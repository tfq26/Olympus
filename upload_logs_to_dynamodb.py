#!/usr/bin/env python3
"""
Upload logs from logs.json to DynamoDB
This script will:
1. Create the DynamoDB table if it doesn't exist
2. Clear existing logs (optional)
3. Upload all logs from logs.json to DynamoDB
"""

import sys
from pathlib import Path

# Add the project root to the path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from mcp.monitor.dynamodb_client import (
    create_tables,
    batch_insert_logs,
    get_all_logs
)
import json
import time

def upload_logs(logs_file_path=None, clear_existing=False):
    """
    Upload logs from logs.json to DynamoDB
    
    Args:
        logs_file_path: Path to logs.json file (optional, defaults to project root)
        clear_existing: If True, delete all existing logs before uploading (optional)
    """
    # Use default path if not provided
    if logs_file_path is None:
        logs_file_path = project_root / "logs.json"
    else:
        logs_file_path = Path(logs_file_path)
    
    if not logs_file_path.exists():
        print(f"❌ Error: logs.json not found at {logs_file_path}")
        return False
    
    print("=" * 60)
    print("Uploading Logs to DynamoDB")
    print("=" * 60)
    
    # Step 1: Create tables if they don't exist
    print("\n📦 Step 1: Creating DynamoDB tables...")
    try:
        table_results = create_tables()
        if table_results["logs_table_created"]:
            print("✓ Logs table ready")
        else:
            print("⚠️  Logs table creation failed or already exists")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False
    
    # Wait for table to be ready
    print("Waiting for table to be ready...")
    time.sleep(3)
    
    # Step 2: Load logs from JSON
    print(f"\n📖 Step 2: Loading logs from {logs_file_path}...")
    try:
        with open(logs_file_path, 'r') as f:
            data = json.load(f)
            logs = data.get("logs", [])
            
        if not logs:
            print("❌ No logs found in logs.json")
            return False
        
        print(f"✓ Found {len(logs)} logs to upload")
    except Exception as e:
        print(f"❌ Error loading logs.json: {e}")
        return False
    
    # Step 3: Clear existing logs (optional)
    if clear_existing:
        print("\n🗑️  Step 3: Clearing existing logs...")
        try:
            # Get all existing logs
            existing_logs = get_all_logs()
            if existing_logs:
                print(f"  Found {len(existing_logs)} existing logs")
                # Note: DynamoDB doesn't have a simple "delete all" operation
                # You would need to delete items one by one or use a script
                print("  ⚠️  Clearing existing logs requires manual deletion")
                print("  ⚠️  Skipping clear step - new logs will be added")
            else:
                print("  ✓ No existing logs to clear")
        except Exception as e:
            print(f"  ⚠️  Could not check existing logs: {e}")
            print("  Continuing with upload...")
    
    # Step 4: Upload logs to DynamoDB
    print(f"\n⬆️  Step 4: Uploading {len(logs)} logs to DynamoDB...")
    print("  This may take a while for large files...")
    
    try:
        start_time = time.time()
        inserted_count = batch_insert_logs(logs)
        elapsed_time = time.time() - start_time
        
        print(f"\n✓ Successfully uploaded {inserted_count} logs to DynamoDB")
        print(f"  Time taken: {elapsed_time:.2f} seconds")
        print(f"  Rate: {inserted_count / elapsed_time:.2f} logs/second")
        
        if inserted_count < len(logs):
            print(f"  ⚠️  Warning: {len(logs) - inserted_count} logs failed to upload")
        
        return True
    except Exception as e:
        print(f"❌ Error uploading logs: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Upload logs from logs.json to DynamoDB")
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Path to logs.json file (default: ./logs.json)"
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear existing logs before uploading (requires manual implementation)"
    )
    
    args = parser.parse_args()
    
    success = upload_logs(
        logs_file_path=args.file,
        clear_existing=args.clear
    )
    
    if success:
        print("\n" + "=" * 60)
        print("✅ Upload completed successfully!")
        print("=" * 60)
        print("\nYour logs are now available in DynamoDB and can be accessed via:")
        print("  - Flask backend: GET /monitor/mock/logs?resource_id=<id>")
        print("  - Frontend: Ask chatbot 'Show recent logs from <resource>'")
        sys.exit(0)
    else:
        print("\n" + "=" * 60)
        print("❌ Upload failed!")
        print("=" * 60)
        sys.exit(1)

