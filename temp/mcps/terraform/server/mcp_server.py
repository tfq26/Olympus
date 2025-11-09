import subprocess
import json
import os
import sys
import logging
from mcp.server.fastmcp import FastMCP

# ----------------------------------------------------------------------
# ✅ Setup logging (only to stderr, so stdout stays clean for MCP)
# ----------------------------------------------------------------------
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

mcp = FastMCP("terraform")

# ----------------------------------------------------------------------
# Terraform Directories
# ----------------------------------------------------------------------
TERRAFORM_BASE_DIR = "/app/server/terraform"
TERRAFORM_EC2_DIR = os.path.join(TERRAFORM_BASE_DIR, "ec2")
TERRAFORM_S3_DIR = os.path.join(TERRAFORM_BASE_DIR, "s3")
TERRAFORM_LAMBDA_DIR = os.path.join(TERRAFORM_BASE_DIR, "lambda")

# ----------------------------------------------------------------------
# Helper functions
# ----------------------------------------------------------------------
def tf(args: list[str], working_dir: str) -> str:
    """Execute terraform command in the specified directory"""
    logging.info(f"Running Terraform command: {' '.join(args)} in {working_dir}")
    result = subprocess.run(args, cwd=working_dir, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(result.stderr)
    return result.stdout

def tf_with_output(args: list[str], working_dir: str) -> str:
    """Execute terraform command and return both stdout and stderr"""
    logging.info(f"Running Terraform command: {' '.join(args)} in {working_dir}")
    result = subprocess.run(args, cwd=working_dir, capture_output=True, text=True)
    return result.stdout + result.stderr

# ----------------------------------------------------------------------
# EC2 Tools
# ----------------------------------------------------------------------
@mcp.tool()
def create_ec2_instance(auto_approve: bool = True) -> str:
    """Create an EC2 instance using Terraform."""
    init_output = tf_with_output(["terraform", "init", "-input=false"], TERRAFORM_EC2_DIR)
    plan_output = tf_with_output(["terraform", "plan"], TERRAFORM_EC2_DIR)
    apply_cmd = ["terraform", "apply"]
    if auto_approve:
        apply_cmd.append("-auto-approve")
    apply_output = tf_with_output(apply_cmd, TERRAFORM_EC2_DIR)
    output = tf_with_output(["terraform", "output", "-json"], TERRAFORM_EC2_DIR)
    return f"INIT:\n{init_output}\nPLAN:\n{plan_output}\nAPPLY:\n{apply_output}\nOUTPUTS:\n{output}"

@mcp.tool()
def createEC2(command: str, var_file: str = None, auto_approve: bool = False) -> str:
    """Execute individual Terraform commands for EC2."""
    cmd = ["terraform", command]
    if command in ["plan", "apply"] and var_file:
        cmd.extend(["-var-file", var_file])
    if command == "apply" and auto_approve:
        cmd.append("-auto-approve")
    return tf_with_output(cmd, TERRAFORM_EC2_DIR)

@mcp.tool()
def destroy_ec2() -> str:
    """Destroy EC2 instance"""
    return tf_with_output(["terraform", "destroy", "-auto-approve"], TERRAFORM_EC2_DIR)

# ----------------------------------------------------------------------
# S3 Tools
# ----------------------------------------------------------------------
@mcp.tool()
def create_s3_bucket(bucket_name: str, aws_region: str = "us-east-1", auto_approve: bool = True) -> str:
    """Create an S3 bucket using Terraform."""
    logging.info(f"Creating S3 bucket: {bucket_name} in {aws_region}")
    init_output = tf_with_output(["terraform", "init", "-input=false"], TERRAFORM_S3_DIR)
    cmd = [
        "terraform", "apply",
        "-var", f"bucket_name={bucket_name}",
        "-var", f"aws_region={aws_region}",
    ]
    if auto_approve:
        cmd.append("-auto-approve")
    apply_output = tf_with_output(cmd, TERRAFORM_S3_DIR)
    output = tf_with_output(["terraform", "output", "-json"], TERRAFORM_S3_DIR)
    return f"{init_output}\n{apply_output}\nOutputs:\n{output}"

@mcp.tool()
def destroy_s3_bucket(bucket_name: str, auto_approve: bool = True) -> str:
    """Safely destroy an S3 bucket via Terraform."""
    logging.info(f"Destroy request received for bucket: {bucket_name}")
    os.chdir(TERRAFORM_S3_DIR)

    # Verify credentials
    if not os.getenv("AWS_ACCESS_KEY_ID"):
        raise Exception("❌ Missing AWS credentials in environment. Please export them first.")

    # Check if bucket exists
    logging.info(f"Checking if bucket {bucket_name} exists in AWS...")
    check_cmd = ["aws", "s3api", "head-bucket", "--bucket", bucket_name]
    exists = subprocess.run(check_cmd, capture_output=True, text=True)
    if exists.returncode != 0:
        logging.warning(f"Bucket {bucket_name} not found in AWS.")
        return f"✅ Bucket {bucket_name} does not exist or was already deleted."

    # Init Terraform
    logging.info("Initializing Terraform...")
    subprocess.run(["terraform", "init", "-input=false"], check=True)

    # Import bucket if not in state
    logging.info("Checking Terraform state for existing resource...")
    state_check = subprocess.run(["terraform", "state", "list"], capture_output=True, text=True)
    if "aws_s3_bucket.bucket" not in state_check.stdout:
        logging.info("No state found — importing bucket...")
        subprocess.run(["terraform", "import", "aws_s3_bucket.bucket", bucket_name], check=True)

    # Empty bucket
    logging.info("Emptying bucket before destroy...")
    subprocess.run(["aws", "s3", "rm", f"s3://{bucket_name}", "--recursive"], check=False)

    # Destroy bucket
    destroy_cmd = ["terraform", "destroy"]
    if auto_approve:
        destroy_cmd.append("-auto-approve")
    logging.info(f"Executing: {' '.join(destroy_cmd)}")

    destroy_result = subprocess.run(destroy_cmd, capture_output=True, text=True)
    if destroy_result.returncode == 0:
        logging.info(f"✅ Successfully destroyed S3 bucket {bucket_name}")
    else:
        logging.error(f"❌ Terraform destroy failed:\n{destroy_result.stderr}")

    return destroy_result.stdout + destroy_result.stderr

# ----------------------------------------------------------------------
# Lambda Tools
# ----------------------------------------------------------------------
@mcp.tool()
def create_lambda_function(function_name: str, aws_region: str = "us-east-1", source_code: str = None, auto_approve: bool = True) -> str:
    """Create a Lambda function using Terraform."""
    if source_code is None:
        source_code = "def handler(event, context):\n    return {'statusCode': 200, 'body': 'Hello from Lambda!'}"
    init_output = tf_with_output(["terraform", "init", "-input=false"], TERRAFORM_LAMBDA_DIR)
    tfvars_file = os.path.join(TERRAFORM_LAMBDA_DIR, "terraform.tfvars")
    with open(tfvars_file, 'w') as f:
        f.write(f'function_name = "{function_name}"\n')
        f.write(f'aws_region = "{aws_region}"\n')
        f.write('source_code = <<-EOT\n')
        f.write(source_code)
        f.write('\nEOT\n')
    try:
        cmd = ["terraform", "apply", "-var-file", "terraform.tfvars"]
        if auto_approve:
            cmd.append("-auto-approve")
        apply_output = tf_with_output(cmd, TERRAFORM_LAMBDA_DIR)
        output = tf_with_output(["terraform", "output", "-json"], TERRAFORM_LAMBDA_DIR)
        return f"{init_output}\n{apply_output}\nOutputs:\n{output}"
    finally:
        if os.path.exists(tfvars_file):
            os.remove(tfvars_file)

@mcp.tool()
def destroy_lambda_function(auto_approve: bool = True) -> str:
    """Destroy Lambda function."""
    cmd = ["terraform", "destroy"]
    if auto_approve:
        cmd.append("-auto-approve")
    return tf_with_output(cmd, TERRAFORM_LAMBDA_DIR)

# ----------------------------------------------------------------------
# MCP Entry Point
# ----------------------------------------------------------------------
if __name__ == "__main__":
    # Flush any accidental stdout
    sys.stdout.flush()
    sys.stderr.flush()

    logging.info("✅ Terraform MCP server starting (no stdout interference)...")

    # Run the MCP server (no prints, only clean JSON output)
    mcp.run()
