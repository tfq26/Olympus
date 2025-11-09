"""
Test Script for Ticketing System
Tests all major functionality: ticket creation, assignment, approval, rejection
"""
import json
from ticket_system_standalone import (
    load_tickets, load_employees, load_admins,
    create_ticket_from_issue, approve_critical_ticket, reject_critical_ticket,
    get_ticket_by_id, get_employee_by_id
)


def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}\n")


def test_load_data():
    """Test loading data from JSON files"""
    print_section("TEST 1: Load Data from JSON Files")
    
    employees = load_employees()
    admins = load_admins()
    tickets = load_tickets()
    
    print(f"✅ Loaded {len(employees)} employees")
    print(f"✅ Loaded {len(admins)} admins")
    print(f"✅ Loaded {len(tickets)} existing tickets")
    
    if employees:
        print(f"\nSample Employee: {employees[0].get('name')} ({employees[0].get('role')})")
    if admins:
        print(f"Sample Admin: {admins[0].get('name')}")
    
    return employees, admins, tickets


def test_create_medium_ticket():
    """Test creating a MEDIUM severity ticket (auto-assigned)"""
    print_section("TEST 2: Create MEDIUM Severity Ticket (Auto-Assignment)")
    
    ticket = create_ticket_from_issue(
        issue="High CPU usage detected",
        resource_id="res_vm_001",
        severity="MEDIUM",
        issue_type="cpu_spike",
        description="CPU usage has been above 80% for the last 30 minutes",
        customer_name="Globex"
    )
    
    if ticket:
        print(f"✅ Ticket Created: {ticket['ticket_id']}")
        print(f"   Status: {ticket['status']}")
        print(f"   Severity: {ticket['severity']}")
        print(f"   Issue Type: {ticket['issue_type']}")
        if ticket.get('assigned_employee_name'):
            print(f"   Assigned To: {ticket['assigned_employee_name']} (ID: {ticket['assigned_employee_id']})")
        else:
            print(f"   Assigned To: None (no available employees)")
        return ticket
    else:
        print("❌ Failed to create ticket")
        return None


def test_create_critical_ticket():
    """Test creating a CRITICAL severity ticket (requires approval)"""
    print_section("TEST 3: Create CRITICAL Severity Ticket (Pending Approval)")
    
    ticket = create_ticket_from_issue(
        issue="Database connection failure - service down",
        resource_id="res_db_002",
        severity="CRITICAL",
        issue_type="infrastructure",
        description="Complete database outage affecting all customers. Immediate attention required.",
        customer_name="Initech"
    )
    
    if ticket:
        print(f"✅ Ticket Created: {ticket['ticket_id']}")
        print(f"   Status: {ticket['status']}")
        print(f"   Severity: {ticket['severity']}")
        print(f"   Pending Admin Approval: {ticket['pending_admin_approval']}")
        if ticket.get('suggested_employee_name'):
            print(f"   Suggested Employee: {ticket['suggested_employee_name']} (ID: {ticket['suggested_employee_id']})")
        else:
            print(f"   Suggested Employee: None")
        return ticket
    else:
        print("❌ Failed to create ticket")
        return None


def test_approve_critical_ticket(ticket_id):
    """Test admin approval of critical ticket"""
    print_section("TEST 4: Admin Approves Critical Ticket")
    
    # Use first admin
    admins = load_admins()
    if not admins:
        print("❌ No admins available for testing")
        return None
    
    admin_id = admins[0].get("admin_id")
    admin_name = admins[0].get("name")
    
    print(f"Admin: {admin_name} (ID: {admin_id})")
    print(f"Approving ticket: {ticket_id}")
    
    result = approve_critical_ticket(ticket_id, admin_id)
    
    if result.get("success"):
        ticket = result["ticket"]
        print(f"\n✅ Ticket Approved!")
        print(f"   New Status: {ticket['status']}")
        print(f"   Assigned To: {ticket.get('assigned_employee_name')} (ID: {ticket['assigned_employee_id']})")
        print(f"   Approved By: {ticket['approved_by']}")
        print(f"   Approved At: {ticket['approved_at']}")
        return ticket
    else:
        print(f"❌ Failed to approve: {result.get('error')}")
        return None


def test_reject_critical_ticket(ticket_id):
    """Test admin rejection of critical ticket"""
    print_section("TEST 5: Admin Rejects Critical Ticket")
    
    # Use first admin
    admins = load_admins()
    if not admins:
        print("❌ No admins available for testing")
        return None
    
    admin_id = admins[0].get("admin_id")
    admin_name = admins[0].get("name")
    
    print(f"Admin: {admin_name} (ID: {admin_id})")
    print(f"Rejecting ticket: {ticket_id}")
    
    result = reject_critical_ticket(
        ticket_id, 
        admin_id, 
        reason="Issue resolved externally, ticket not needed"
    )
    
    if result.get("success"):
        ticket = result["ticket"]
        print(f"\n✅ Ticket Rejected!")
        print(f"   New Status: {ticket['status']}")
        print(f"   Rejected By: {ticket['rejected_by']}")
        print(f"   Reason: {ticket['rejection_reason']}")
        return ticket
    else:
        print(f"❌ Failed to reject: {result.get('error')}")
        return None


def test_view_all_tickets():
    """View all current tickets"""
    print_section("TEST 6: View All Tickets")
    
    tickets = load_tickets()
    
    if not tickets:
        print("No tickets found")
        return
    
    print(f"Total Tickets: {len(tickets)}\n")
    
    for ticket in tickets:
        print(f"ID: {ticket['ticket_id']}")
        print(f"   Issue: {ticket['issue']}")
        print(f"   Status: {ticket['status']}")
        print(f"   Severity: {ticket['severity']}")
        if ticket.get('assigned_employee_name'):
            print(f"   Assigned: {ticket['assigned_employee_name']}")
        print()


def run_all_tests():
    """Run all tests"""
    print("\n" + "="*70)
    print("  TICKETING SYSTEM TEST SUITE")
    print("="*70)
    
    # Test 1: Load data
    employees, admins, tickets = test_load_data()
    
    if not employees:
        print("\n⚠️  Warning: No employees found. Some tests may fail.")
    
    if not admins:
        print("\n⚠️  Warning: No admins found. Approval tests will fail.")
    
    # Test 2: Create medium ticket
    medium_ticket = test_create_medium_ticket()
    
    # Test 3: Create first critical ticket
    critical_ticket_1 = test_create_critical_ticket()
    
    # Test 4: Approve the critical ticket
    if critical_ticket_1:
        test_approve_critical_ticket(critical_ticket_1['ticket_id'])
    
    # Test 5: Create another critical ticket and reject it
    critical_ticket_2 = create_ticket_from_issue(
        issue="Security breach detected",
        resource_id="res_api_002",
        severity="CRITICAL",
        issue_type="security",
        description="Unauthorized access attempt detected",
        customer_name="Umbrella"
    )
    
    if critical_ticket_2:
        test_reject_critical_ticket(critical_ticket_2['ticket_id'])
    
    # Test 6: View all tickets
    test_view_all_tickets()
    
    # Final Summary
    print_section("TEST SUMMARY")
    all_tickets = load_tickets()
    
    status_counts = {}
    severity_counts = {}
    
    for ticket in all_tickets:
        status = ticket.get('status', 'UNKNOWN')
        severity = ticket.get('severity', 'UNKNOWN')
        status_counts[status] = status_counts.get(status, 0) + 1
        severity_counts[severity] = severity_counts.get(severity, 0) + 1
    
    print(f"Total Tickets: {len(all_tickets)}")
    print(f"\nBy Status:")
    for status, count in status_counts.items():
        print(f"  {status}: {count}")
    
    print(f"\nBy Severity:")
    for severity, count in severity_counts.items():
        print(f"  {severity}: {count}")
    
    print("\n" + "="*70)
    print("  ✅ ALL TESTS COMPLETED")
    print("="*70 + "\n")


if __name__ == "__main__":
    run_all_tests()

