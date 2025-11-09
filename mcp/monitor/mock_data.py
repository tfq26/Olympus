"""
Mock Data Module
Loads and provides access to mock data from logs.json and metrics.json for testing
"""
import json
import os

# Calculate project root directory (3 levels up from this file: mcp/monitor/mock_data.py)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOGS_FILE = os.path.join(BASE_DIR, "logs.json")
METRICS_FILE = os.path.join(BASE_DIR, "metrics.json")

def load_logs():
    """
    Load logs from logs.json file
    Returns: List of log entries or None if file cannot be loaded
    """
    try:
        with open(LOGS_FILE, 'r') as f:
            data = json.load(f)
            # Extract the "logs" array from the JSON structure
            return data.get("logs", [])
    except Exception as e:
        return None

def load_metrics():
    """
    Load resources/metrics from metrics.json file
    Returns: List of resource objects or None if file cannot be loaded
    """
    try:
        with open(METRICS_FILE, 'r') as f:
            data = json.load(f)
            # Extract the "resources" array from the JSON structure
            return data.get("resources", [])
    except Exception as e:
        return None

def get_resource_by_id(resource_id):
    """
    Get a specific resource by its ID from metrics.json
    Args: resource_id - The ID of the resource to find (e.g., "res_vm_001")
    Returns: Resource object if found, None otherwise
    """
    resources = load_metrics()
    if resources:
        for resource in resources:
            if resource.get("id") == resource_id:
                return resource
    return None

def get_logs_by_resource(resource_id):
    """
    Get all logs associated with a specific resource
    Args: resource_id - The ID of the resource to filter logs by
    Returns: List of log entries that affect the specified resource
    """
    logs = load_logs()
    if logs:
        # Filter logs where the resource_id appears in the "resources_affected" array
        return [log for log in logs if resource_id in log.get("resources_affected", [])]
    return []

def get_customer_health_summary():
    """
    Analyze logs by customer and calculate health metrics
    Groups logs by customer_name and calculates:
    - Total logs per customer
    - Error logs count
    - Warning logs count
    - Critical logs count
    - Health percentage (based on OK logs / total logs)
    - Critical issues (resources with ERROR or CRITICAL status)
    Returns: Dictionary with customer health data and critical issues
    """
    logs = load_logs()
    if not logs:
        return None
    
    # Dictionary to store customer metrics
    customer_stats = {}
    # Set to track resources with critical issues (ERROR or CRITICAL)
    critical_resources = set()
    
    # Process each log
    for log in logs:
        customer = log.get("customer_name")
        status = log.get("status", "UNKNOWN")
        resources = log.get("resources_affected", [])
        
        # Initialize customer if not seen before
        if customer not in customer_stats:
            customer_stats[customer] = {
                "total_logs": 0,
                "error_logs": 0,
                "warning_logs": 0,
                "critical_logs": 0
            }
        
        # Count logs by status
        customer_stats[customer]["total_logs"] += 1
        if status == "ERROR":
            customer_stats[customer]["error_logs"] += 1
            # Add resources with errors to critical issues
            critical_resources.update(resources)
        elif status == "WARNING":
            customer_stats[customer]["warning_logs"] += 1
        elif status == "CRITICAL":
            customer_stats[customer]["critical_logs"] += 1
            # Add resources with critical issues
            critical_resources.update(resources)
    
    # Calculate health percentage for each customer
    # Health % = (OK logs / Total logs) * 100
    # OK logs = total_logs - error_logs - warning_logs - critical_logs
    affected_customers = []
    for customer, stats in customer_stats.items():
        total = stats["total_logs"]
        error = stats["error_logs"]
        warning = stats["warning_logs"]
        critical = stats["critical_logs"]
        
        # Calculate OK logs and health percentage
        ok_logs = total - error - warning - critical
        health_percent_value = round((ok_logs / total * 100) if total > 0 else 100.0, 2)
        # Format health percentage with % symbol
        health_percent = f"{health_percent_value}%"
        
        affected_customers.append({
            "customer": customer,
            "total_logs": total,
            "error_logs": error,
            "warning_logs": warning,
            "critical_logs": critical,
            "health_percent": health_percent,
            "_health_value": health_percent_value  # Store numeric value for sorting
        })
    
    # Sort customers by health percentage (lowest first - most problematic first)
    # Use numeric value for proper sorting
    affected_customers.sort(key=lambda x: x["_health_value"])
    
    # Remove the temporary sorting key before returning
    for customer in affected_customers:
        del customer["_health_value"]
    
    return {
        "affected_customers": affected_customers,
        "critical_issues": sorted(list(critical_resources))
    }

