"""
Migration Script: Load logs.json into DynamoDB
This script creates DynamoDB table and migrates logs from JSON file
Note: Only logs are stored in DynamoDB (metrics removed)
"""
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from mcp.monitor.dynamodb_client import migrate_json_to_dynamodb

if __name__ == "__main__":
    print("=" * 60)
    print("DynamoDB Migration Script - Logs Only")
    print("=" * 60)
    print("")
    print("This script will:")
    print("1. Create DynamoDB table (logs-table)")
    print("2. Load data from logs.json")
    print("3. Insert logs into DynamoDB")
    print("")
    print("Note: Metrics are not stored in DynamoDB (using JSON fallback)")
    print("")
    
    # Run migration
    results = migrate_json_to_dynamodb()
    
    # Exit with error code if there were errors
    if results["errors"]:
        sys.exit(1)
    else:
        print("\n✓ Migration completed successfully!")
        sys.exit(0)

