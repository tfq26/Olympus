from flask import Blueprint, jsonify, request
from .cloudwatch_client import fetch_ec2_metrics

monitor_bp = Blueprint("monitor", __name__)

@monitor_bp.route("/metrics", methods=["GET"])
def get_ec2_metrics():
    instance_id = request.args.get("instance_id")
    if not instance_id:
        return jsonify({"error": "Please provide ?instance_id=..."}), 400
    
    metrics = fetch_ec2_metrics(instance_id)
    if "error" in metrics:
        return jsonify(metrics), 500

    return jsonify(metrics)
