terraform {
	required_providers {
		aws = {
			source  = "hashicorp/aws"
			version = "~> 5.0"
		}
		archive = {
			source  = "hashicorp/archive"
			version = "~> 2.0"
		}
	}
}

variable "function_name" {
	description = "Name of the Lambda function"
	type        = string
}

variable "aws_region" {
	description = "AWS region for the function"
	type        = string
	default     = "us-east-1"
}

variable "source_code_file" {
	description = "Path to the Python source file for the Lambda function (relative to this module or absolute)"
	type        = string
}

variable "handler" {
	description = "Lambda handler (e.g., 'lambda_function.handler')"
	type        = string
	default     = "lambda_function.handler"
}

provider "aws" {
	region = var.aws_region
}

data "archive_file" "lambda_zip" {
	type        = "zip"
	source_file = var.source_code_file
	output_path = "${path.module}/lambda.zip"
}

resource "aws_iam_role" "lambda_exec" {
	name = "${var.function_name}-exec-role"
	assume_role_policy = jsonencode({
		Version = "2012-10-17"
		Statement = [{
			Action    = "sts:AssumeRole"
			Effect    = "Allow"
			Principal = { Service = "lambda.amazonaws.com" }
		}]
	})
}

resource "aws_iam_role_policy_attachment" "basic_logs" {
	role       = aws_iam_role.lambda_exec.name
	policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "this" {
	function_name = var.function_name
	role          = aws_iam_role.lambda_exec.arn
	handler       = var.handler
	runtime       = "python3.11"
	filename      = data.archive_file.lambda_zip.output_path
	publish       = true

	depends_on = [aws_iam_role_policy_attachment.basic_logs]
}

output "function_name" {
	value = aws_lambda_function.this.function_name
}

output "function_arn" {
	value = aws_lambda_function.this.arn
}

output "function_region" {
	value = var.aws_region
}

 