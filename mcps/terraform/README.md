# Terraform MCP Server - Local Setup

This MCP server provides Terraform operations for AWS resources (EC2, S3, Lambda) through VS Code Copilot.

## Prerequisites

### 1. Install Terraform
- **macOS**: `brew install terraform`
- **Linux**: Download from [terraform.io](https://www.terraform.io/downloads)
- **Windows**: Use Chocolatey `choco install terraform` or download binary

Verify installation:
```bash
terraform --version
```

### 2. Install Python Dependencies
```bash
cd mcps/terraform
pip install -r requirements.txt
```

Or use a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure AWS Credentials
The MCP server uses your local AWS credentials. Set them up via:
- AWS CLI: `aws configure`
- Or set environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- Or use `.env` file in the project root

## VS Code Configuration

The `.vscode/mcp.json` is already configured to run the server locally:

```json
{
  "servers": {
    "terraform": {
      "command": "python",
      "args": ["${workspaceFolder}/mcps/terraform/server/mcp_server.py"],
      "type": "stdio"
    }
  }
}
```

## Directory Structure

```
mcps/terraform/
├── server/
│   ├── mcp_server.py          # Main MCP server
│   └── terraform/
│       ├── ec2/
│       │   └── main.tf        # EC2 instance config
│       ├── s3/
│       │   └── main.tf        # S3 bucket config
│       └── lambda/
│           └── main.tf        # Lambda function config
├── requirements.txt
└── README.md
```

## State Management

Terraform state files are stored locally in each subdirectory:
- `server/terraform/ec2/terraform.tfstate`
- `server/terraform/s3/terraform.tfstate`
- `server/terraform/lambda/terraform.tfstate`

These files persist between operations, allowing proper create/destroy cycles.

## Available Tools

### S3 Operations
- `create_s3_bucket(bucket_name, aws_region="us-east-1", auto_approve=True)`
- `destroy_s3_bucket(auto_approve=True)`

### EC2 Operations
- `create_ec2_instance(auto_approve=True)`
- `destroy_ec2()`

### Lambda Operations
- `create_lambda_function(function_name, aws_region="us-east-1", source_code_file=None, source_code=None, handler="lambda_function.handler", auto_approve=True)`
- `destroy_lambda_function(auto_approve=True)`

## Troubleshooting

### "terraform: command not found"
Ensure Terraform is installed and in your PATH.

### "ModuleNotFoundError: No module named 'mcp'"
Install dependencies: `pip install -r requirements.txt`

### AWS credential errors
Run `aws configure` or verify your `.env` file contains valid credentials.

### State file issues
If destroy fails, check that the corresponding `terraform.tfstate` file exists in the resource directory.

## Usage Example

Via VS Code Copilot:
```
@workspace create an S3 bucket called my-unique-bucket-name
@workspace destroy the S3 bucket
@workspace create an EC2 instance
@workspace create a Lambda function with custom code
```

The MCP server will handle the Terraform operations automatically.
