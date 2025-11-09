"""
Ticket System Module
Handles automatic ticket creation, assignment, and admin approval for CRITICAL tickets
Uses DynamoDB with JSON fallback
"""
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Calculate project root directory (3 levels up from this file)
BASE_DIR = Path(__file__).parent.parent.parent
TICKETS_FILE = BASE_DIR / "tickets.json"
EMPLOYEES_FILE = BASE_DIR / "employees.json"
ADMINS_FILE = BASE_DIR / "admins.json"

# Try to import DynamoDB client
USE_DYNAMODB = False
try:
    import boto3
    from botocore.exceptions import ClientError
    
    DYNAMODB_REGION = os.getenv("DYNAMODB_REGION", "us-east-1")
    TICKETS_TABLE_NAME = os.getenv("DYNAMODB_TABLE_TICKETS", "tickets-table")
    EMPLOYEES_TABLE_NAME = os.getenv("DYNAMODB_TABLE_EMPLOYEES", "employees-table")
    ADMINS_TABLE_NAME = os.getenv("DYNAMODB_TABLE_ADMINS", "admins-table")
    
    # Initialize DynamoDB resource
    dynamodb = boto3.resource("dynamodb", region_name=DYNAMODB_REGION)
    tickets_table = dynamodb.Table(TICKETS_TABLE_NAME)
    employees_table = dynamodb.Table(EMPLOYEES_TABLE_NAME)
    admins_table = dynamodb.Table(ADMINS_TABLE_NAME)
    
    USE_DYNAMODB = True
    print(f"✅ Ticket System: Using DynamoDB (tickets: {TICKETS_TABLE_NAME})")
except Exception as e:
    USE_DYNAMODB = False
    print(f"⚠️  Ticket System: DynamoDB unavailable, using JSON files. Error: {e}")


# ============================================================================
# Employee Database Functions (DynamoDB + JSON Fallback)
# ============================================================================

def load_employees():
    """Load employees from DynamoDB or JSON fallback"""
    if USE_DYNAMODB:
        try:
            response = employees_table.scan()
            employees_list = response.get("Items", [])
            # Handle pagination
            while "LastEvaluatedKey" in response:
                response = employees_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
                employees_list.extend(response.get("Items", []))
            return {"employees": employees_list}
        except Exception as e:
            print(f"Error loading employees from DynamoDB, falling back to JSON: {e}")
    
    # Fallback to JSON
    try:
        if EMPLOYEES_FILE.exists():
            with open(EMPLOYEES_FILE, 'r') as f:
                return json.load(f)
        return {"employees": []}
    except Exception as e:
        print(f"Error loading employees: {e}")
        return {"employees": []}


def save_employees(data):
    """Save employees to DynamoDB or JSON fallback"""
    if USE_DYNAMODB:
        try:
            # Update all employees in DynamoDB
            with employees_table.batch_writer() as batch:
                for employee in data.get("employees", []):
                    batch.put_item(Item=employee)
            return True
        except Exception as e:
            print(f"Error saving employees to DynamoDB, falling back to JSON: {e}")
    
    # Fallback to JSON
    try:
        with open(EMPLOYEES_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving employees: {e}")
        return False


def get_employee_by_id(employee_id):
    """Get employee by ID from DynamoDB or JSON"""
    if USE_DYNAMODB:
        try:
            response = employees_table.get_item(Key={"employee_id": employee_id})
            return response.get("Item")
        except Exception as e:
            print(f"Error getting employee from DynamoDB, falling back to JSON: {e}")
    
    # Fallback to JSON
    data = load_employees()
    for employee in data.get("employees", []):
        if employee.get("employee_id") == employee_id:
            return employee
    return None


def update_employee_workload(employee_id, increment=1):
    """Update employee workload (increment or decrement)"""
    data = load_employees()
    for employee in data.get("employees", []):
        if employee.get("employee_id") == employee_id:
            current_workload = employee.get("current_workload", 0)
            employee["current_workload"] = max(0, current_workload + increment)
            save_employees(data)
            return True
    return False


# ============================================================================
# Admin Database Functions (DynamoDB + JSON Fallback)
# ============================================================================

def load_admins():
    """Load admins from DynamoDB or JSON fallback"""
    if USE_DYNAMODB:
        try:
            response = admins_table.scan()
            admins_list = response.get("Items", [])
            # Handle pagination
            while "LastEvaluatedKey" in response:
                response = admins_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
                admins_list.extend(response.get("Items", []))
            return {"admins": admins_list}
        except Exception as e:
            print(f"Error loading admins from DynamoDB, falling back to JSON: {e}")
    
    # Fallback to JSON
    try:
        if ADMINS_FILE.exists():
            with open(ADMINS_FILE, 'r') as f:
                return json.load(f)
        return {"admins": []}
    except Exception as e:
        print(f"Error loading admins: {e}")
        return {"admins": []}


def save_admins(data):
    """Save admins to DynamoDB or JSON fallback"""
    if USE_DYNAMODB:
        try:
            with admins_table.batch_writer() as batch:
                for admin in data.get("admins", []):
                    batch.put_item(Item=admin)
            return True
        except Exception as e:
            print(f"Error saving admins to DynamoDB, falling back to JSON: {e}")
    
    # Fallback to JSON
    try:
        with open(ADMINS_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving admins: {e}")
        return False


def get_admin_by_id(admin_id):
    """Get admin by ID from DynamoDB or JSON"""
    if USE_DYNAMODB:
        try:
            response = admins_table.get_item(Key={"admin_id": admin_id})
            return response.get("Item")
        except Exception as e:
            print(f"Error getting admin from DynamoDB, falling back to JSON: {e}")
    
    # Fallback to JSON
    data = load_admins()
    for admin in data.get("admins", []):
        if admin.get("admin_id") == admin_id:
            return admin
    return None


# ============================================================================
# Ticket Database Functions (DynamoDB + JSON Fallback)
# ============================================================================

def load_tickets():
    """Load tickets from DynamoDB or JSON fallback"""
    if USE_DYNAMODB:
        try:
            response = tickets_table.scan()
            tickets_list = response.get("Items", [])
            # Handle pagination
            while "LastEvaluatedKey" in response:
                response = tickets_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
                tickets_list.extend(response.get("Items", []))
            return {"tickets": tickets_list}
        except Exception as e:
            print(f"Error loading tickets from DynamoDB, falling back to JSON: {e}")
    
    # Fallback to JSON
    try:
        if TICKETS_FILE.exists():
            with open(TICKETS_FILE, 'r') as f:
                return json.load(f)
        return {"tickets": []}
    except Exception as e:
        print(f"Error loading tickets: {e}")
        return {"tickets": []}


def save_tickets(data):
    """Save tickets to DynamoDB or JSON fallback (deprecated - use create_ticket instead)"""
    if USE_DYNAMODB:
        try:
            with tickets_table.batch_writer() as batch:
                for ticket in data.get("tickets", []):
                    batch.put_item(Item=ticket)
            return True
        except Exception as e:
            print(f"Error saving tickets to DynamoDB, falling back to JSON: {e}")
    
    # Fallback to JSON
    try:
        with open(TICKETS_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving tickets: {e}")
        return False


def get_ticket_by_id(ticket_id):
    """Get ticket by ID from DynamoDB or JSON"""
    if USE_DYNAMODB:
        try:
            response = tickets_table.get_item(Key={"ticket_id": ticket_id})
            return response.get("Item")
        except Exception as e:
            print(f"Error getting ticket from DynamoDB, falling back to JSON: {e}")
    
    # Fallback to JSON
    data = load_tickets()
    for ticket in data.get("tickets", []):
        if ticket.get("ticket_id") == ticket_id:
            return ticket
    return None


def create_ticket(ticket_data):
    """Create a new ticket in DynamoDB or JSON"""
    if USE_DYNAMODB:
        try:
            tickets_table.put_item(Item=ticket_data)
            print(f"✅ Ticket {ticket_data.get('ticket_id')} saved to DynamoDB")
            return True
        except Exception as e:
            print(f"Error creating ticket in DynamoDB, falling back to JSON: {e}")
    
    # Fallback to JSON
    data = load_tickets()
    if "tickets" not in data:
        data["tickets"] = []
    
    data["tickets"].append(ticket_data)
    return save_tickets(data)


def update_ticket(ticket_id, updates):
    """Update ticket with new data in DynamoDB or JSON"""
    if USE_DYNAMODB:
        try:
            # Get existing ticket
            ticket = get_ticket_by_id(ticket_id)
            if ticket:
                ticket.update(updates)
                tickets_table.put_item(Item=ticket)
                print(f"✅ Ticket {ticket_id} updated in DynamoDB")
                return True
            return False
        except Exception as e:
            print(f"Error updating ticket in DynamoDB, falling back to JSON: {e}")
    
    # Fallback to JSON
    data = load_tickets()
    for ticket in data.get("tickets", []):
        if ticket.get("ticket_id") == ticket_id:
            ticket.update(updates)
            return save_tickets(data)
    return False


# ============================================================================
# Auto-Assignment Logic
# ============================================================================

def score_employee(employee, required_skills, issue_type, specialization_match):
    """
    Score an employee based on skills, experience, workload, and specialization
    Returns: Score (0-100)
    """
    score = 0
    
    # Skill match (40% weight)
    employee_skills = set(employee.get("skills", []))
    required_skills_set = set(required_skills)
    if required_skills_set:
        skill_match_percentage = len(employee_skills & required_skills_set) / len(required_skills_set)
        score += skill_match_percentage * 40
    else:
        score += 40  # If no required skills, give full points
    
    # Experience level (25% weight)
    experience_level = employee.get("experience_level", "junior").lower()
    experience_scores = {
        "senior": 25,
        "mid": 15,
        "junior": 10,
        "entry": 5
    }
    score += experience_scores.get(experience_level, 10)
    
    # Current workload (20% weight) - lower is better
    # Convert to float to handle DynamoDB Decimal types
    current_workload = float(employee.get("current_workload", 0))
    max_workload = float(employee.get("max_workload", 5))
    workload_percentage = 1 - (current_workload / max_workload) if max_workload > 0 else 1
    score += workload_percentage * 20
    
    # Specialization match (15% weight)
    employee_specializations = set(employee.get("specializations", []))
    if specialization_match in employee_specializations:
        score += 15
    elif employee_specializations:
        score += 5  # Partial match
    
    return round(score, 2)


def find_best_employee(required_skills, issue_type, specialization):
    """
    Find the best employee for a ticket based on scoring
    Returns: Employee dictionary or None
    """
    data = load_employees()
    employees = data.get("employees", [])
    
    # Filter available employees (convert Decimal to float for comparison)
    available_employees = [
        emp for emp in employees
        if emp.get("availability_status", "unavailable").lower() == "available"
        and float(emp.get("current_workload", 0)) < float(emp.get("max_workload", 5))
    ]
    
    if not available_employees:
        return None
    
    # Score all available employees
    scored_employees = []
    for employee in available_employees:
        score = score_employee(employee, required_skills, issue_type, specialization)
        scored_employees.append((score, employee))
    
    # Sort by score (highest first)
    scored_employees.sort(key=lambda x: x[0], reverse=True)
    
    # Return best employee
    if scored_employees:
        return scored_employees[0][1]
    return None


def determine_required_skills(issue_type, severity):
    """Determine required skills based on issue type and severity"""
    skill_map = {
        "memory_leak": ["Python", "AWS", "DevOps", "Monitoring"],
        "cpu_spike": ["AWS", "DevOps", "Performance", "CloudWatch"],
        "disk_full": ["AWS", "DevOps", "Storage", "EC2"],
        "network_issue": ["AWS", "Network", "DevOps", "CloudWatch"],
        "security": ["Security", "AWS", "DevOps", "Compliance"],
        "error_log": ["Python", "AWS", "DevOps", "Troubleshooting"],
        "performance": ["Performance", "AWS", "DevOps", "Monitoring"],
        "infrastructure": ["AWS", "DevOps", "Infrastructure", "CloudWatch"]
    }
    
    return skill_map.get(issue_type, ["AWS", "DevOps"])


def determine_specialization(issue_type):
    """Determine specialization based on issue type"""
    specialization_map = {
        "memory_leak": "performance",
        "cpu_spike": "performance",
        "disk_full": "infrastructure",
        "network_issue": "infrastructure",
        "security": "security",
        "error_log": "troubleshooting",
        "performance": "performance",
        "infrastructure": "infrastructure"
    }
    
    return specialization_map.get(issue_type, "general")


# ============================================================================
# Ticket Creation Functions
# ============================================================================

def generate_ticket_id():
    """Generate a unique ticket ID"""
    return f"TCKT_{str(uuid.uuid4())[:8].upper()}"


def create_critical_ticket(issue, resource_id, severity, issue_type, description=None, 
                          customer_name=None, logs_related=None, metrics_snapshot=None):
    """
    Create a CRITICAL ticket that requires admin approval
    Returns: Ticket dictionary with PENDING_APPROVAL status
    """
    ticket_id = generate_ticket_id()
    
    # Determine required skills and suggest employee
    required_skills = determine_required_skills(issue_type, severity)
    specialization = determine_specialization(issue_type)
    suggested_employee = find_best_employee(required_skills, issue_type, specialization)
    
    ticket = {
        "ticket_id": ticket_id,
        "issue": issue,
        "status": "PENDING_APPROVAL",
        "severity": severity,
        "resource_id": resource_id,
        "created_at": datetime.utcnow().isoformat() + 'Z',
        "pending_admin_approval": True,
        "suggested_employee_id": suggested_employee.get("employee_id") if suggested_employee else None,
        "admin_notified": False,
        "assigned_employee_ID": None,
        "assigned_at": None,
        "issue_type": issue_type,
        "description": description or issue,
        "customer_name": customer_name,
        "logs_related": logs_related or [],
        "metrics_snapshot": metrics_snapshot or {},
        "required_skills": required_skills,
        "specialization": specialization
    }
    
    # Save ticket
    if create_ticket(ticket):
        return ticket
    return None


def create_non_critical_ticket(issue, resource_id, severity, issue_type, description=None,
                               customer_name=None, logs_related=None, metrics_snapshot=None):
    """
    Create a NON-CRITICAL ticket and auto-assign to best employee
    Returns: Ticket dictionary with ASSIGNED status
    """
    ticket_id = generate_ticket_id()
    
    # Determine required skills and find best employee
    required_skills = determine_required_skills(issue_type, severity)
    specialization = determine_specialization(issue_type)
    assigned_employee = find_best_employee(required_skills, issue_type, specialization)
    
    if not assigned_employee:
        # If no employee available, create unassigned ticket
        ticket = {
            "ticket_id": ticket_id,
            "issue": issue,
            "status": "OPEN",
            "severity": severity,
            "resource_id": resource_id,
            "created_at": datetime.utcnow().isoformat() + 'Z',
            "pending_admin_approval": False,
            "assigned_employee_ID": None,
            "assigned_at": None,
            "issue_type": issue_type,
            "description": description or issue,
            "customer_name": customer_name,
            "logs_related": logs_related or [],
            "metrics_snapshot": metrics_snapshot or {}
        }
    else:
        # Assign to employee
        assigned_employee_id = assigned_employee.get("employee_id")
        update_employee_workload(assigned_employee_id, 1)
        
        ticket = {
            "ticket_id": ticket_id,
            "issue": issue,
            "status": "ASSIGNED",
            "severity": severity,
            "resource_id": resource_id,
            "created_at": datetime.utcnow().isoformat() + 'Z',
            "pending_admin_approval": False,
            "assigned_employee_ID": assigned_employee_id,
            "assigned_at": datetime.utcnow().isoformat() + 'Z',
            "issue_type": issue_type,
            "description": description or issue,
            "customer_name": customer_name,
            "logs_related": logs_related or [],
            "metrics_snapshot": metrics_snapshot or {}
        }
    
    # Save ticket
    if create_ticket(ticket):
        return ticket
    return None


def create_ticket_from_issue(issue, resource_id, severity, issue_type, description=None,
                             customer_name=None, logs_related=None, metrics_snapshot=None):
    """
    Create a ticket based on severity
    - CRITICAL: Requires admin approval (PENDING_APPROVAL)
    - NON-CRITICAL: Auto-create and assign (ASSIGNED)
    """
    severity_upper = severity.upper() if severity else "MEDIUM"
    
    if severity_upper == "CRITICAL":
        return create_critical_ticket(
            issue, resource_id, severity_upper, issue_type,
            description, customer_name, logs_related, metrics_snapshot
        )
    else:
        return create_non_critical_ticket(
            issue, resource_id, severity_upper, issue_type,
            description, customer_name, logs_related, metrics_snapshot
        )


# ============================================================================
# Admin Approval Functions
# ============================================================================

def approve_critical_ticket(ticket_id, admin_id, employee_id=None):
    """
    Approve a CRITICAL ticket and assign to employee
    If employee_id is None, uses suggested_employee_id
    """
    ticket = get_ticket_by_id(ticket_id)
    if not ticket:
        return {"error": "Ticket not found"}
    
    if ticket.get("status") != "PENDING_APPROVAL":
        return {"error": "Ticket is not pending approval"}
    
    # Use provided employee_id or suggested_employee_id
    assigned_employee_id = employee_id or ticket.get("suggested_employee_id")
    if not assigned_employee_id:
        return {"error": "No employee specified for assignment"}
    
    # Check if employee exists
    employee = get_employee_by_id(assigned_employee_id)
    if not employee:
        return {"error": "Employee not found"}
    
    # Update employee workload
    update_employee_workload(assigned_employee_id, 1)
    
    # Update ticket
    updates = {
        "status": "ASSIGNED",
        "pending_admin_approval": False,
        "assigned_employee_ID": assigned_employee_id,
        "assigned_at": datetime.utcnow().isoformat() + 'Z',
        "approved_by": admin_id,
        "approved_at": datetime.utcnow().isoformat() + 'Z'
    }
    
    if update_ticket(ticket_id, updates):
        return {"success": True, "ticket": get_ticket_by_id(ticket_id)}
    return {"error": "Failed to update ticket"}


def reject_critical_ticket(ticket_id, admin_id, reason=None):
    """Reject a CRITICAL ticket"""
    ticket = get_ticket_by_id(ticket_id)
    if not ticket:
        return {"error": "Ticket not found"}
    
    if ticket.get("status") != "PENDING_APPROVAL":
        return {"error": "Ticket is not pending approval"}
    
    # Update ticket
    updates = {
        "status": "REJECTED",
        "pending_admin_approval": False,
        "rejected_by": admin_id,
        "rejected_at": datetime.utcnow().isoformat() + 'Z',
        "rejection_reason": reason or "Admin rejected"
    }
    
    if update_ticket(ticket_id, updates):
        return {"success": True, "ticket": get_ticket_by_id(ticket_id)}
    return {"error": "Failed to update ticket"}


# ============================================================================
# AI-Driven Ticket Creation Functions
# ============================================================================

def create_ticket_from_ai_analysis(ai_analysis, resource):
    """
    Create a ticket based on AI analysis results
    Only creates ticket if AI detected an issue (has_issue = true and severity != OK)
    Args:
        ai_analysis - Dictionary from analyze_metrics_for_issues() with has_issue, severity, etc.
        resource - Resource object with metrics data
    Returns: Ticket dictionary if created, None if no issue detected
    """
    # Check if there's an error in AI analysis
    if "error" in ai_analysis:
        return None
    
    # Check if issue was detected
    has_issue = ai_analysis.get("has_issue", False)
    severity = ai_analysis.get("severity", "OK").upper()
    
    # Only create ticket if issue detected and severity is not OK
    if not has_issue or severity == "OK":
        return None
    
    # Extract information from AI analysis
    issue_type = ai_analysis.get("issue_type") or "general"
    description = ai_analysis.get("description") or f"{severity} issue detected in resource"
    recommendations = ai_analysis.get("recommendations")
    
    # Get resource information
    resource_id = resource.get("id", "unknown")
    resource_name = resource.get("name", "unknown")
    customer_name = resource.get("tags", {}).get("customer") or resource.get("tags", {}).get("Name") or "Unknown"
    metrics_snapshot = resource.get("metrics", {})
    
    # Create issue description
    issue = f"{severity}: {description}"
    if recommendations:
        full_description = f"{description}\n\nRecommendations: {recommendations}"
    else:
        full_description = description
    
    # Create ticket using existing function
    ticket = create_ticket_from_issue(
        issue=issue,
        resource_id=resource_id,
        severity=severity,
        issue_type=issue_type,
        description=full_description,
        customer_name=customer_name,
        logs_related=[],
        metrics_snapshot=metrics_snapshot
    )
    
    return ticket

