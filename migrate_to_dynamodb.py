"""
Migration Script: Load all JSON data into DynamoDB
This script creates DynamoDB tables and migrates all JSON files:
- logs.json -> logs-table
- metrics.json -> metrics-table
- employees.json -> employees-table
- admins.json -> admins-table
- tickets.json -> tickets-table
"""
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from mcp.monitor.dynamodb_client import migrate_json_to_dynamodb

if __name__ == "__main__":
    print("=" * 60)
    print("DynamoDB Migration Script - All JSON Data")
    print("=" * 60)
    print("")
    print("This script will:")
    print("1. Create DynamoDB tables (logs, metrics, employees, admins, tickets)")
    print("2. Load data from JSON files")
    print("3. Insert all data into DynamoDB")
    print("")
    print("Files to migrate:")
    print("  - logs.json -> logs-table")
    print("  - metrics.json -> metrics-table")
    print("  - employees.json -> employees-table")
    print("  - admins.json -> admins-table")
    print("  - tickets.json -> tickets-table")
    print("")
    
    # Run migration
    results = migrate_json_to_dynamodb()
    
    # Exit with error code if there were errors
    if results["errors"]:
        sys.exit(1)
    else:
        print("\n✓ Migration completed successfully!")
        sys.exit(0)

