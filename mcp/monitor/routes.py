"""
Monitor Routes - Flask Blueprint for monitoring endpoints
Provides endpoints for CloudWatch metrics and mock data analysis with LLM integration
"""
from flask import Blueprint, jsonify, request
from .cloudwatch_client import fetch_ec2_metrics
from .mock_data import load_logs, load_metrics, get_resource_by_id, get_logs_by_resource, get_customer_health_summary
from ..Nvidia_llm.AI_client import analyze_with_nvidia, analyze_metrics_with_nvidia, analyze_logs_with_nvidia, analyze_customer_health

# Create Flask Blueprint for monitor routes
monitor_bp = Blueprint("monitor", __name__)

# ============================================================================
# Real CloudWatch Endpoint
# ============================================================================

@monitor_bp.route("/metrics", methods=["GET"])
def get_ec2_metrics():
    """
    Get EC2 metrics from AWS CloudWatch with LLM analysis
    Query params: instance_id (required) - AWS EC2 instance ID
    Returns: CloudWatch metrics data + LLM analysis
    """
    instance_id = request.args.get("instance_id")
    if not instance_id:
        return jsonify({"error": "Please provide ?instance_id=..."}), 400
    
    # Fetch CloudWatch metrics from AWS
    metrics = fetch_ec2_metrics(instance_id)
    if "error" in metrics:
        return jsonify(metrics), 500

    # Analyze metrics with NVIDIA Nemotron LLM
    llm_analysis = analyze_with_nvidia(metrics)
    
    # Return both raw metrics and LLM analysis
    return jsonify({
        "metrics": metrics,
        "analysis": llm_analysis
    })

# ============================================================================
# Mock Data Endpoints - For Testing
# ============================================================================

@monitor_bp.route("/mock/metrics", methods=["GET"])
def get_mock_metrics():
    """
    Get all resources from mock metrics.json file
    Returns: List of all resources with total count
    """
    resources = load_metrics()
    if resources is None:
        return jsonify({"error": "Failed to load metrics.json"}), 500
    
    return jsonify({
        "resources": resources,
        "total": len(resources)
    })

@monitor_bp.route("/mock/metrics/<resource_id>", methods=["GET"])
def get_mock_resource_metrics(resource_id):
    """
    Get specific resource metrics with LLM analysis
    Path param: resource_id - Resource ID (e.g., "res_vm_001")
    Returns: Resource data + LLM analysis of metrics, security, and health
    """
    resource = get_resource_by_id(resource_id)
    if not resource:
        return jsonify({"error": f"Resource {resource_id} not found"}), 404
    
    # Analyze resource metrics, security, and health with LLM
    analysis = analyze_metrics_with_nvidia(resource)
    
    return jsonify({
        "resource": resource,
        "analysis": analysis
    })

@monitor_bp.route("/mock/logs", methods=["GET"])
def get_mock_logs():
    """
    Get logs from mock logs.json file with optional filtering
    Query params:
        - resource_id (optional) - Filter logs by resource ID
        - status (optional) - Filter logs by status (OK, ERROR, WARNING, CRITICAL)
    Returns: Filtered logs with total count
    """
    logs = load_logs()
    if logs is None:
        return jsonify({"error": "Failed to load logs.json"}), 500
    
    # Apply optional filters from query parameters
    resource_id = request.args.get("resource_id")
    status = request.args.get("status")
    
    filtered_logs = logs
    # Filter by resource if resource_id is provided
    if resource_id:
        filtered_logs = [log for log in filtered_logs if resource_id in log.get("resources_affected", [])]
    # Filter by status if status is provided
    if status:
        filtered_logs = [log for log in filtered_logs if log.get("status") == status]
    
    return jsonify({
        "logs": filtered_logs,
        "total": len(filtered_logs)
    })

@monitor_bp.route("/mock/logs/analysis", methods=["GET"])
def analyze_mock_logs():
    """
    Analyze logs with LLM, includes status distribution
    Query params:
        - resource_id (optional) - Analyze logs for specific resource
        - status (optional) - Analyze logs with specific status
    Returns: Total logs, status distribution, and LLM analysis
    """
    logs = load_logs()
    if logs is None:
        return jsonify({"error": "Failed to load logs.json"}), 500
    
    # Apply optional filters from query parameters
    resource_id = request.args.get("resource_id")
    status = request.args.get("status")
    
    filtered_logs = logs
    # Filter by resource if resource_id is provided
    if resource_id:
        filtered_logs = [log for log in filtered_logs if resource_id in log.get("resources_affected", [])]
    # Filter by status if status is provided
    if status:
        filtered_logs = [log for log in filtered_logs if log.get("status") == status]
    
    if not filtered_logs:
        return jsonify({"error": "No logs found with the specified filters"}), 404
    
    # Analyze filtered logs with LLM
    analysis = analyze_logs_with_nvidia(filtered_logs)
    
    # Calculate status distribution (count of each status type)
    status_counts = {}
    for log in filtered_logs:
        s = log.get("status", "UNKNOWN")
        status_counts[s] = status_counts.get(s, 0) + 1
    
    return jsonify({
        "total_logs": len(filtered_logs),
        "status_distribution": status_counts,
        "analysis": analysis
    })

@monitor_bp.route("/mock/resource/<resource_id>/combined", methods=["GET"])
def get_combined_resource_analysis(resource_id):
    """
    Get combined analysis of logs + metrics for a specific resource
    Path param: resource_id - Resource ID to analyze
    Returns: Resource data, metrics analysis, logs analysis, and log count
    This endpoint provides a comprehensive view by analyzing both metrics and logs together
    """
    resource = get_resource_by_id(resource_id)
    if not resource:
        return jsonify({"error": f"Resource {resource_id} not found"}), 404
    
    # Get all logs associated with this resource
    logs = get_logs_by_resource(resource_id)
    
    # Analyze resource metrics (CPU, memory, security, etc.)
    metrics_analysis = analyze_metrics_with_nvidia(resource)
    
    # Analyze logs for this resource (errors, patterns, etc.)
    logs_analysis = analyze_logs_with_nvidia(logs) if logs else {"analysis": "No logs found for this resource"}
    
    return jsonify({
        "resource": resource,
        "metrics_analysis": metrics_analysis,
        "logs_analysis": logs_analysis,
        "logs_count": len(logs)
    })

@monitor_bp.route("/mock/customers/health", methods=["GET"])
def get_customer_health():
    """
    Get customer health summary with LLM analysis
    Analyzes all logs grouped by customer and calculates health metrics
    Returns: Customer health metrics, critical issues, and LLM summary
    """
    # Get customer health data from logs
    health_data = get_customer_health_summary()
    if health_data is None:
        return jsonify({"error": "Failed to load logs.json"}), 500
    
    # Extract customer metrics and critical issues
    affected_customers = health_data.get("affected_customers", [])
    critical_issues = health_data.get("critical_issues", [])
    
    # Calculate overall statistics
    total_logs = sum(c["total_logs"] for c in affected_customers)
    total_errors = sum(c["error_logs"] for c in affected_customers)
    total_warnings = sum(c["warning_logs"] for c in affected_customers)
    total_critical = sum(c["critical_logs"] for c in affected_customers)
    total_customers = len(affected_customers)
    
    # Calculate overall health percentage
    ok_logs = total_logs - total_errors - total_warnings - total_critical
    overall_health_value = round((ok_logs / total_logs * 100) if total_logs > 0 else 100.0, 2)
    # Format overall health percentage with % symbol
    overall_health_percent = f"{overall_health_value}%"
    
    # Generate LLM summary
    llm_analysis = analyze_customer_health(health_data, critical_issues)
    
    # Build response
    return jsonify({
        "summary": llm_analysis.get("analysis", "Analysis not available"),
        "affected_customers": affected_customers,
        "critical_issues": critical_issues,
        "overall_statistics": {
            "total_logs": total_logs,
            "total_customers": total_customers,
            "overall_health_percent": overall_health_percent,
            "total_errors": total_errors,
            "total_critical": total_critical,
            "total_warnings": total_warnings
        }
    })
