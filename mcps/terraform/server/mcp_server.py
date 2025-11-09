import subprocess
import json
import os
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("terraform")
TERRAFORM_BASE_DIR = "/app/server/terraform"
TERRAFORM_EC2_DIR = "/app/server/terraform/ec2"
TERRAFORM_S3_DIR = "/app/server/terraform/s3"
TERRAFORM_LAMBDA_DIR = "/app/server/terraform/lambda"

def tf(args: list[str], working_dir: str) -> str:
    """Execute terraform command in the specified directory"""
    result = subprocess.run(args, cwd=working_dir, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(result.stderr)
    return result.stdout

def tf_with_output(args: list[str], working_dir: str) -> str:
    """Execute terraform command and return both stdout and stderr"""
    result = subprocess.run(args, cwd=working_dir, capture_output=True, text=True)
    return result.stdout + result.stderr

# EC2 Tools
@mcp.tool()
def create_ec2_instance(auto_approve: bool = True) -> str:
    """
    Create an EC2 instance using Terraform. Automatically runs init, plan, and apply in order.
    
    Args:
        auto_approve: Skip interactive approval for apply (default: True)
    
    Returns:
        The output from terraform including instance details
    """
    # Step 1: Init
    init_output = tf_with_output(["terraform", "init", "-input=false"], TERRAFORM_EC2_DIR)
    
    # Step 2: Plan
    plan_output = tf_with_output(["terraform", "plan"], TERRAFORM_EC2_DIR)
    
    # Step 3: Apply
    apply_cmd = ["terraform", "apply"]
    if auto_approve:
        apply_cmd.append("-auto-approve")
    apply_output = tf_with_output(apply_cmd, TERRAFORM_EC2_DIR)
    
    # Get outputs
    output = tf_with_output(["terraform", "output", "-json"], TERRAFORM_EC2_DIR)
    
    return f"INIT:\n{init_output}\n\nPLAN:\n{plan_output}\n\nAPPLY:\n{apply_output}\n\nOUTPUTS:\n{output}"

@mcp.tool()
def createEC2(command: str, var_file: str = None, auto_approve: bool = False) -> str:
    """
    Execute individual Terraform commands for EC2 (init, plan, apply).
    For creating an instance from scratch, use create_ec2_instance() instead.
    
    Args:
        command: The terraform command to run (init, plan, or apply)
        var_file: Optional path to a variable file (for plan/apply)
        auto_approve: If True, skip interactive approval for apply (default: False)
    
    Returns:
        The output from the terraform command
    """
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

# S3 Tools
@mcp.tool()
def create_s3_bucket(
    bucket_name: str,
    aws_region: str = "us-east-1",
    auto_approve: bool = True
) -> str:
    """
    Create an S3 bucket using Terraform.
    
    Args:
        bucket_name: Name of the S3 bucket (must be globally unique)
        aws_region: AWS region for the bucket (default: us-east-1)
        auto_approve: Skip interactive approval (default: True)
    
    Returns:
        The output from terraform apply including bucket details
    """
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
    
    return f"{init_output}\n{apply_output}\n\nOutputs:\n{output}"

@mcp.tool()
def destroy_s3_bucket(auto_approve: bool = True) -> str:
    """
    Destroy the S3 bucket created by Terraform.
    
    Args:
        auto_approve: Skip interactive approval (default: True)
    
    Returns:
        The output from terraform destroy
    """
    cmd = ["terraform", "destroy"]
    if auto_approve:
        cmd.append("-auto-approve")
    
    return tf_with_output(cmd, TERRAFORM_S3_DIR)

# Lambda Tools
@mcp.tool()
def create_lambda_function(
    function_name: str,
    aws_region: str = "us-east-1",
    source_code_file: str | None = None,
    source_code: str | None = None,
    handler: str = "lambda_function.handler",
    auto_approve: bool = True
) -> str:
    """
    Create a Lambda function using Terraform.
    
    Args:
        function_name: Name of the Lambda function
        aws_region: AWS region for the function (default: us-east-1)
        source_code_file: Path to a Python file with the Lambda code. If provided, used directly.
        source_code: Inline source code string. If provided, written to a temp file and used.
        handler: Lambda handler in module.function format. Defaults to "lambda_function.handler"
        auto_approve: Skip interactive approval (default: True)
    
    Returns:
        The output from terraform apply including function details
    """
    # Determine source code strategy
    created_temp_file = False
    temp_filename = None
    default_file_path = os.path.join(TERRAFORM_LAMBDA_DIR, "lambda_function.py")

    if source_code_file and source_code:
        raise ValueError("Provide either source_code_file or source_code, not both.")

    if source_code:
        # Write inline source to a temp file inside lambda module directory
        temp_filename = "_inline_lambda.py"
        temp_path = os.path.join(TERRAFORM_LAMBDA_DIR, temp_filename)
        with open(temp_path, 'w') as f:
            f.write(source_code.rstrip("\n") + "\n")
        source_code_file = temp_filename
        created_temp_file = True
        # If handler still default, adjust to match module name
        if handler == "lambda_function.handler":
            handler = "_inline_lambda.handler"
    elif source_code_file is None:
        # Generate a default minimal handler file if none specified
        if not os.path.exists(default_file_path):
            with open(default_file_path, 'w') as f:
                f.write("def handler(event, context):\n    return {'statusCode': 200, 'body': 'Hello from Lambda!'}\n")
            created_temp_file = True
            temp_filename = "lambda_function.py"
        source_code_file = "lambda_function.py"  # relative reference
    
    init_output = tf_with_output(["terraform", "init", "-input=false"], TERRAFORM_LAMBDA_DIR)
    
    tfvars_file = os.path.join(TERRAFORM_LAMBDA_DIR, "terraform.tfvars")
    with open(tfvars_file, 'w') as f:
        f.write(f'function_name = "{function_name}"\n')
        f.write(f'aws_region = "{aws_region}"\n')
        # If the provided path is absolute, write it as-is; otherwise treat as relative to module dir
        f.write(f'source_code_file = "{source_code_file}"\n')
        f.write(f'handler = "{handler}"\n')
    
    try:
        cmd = ["terraform", "apply", "-var-file", "terraform.tfvars"]
        if auto_approve:
            cmd.append("-auto-approve")
        
        apply_output = tf_with_output(cmd, TERRAFORM_LAMBDA_DIR)
        output = tf_with_output(["terraform", "output", "-json"], TERRAFORM_LAMBDA_DIR)
        
        return f"{init_output}\n{apply_output}\n\nOutputs:\n{output}"
    finally:
        if os.path.exists(tfvars_file):
            os.remove(tfvars_file)
        # Clean up the default file only if we created it here
        if created_temp_file:
            # Remove whichever temp file we created
            try:
                if temp_filename:
                    temp_path = os.path.join(TERRAFORM_LAMBDA_DIR, temp_filename)
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                elif os.path.exists(default_file_path):
                    os.remove(default_file_path)
            except Exception:
                pass

@mcp.tool()
def destroy_lambda_function(auto_approve: bool = True) -> str:
    """
    Destroy the Lambda function created by Terraform.
    
    Args:
        auto_approve: Skip interactive approval (default: True)
    
    Returns:
        The output from terraform destroy
    """
    cmd = ["terraform", "destroy"]
    if auto_approve:
        cmd.append("-auto-approve")
    
    return tf_with_output(cmd, TERRAFORM_LAMBDA_DIR)

if __name__ == "__main__":
    mcp.run()


