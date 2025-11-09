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
EMPLOYEES_TABLE_NAME = os.getenv("DYNAMODB_TABLE_EMPLOYEES", "employees-table")
ADMINS_TABLE_NAME = os.getenv("DYNAMODB_TABLE_ADMINS", "admins-table")
TICKETS_TABLE_NAME = os.getenv("DYNAMODB_TABLE_TICKETS", "tickets-table")

# Initialize DynamoDB resource (simpler API than client)
try:
    dynamodb_resource = boto3.resource("dynamodb", region_name=DYNAMODB_REGION)
    # Get table references (will be None if tables don't exist)
    logs_table = dynamodb_resource.Table(LOGS_TABLE_NAME) if LOGS_TABLE_NAME else None
    metrics_table = dynamodb_resource.Table(METRICS_TABLE_NAME) if METRICS_TABLE_NAME else None
    employees_table = dynamodb_resource.Table(EMPLOYEES_TABLE_NAME) if EMPLOYEES_TABLE_NAME else None
    admins_table = dynamodb_resource.Table(ADMINS_TABLE_NAME) if ADMINS_TABLE_NAME else None
    tickets_table = dynamodb_resource.Table(TICKETS_TABLE_NAME) if TICKETS_TABLE_NAME else None
except Exception as e:
    # If DynamoDB initialization fails, set tables to None (will fall back to JSON)
    logs_table = None
    metrics_table = None
    employees_table = None
    admins_table = None
    tickets_table = None


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
    Create all DynamoDB tables for logs, metrics, employees, admins, and tickets
    Creates tables if they don't exist
    Returns: Dictionary with creation results
    """
    results = {
        "logs_table_created": False,
        "metrics_table_created": False,
        "employees_table_created": False,
        "admins_table_created": False,
        "tickets_table_created": False,
        "errors": []
    }
    
    dynamodb_client = boto3.client("dynamodb", region_name=DYNAMODB_REGION)
    
    # Create logs table (uses log_id as partition key to match existing schema)
    try:
        logs_table_definition = {
            "TableName": LOGS_TABLE_NAME,
            "KeySchema": [
                {"AttributeName": "log_id", "KeyType": "HASH"},
                {"AttributeName": "timestamp", "KeyType": "RANGE"}
            ],
            "AttributeDefinitions": [
                {"AttributeName": "log_id", "AttributeType": "S"},
                {"AttributeName": "timestamp", "AttributeType": "S"}
            ],
            "BillingMode": "PAY_PER_REQUEST"
        }
        dynamodb_client.create_table(**logs_table_definition)
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
            results["errors"].append(f"Error creating logs table: {str(e)}")
    
    # Create metrics table
    try:
        metrics_table_definition = {
            "TableName": METRICS_TABLE_NAME,
            "KeySchema": [{"AttributeName": "id", "KeyType": "HASH"}],
            "AttributeDefinitions": [{"AttributeName": "id", "AttributeType": "S"}],
            "BillingMode": "PAY_PER_REQUEST"
        }
        dynamodb_client.create_table(**metrics_table_definition)
        print(f"Creating metrics table: {METRICS_TABLE_NAME}...")
        waiter = dynamodb_client.get_waiter('table_exists')
        waiter.wait(TableName=METRICS_TABLE_NAME)
        print(f"✓ Metrics table created successfully")
        results["metrics_table_created"] = True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print(f"Metrics table {METRICS_TABLE_NAME} already exists")
            results["metrics_table_created"] = True
        else:
            results["errors"].append(f"Error creating metrics table: {str(e)}")
    
    # Create employees table
    try:
        employees_table_definition = {
            "TableName": EMPLOYEES_TABLE_NAME,
            "KeySchema": [{"AttributeName": "employee_id", "KeyType": "HASH"}],
            "AttributeDefinitions": [{"AttributeName": "employee_id", "AttributeType": "S"}],
            "BillingMode": "PAY_PER_REQUEST"
        }
        dynamodb_client.create_table(**employees_table_definition)
        print(f"Creating employees table: {EMPLOYEES_TABLE_NAME}...")
        waiter = dynamodb_client.get_waiter('table_exists')
        waiter.wait(TableName=EMPLOYEES_TABLE_NAME)
        print(f"✓ Employees table created successfully")
        results["employees_table_created"] = True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print(f"Employees table {EMPLOYEES_TABLE_NAME} already exists")
            results["employees_table_created"] = True
        else:
            results["errors"].append(f"Error creating employees table: {str(e)}")
    
    # Create admins table
    try:
        admins_table_definition = {
            "TableName": ADMINS_TABLE_NAME,
            "KeySchema": [{"AttributeName": "admin_id", "KeyType": "HASH"}],
            "AttributeDefinitions": [{"AttributeName": "admin_id", "AttributeType": "S"}],
            "BillingMode": "PAY_PER_REQUEST"
        }
        dynamodb_client.create_table(**admins_table_definition)
        print(f"Creating admins table: {ADMINS_TABLE_NAME}...")
        waiter = dynamodb_client.get_waiter('table_exists')
        waiter.wait(TableName=ADMINS_TABLE_NAME)
        print(f"✓ Admins table created successfully")
        results["admins_table_created"] = True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print(f"Admins table {ADMINS_TABLE_NAME} already exists")
            results["admins_table_created"] = True
        else:
            results["errors"].append(f"Error creating admins table: {str(e)}")
    
    # Create tickets table
    try:
        tickets_table_definition = {
            "TableName": TICKETS_TABLE_NAME,
            "KeySchema": [{"AttributeName": "ticket_id", "KeyType": "HASH"}],
            "AttributeDefinitions": [{"AttributeName": "ticket_id", "AttributeType": "S"}],
            "BillingMode": "PAY_PER_REQUEST"
        }
        dynamodb_client.create_table(**tickets_table_definition)
        print(f"Creating tickets table: {TICKETS_TABLE_NAME}...")
        waiter = dynamodb_client.get_waiter('table_exists')
        waiter.wait(TableName=TICKETS_TABLE_NAME)
        print(f"✓ Tickets table created successfully")
        results["tickets_table_created"] = True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print(f"Tickets table {TICKETS_TABLE_NAME} already exists")
            results["tickets_table_created"] = True
        else:
            results["errors"].append(f"Error creating tickets table: {str(e)}")
    
    return results


def batch_insert_employees(employees_list):
    """Batch insert employees into DynamoDB"""
    if not employees_table:
        return 0
    
    inserted_count = 0
    try:
        with employees_table.batch_writer() as batch:
            for employee in employees_list:
                batch.put_item(Item=employee)
                inserted_count += 1
        return inserted_count
    except Exception as e:
        print(f"Error in batch insert employees: {e}")
        return inserted_count


def batch_insert_admins(admins_list):
    """Batch insert admins into DynamoDB"""
    if not admins_table:
        return 0
    
    inserted_count = 0
    try:
        with admins_table.batch_writer() as batch:
            for admin in admins_list:
                batch.put_item(Item=admin)
                inserted_count += 1
        return inserted_count
    except Exception as e:
        print(f"Error in batch insert admins: {e}")
        return inserted_count


def batch_insert_tickets(tickets_list):
    """Batch insert tickets into DynamoDB"""
    if not tickets_table:
        return 0
    
    inserted_count = 0
    try:
        with tickets_table.batch_writer() as batch:
            for ticket in tickets_list:
                batch.put_item(Item=ticket)
                inserted_count += 1
        return inserted_count
    except Exception as e:
        print(f"Error in batch insert tickets: {e}")
        return inserted_count


def batch_insert_metrics_resources(resources_list):
    """Batch insert metrics/resources into DynamoDB"""
    if not metrics_table:
        return 0
    
    inserted_count = 0
    try:
        with metrics_table.batch_writer() as batch:
            for resource in resources_list:
                batch.put_item(Item=resource)
                inserted_count += 1
        return inserted_count
    except Exception as e:
        print(f"Error in batch insert metrics: {e}")
        return inserted_count


def migrate_json_to_dynamodb(logs_file_path=None, metrics_file_path=None, 
                              employees_file_path=None, admins_file_path=None, 
                              tickets_file_path=None):
    """
    Create DynamoDB tables and migrate all JSON data to DynamoDB
    This function:
    1. Creates all tables (logs, metrics, employees, admins, tickets)
    2. Reads JSON files
    3. Inserts data into DynamoDB using batch operations
    Args:
        logs_file_path - Path to logs.json file (optional)
        metrics_file_path - Path to metrics.json file (optional)
        employees_file_path - Path to employees.json file (optional)
        admins_file_path - Path to admins.json file (optional)
        tickets_file_path - Path to tickets.json file (optional)
    Returns: Dictionary with migration results
    """
    import json
    import time
    from pathlib import Path
    
    # Use default paths if not provided
    project_root = Path(__file__).parent.parent.parent
    if logs_file_path is None:
        logs_file_path = project_root / "logs.json"
    if metrics_file_path is None:
        metrics_file_path = project_root / "metrics.json"
    if employees_file_path is None:
        employees_file_path = project_root / "employees.json"
    if admins_file_path is None:
        admins_file_path = project_root / "admins.json"
    if tickets_file_path is None:
        tickets_file_path = project_root / "tickets.json"
    
    results = {
        "tables_created": {},
        "logs_inserted": 0,
        "metrics_inserted": 0,
        "employees_inserted": 0,
        "admins_inserted": 0,
        "tickets_inserted": 0,
        "errors": []
    }
    
    # Step 1: Create all tables
    print("=== Step 1: Creating DynamoDB Tables ===")
    try:
        table_results = create_tables()
        results["tables_created"] = {
            "logs": table_results["logs_table_created"],
            "metrics": table_results["metrics_table_created"],
            "employees": table_results["employees_table_created"],
            "admins": table_results["admins_table_created"],
            "tickets": table_results["tickets_table_created"]
        }
        results["errors"].extend(table_results["errors"])
    except Exception as e:
        error_msg = f"Error creating tables: {str(e)}"
        results["errors"].append(error_msg)
        print(error_msg)
        return results
    
    # Wait for tables to be ready
    print("Waiting for tables to be ready...")
    time.sleep(5)
    
    # Step 2: Migrate logs
    if logs_file_path.exists():
        print("\n=== Step 2: Migrating Logs ===")
        try:
            with open(logs_file_path, 'r') as f:
                data = json.load(f)
                logs = data.get("logs", [])
                if logs:
                    print(f"Found {len(logs)} logs to migrate")
                    print("Inserting logs into DynamoDB (this may take a while)...")
                    results["logs_inserted"] = batch_insert_logs(logs)
                    print(f"✓ Migrated {results['logs_inserted']} log items to DynamoDB")
        except Exception as e:
            results["errors"].append(f"Error migrating logs: {str(e)}")
    
    # Step 3: Migrate metrics
    if metrics_file_path.exists():
        print("\n=== Step 3: Migrating Metrics ===")
        try:
            with open(metrics_file_path, 'r') as f:
                data = json.load(f)
                resources = data.get("resources", [])
                if resources:
                    print(f"Found {len(resources)} resources to migrate")
                    results["metrics_inserted"] = batch_insert_metrics_resources(resources)
                    print(f"✓ Migrated {results['metrics_inserted']} resources to DynamoDB")
        except Exception as e:
            results["errors"].append(f"Error migrating metrics: {str(e)}")
    
    # Step 4: Migrate employees
    if employees_file_path.exists():
        print("\n=== Step 4: Migrating Employees ===")
        try:
            with open(employees_file_path, 'r') as f:
                data = json.load(f)
                employees = data.get("employees", [])
                if employees:
                    print(f"Found {len(employees)} employees to migrate")
                    results["employees_inserted"] = batch_insert_employees(employees)
                    print(f"✓ Migrated {results['employees_inserted']} employees to DynamoDB")
        except Exception as e:
            results["errors"].append(f"Error migrating employees: {str(e)}")
    
    # Step 5: Migrate admins
    if admins_file_path.exists():
        print("\n=== Step 5: Migrating Admins ===")
        try:
            with open(admins_file_path, 'r') as f:
                data = json.load(f)
                admins = data.get("admins", [])
                if admins:
                    print(f"Found {len(admins)} admins to migrate")
                    results["admins_inserted"] = batch_insert_admins(admins)
                    print(f"✓ Migrated {results['admins_inserted']} admins to DynamoDB")
        except Exception as e:
            results["errors"].append(f"Error migrating admins: {str(e)}")
    
    # Step 6: Migrate tickets
    if tickets_file_path.exists():
        print("\n=== Step 6: Migrating Tickets ===")
        try:
            with open(tickets_file_path, 'r') as f:
                data = json.load(f)
                tickets = data.get("tickets", [])
                if tickets:
                    print(f"Found {len(tickets)} tickets to migrate")
                    results["tickets_inserted"] = batch_insert_tickets(tickets)
                    print(f"✓ Migrated {results['tickets_inserted']} tickets to DynamoDB")
                else:
                    print("No tickets to migrate (tickets.json is empty)")
        except Exception as e:
            results["errors"].append(f"Error migrating tickets: {str(e)}")
    
    # Summary
    print("\n" + "=" * 60)
    print("=== Migration Summary ===")
    print("=" * 60)
    print(f"Tables created:")
    print(f"  - Logs: {results['tables_created'].get('logs', False)}")
    print(f"  - Metrics: {results['tables_created'].get('metrics', False)}")
    print(f"  - Employees: {results['tables_created'].get('employees', False)}")
    print(f"  - Admins: {results['tables_created'].get('admins', False)}")
    print(f"  - Tickets: {results['tables_created'].get('tickets', False)}")
    print(f"")
    print(f"Data migrated:")
    print(f"  - Logs: {results['logs_inserted']} items")
    print(f"  - Metrics: {results['metrics_inserted']} items")
    print(f"  - Employees: {results['employees_inserted']} items")
    print(f"  - Admins: {results['admins_inserted']} items")
    print(f"  - Tickets: {results['tickets_inserted']} items")
    
    if results["errors"]:
        print(f"\nErrors: {len(results['errors'])}")
        for error in results["errors"]:
            print(f"  - {error}")
    else:
        print("\n✓ Migration completed successfully!")
    
    return results

