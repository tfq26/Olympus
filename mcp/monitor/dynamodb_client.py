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
    Args: log_data - Dictionary containing log data
    Returns: True if successful, False otherwise
    """
    try:
        if not logs_table:
            return False
        
        # Denormalize: create one item per resource affected for efficient querying
        resources = log_data.get("resources_affected", [])
        if not resources:
            # If no resources, create single item
            item = {
                "log_id": log_data.get("id"),
                "timestamp": log_data.get("time"),
                "log_code": log_data.get("log_code"),
                "subtype": log_data.get("subtype"),
                "customer_name": log_data.get("customer_name"),
                "resources_affected": log_data.get("resources_affected", []),
                "status": log_data.get("status")
            }
            logs_table.put_item(Item=item)
        else:
            # Create one item per resource (denormalized for GSI queries)
            for resource_id in resources:
                item = {
                    "log_id": f"{log_data.get('id')}_res_{resource_id}",  # Use "_res_" separator
                    "timestamp": log_data.get("time"),
                    "log_code": log_data.get("log_code"),
                    "subtype": log_data.get("subtype"),
                    "customer_name": log_data.get("customer_name"),
                    "resource_id": resource_id,  # For GSI3 querying
                    "resources_affected": log_data.get("resources_affected", []),
                    "status": log_data.get("status")
                }
                logs_table.put_item(Item=item)
        
        return True
    except Exception as e:
        print(f"Error inserting log: {e}")
        return False


def batch_insert_logs(logs_list):
    """
    Batch insert logs into DynamoDB (more efficient than individual inserts)
    Uses denormalization: creates one item per resource for efficient querying
    Args: logs_list - List of log dictionaries
    Returns: Number of successfully inserted logs
    """
    if not logs_table:
        return 0
    
    inserted_count = 0
    # DynamoDB allows max 25 items per batch write
    batch_size = 25
    
    try:
        # First, prepare all items (denormalized)
        all_items = []
        for log in logs_list:
            resources = log.get("resources_affected", [])
            if not resources:
                # If no resources, create single item
                all_items.append({
                    "log_id": log.get("id"),
                    "timestamp": log.get("time"),
                    "log_code": log.get("log_code"),
                    "subtype": log.get("subtype"),
                    "customer_name": log.get("customer_name"),
                    "resources_affected": log.get("resources_affected", []),
                    "status": log.get("status")
                })
            else:
                # Create one item per resource (denormalized for GSI queries)
                for resource_id in resources:
                    all_items.append({
                        "log_id": f"{log.get('id')}_res_{resource_id}",  # Use "_res_" separator
                        "timestamp": log.get("time"),
                        "log_code": log.get("log_code"),
                        "subtype": log.get("subtype"),
                        "customer_name": log.get("customer_name"),
                        "resource_id": resource_id,  # For GSI3 querying
                        "resources_affected": log.get("resources_affected", []),
                        "status": log.get("status")
                    })
        
        # Process items in batches
        with logs_table.batch_writer() as batch:
            for item in all_items:
                batch.put_item(Item=item)
                inserted_count += 1
        
        return inserted_count
    except Exception as e:
        print(f"Error in batch insert logs: {e}")
        return inserted_count


def insert_resource(resource_data):
    """
    Insert a single resource into DynamoDB
    Args: resource_data - Dictionary containing resource data
    Returns: True if successful, False otherwise
    """
    try:
        if not metrics_table:
            return False
        
        # Convert resource data to DynamoDB item format
        item = {
            "resource_id": resource_data.get("id"),
            "name": resource_data.get("name"),
            "type": resource_data.get("type"),
            "provider": resource_data.get("provider"),
            "region": resource_data.get("region"),
            "status": resource_data.get("status"),
            "created_at": resource_data.get("created_at"),
            "created_by": resource_data.get("created_by"),
            "health_score": resource_data.get("health_score"),
            "metrics": resource_data.get("metrics", {}),
            "dependencies": resource_data.get("dependencies", []),
            "tags": resource_data.get("tags", {}),
            "estimated_monthly_cost": resource_data.get("estimated_monthly_cost"),
            "security": resource_data.get("security", {})
        }
        
        metrics_table.put_item(Item=item)
        return True
    except Exception as e:
        print(f"Error inserting resource: {e}")
        return False


def batch_insert_resources(resources_list):
    """
    Batch insert resources into DynamoDB
    Args: resources_list - List of resource dictionaries
    Returns: Number of successfully inserted resources
    """
    if not metrics_table:
        return 0
    
    inserted_count = 0
    
    try:
        # Use batch writer for efficient batch writes
        with metrics_table.batch_writer() as batch:
            for resource in resources_list:
                item = {
                    "resource_id": resource.get("id"),
                    "name": resource.get("name"),
                    "type": resource.get("type"),
                    "provider": resource.get("provider"),
                    "region": resource.get("region"),
                    "status": resource.get("status"),
                    "created_at": resource.get("created_at"),
                    "created_by": resource.get("created_by"),
                    "health_score": resource.get("health_score"),
                    "metrics": resource.get("metrics", {}),
                    "dependencies": resource.get("dependencies", []),
                    "tags": resource.get("tags", {}),
                    "estimated_monthly_cost": resource.get("estimated_monthly_cost"),
                    "security": resource.get("security", {})
                }
                batch.put_item(Item=item)
                inserted_count += 1
        
        return inserted_count
    except Exception as e:
        print(f"Error in batch insert resources: {e}")
        return inserted_count


def get_log_by_id(log_id):
    """
    Get a single log by its ID
    Note: Due to denormalization, this may return the first matching log
    Args: log_id - The log ID to retrieve
    Returns: Log dictionary or None if not found
    """
    try:
        if not logs_table:
            return None
        
        # Since we denormalized, try to get the first occurrence
        # (log_id might be "log_00001" or "log_00001_res_vm_001")
        response = logs_table.get_item(
            Key={"log_id": log_id}
        )
        
        if "Item" in response:
            item = response["Item"]
            # Convert back to original format
            return _convert_log_item(item)
        return None
    except Exception as e:
        print(f"Error getting log by ID: {e}")
        return None


def get_logs_by_customer(customer_name):
    """
    Get all logs for a specific customer using GSI1
    Args: customer_name - The customer name to query
    Returns: List of log dictionaries
    """
    try:
        if not logs_table:
            return []
        
        logs = []
        
        try:
            # Query GSI1: customer-name-index
            response = logs_table.query(
                IndexName="customer-name-index",
                KeyConditionExpression="customer_name = :customer",
                ExpressionAttributeValues={":customer": customer_name}
            )
            
            for item in response.get("Items", []):
                logs.append(_convert_log_item(item))
            
            # Handle pagination
            while "LastEvaluatedKey" in response:
                response = logs_table.query(
                    IndexName="customer-name-index",
                    KeyConditionExpression="customer_name = :customer",
                    ExpressionAttributeValues={":customer": customer_name},
                    ExclusiveStartKey=response["LastEvaluatedKey"]
                )
                for item in response.get("Items", []):
                    logs.append(_convert_log_item(item))
        except ClientError as e:
            # If GSI doesn't exist, fall back to scan with filter
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                response = logs_table.scan(
                    FilterExpression="customer_name = :customer",
                    ExpressionAttributeValues={":customer": customer_name}
                )
                for item in response.get("Items", []):
                    logs.append(_convert_log_item(item))
            else:
                raise
        
        return logs
    except Exception as e:
        print(f"Error getting logs by customer: {e}")
        return []


def get_logs_by_status(status):
    """
    Get all logs with a specific status using GSI2
    Args: status - The status to query (OK, ERROR, WARNING, CRITICAL)
    Returns: List of log dictionaries
    """
    try:
        if not logs_table:
            return []
        
        logs = []
        
        try:
            # Query GSI2: status-index
            response = logs_table.query(
                IndexName="status-index",
                KeyConditionExpression="#status = :status",
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={":status": status}
            )
            
            for item in response.get("Items", []):
                logs.append(_convert_log_item(item))
            
            # Handle pagination
            while "LastEvaluatedKey" in response:
                response = logs_table.query(
                    IndexName="status-index",
                    KeyConditionExpression="#status = :status",
                    ExpressionAttributeNames={"#status": "status"},
                    ExpressionAttributeValues={":status": status},
                    ExclusiveStartKey=response["LastEvaluatedKey"]
                )
                for item in response.get("Items", []):
                    logs.append(_convert_log_item(item))
        except ClientError as e:
            # If GSI doesn't exist, fall back to scan with filter
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                response = logs_table.scan(
                    FilterExpression="#status = :status",
                    ExpressionAttributeNames={"#status": "status"},
                    ExpressionAttributeValues={":status": status}
                )
                for item in response.get("Items", []):
                    logs.append(_convert_log_item(item))
            else:
                raise
        
        return logs
    except Exception as e:
        print(f"Error getting logs by status: {e}")
        return []


def get_logs_by_resource(resource_id):
    """
    Get all logs for a specific resource using GSI3
    Args: resource_id - The resource ID to query
    Returns: List of log dictionaries
    """
    try:
        if not logs_table:
            return []
        
        logs = []
        
        try:
            # Query GSI3: resource-index
            response = logs_table.query(
                IndexName="resource-index",
                KeyConditionExpression="resource_id = :resource",
                ExpressionAttributeValues={":resource": resource_id}
            )
            
            for item in response.get("Items", []):
                logs.append(_convert_log_item(item))
            
            # Handle pagination
            while "LastEvaluatedKey" in response:
                response = logs_table.query(
                    IndexName="resource-index",
                    KeyConditionExpression="resource_id = :resource",
                    ExpressionAttributeValues={":resource": resource_id},
                    ExclusiveStartKey=response["LastEvaluatedKey"]
                )
                for item in response.get("Items", []):
                    logs.append(_convert_log_item(item))
        except ClientError as e:
            # If GSI doesn't exist, fall back to scan with filter
            # Note: contains() doesn't work directly on lists, need to check each item
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                # Scan all items and filter in application
                response = logs_table.scan()
                for item in response.get("Items", []):
                    # Check if resource_id is in resources_affected list
                    resources_affected = item.get("resources_affected", [])
                    if resource_id in resources_affected:
                        logs.append(_convert_log_item(item))
                
                # Handle pagination
                while "LastEvaluatedKey" in response:
                    response = logs_table.scan(
                        ExclusiveStartKey=response["LastEvaluatedKey"]
                    )
                    for item in response.get("Items", []):
                        resources_affected = item.get("resources_affected", [])
                        if resource_id in resources_affected:
                            logs.append(_convert_log_item(item))
            else:
                raise
        
        return logs
    except Exception as e:
        print(f"Error getting logs by resource: {e}")
        return []


def get_all_logs():
    """
    Get all logs from DynamoDB (use scan - less efficient for large datasets)
    Returns: List of all log dictionaries (deduplicated)
    Note: Due to denormalization, we deduplicate logs by original log ID
    """
    try:
        if not logs_table:
            return []
        
        logs_dict = {}  # Use dict to store unique logs by original log ID
        seen_log_ids = set()  # Track unique log IDs to avoid duplicates
        
        response = logs_table.scan()
        
        for item in response.get("Items", []):
            # Extract original log ID (remove resource suffix if present)
            log_id = item.get("log_id", "")
            # Handle composite keys: "log_00001_res_vm_001" -> "log_00001"
            if "_res_" in log_id:
                original_log_id = log_id.split("_res_")[0]
            else:
                original_log_id = log_id
            
            # Only add if we haven't seen this log ID before
            if original_log_id not in seen_log_ids:
                log = _convert_log_item(item)
                logs_dict[original_log_id] = log
                seen_log_ids.add(original_log_id)
        
        # Handle pagination
        while "LastEvaluatedKey" in response:
            response = logs_table.scan(
                ExclusiveStartKey=response["LastEvaluatedKey"]
            )
            for item in response.get("Items", []):
                log_id = item.get("log_id", "")
                if "_res_" in log_id:
                    original_log_id = log_id.split("_res_")[0]
                else:
                    original_log_id = log_id
                if original_log_id not in seen_log_ids:
                    log = _convert_log_item(item)
                    logs_dict[original_log_id] = log
                    seen_log_ids.add(original_log_id)
        
        # Return as list
        return list(logs_dict.values())
    except Exception as e:
        print(f"Error getting all logs: {e}")
        return []


def get_resource_by_id(resource_id):
    """
    Get a single resource by its ID
    Args: resource_id - The resource ID to retrieve
    Returns: Resource dictionary or None if not found
    """
    try:
        if not metrics_table:
            return None
        
        response = metrics_table.get_item(
            Key={"resource_id": resource_id}
        )
        
        if "Item" in response:
            item = response["Item"]
            # Convert resource_id back to id for compatibility
            item["id"] = item.pop("resource_id")
            return item
        return None
    except Exception as e:
        print(f"Error getting resource by ID: {e}")
        return None


def get_all_resources():
    """
    Get all resources from DynamoDB
    Returns: List of all resource dictionaries
    """
    try:
        if not metrics_table:
            return []
        
        resources = []
        response = metrics_table.scan()
        
        for item in response.get("Items", []):
            # Convert resource_id back to id for compatibility
            item["id"] = item.pop("resource_id")
            resources.append(item)
        
        # Handle pagination
        while "LastEvaluatedKey" in response:
            response = metrics_table.scan(
                ExclusiveStartKey=response["LastEvaluatedKey"]
            )
            for item in response.get("Items", []):
                item["id"] = item.pop("resource_id")
                resources.append(item)
        
        return resources
    except Exception as e:
        print(f"Error getting all resources: {e}")
        return []


def _convert_log_item(item):
    """
    Convert DynamoDB log item to Python dictionary (original format)
    Args: item - DynamoDB item from DynamoDB
    Returns: Python dictionary in original log format
    """
    # Extract original log ID (remove resource suffix if present)
    log_id = item.get("log_id", "")
    # Handle composite keys: "log_00001_res_vm_001" -> "log_00001"
    if "_res_" in log_id:
        # Split on "_res_" to get original log ID
        parts = log_id.split("_res_")
        original_log_id = parts[0]
    else:
        original_log_id = log_id
    
    # Build log dictionary in original format
    log = {
        "id": original_log_id,
        "time": item.get("timestamp"),
        "log_code": item.get("log_code"),
        "subtype": item.get("subtype"),
        "customer_name": item.get("customer_name"),
        "resources_affected": item.get("resources_affected", []),
        "status": item.get("status")
    }
    
    return log


def migrate_json_to_dynamodb(logs_file_path=None, metrics_file_path=None):
    """
    Migrate data from JSON files to DynamoDB
    This function reads logs.json and metrics.json and inserts them into DynamoDB
    Args:
        logs_file_path - Path to logs.json file (optional, uses default if None)
        metrics_file_path - Path to metrics.json file (optional, uses default if None)
    Returns: Dictionary with migration results
    """
    import json
    from pathlib import Path
    
    # Use default paths if not provided
    if logs_file_path is None:
        project_root = Path(__file__).parent.parent.parent
        logs_file_path = project_root / "logs.json"
    if metrics_file_path is None:
        project_root = Path(__file__).parent.parent.parent
        metrics_file_path = project_root / "metrics.json"
    
    results = {
        "logs_inserted": 0,
        "resources_inserted": 0,
        "errors": []
    }
    
    # Migrate logs
    try:
        if logs_file_path.exists():
            with open(logs_file_path, 'r') as f:
                data = json.load(f)
                logs = data.get("logs", [])
                if logs:
                    results["logs_inserted"] = batch_insert_logs(logs)
                    print(f"Migrated {results['logs_inserted']} log items to DynamoDB")
        else:
            results["errors"].append(f"Logs file not found: {logs_file_path}")
    except Exception as e:
        error_msg = f"Error migrating logs: {str(e)}"
        results["errors"].append(error_msg)
        print(error_msg)
    
    # Migrate resources
    try:
        if metrics_file_path.exists():
            with open(metrics_file_path, 'r') as f:
                data = json.load(f)
                resources = data.get("resources", [])
                if resources:
                    results["resources_inserted"] = batch_insert_resources(resources)
                    print(f"Migrated {results['resources_inserted']} resource items to DynamoDB")
        else:
            results["errors"].append(f"Metrics file not found: {metrics_file_path}")
    except Exception as e:
        error_msg = f"Error migrating resources: {str(e)}"
        results["errors"].append(error_msg)
        print(error_msg)
    
    return results

