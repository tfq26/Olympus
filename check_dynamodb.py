#!/usr/bin/env python3
"""
Check DynamoDB connection and table status
"""

import sys
from pathlib import Path

# Add the project root to the path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from mcp.monitor.dynamodb_client import (
    logs_table,
    metrics_table,
    get_all_logs,
    get_all_resources
)

def check_dynamodb():
    """Check DynamoDB connection and tables"""
    print("=" * 60)
    print("DynamoDB Connection Check")
    print("=" * 60)
    
    # Check logs table
    print("\n📊 Logs Table:")
    if logs_table is None:
        print("  ❌ Logs table not initialized")
        print("  💡 Make sure DYNAMODB_TABLE_LOGS is set in .env")
        print("  💡 Or run: python upload_logs_to_dynamodb.py")
    else:
        print(f"  ✓ Logs table: {logs_table.table_name}")
        try:
            logs = get_all_logs()
            if logs is not None:
                print(f"  ✓ Found {len(logs)} logs in DynamoDB")
            else:
                print("  ⚠️  Table exists but no logs found (or error reading)")
        except Exception as e:
            print(f"  ❌ Error reading logs: {e}")
    
    # Check metrics table
    print("\n📈 Metrics Table:")
    if metrics_table is None:
        print("  ❌ Metrics table not initialized")
        print("  💡 Make sure DYNAMODB_TABLE_METRICS is set in .env")
    else:
        print(f"  ✓ Metrics table: {metrics_table.table_name}")
        try:
            resources = get_all_resources()
            if resources is not None:
                print(f"  ✓ Found {len(resources)} resources in DynamoDB")
            else:
                print("  ⚠️  Table exists but no resources found (or error reading)")
        except Exception as e:
            print(f"  ❌ Error reading resources: {e}")
    
    print("\n" + "=" * 60)
    print("Check complete!")
    print("=" * 60)

if __name__ == "__main__":
    check_dynamodb()

