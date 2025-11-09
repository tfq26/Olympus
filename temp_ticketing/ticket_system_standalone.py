"""
Standalone Ticket System Module
Handles automatic ticket creation, assignment, and admin approval for CRITICAL tickets
"""
import json
import os
import uuid
from datetime import datetime
from pathlib import Path

# Use local data directory
BASE_DIR = Path(__file__).parent
TICKETS_FILE = BASE_DIR / "data" / "tickets.json"
EMPLOYEES_FILE = BASE_DIR / "data" / "employees.json"
ADMINS_FILE = BASE_DIR / "data" / "admins.json"


# ============================================================================
# Employee Database Functions
# ============================================================================

def load_employees():
    """Load employees from employees.json"""
    try:
        if EMPLOYEES_FILE.exists():
            with open(EMPLOYEES_FILE, 'r') as f:
                data = json.load(f)
                # Handle both list and dict with "employees" key
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict) and "employees" in data:
                    return data["employees"]
                return []
        return []
    except Exception as e:
        print(f"Error loading employees: {e}")
        return []


def save_employees(employees_list):
    """Save employees to employees.json"""
    try:
        with open(EMPLOYEES_FILE, 'w') as f:
            # Always save with "employees" wrapper
            json.dump({"employees": employees_list}, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving employees: {e}")
        return False


def get_employee_by_id(employee_id):
    """Get employee by ID"""
    employees = load_employees()
    for employee in employees:
        # Check both 'id' and 'employee_id' fields
        if employee.get("id") == employee_id or employee.get("employee_id") == employee_id:
            return employee
    return None


def update_employee_workload(employee_id, increment=1):
    """Update employee workload (increment or decrement)"""
    employees = load_employees()
    for employee in employees:
        # Check both 'id' and 'employee_id' fields
        if employee.get("id") == employee_id or employee.get("employee_id") == employee_id:
            # Initialize current_workload if not present
            if "current_workload" not in employee:
                employee["current_workload"] = 0
            employee["current_workload"] = max(0, employee["current_workload"] + increment)
            save_employees(employees)
            return True
    return False


# ============================================================================
# Admin Database Functions
# ============================================================================

def load_admins():
    """Load admins from admins.json"""
    try:
        if ADMINS_FILE.exists():
            with open(ADMINS_FILE, 'r') as f:
                data = json.load(f)
                # Handle both list and dict with "admins" key
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict) and "admins" in data:
                    return data["admins"]
                return []
        return []
    except Exception as e:
        print(f"Error loading admins: {e}")
        return []


def save_admins(data):
    """Save admins to admins.json"""
    try:
        with open(ADMINS_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving admins: {e}")
        return False


def get_admin_by_id(admin_id):
    """Get admin by ID"""
    admins = load_admins()
    for admin in admins:
        if admin.get("admin_id") == admin_id:
            return admin
    return None


# ============================================================================
# Ticket Database Functions
# ============================================================================

def load_tickets():
    """Load tickets from tickets.json"""
    try:
        if TICKETS_FILE.exists():
            with open(TICKETS_FILE, 'r') as f:
                data = json.load(f)
                return data.get("tickets", [])
        return []
    except Exception as e:
        print(f"Error loading tickets: {e}")
        return []


def save_tickets(tickets):
    """Save tickets to tickets.json"""
    try:
        with open(TICKETS_FILE, 'w') as f:
            json.dump({"tickets": tickets}, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving tickets: {e}")
        return False


def get_ticket_by_id(ticket_id):
    """Get ticket by ID"""
    tickets = load_tickets()
    for ticket in tickets:
        if ticket.get("ticket_id") == ticket_id:
            return ticket
    return None


def create_ticket(ticket_data):
    """Create a new ticket"""
    tickets = load_tickets()
    tickets.append(ticket_data)
    return save_tickets(tickets)


def update_ticket(ticket_id, updates):
    """Update ticket with new data"""
    tickets = load_tickets()
    for ticket in tickets:
        if ticket.get("ticket_id") == ticket_id:
            ticket.update(updates)
            return save_tickets(tickets)
    return False


# ============================================================================
# Auto-Assignment Logic
# ============================================================================

def score_employee(employee, required_skills):
    """
    Score an employee based on skills, experience, and workload
    Returns: Score (0-100)
    """
    score = 0
    
    # Skill match (50% weight)
    employee_skills = set(skill.lower() for skill in employee.get("skills", []))
    required_skills_lower = set(skill.lower() for skill in required_skills)
    
    if required_skills_lower:
        match_count = len(employee_skills & required_skills_lower)
        skill_match_percentage = match_count / len(required_skills_lower)
        score += skill_match_percentage * 50
    else:
        score += 50
    
    # Experience level (25% weight)
    experience_level = employee.get("experience_level", "junior").lower()
    experience_scores = {"senior": 25, "mid": 18, "junior": 12, "entry": 8}
    score += experience_scores.get(experience_level, 12)
    
    # Current workload (25% weight) - lower is better
    current_workload = employee.get("current_workload", 0)
    max_workload = employee.get("max_workload", 5)
    if max_workload > 0:
        workload_percentage = 1 - (current_workload / max_workload)
        score += workload_percentage * 25
    else:
        score += 25
    
    return round(score, 2)


def find_best_employee(required_skills, issue_type):
    """
    Find the best employee for a ticket based on scoring
    Returns: Employee dictionary or None
    """
    employees = load_employees()
    
    if not employees:
        return None
    
    # Score all employees
    scored_employees = []
    for employee in employees:
        score = score_employee(employee, required_skills)
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
        "memory_leak": ["Python", "AWS", "DevOps"],
        "cpu_spike": ["AWS", "DevOps", "Performance"],
        "disk_full": ["AWS", "DevOps", "Storage"],
        "network_issue": ["AWS", "Network", "DevOps"],
        "security": ["Security", "AWS", "DevOps"],
        "performance": ["Performance", "AWS", "DevOps"],
        "infrastructure": ["AWS", "DevOps", "Infrastructure"]
    }
    
    return skill_map.get(issue_type, ["AWS", "DevOps"])


# ============================================================================
# Ticket Creation Functions
# ============================================================================

def generate_ticket_id():
    """Generate a unique ticket ID"""
    return f"TCKT_{str(uuid.uuid4())[:8].upper()}"


def create_critical_ticket(issue, resource_id, severity, issue_type, description=None, 
                          customer_name=None):
    """
    Create a CRITICAL ticket that requires admin approval
    Returns: Ticket dictionary with PENDING_APPROVAL status
    """
    ticket_id = generate_ticket_id()
    
    # Determine required skills and suggest employee
    required_skills = determine_required_skills(issue_type, severity)
    suggested_employee = find_best_employee(required_skills, issue_type)
    
    ticket = {
        "ticket_id": ticket_id,
        "issue": issue,
        "status": "PENDING_APPROVAL",
        "severity": severity,
        "resource_id": resource_id,
        "created_at": datetime.utcnow().isoformat() + 'Z',
        "pending_admin_approval": True,
        "suggested_employee_id": suggested_employee.get("employee_id") or suggested_employee.get("id") if suggested_employee else None,
        "suggested_employee_name": suggested_employee.get("name") if suggested_employee else None,
        "assigned_employee_id": None,
        "assigned_at": None,
        "issue_type": issue_type,
        "description": description or issue,
        "customer_name": customer_name,
        "required_skills": required_skills
    }
    
    # Save ticket
    if create_ticket(ticket):
        return ticket
    return None


def create_non_critical_ticket(issue, resource_id, severity, issue_type, description=None,
                               customer_name=None):
    """
    Create a NON-CRITICAL ticket and auto-assign to best employee
    Returns: Ticket dictionary with ASSIGNED status
    """
    ticket_id = generate_ticket_id()
    
    # Determine required skills and find best employee
    required_skills = determine_required_skills(issue_type, severity)
    assigned_employee = find_best_employee(required_skills, issue_type)
    
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
            "assigned_employee_id": None,
            "assigned_at": None,
            "issue_type": issue_type,
            "description": description or issue,
            "customer_name": customer_name
        }
    else:
        # Assign to employee
        assigned_employee_id = assigned_employee.get("employee_id") or assigned_employee.get("id")
        update_employee_workload(assigned_employee_id, 1)
        
        ticket = {
            "ticket_id": ticket_id,
            "issue": issue,
            "status": "ASSIGNED",
            "severity": severity,
            "resource_id": resource_id,
            "created_at": datetime.utcnow().isoformat() + 'Z',
            "pending_admin_approval": False,
            "assigned_employee_id": assigned_employee_id,
            "assigned_employee_name": assigned_employee.get("name"),
            "assigned_at": datetime.utcnow().isoformat() + 'Z',
            "issue_type": issue_type,
            "description": description or issue,
            "customer_name": customer_name
        }
    
    # Save ticket
    if create_ticket(ticket):
        return ticket
    return None


def create_ticket_from_issue(issue, resource_id, severity, issue_type, description=None,
                             customer_name=None):
    """
    Create a ticket based on severity
    - CRITICAL: Requires admin approval (PENDING_APPROVAL)
    - NON-CRITICAL: Auto-create and assign (ASSIGNED)
    """
    severity_upper = severity.upper() if severity else "MEDIUM"
    
    if severity_upper == "CRITICAL":
        return create_critical_ticket(
            issue, resource_id, severity_upper, issue_type,
            description, customer_name
        )
    else:
        return create_non_critical_ticket(
            issue, resource_id, severity_upper, issue_type,
            description, customer_name
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
        "assigned_employee_id": assigned_employee_id,
        "assigned_employee_name": employee.get("name"),
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

