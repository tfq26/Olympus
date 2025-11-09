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
	description = "Name of the Lambda function (used when function_count is 1)"
	type        = string
	default     = ""
}

variable "function_name_prefix" {
	description = "Prefix for function names when creating multiple functions"
	type        = string
	default     = ""
}

variable "function_count" {
	description = "Number of Lambda functions to create"
	type        = number
	default     = 1
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
	count = var.function_count
	name = var.function_count > 1 ? "${var.function_name_prefix}-${count.index + 1}-exec-role" : "${coalesce(var.function_name, "${var.function_name_prefix}-1")}-exec-role"
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
	count      = var.function_count
	role       = aws_iam_role.lambda_exec[count.index].name
	policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "this" {
	count         = var.function_count
	function_name = var.function_count > 1 ? "${var.function_name_prefix}-${count.index + 1}" : coalesce(var.function_name, "${var.function_name_prefix}-1")
	role          = aws_iam_role.lambda_exec[count.index].arn
	handler       = var.handler
	runtime       = "python3.11"
	filename      = data.archive_file.lambda_zip.output_path
	publish       = true

	depends_on = [aws_iam_role_policy_attachment.basic_logs]
}

output "function_name" {
	value = [for f in aws_lambda_function.this : f.function_name]
}

output "function_arn" {
	value = [for f in aws_lambda_function.this : f.arn]
}

output "function_region" {
	value = var.aws_region
}

 