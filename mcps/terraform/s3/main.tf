terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "bucket_name" {
  description = "Name of the S3 bucket"
  type        = string
}

variable "aws_region" {
  description = "AWS region for the bucket"
  type        = string
  default     = "us-east-1"
}

provider "aws" {
  region = var.aws_region
}

resource "aws_s3_bucket" "bucket" {
  bucket = var.bucket_name

  tags = {
    Name = var.bucket_name
  }
}

output "bucket_name" {
  value = aws_s3_bucket.bucket.id
}

output "bucket_arn" {
  value = aws_s3_bucket.bucket.arn
}

output "bucket_region" {
  value = aws_s3_bucket.bucket.region
}