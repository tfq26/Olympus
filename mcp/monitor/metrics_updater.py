"""
Metrics Updater Module
Handles updating metrics.json file with enriched CloudWatch metrics
"""
import json
import os
from pathlib import Path
from .cloudwatch_client import fetch_ec2_metrics_enriched

# Calculate project root directory (3 levels up from this file: mcp/monitor/metrics_updater.py)
BASE_DIR = Path(__file__).parent.parent.parent
METRICS_FILE = BASE_DIR / "metrics.json"


def load_metrics_json():
    """
    Load metrics.json file
    Returns: Dictionary with metrics data or None if error
    """
    try:
        with open(METRICS_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        return {"error": f"Failed to load metrics.json: {str(e)}"}


def save_metrics_json(data):
    """
    Save metrics.json file
    Args: data - Dictionary with metrics data
    Returns: True if successful, False otherwise
    """
    try:
        # Write to temporary file first
        temp_file = METRICS_FILE.with_suffix('.json.tmp')
        with open(temp_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        # Replace original file
        temp_file.replace(METRICS_FILE)
        return True
    except Exception as e:
        print(f"Error saving metrics.json: {e}")
        # Clean up temp file if it exists
        temp_file = METRICS_FILE.with_suffix('.json.tmp')
        if temp_file.exists():
            temp_file.unlink()
        return False


def find_resource_by_instance_id(instance_id, resources):
    """
    Find resource in metrics.json by instance_id field
    Args: instance_id - EC2 instance ID, resources - List of resources
    Returns: Resource dictionary or None if not found
    """
    for resource in resources:
        if resource.get("instance_id") == instance_id:
            return resource
    return None


def find_resource_by_id(resource_id, resources):
    """
    Find resource in metrics.json by id field
    Args: resource_id - Resource ID, resources - List of resources
    Returns: Resource dictionary or None if not found
    """
    for resource in resources:
        if resource.get("id") == resource_id:
            return resource
    return None


def update_resource_metrics(instance_id, resource_id=None, auto_create=False):
    """
    Update resource metrics in metrics.json with enriched CloudWatch data
    Automatically finds or creates resource entry and updates/replaces metrics
    Args:
        instance_id - EC2 instance ID (required)
        resource_id - Resource ID to update (optional, used if instance_id not in resource)
        auto_create - If True, create new resource if not found (default: False)
    Returns: Dictionary with update result
    """
    # Fetch enriched metrics from CloudWatch
    enriched_metrics = fetch_ec2_metrics_enriched(instance_id)
    if "error" in enriched_metrics:
        return enriched_metrics
    
    # Load metrics.json
    metrics_data = load_metrics_json()
    if "error" in metrics_data:
        return metrics_data
    
    resources = metrics_data.get("resources", [])
    if not resources:
        resources = []
        metrics_data["resources"] = resources
    
    # Find matching resource
    resource = None
    if resource_id:
        # Find by resource_id parameter
        resource = find_resource_by_id(resource_id, resources)
    else:
        # Find by instance_id field
        resource = find_resource_by_instance_id(instance_id, resources)
    
    # If resource not found and auto_create is True, create new resource
    if not resource and auto_create:
        # Create new resource entry
        metadata = enriched_metrics.get("metadata", {})
        resource = {
            "id": resource_id if resource_id else f"res_ec2_{instance_id[-8:]}",
            "name": f"ec2-{instance_id}",
            "type": "vm",
            "provider": "aws",
            "region": metadata.get("region", "us-east-1"),
            "status": "healthy" if metadata.get("instance_state") == "running" else "stopped",
            "created_at": metadata.get("launch_time"),
            "created_by": "system",
            "health_score": 100,
            "metrics": {},
            "dependencies": [],
            "tags": {},
            "estimated_monthly_cost": 0,
            "security": {},
            "instance_id": instance_id
        }
        resources.append(resource)
    
    # If still not found, return error
    if not resource:
        return {"error": f"Resource not found. Add instance_id to resource in metrics.json or provide resource_id parameter. Instance: {instance_id}"}
    
    # Update metrics object - REPLACE existing values (not duplicate)
    metrics = enriched_metrics.get("metrics", {})
    
    # Initialize metrics if it doesn't exist
    if resource.get("metrics") is None:
        resource["metrics"] = {}
    
    # REPLACE metrics fields with new values (even if None, to keep data fresh)
    # This ensures data is always up-to-date and not duplicated
    resource["metrics"]["cpu_usage_percent"] = metrics.get("cpu_usage_percent")
    resource["metrics"]["memory_usage_percent"] = metrics.get("memory_usage_percent")
    resource["metrics"]["disk_usage_percent"] = metrics.get("disk_usage_percent")
    resource["metrics"]["network_in_mbps"] = metrics.get("network_in_mbps")
    resource["metrics"]["network_out_mbps"] = metrics.get("network_out_mbps")
    resource["metrics"]["uptime_days"] = metrics.get("uptime_days")
    
    # Update instance_id field if it doesn't exist
    if not resource.get("instance_id"):
        resource["instance_id"] = instance_id
    
    # Save updated metrics.json
    if not save_metrics_json(metrics_data):
        return {"error": "Failed to save metrics.json"}
    
    return {
        "success": True,
        "message": "Metrics updated successfully",
        "resource_id": resource.get("id"),
        "instance_id": instance_id,
        "updated_metrics": resource["metrics"],
        "metadata": enriched_metrics.get("metadata")
    }

