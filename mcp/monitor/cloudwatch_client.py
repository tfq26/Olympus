import boto3
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

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
