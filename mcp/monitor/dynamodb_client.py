"""
DynamoDB Client Module
Handles all DynamoDB operations for storing and querying logs and metrics
Uses boto3 DynamoDB resource API for simplified operations
"""
import boto3
import os
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
project_root = Path(__file__).parent.parent.parent
env_file = project_root / ".env"
load_dotenv(dotenv_path=env_file)

# DynamoDB configuration from environment variables
DYNAMODB_REGION = os.getenv("DYNAMODB_REGION", "us-east-1")
LOGS_TABLE_NAME = os.getenv("DYNAMODB_TABLE_LOGS", "logs-table")
METRICS_TABLE_NAME = os.getenv("DYNAMODB_TABLE_METRICS", "metrics-table")

# Initialize DynamoDB resource (simpler API than client)
try:
    dynamodb_resource = boto3.resource("dynamodb", region_name=DYNAMODB_REGION)
    # Get table references (will be None if tables don't exist)
    logs_table = dynamodb_resource.Table(LOGS_TABLE_NAME) if LOGS_TABLE_NAME else None
    metrics_table = dynamodb_resource.Table(METRICS_TABLE_NAME) if METRICS_TABLE_NAME else None
except Exception as e:
    # If DynamoDB initialization fails, set tables to None (will fall back to JSON)
    logs_table = None
    metrics_table = None


def insert_log(log_data):
    """
    Insert a single log entry into DynamoDB
    Maps JSON fields to table schema: id -> log_id, time -> timestamp
    Args: log_data - Dictionary containing log data (entire JSON object)
    Returns: True if successful, False otherwise
    """
    try:
        if not logs_table:
            return False
        
        # Map JSON fields to table schema
        item = log_data.copy()
        
        # Map "id" to "log_id" for partition key
        if "id" in item:
            item["log_id"] = item.pop("id")
        
        # Map "time" to "timestamp" for sort key
        if "time" in item:
            item["timestamp"] = item.pop("time")
        
        # Store the item with mapped keys
        logs_table.put_item(Item=item)
        
        return True
    except Exception as e:
        print(f"Error inserting log: {e}")
        return False


def batch_insert_logs(logs_list):
    """
    Batch insert logs into DynamoDB
    Maps JSON fields to table schema: id -> log_id, time -> timestamp
    Args: logs_list - List of log dictionaries (entire JSON objects)
    Returns: Number of successfully inserted logs
    Note: Table requires log_id (partition key) and timestamp (sort key)
    """
    if not logs_table:
        return 0
    
    inserted_count = 0
    failed_count = 0
    
    try:
        # Table schema requires: log_id (PK) and timestamp (SK)
        # JSON has: id and time - need to map them
        with logs_table.batch_writer() as batch:
            for log in logs_list:
                try:
                    # Map JSON fields to table schema
                    item = log.copy()
                    
                    # Map "id" to "log_id" for partition key
                    if "id" in item:
                        item["log_id"] = item.pop("id")
                    
                    # Map "time" to "timestamp" for sort key
                    if "time" in item:
                        item["timestamp"] = item.pop("time")
                    
                    # Keep all other fields as-is (customer_name, status, resources_affected, etc.)
                    # Store the item with mapped keys
                    batch.put_item(Item=item)
                    inserted_count += 1
                except Exception as e:
                    failed_count += 1
                    if failed_count <= 5:  # Only print first 5 errors
                        print(f"  Error inserting log {log.get('id', 'unknown')}: {e}")
        
        if failed_count > 0:
            print(f"  Warning: {failed_count} logs failed to insert")
        
        return inserted_count
    except Exception as e:
        print(f"Error in batch insert logs: {e}")
        return inserted_count


def insert_resource(resource_data):
    """
    Insert a single resource into DynamoDB (store JSON as-is)
    Args: resource_data - Dictionary containing resource data (entire JSON object)
    Returns: True if successful, False otherwise
    """
    try:
        if not metrics_table:
            return False
        
        # Store the entire JSON object as-is - no transformation
        metrics_table.put_item(Item=resource_data)
        
        return True
    except Exception as e:
        print(f"Error inserting resource: {e}")
        return False


def batch_insert_resources(resources_list):
    """
    Batch insert resources into DynamoDB (store JSON as-is)
    Args: resources_list - List of resource dictionaries (entire JSON objects)
    Returns: Number of successfully inserted resources
    """
    if not metrics_table:
        return 0
    
    inserted_count = 0
    
    try:
        # Store each resource JSON object as-is - no transformation
        with metrics_table.batch_writer() as batch:
            for resource in resources_list:
                # Store the entire resource object as-is
                batch.put_item(Item=resource)
                inserted_count += 1
        
        return inserted_count
    except Exception as e:
        print(f"Error in batch insert resources: {e}")
        return inserted_count


def get_log_by_id(log_id):
    """
    Get a single log by its ID
    Maps table fields back to JSON format: log_id -> id, timestamp -> time
    Args: log_id - The log ID to retrieve
    Returns: Log dictionary (JSON format) or None if not found
    Note: Table uses log_id, but we need to query by it and return JSON format
    """
    try:
        if not logs_table:
            return None
        
        # Query by log_id (need to scan or query since timestamp is also part of key)
        # For simplicity, scan and filter by log_id, then return first match
        response = logs_table.scan(
            FilterExpression="log_id = :log_id",
            ExpressionAttributeValues={":log_id": log_id}
        )
        
        if response.get("Items"):
            # Convert back to JSON format (log_id -> id, timestamp -> time)
            item = response["Items"][0]
            # Map table fields back to JSON format
            if "log_id" in item:
                item["id"] = item.pop("log_id")
            if "timestamp" in item:
                item["time"] = item.pop("timestamp")
            return item
        return None
    except Exception as e:
        print(f"Error getting log by ID: {e}")
        return None


def get_logs_by_customer(customer_name):
    """
    Get all logs for a specific customer (scan and filter)
    Maps table fields back to JSON format: log_id -> id, timestamp -> time
    Args: customer_name - The customer name to query
    Returns: List of log dictionaries (JSON format)
    """
    try:
        if not logs_table:
            return []
        
        logs = []
        
        # Scan table and filter by customer_name
        response = logs_table.scan(
            FilterExpression="customer_name = :customer",
            ExpressionAttributeValues={":customer": customer_name}
        )
        
        for item in response.get("Items", []):
            # Convert table fields back to JSON format
            if "log_id" in item:
                item["id"] = item.pop("log_id")
            if "timestamp" in item:
                item["time"] = item.pop("timestamp")
            logs.append(item)
        
        # Handle pagination
        while "LastEvaluatedKey" in response:
            response = logs_table.scan(
                FilterExpression="customer_name = :customer",
                ExpressionAttributeValues={":customer": customer_name},
                ExclusiveStartKey=response["LastEvaluatedKey"]
            )
            for item in response.get("Items", []):
                # Convert table fields back to JSON format
                if "log_id" in item:
                    item["id"] = item.pop("log_id")
                if "timestamp" in item:
                    item["time"] = item.pop("timestamp")
                logs.append(item)
        
        return logs
    except Exception as e:
        print(f"Error getting logs by customer: {e}")
        return []


def get_logs_by_status(status):
    """
    Get all logs with a specific status (scan and filter)
    Maps table fields back to JSON format: log_id -> id, timestamp -> time
    Args: status - The status to query (OK, ERROR, WARNING, CRITICAL, STALE)
    Returns: List of log dictionaries (JSON format)
    """
    try:
        if not logs_table:
            return []
        
        logs = []
        
        # Scan table and filter by status
        response = logs_table.scan(
            FilterExpression="#status = :status",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":status": status}
        )
        
        for item in response.get("Items", []):
            # Convert table fields back to JSON format
            if "log_id" in item:
                item["id"] = item.pop("log_id")
            if "timestamp" in item:
                item["time"] = item.pop("timestamp")
            logs.append(item)
        
        # Handle pagination
        while "LastEvaluatedKey" in response:
            response = logs_table.scan(
                FilterExpression="#status = :status",
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={":status": status},
                ExclusiveStartKey=response["LastEvaluatedKey"]
            )
            for item in response.get("Items", []):
                # Convert table fields back to JSON format
                if "log_id" in item:
                    item["id"] = item.pop("log_id")
                if "timestamp" in item:
                    item["time"] = item.pop("timestamp")
                logs.append(item)
        
        return logs
    except Exception as e:
        print(f"Error getting logs by status: {e}")
        return []


def get_logs_by_resource(resource_id):
    """
    Get all logs for a specific resource (scan and filter)
    Maps table fields back to JSON format: log_id -> id, timestamp -> time
    Args: resource_id - The resource ID to query
    Returns: List of log dictionaries (JSON format) or None if table doesn't exist
    """
    try:
        if not logs_table:
            return None
        
        logs = []
        
        # Scan table and filter by resource_id in resources_affected list
        response = logs_table.scan()
        
        for item in response.get("Items", []):
            # Check if resource_id is in resources_affected list
            resources_affected = item.get("resources_affected", [])
            if resource_id in resources_affected:
                # Convert table fields back to JSON format
                if "log_id" in item:
                    item["id"] = item.pop("log_id")
                if "timestamp" in item:
                    item["time"] = item.pop("timestamp")
                logs.append(item)
        
        # Handle pagination
        while "LastEvaluatedKey" in response:
            response = logs_table.scan(
                ExclusiveStartKey=response["LastEvaluatedKey"]
            )
            for item in response.get("Items", []):
                resources_affected = item.get("resources_affected", [])
                if resource_id in resources_affected:
                    # Convert table fields back to JSON format
                    if "log_id" in item:
                        item["id"] = item.pop("log_id")
                    if "timestamp" in item:
                        item["time"] = item.pop("timestamp")
                    logs.append(item)
        
        return logs
    except ClientError as e:
        # If table doesn't exist, return None so fallback can work
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            return None
        print(f"Error getting logs by resource: {e}")
        return None
    except Exception as e:
        print(f"Error getting logs by resource: {e}")
        return None


def get_all_logs():
    """
    Get all logs from DynamoDB (use scan - returns JSON format)
    Maps table fields back to JSON format: log_id -> id, timestamp -> time
    Returns: List of all log dictionaries (JSON format) or None if table doesn't exist
    """
    try:
        if not logs_table:
            return None
        
        logs = []
        response = logs_table.scan()
        
        for item in response.get("Items", []):
            # Convert table fields back to JSON format
            if "log_id" in item:
                item["id"] = item.pop("log_id")
            if "timestamp" in item:
                item["time"] = item.pop("timestamp")
            logs.append(item)
        
        # Handle pagination
        while "LastEvaluatedKey" in response:
            response = logs_table.scan(
                ExclusiveStartKey=response["LastEvaluatedKey"]
            )
            for item in response.get("Items", []):
                # Convert table fields back to JSON format
                if "log_id" in item:
                    item["id"] = item.pop("log_id")
                if "timestamp" in item:
                    item["time"] = item.pop("timestamp")
                logs.append(item)
        
        return logs
    except ClientError as e:
        # If table doesn't exist, return None so fallback can work
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            return None
        print(f"Error getting all logs: {e}")
        return None
    except Exception as e:
        print(f"Error getting all logs: {e}")
        return None


def get_resource_by_id(resource_id):
    """
    Get a single resource by its ID (returns JSON as stored)
    Args: resource_id - The resource ID to retrieve
    Returns: Resource dictionary (JSON as-is) or None if not found
    """
    try:
        if not metrics_table:
            return None
        
        response = metrics_table.get_item(
            Key={"id": resource_id}
        )
        
        if "Item" in response:
            # Return the item as-is (no conversion needed)
            return response["Item"]
        return None
    except ClientError as e:
        # If table doesn't exist, raise exception so fallback can work
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            raise  # Let the caller handle fallback
        print(f"Error getting resource by ID: {e}")
        return None
    except Exception as e:
        print(f"Error getting resource by ID: {e}")
        return None


def get_all_resources():
    """
    Get all resources from DynamoDB (returns JSON as stored)
    Returns: List of all resource dictionaries (JSON as-is) or None if table doesn't exist
    """
    try:
        if not metrics_table:
            return None
        
        resources = []
        response = metrics_table.scan()
        
        for item in response.get("Items", []):
            resources.append(item)  # Return as-is, no conversion needed
        
        # Handle pagination
        while "LastEvaluatedKey" in response:
            response = metrics_table.scan(
                ExclusiveStartKey=response["LastEvaluatedKey"]
            )
            for item in response.get("Items", []):
                resources.append(item)  # Return as-is
        
        return resources
    except ClientError as e:
        # If table doesn't exist, return None so fallback can work
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            return None
        print(f"Error getting all resources: {e}")
        return None
    except Exception as e:
        print(f"Error getting all resources: {e}")
        return None


# Removed _convert_log_item function - no longer needed since we store JSON as-is


def create_tables():
    """
    Create DynamoDB table to store logs JSON data as-is
    Creates logs-table if it doesn't exist (metrics removed - only logs)
    Simple schema: just store the JSON objects with id as partition key
    Returns: Dictionary with creation results
    """
    results = {
        "logs_table_created": False,
        "errors": []
    }
    
    try:
        # Create logs table - simple schema, just store JSON as-is
        try:
            logs_table_definition = {
                "TableName": LOGS_TABLE_NAME,
                "KeySchema": [
                    {
                        "AttributeName": "id",
                        "KeyType": "HASH"  # Partition key - just the log id
                    }
                ],
                "AttributeDefinitions": [
                    {
                        "AttributeName": "id",
                        "AttributeType": "S"  # String
                    }
                ],
                "BillingMode": "PAY_PER_REQUEST"  # On-demand pricing
            }
            
            dynamodb_client = boto3.client("dynamodb", region_name=DYNAMODB_REGION)
            dynamodb_client.create_table(**logs_table_definition)
            
            # Wait for table to be created
            print(f"Creating logs table: {LOGS_TABLE_NAME}...")
            waiter = dynamodb_client.get_waiter('table_exists')
            waiter.wait(TableName=LOGS_TABLE_NAME)
            print(f"✓ Logs table created successfully")
            results["logs_table_created"] = True
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceInUseException':
                print(f"Logs table {LOGS_TABLE_NAME} already exists")
                results["logs_table_created"] = True
            else:
                error_msg = f"Error creating logs table: {str(e)}"
                results["errors"].append(error_msg)
                print(error_msg)
    
    except Exception as e:
        error_msg = f"Error in create_tables: {str(e)}"
        results["errors"].append(error_msg)
        print(error_msg)
    
    return results


def migrate_json_to_dynamodb(logs_file_path=None):
    """
    Create DynamoDB table and migrate logs from JSON file
    This function:
    1. Creates the logs-table (if it doesn't exist)
    2. Reads logs.json
    3. Inserts logs into DynamoDB using batch operations
    Note: Metrics removed - only logs are stored in DynamoDB
    Args:
        logs_file_path - Path to logs.json file (optional, uses default if None)
    Returns: Dictionary with migration results
    """
    import json
    from pathlib import Path
    
    # Use default path if not provided
    if logs_file_path is None:
        project_root = Path(__file__).parent.parent.parent
        logs_file_path = project_root / "logs.json"
    
    results = {
        "table_created": False,
        "logs_inserted": 0,
        "errors": []
    }
    
    # Step 1: Create table
    print("=== Step 1: Creating DynamoDB Table ===")
    try:
        table_results = create_tables()
        results["table_created"] = table_results["logs_table_created"]
        results["errors"].extend(table_results["errors"])
        
        if not results["table_created"]:
            print("Warning: Table may not have been created")
    except Exception as e:
        error_msg = f"Error creating table: {str(e)}"
        results["errors"].append(error_msg)
        print(error_msg)
        return results
    
    # Wait a bit for table to be fully ready
    import time
    time.sleep(2)
    
    # Step 2: Migrate logs
    print("\n=== Step 2: Migrating Logs ===")
    try:
        if logs_file_path.exists():
            print(f"Reading logs from: {logs_file_path}")
            with open(logs_file_path, 'r') as f:
                data = json.load(f)
                logs = data.get("logs", [])
                if logs:
                    print(f"Found {len(logs)} logs to migrate")
                    print("Inserting logs into DynamoDB (this may take a while)...")
                    results["logs_inserted"] = batch_insert_logs(logs)
                    print(f"✓ Migrated {results['logs_inserted']} log items to DynamoDB")
                else:
                    results["errors"].append("No logs found in JSON file")
        else:
            results["errors"].append(f"Logs file not found: {logs_file_path}")
    except Exception as e:
        error_msg = f"Error migrating logs: {str(e)}"
        results["errors"].append(error_msg)
        print(error_msg)
    
    # Summary
    print("\n=== Migration Summary ===")
    print(f"Table created: {results['table_created']}")
    print(f"Logs inserted: {results['logs_inserted']}")
    if results["errors"]:
        print(f"Errors: {len(results['errors'])}")
        for error in results["errors"]:
            print(f"  - {error}")
    else:
        print("✓ Migration completed successfully!")
    
    return results

