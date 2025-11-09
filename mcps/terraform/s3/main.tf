terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "bucket_name" {
  description = "Name of the S3 bucket (used when bucket_count is 1)"
  type        = string
  default     = ""
}

variable "bucket_name_prefix" {
  description = "Prefix for bucket names when creating multiple buckets"
  type        = string
  default     = ""
}

variable "bucket_count" {
  description = "Number of S3 buckets to create"
  type        = number
  default     = 1
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
  count  = var.bucket_count
  bucket = var.bucket_count > 1 ? "${var.bucket_name_prefix}-${count.index + 1}" : coalesce(var.bucket_name, "${var.bucket_name_prefix}-1")

  tags = {
    Name = var.bucket_count > 1 ? "${var.bucket_name_prefix}-${count.index + 1}" : coalesce(var.bucket_name, "${var.bucket_name_prefix}-1")
  }
}

output "bucket_name" {
  value = [for b in aws_s3_bucket.bucket : b.id]
}

output "bucket_arn" {
  value = [for b in aws_s3_bucket.bucket : b.arn]
}

output "bucket_region" {
  value = [for b in aws_s3_bucket.bucket : b.region]
}