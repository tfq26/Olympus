"""
CloudWatch Client Module
Handles fetching EC2 metrics from AWS CloudWatch and EC2 instance metadata
Provides functions to fetch enriched metrics (CPU, memory, disk, network, uptime)
"""
import boto3
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from botocore.exceptions import ClientError

load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

def fetch_ec2_metrics(instance_id):
    """
    Fetch EC2 CPU utilization metrics from CloudWatch.
    """
    cloudwatch = boto3.client("cloudwatch", region_name=AWS_REGION)

    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        
        response = cloudwatch.get_metric_statistics(
            Namespace="AWS/EC2",
            MetricName="CPUUtilization",
            Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
            StartTime=start_time,
            EndTime=end_time,
            Period=300,
            Statistics=["Average"],
        )

        # Add helpful info if no datapoints
        if not response.get("Datapoints"):
            response["message"] = f"No metrics found for instance {instance_id} in the last hour. The instance may be stopped, terminated, or metrics may not be available yet."

        return response
    except Exception as e:
        return {"error": str(e)}


def fetch_ec2_instance_metadata(instance_id):
    """
    Fetch EC2 instance metadata (launch_time, instance_type, state, etc.)
    Args: instance_id - EC2 instance ID
    Returns: Dictionary with instance metadata or error
    """
    ec2_client = boto3.client("ec2", region_name=AWS_REGION)
    
    try:
        response = ec2_client.describe_instances(InstanceIds=[instance_id])
        
        if not response.get("Reservations") or not response["Reservations"][0].get("Instances"):
            return {"error": f"Instance {instance_id} not found"}
        
        instance = response["Reservations"][0]["Instances"][0]
        
        return {
            "instance_id": instance_id,
            "launch_time": instance.get("LaunchTime"),
            "instance_type": instance.get("InstanceType"),
            "state": instance.get("State", {}).get("Name"),
            "region": AWS_REGION,
            "availability_zone": instance.get("Placement", {}).get("AvailabilityZone"),
            "tags": {tag["Key"]: tag["Value"] for tag in instance.get("Tags", [])}
        }
    except ClientError as e:
        if e.response['Error']['Code'] == 'InvalidInstanceID.NotFound':
            return {"error": f"Instance {instance_id} not found"}
        return {"error": str(e)}
    except Exception as e:
        return {"error": str(e)}


def calculate_uptime_days(launch_time):
    """
    Calculate uptime in days from EC2 launch_time
    Args: launch_time - datetime object from EC2
    Returns: Integer number of days
    """
    if not launch_time:
        return None
    
    if isinstance(launch_time, str):
        launch_time = datetime.fromisoformat(launch_time.replace('Z', '+00:00'))
    
    uptime = datetime.utcnow().replace(tzinfo=launch_time.tzinfo) - launch_time
    return uptime.days


def aggregate_metric_datapoints(datapoints):
    """
    Calculate average from CloudWatch metric datapoints
    Args: datapoints - List of datapoint dictionaries from CloudWatch
    Returns: Float average value or None if no datapoints
    """
    if not datapoints:
        return None
    
    values = [dp.get("Average") for dp in datapoints if dp.get("Average") is not None]
    if not values:
        return None
    
    return sum(values) / len(values)


def convert_network_bytes_to_mbps(bytes_value, period_seconds=300):
    """
    Convert network bytes to MB/s (megabytes per second)
    CloudWatch NetworkIn/NetworkOut metrics are bytes transferred during the period
    Args: 
        bytes_value - Average bytes value from CloudWatch (bytes over period)
        period_seconds - Period in seconds (default 300 for 5 minutes)
    Returns: Float MB/s value
    Formula: (bytes / period_seconds) / 1048576 = MB/s
    """
    if bytes_value is None:
        return None
    
    # CloudWatch NetworkIn/NetworkOut: bytes transferred during the period
    # To get bytes per second: bytes / period_seconds
    # To get MB per second: (bytes / period_seconds) / 1048576
    bytes_per_second = bytes_value / period_seconds if period_seconds > 0 else 0
    mbps = bytes_per_second / 1048576  # Convert bytes to megabytes
    
    return round(mbps, 2)


def fetch_cpu_utilization(instance_id, hours=1):
    """
    Fetch CPU utilization metric from CloudWatch
    Args: instance_id - EC2 instance ID, hours - Time range in hours
    Returns: Dictionary with metric data or error
    """
    cloudwatch = boto3.client("cloudwatch", region_name=AWS_REGION)
    
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)
        
        response = cloudwatch.get_metric_statistics(
            Namespace="AWS/EC2",
            MetricName="CPUUtilization",
            Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
            StartTime=start_time,
            EndTime=end_time,
            Period=300,
            Statistics=["Average"],
            Unit="Percent"
        )
        
        return response
    except Exception as e:
        return {"error": str(e)}


def fetch_memory_utilization(instance_id, hours=1):
    """
    Fetch memory utilization metric from CloudWatch Agent
    Args: instance_id - EC2 instance ID, hours - Time range in hours
    Returns: Dictionary with metric data or None if not available
    """
    cloudwatch = boto3.client("cloudwatch", region_name=AWS_REGION)
    
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)
        
        # Try CWAgent namespace (CloudWatch Agent)
        response = cloudwatch.get_metric_statistics(
            Namespace="CWAgent",
            MetricName="mem_used_percent",
            Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
            StartTime=start_time,
            EndTime=end_time,
            Period=300,
            Statistics=["Average"],
            Unit="Percent"
        )
        
        # If no data, try alternative metric name
        if not response.get("Datapoints"):
            response = cloudwatch.get_metric_statistics(
                Namespace="CWAgent",
                MetricName="MemoryUtilization",
                Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
                StartTime=start_time,
                EndTime=end_time,
                Period=300,
                Statistics=["Average"],
                Unit="Percent"
            )
        
        return response if response.get("Datapoints") else None
    except Exception as e:
        return None


def fetch_disk_utilization(instance_id, hours=1):
    """
    Fetch disk utilization metric from CloudWatch Agent
    Args: instance_id - EC2 instance ID, hours - Time range in hours
    Returns: Dictionary with metric data or None if not available
    """
    cloudwatch = boto3.client("cloudwatch", region_name=AWS_REGION)
    
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)
        
        # Try CWAgent namespace (CloudWatch Agent)
        response = cloudwatch.get_metric_statistics(
            Namespace="CWAgent",
            MetricName="disk_used_percent",
            Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
            StartTime=start_time,
            EndTime=end_time,
            Period=300,
            Statistics=["Average"],
            Unit="Percent"
        )
        
        # If no data, try alternative metric name
        if not response.get("Datapoints"):
            response = cloudwatch.get_metric_statistics(
                Namespace="CWAgent",
                MetricName="DiskSpaceUtilization",
                Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
                StartTime=start_time,
                EndTime=end_time,
                Period=300,
                Statistics=["Average"],
                Unit="Percent"
            )
        
        return response if response.get("Datapoints") else None
    except Exception as e:
        return None


def fetch_network_in(instance_id, hours=1):
    """
    Fetch network inbound metric from CloudWatch
    Args: instance_id - EC2 instance ID, hours - Time range in hours
    Returns: Dictionary with metric data or error
    """
    cloudwatch = boto3.client("cloudwatch", region_name=AWS_REGION)
    
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)
        
        response = cloudwatch.get_metric_statistics(
            Namespace="AWS/EC2",
            MetricName="NetworkIn",
            Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
            StartTime=start_time,
            EndTime=end_time,
            Period=300,
            Statistics=["Average"],
            Unit="Bytes"
        )
        
        return response
    except Exception as e:
        return {"error": str(e)}


def fetch_network_out(instance_id, hours=1):
    """
    Fetch network outbound metric from CloudWatch
    Args: instance_id - EC2 instance ID, hours - Time range in hours
    Returns: Dictionary with metric data or error
    """
    cloudwatch = boto3.client("cloudwatch", region_name=AWS_REGION)
    
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)
        
        response = cloudwatch.get_metric_statistics(
            Namespace="AWS/EC2",
            MetricName="NetworkOut",
            Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
            StartTime=start_time,
            EndTime=end_time,
            Period=300,
            Statistics=["Average"],
            Unit="Bytes"
        )
        
        return response
    except Exception as e:
        return {"error": str(e)}


def fetch_ec2_metrics_enriched(instance_id, hours=1):
    """
    Fetch enriched EC2 metrics from CloudWatch and EC2 metadata
    Returns enriched metrics dictionary with CPU, memory, disk, network, and uptime
    Args:
        instance_id - EC2 instance ID
        hours - Time range in hours for metrics (default: 1)
    Returns: Dictionary with enriched metrics or error
    """
    # Fetch EC2 instance metadata
    instance_metadata = fetch_ec2_instance_metadata(instance_id)
    if "error" in instance_metadata:
        return instance_metadata
    
    # Calculate uptime
    launch_time = instance_metadata.get("launch_time")
    uptime_days = calculate_uptime_days(launch_time) if launch_time else None
    
    # Fetch CloudWatch metrics
    cpu_data = fetch_cpu_utilization(instance_id, hours)
    memory_data = fetch_memory_utilization(instance_id, hours)
    disk_data = fetch_disk_utilization(instance_id, hours)
    network_in_data = fetch_network_in(instance_id, hours)
    network_out_data = fetch_network_out(instance_id, hours)
    
    # Process and aggregate metrics
    cpu_usage = aggregate_metric_datapoints(cpu_data.get("Datapoints", [])) if "error" not in cpu_data else None
    memory_usage = aggregate_metric_datapoints(memory_data.get("Datapoints", [])) if memory_data else None
    disk_usage = aggregate_metric_datapoints(disk_data.get("Datapoints", [])) if disk_data else None
    
    # Process network metrics (convert bytes to MB/s)
    network_in_bytes = aggregate_metric_datapoints(network_in_data.get("Datapoints", [])) if "error" not in network_in_data else None
    network_out_bytes = aggregate_metric_datapoints(network_out_data.get("Datapoints", [])) if "error" not in network_out_data else None
    
    network_in_mbps = convert_network_bytes_to_mbps(network_in_bytes, 300) if network_in_bytes else None
    network_out_mbps = convert_network_bytes_to_mbps(network_out_bytes, 300) if network_out_bytes else None
    
    # Round CPU, memory, disk to 2 decimal places
    cpu_usage = round(cpu_usage, 2) if cpu_usage is not None else None
    memory_usage = round(memory_usage, 2) if memory_usage is not None else None
    disk_usage = round(disk_usage, 2) if disk_usage is not None else None
    
    # Build enriched metrics response
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=hours)
    
    return {
        "instance_id": instance_id,
        "metrics": {
            "cpu_usage_percent": cpu_usage,
            "memory_usage_percent": memory_usage,
            "disk_usage_percent": disk_usage,
            "network_in_mbps": network_in_mbps,
            "network_out_mbps": network_out_mbps,
            "uptime_days": uptime_days
        },
        "metadata": {
            "instance_type": instance_metadata.get("instance_type"),
            "instance_state": instance_metadata.get("state"),
            "launch_time": launch_time.isoformat() + 'Z' if launch_time else None,
            "region": instance_metadata.get("region"),
            "availability_zone": instance_metadata.get("availability_zone")
        },
        "timestamp": datetime.utcnow().isoformat() + 'Z',
        "time_range": {
            "start": start_time.isoformat() + 'Z',
            "end": end_time.isoformat() + 'Z'
        }
    }
