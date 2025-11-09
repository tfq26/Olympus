"""
Monitor Routes - Flask Blueprint for monitoring endpoints
Provides endpoints for CloudWatch metrics and mock data analysis with LLM integration
"""
from flask import Blueprint, jsonify, request
from .cloudwatch_client import fetch_ec2_metrics, fetch_ec2_metrics_enriched
from .log_data import load_logs, load_metrics, get_resource_by_id, get_logs_by_resource, get_customer_health_summary
from .metrics_updater import update_resource_metrics
from .ticket_system import (
    create_ticket_from_issue, get_ticket_by_id, load_tickets, approve_critical_ticket,
    reject_critical_ticket, load_employees, load_admins, get_employee_by_id, get_admin_by_id,
    update_ticket
)
from ..Nvidia_llm.AI_client import analyze_with_nvidia, analyze_metrics_with_nvidia, analyze_logs_with_nvidia

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


@monitor_bp.route("/metrics/enriched", methods=["GET"])
def get_ec2_metrics_enriched():
    """
    Get enriched EC2 metrics from CloudWatch and EC2 metadata
    Automatically updates metrics.json with fetched data (replaces existing, no duplicates)
    Query params: 
        instance_id (required) - AWS EC2 instance ID
        resource_id (optional) - Resource ID to update (if instance_id not in resource)
        auto_update (optional) - Set to 'false' to disable auto-update (default: 'true')
    Returns: Enriched metrics (CPU, memory, disk, network, uptime) + metadata + update status
    """
    instance_id = request.args.get("instance_id")
    if not instance_id:
        return jsonify({"error": "Please provide ?instance_id=..."}), 400
    
    resource_id = request.args.get("resource_id")
    auto_update = request.args.get("auto_update", "true").lower() == "true"
    
    # Fetch enriched metrics from CloudWatch and EC2
    enriched_metrics = fetch_ec2_metrics_enriched(instance_id)
    if "error" in enriched_metrics:
        return jsonify(enriched_metrics), 500
    
    # Automatically update metrics.json (unless disabled)
    update_result = None
    if auto_update:
        update_result = update_resource_metrics(instance_id, resource_id, auto_create=False)
        # If update failed but we have metrics, still return the metrics
        # (update failure is not critical for viewing metrics)
        if "error" in update_result:
            # Log error but don't fail the request
            enriched_metrics["update_warning"] = update_result.get("error")
        else:
            enriched_metrics["update_status"] = "updated"
            enriched_metrics["resource_id"] = update_result.get("resource_id")
    
    return jsonify(enriched_metrics)


@monitor_bp.route("/metrics/update", methods=["POST"])
def update_metrics():
    """
    Update resource metrics in metrics.json with enriched CloudWatch data
    Query params:
        instance_id (required) - EC2 instance ID
        resource_id (optional) - Resource ID to update (if instance_id not in resource)
    Returns: Update result with updated metrics
    """
    instance_id = request.args.get("instance_id")
    resource_id = request.args.get("resource_id")
    
    if not instance_id:
        return jsonify({"error": "Please provide ?instance_id=..."}), 400
    
    # Update metrics in metrics.json
    result = update_resource_metrics(instance_id, resource_id)
    
    if "error" in result:
        return jsonify(result), 500
    
    return jsonify(result)

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
    Get customer health summary
    Analyzes all logs grouped by customer and calculates health metrics
    Returns: Customer health metrics, critical issues, and overall statistics
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
    
    # Build response (without LLM summary)
    return jsonify({
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

# ============================================================================
# Ticket System Endpoints
# ============================================================================

@monitor_bp.route("/tickets", methods=["GET"])
def get_tickets():
    """
    Get all tickets with optional filtering
    Query params:
        - status (optional) - Filter by status (PENDING_APPROVAL, ASSIGNED, etc.)
        - severity (optional) - Filter by severity (CRITICAL, HIGH, MEDIUM, LOW)
        - employee_id (optional) - Filter by assigned employee
    Returns: List of tickets with total count
    """
    data = load_tickets()
    tickets = data.get("tickets", [])
    
    # Apply filters
    status = request.args.get("status")
    severity = request.args.get("severity")
    employee_id = request.args.get("employee_id")
    
    filtered_tickets = tickets
    if status:
        filtered_tickets = [t for t in filtered_tickets if t.get("status") == status]
    if severity:
        filtered_tickets = [t for t in filtered_tickets if t.get("severity") == severity.upper()]
    if employee_id:
        filtered_tickets = [t for t in filtered_tickets if t.get("assigned_employee_ID") == employee_id]
    
    return jsonify({
        "tickets": filtered_tickets,
        "total": len(filtered_tickets)
    })


@monitor_bp.route("/tickets/pending", methods=["GET"])
def get_pending_tickets():
    """
    Get all CRITICAL tickets pending admin approval
    Returns: List of pending tickets
    """
    data = load_tickets()
    tickets = data.get("tickets", [])
    
    pending_tickets = [
        t for t in tickets
        if t.get("status") == "PENDING_APPROVAL" and t.get("severity") == "CRITICAL"
    ]
    
    return jsonify({
        "tickets": pending_tickets,
        "total": len(pending_tickets)
    })


@monitor_bp.route("/tickets/<ticket_id>", methods=["GET"])
def get_ticket(ticket_id):
    """
    Get a specific ticket by ID
    Path param: ticket_id - Ticket ID
    Returns: Ticket details
    """
    ticket = get_ticket_by_id(ticket_id)
    if not ticket:
        return jsonify({"error": f"Ticket {ticket_id} not found"}), 404
    
    return jsonify(ticket)


@monitor_bp.route("/tickets", methods=["POST"])
def create_ticket_endpoint():
    """
    Create a new ticket (manual creation)
    Body: {
        "issue": "Issue description",
        "resource_id": "res_vm_001",
        "severity": "HIGH",
        "issue_type": "cpu_spike",
        "description": "Detailed description",
        "customer_name": "Customer Name"
    }
    Returns: Created ticket
    """
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    issue = data.get("issue")
    resource_id = data.get("resource_id")
    severity = data.get("severity", "MEDIUM")
    issue_type = data.get("issue_type", "general")
    description = data.get("description")
    customer_name = data.get("customer_name")
    logs_related = data.get("logs_related", [])
    metrics_snapshot = data.get("metrics_snapshot", {})
    
    if not issue or not resource_id:
        return jsonify({"error": "issue and resource_id are required"}), 400
    
    ticket = create_ticket_from_issue(
        issue, resource_id, severity, issue_type,
        description, customer_name, logs_related, metrics_snapshot
    )
    
    if not ticket:
        return jsonify({"error": "Failed to create ticket"}), 500
    
    return jsonify(ticket), 201


@monitor_bp.route("/tickets/<ticket_id>/approve", methods=["POST"])
def approve_ticket(ticket_id):
    """
    Approve a CRITICAL ticket and assign to employee
    Body: {
        "admin_id": "ADMIN001",
        "employee_id": "EMP004" (optional, uses suggested if not provided)
    }
    Returns: Approved ticket
    """
    data = request.get_json() or {}
    admin_id = data.get("admin_id")
    employee_id = data.get("employee_id")
    
    if not admin_id:
        return jsonify({"error": "admin_id is required"}), 400
    
    # Check if admin exists
    admin = get_admin_by_id(admin_id)
    if not admin:
        return jsonify({"error": "Admin not found"}), 404
    
    result = approve_critical_ticket(ticket_id, admin_id, employee_id)
    
    if "error" in result:
        return jsonify(result), 400
    
    return jsonify(result)


@monitor_bp.route("/tickets/<ticket_id>/reject", methods=["POST"])
def reject_ticket(ticket_id):
    """
    Reject a CRITICAL ticket
    Body: {
        "admin_id": "ADMIN001",
        "reason": "False positive" (optional)
    }
    Returns: Rejected ticket
    """
    data = request.get_json() or {}
    admin_id = data.get("admin_id")
    reason = data.get("reason")
    
    if not admin_id:
        return jsonify({"error": "admin_id is required"}), 400
    
    # Check if admin exists
    admin = get_admin_by_id(admin_id)
    if not admin:
        return jsonify({"error": "Admin not found"}), 404
    
    result = reject_critical_ticket(ticket_id, admin_id, reason)
    
    if "error" in result:
        return jsonify(result), 400
    
    return jsonify(result)


@monitor_bp.route("/tickets/<ticket_id>/resolve", methods=["POST"])
def resolve_ticket(ticket_id):
    """
    Resolve a ticket
    Body: {
        "resolution": "Issue resolved by..." (optional)
    }
    Returns: Resolved ticket
    """
    data = request.get_json() or {}
    resolution = data.get("resolution")
    
    ticket = get_ticket_by_id(ticket_id)
    if not ticket:
        return jsonify({"error": "Ticket not found"}), 404
    
    from datetime import datetime
    updates = {
        "status": "RESOLVED",
        "resolved_at": datetime.utcnow().isoformat() + 'Z',
        "resolution": resolution
    }
    
    # Decrement employee workload if ticket was assigned
    if ticket.get("assigned_employee_ID"):
        from .ticket_system import update_employee_workload
        update_employee_workload(ticket.get("assigned_employee_ID"), -1)
    
    if update_ticket(ticket_id, updates):
        return jsonify(get_ticket_by_id(ticket_id))
    return jsonify({"error": "Failed to update ticket"}), 500


@monitor_bp.route("/employees", methods=["GET"])
def get_employees():
    """
    Get all employees
    Returns: List of employees
    """
    data = load_employees()
    return jsonify({
        "employees": data.get("employees", []),
        "total": len(data.get("employees", []))
    })


@monitor_bp.route("/employees/<employee_id>", methods=["GET"])
def get_employee(employee_id):
    """
    Get a specific employee by ID
    Path param: employee_id - Employee ID
    Returns: Employee details
    """
    employee = get_employee_by_id(employee_id)
    if not employee:
        return jsonify({"error": f"Employee {employee_id} not found"}), 404
    
    return jsonify(employee)


@monitor_bp.route("/admins", methods=["GET"])
def get_admins():
    """
    Get all admins
    Returns: List of admins
    """
    data = load_admins()
    return jsonify({
        "admins": data.get("admins", []),
        "total": len(data.get("admins", []))
    })


@monitor_bp.route("/logs/create-tickets", methods=["POST"])
def create_tickets_from_logs():
    """
    Create tickets from logs based on error status
    Query params:
        - resource_id (optional) - Filter logs by resource
        - status (optional) - Filter logs by status (ERROR, CRITICAL, WARNING)
    Returns: List of created tickets
    """
    logs = load_logs()
    if logs is None:
        return jsonify({"error": "Failed to load logs.json"}), 500
    
    resource_id = request.args.get("resource_id")
    status_filter = request.args.get("status")
    
    # Filter logs
    filtered_logs = logs
    if resource_id:
        filtered_logs = [log for log in filtered_logs if resource_id in log.get("resources_affected", [])]
    if status_filter:
        filtered_logs = [log for log in filtered_logs if log.get("status") == status_filter.upper()]
    
    # Filter for error logs only
    error_logs = [
        log for log in filtered_logs
        if log.get("status") in ["ERROR", "CRITICAL", "WARNING", "STALE"]
    ]
    
    created_tickets = []
    
    for log in error_logs:
        severity = log.get("status", "MEDIUM")
        resource_id = log.get("resources_affected", [""])[0] if log.get("resources_affected") else "unknown"
        customer_name = log.get("customer_name")
        issue = f"{severity}: {log.get('subtype', 'Unknown issue')} detected in {resource_id}"
        issue_type = "error_log"
        description = f"Log entry: {log.get('log_code', 'N/A')} - {log.get('subtype', 'Unknown')}"
        
        ticket = create_ticket_from_issue(
            issue, resource_id, severity, issue_type,
            description, customer_name, [log.get("id")], {}
        )
        
        if ticket:
            created_tickets.append(ticket)
    
    return jsonify({
        "tickets_created": len(created_tickets),
        "tickets": created_tickets
    })


@monitor_bp.route("/metrics/create-tickets", methods=["POST"])
def create_tickets_from_metrics():
    """
    Create tickets from metrics anomalies
    Query params:
        - resource_id (optional) - Filter resources by ID
    Returns: List of created tickets
    """
    resources = load_metrics()
    if resources is None:
        return jsonify({"error": "Failed to load metrics.json"}), 500
    
    resource_id_filter = request.args.get("resource_id")
    
    # Filter resources
    filtered_resources = resources
    if resource_id_filter:
        filtered_resources = [r for r in resources if r.get("id") == resource_id_filter]
    
    created_tickets = []
    
    for resource in filtered_resources:
        metrics = resource.get("metrics", {})
        resource_id = resource.get("id")
        customer_name = resource.get("tags", {}).get("customer") or "Unknown"
        
        # Check for CPU anomaly
        cpu_usage = metrics.get("cpu_usage_percent")
        if cpu_usage and cpu_usage > 90:
            severity = "CRITICAL" if cpu_usage > 95 else "HIGH"
            issue = f"{severity}: CPU usage at {cpu_usage}% in {resource_id}"
            ticket = create_ticket_from_issue(
                issue, resource_id, severity, "cpu_spike",
                f"CPU usage has exceeded threshold: {cpu_usage}%",
                customer_name, [], {"cpu_usage_percent": cpu_usage}
            )
            if ticket:
                created_tickets.append(ticket)
        
        # Check for memory anomaly
        memory_usage = metrics.get("memory_usage_percent")
        if memory_usage and memory_usage > 90:
            severity = "CRITICAL" if memory_usage > 95 else "HIGH"
            issue = f"{severity}: Memory usage at {memory_usage}% in {resource_id}"
            ticket = create_ticket_from_issue(
                issue, resource_id, severity, "memory_leak",
                f"Memory usage has exceeded threshold: {memory_usage}%",
                customer_name, [], {"memory_usage_percent": memory_usage}
            )
            if ticket:
                created_tickets.append(ticket)
        
        # Check for disk anomaly
        disk_usage = metrics.get("disk_usage_percent")
        if disk_usage and disk_usage > 90:
            severity = "CRITICAL" if disk_usage > 95 else "HIGH"
            issue = f"{severity}: Disk usage at {disk_usage}% in {resource_id}"
            ticket = create_ticket_from_issue(
                issue, resource_id, severity, "disk_full",
                f"Disk usage has exceeded threshold: {disk_usage}%",
                customer_name, [], {"disk_usage_percent": disk_usage}
            )
            if ticket:
                created_tickets.append(ticket)
    
    return jsonify({
        "tickets_created": len(created_tickets),
        "tickets": created_tickets
    })
