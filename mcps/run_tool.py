#!/usr/bin/env python3
import argparse
import json
import sys
import os

# Import the tool functions from the MCP server module
from mcp_server import (
    ping as mcp_ping,
    create_s3_bucket,
    destroy_s3_bucket,
    create_ec2_instance,
    destroy_ec2,
    create_lambda_function,
    destroy_lambda_function,
)


def _print(obj):
    if isinstance(obj, (dict, list)):
        print(json.dumps(obj))
    else:
        # Many tool functions return plain text; keep as-is
        print(obj)


def main():
    parser = argparse.ArgumentParser(description="Run Terraform MCP tools via CLI wrapper")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Ping
    subparsers.add_parser("ping")

    # S3
    s3_create = subparsers.add_parser("s3.create")
    s3_create.add_argument("--bucket_name", required=True)
    s3_create.add_argument("--aws_region", default="us-east-1")
    s3_destroy = subparsers.add_parser("s3.destroy")
    s3_destroy.add_argument("--bucket_name", required=True)
    s3_destroy.add_argument("--auto_approve", default="true")

    # EC2
    ec2_create = subparsers.add_parser("ec2.create")
    ec2_create.add_argument("--auto_approve", default="true")
    subparsers.add_parser("ec2.destroy")

    # Lambda
    lam_create = subparsers.add_parser("lambda.create")
    lam_create.add_argument("--function_name", required=True)
    lam_create.add_argument("--aws_region", default="us-east-1")
    lam_create.add_argument("--source_code", default=None)
    lam_destroy = subparsers.add_parser("lambda.destroy")
    lam_destroy.add_argument("--auto_approve", default="true")

    args = parser.parse_args()

    try:
        if args.command == "ping":
            _print(mcp_ping())
            return 0

        if args.command == "s3.create":
            out = create_s3_bucket(bucket_name=args.bucket_name, aws_region=args.aws_region, auto_approve=True)
            _print(out)
            return 0

        if args.command == "s3.destroy":
            auto = str(args.auto_approve).lower() == "true"
            out = destroy_s3_bucket(bucket_name=args.bucket_name, auto_approve=auto)
            _print(out)
            return 0

        if args.command == "ec2.create":
            auto = str(args.auto_approve).lower() == "true"
            out = create_ec2_instance(auto_approve=auto)
            _print(out)
            return 0

        if args.command == "ec2.destroy":
            out = destroy_ec2()
            _print(out)
            return 0

        if args.command == "lambda.create":
            out = create_lambda_function(
                function_name=args.function_name,
                aws_region=args.aws_region,
                source_code=args.source_code,
                auto_approve=True,
            )
            _print(out)
            return 0

        if args.command == "lambda.destroy":
            auto = str(args.auto_approve).lower() == "true"
            out = destroy_lambda_function(auto_approve=auto)
            _print(out)
            return 0

        print(json.dumps({"error": f"Unknown command {args.command}"}))
        return 2
    except Exception as e:
        # Print as JSON error to make it easy for callers to parse
        print(json.dumps({"error": str(e)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
