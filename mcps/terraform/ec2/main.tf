terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

variable "instance_count" {
  description = "Number of EC2 instances to create"
  type        = number
  default     = 1
}

variable "instance_name_prefix" {
  description = "Name prefix for EC2 instances"
  type        = string
  default     = "mcp-demo-instance"
}

// Backward-compat for legacy var name
variable "name_prefix" {
  description = "Legacy name prefix variable (deprecated)"
  type        = string
  default     = null
}

resource "aws_instance" "demo" {
  count         = var.instance_count
  ami           = "ami-0c02fb55956c7d316" # Amazon Linux 2 (us-east-1)
  instance_type = "t3.micro"

  tags = {
    Name = "${coalesce(var.instance_name_prefix, var.name_prefix, "mcp-demo-instance")}-${count.index + 1}"
  }
}

output "instance_ids" {
  value = [for i in aws_instance.demo : i.id]
}

output "public_ips" {
  value = [for i in aws_instance.demo : i.public_ip]
}
