from flask import Blueprint, jsonify, request
from .cloudwatch_client import fetch_ec2_metrics
from ..Nvidia_llm.AI_client import analyze_with_nvidia

monitor_bp = Blueprint("monitor", __name__)

@monitor_bp.route("/metrics", methods=["GET"])
def get_ec2_metrics():
    instance_id = request.args.get("instance_id")
    if not instance_id:
        return jsonify({"error": "Please provide ?instance_id=..."}), 400
    
    # Fetch CloudWatch metrics
    metrics = fetch_ec2_metrics(instance_id)
    if "error" in metrics:
        return jsonify(metrics), 500

    # Analyze metrics with NVIDIA Nemotron LLM
    llm_analysis = analyze_with_nvidia(metrics)
    
    # Return both metrics and analysis
    return jsonify({
        "metrics": metrics,
        "analysis": llm_analysis
    })
