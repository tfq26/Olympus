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

