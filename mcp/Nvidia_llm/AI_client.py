"""
NVIDIA LLM Client - Integration with NVIDIA Nemotron for analyzing metrics and logs
Provides functions to analyze CloudWatch metrics, resource metrics, and logs using LLM
Uses OpenAI SDK with NVIDIA API
"""
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
import httpx

# Load environment variables from .env file in project root
project_root = Path(__file__).parent.parent.parent
env_file = project_root / ".env"
load_dotenv(dotenv_path=env_file)

# Get NVIDIA API configuration from environment variables
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
# Using nvidia/nvidia-nemotron-nano-9b-v2 as default model
# Can be overridden with NVIDIA_MODEL in .env file
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "nvidia/nvidia-nemotron-nano-9b-v2")

def _get_client():
    """
    Get or create OpenAI client configured for NVIDIA API
    Returns: OpenAI client instance or None if API key is not set
    """
    if not NVIDIA_API_KEY:
        return None
    
    try:
        # Create custom HTTP client to avoid proxy/environment issues
        http_client = httpx.Client(
            base_url=NVIDIA_BASE_URL,
            headers={
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Content-Type": "application/json"
            },
            timeout=30.0
        )
        
        # Create OpenAI client with custom HTTP client
        client = OpenAI(
            base_url=NVIDIA_BASE_URL,
            api_key=NVIDIA_API_KEY,
            http_client=http_client
        )
        return client
    except Exception as e:
        # Fallback: try simple initialization
        try:
            # Clear any problematic env vars temporarily
            old_proxies = {}
            for key in ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']:
                if key in os.environ:
                    old_proxies[key] = os.environ.pop(key)
            
            client = OpenAI(
                base_url=NVIDIA_BASE_URL,
                api_key=NVIDIA_API_KEY
            )
            
            # Restore env vars
            for key, value in old_proxies.items():
                os.environ[key] = value
                
            return client
        except Exception:
            return None

def analyze_with_nvidia(metrics):
    """
    Analyzes AWS CloudWatch metrics using NVIDIA's Nemotron LLM
    Args: metrics - CloudWatch metrics JSON response from AWS API
    Returns: Dictionary with "analysis" key containing human-readable summary
    """
    if not NVIDIA_API_KEY:
        return {"error": "Missing NVIDIA_API_KEY"}

    # Convert metrics to JSON string for the prompt
    metrics_json = json.dumps(metrics, indent=2, default=str)
    
    # Create prompt focused on CloudWatch-specific metrics analysis
    prompt = f"""Analyze the following AWS CloudWatch EC2 metrics data and provide a concise, human-readable summary.

Focus on:
- CPU utilization trends and patterns
- Any anomalies or spikes
- Recommendations for scaling or optimization
- Overall health status

AWS CloudWatch Metrics Data:
{metrics_json}

Provide a clear, actionable summary in 2-3 sentences. If there are no datapoints, explain what this might mean."""

    return _call_nvidia_api(prompt, "AWS CloudWatch metrics")

def analyze_metrics_with_nvidia(metrics_data):
    """
    Analyzes resource metrics data from metrics.json using NVIDIA's Nemotron LLM
    Args: metrics_data - Resource object with metrics, security, health score, etc.
    Returns: Dictionary with "analysis" key containing human-readable summary
    """
    if not NVIDIA_API_KEY:
        return {"error": "Missing NVIDIA_API_KEY"}

    # Convert resource data to JSON string
    metrics_json = json.dumps(metrics_data, indent=2, default=str)
    
    # Create prompt focused on resource metrics, security, and health
    prompt = f"""Analyze the following resource metrics data and provide a concise, human-readable summary.

Focus on:
- Resource health and status
- Performance metrics (CPU, memory, disk, network)
- Security vulnerabilities and compliance
- Cost implications
- Recommendations for optimization

Resource Metrics Data:
{metrics_json}

Provide a clear, actionable summary in 2-3 sentences."""

    return _call_nvidia_api(prompt, "resource metrics")

def analyze_logs_with_nvidia(logs_data):
    """
    Analyzes log data from logs.json using NVIDIA's Nemotron LLM
    Args: logs_data - List of log entries to analyze
    Returns: Dictionary with "analysis" key containing human-readable summary
    Note: Only analyzes first 100 logs to avoid token limits
    """
    if not NVIDIA_API_KEY:
        return {"error": "Missing NVIDIA_API_KEY"}

    # Limit to first 100 logs to avoid exceeding API token limits
    sample_logs = logs_data[:100] if len(logs_data) > 100 else logs_data
    logs_json = json.dumps(sample_logs, indent=2, default=str)
    
    total_logs = len(logs_data)
    # Create prompt focused on log patterns and errors
    prompt = f"""Analyze the following log data (showing {len(sample_logs)} of {total_logs} total logs) and provide a concise, human-readable summary.

Focus on:
- Error patterns and critical issues
- Status distribution (OK, ERROR, WARNING, CRITICAL)
- Common log subtypes and patterns
- Recommendations for investigation

Log Data:
{logs_json}

Provide a clear, actionable summary in 2-3 sentences."""

    return _call_nvidia_api(prompt, "log data")

def analyze_customer_health(customer_data, critical_issues):
    """
    Analyzes customer health data with LLM
    Args:
        customer_data - Dictionary with customer health metrics and statistics
        critical_issues - List of resource IDs with critical issues
    Returns: Dictionary with "analysis" key containing LLM-generated summary
    """
    if not NVIDIA_API_KEY:
        return {"error": "Missing NVIDIA_API_KEY"}
    
    # Format customer data for analysis
    customers_json = json.dumps(customer_data.get("affected_customers", []), indent=2)
    critical_issues_str = ", ".join(critical_issues) if critical_issues else "None"
    
    # Calculate overall statistics
    total_logs = sum(c["total_logs"] for c in customer_data.get("affected_customers", []))
    total_errors = sum(c["error_logs"] for c in customer_data.get("affected_customers", []))
    total_warnings = sum(c["warning_logs"] for c in customer_data.get("affected_customers", []))
    total_critical = sum(c["critical_logs"] for c in customer_data.get("affected_customers", []))
    total_customers = len(customer_data.get("affected_customers", []))
    
    # Calculate overall health percentage
    ok_logs = total_logs - total_errors - total_warnings - total_critical
    overall_health_value = round((ok_logs / total_logs * 100) if total_logs > 0 else 100.0, 2)
    overall_health = f"{overall_health_value}%"
    
    # Create prompt for LLM analysis
    prompt = f"""Analyze the following customer health data and provide a concise summary.

Customer Health Metrics:
{customers_json}

Critical Issues (Resources with ERROR or CRITICAL status):
{critical_issues_str}

Overall Statistics:
- Total Logs: {total_logs}
- Total Customers: {total_customers}
- Overall Health: {overall_health}
- Total Errors: {total_errors}
- Total Warnings: {total_warnings}
- Total Critical: {total_critical}

Provide a clear summary in 2-3 sentences focusing on:
- Overall system health trends
- Customers with the most issues
- Critical resources that need attention
- Key recommendations"""
    
    return _call_nvidia_api(prompt, "customer health data")


def analyze_metrics_for_issues(resource):
    """
    Analyzes resource metrics and determines if there are any issues that require tickets
    Uses historical logs to establish normal behavior baseline, then compares current metrics
    Returns structured JSON with issue detection, severity, and type
    Args: resource - Resource object with metrics data
    Returns: Dictionary with has_issue, severity, issue_type, description, recommendations
    """
    if not NVIDIA_API_KEY:
        return {"error": "Missing NVIDIA_API_KEY"}
    
    # Extract metrics from resource
    metrics = resource.get("metrics", {})
    resource_id = resource.get("id", "unknown")
    resource_name = resource.get("name", "unknown")
    instance_id = resource.get("instance_id")
    
    # Load historical logs for this resource to establish normal behavior baseline
    try:
        from ..monitor.log_data import get_logs_by_resource, load_logs
        # Try to get logs by resource_id first
        historical_logs = get_logs_by_resource(resource_id)
        
        # If no logs found by resource_id and we have instance_id, try to filter by instance
        if not historical_logs and instance_id:
            all_logs = load_logs()
            if all_logs:
                # Filter logs that might be related to this instance
                # Look for logs with matching customer name or resource patterns
                customer_name = resource.get("tags", {}).get("Name") or resource.get("tags", {}).get("customer")
                if customer_name:
                    historical_logs = [
                        log for log in all_logs
                        if log.get("customer_name") == customer_name
                        and log.get("status") == "OK"  # Only use OK logs for baseline
                        and resource_id in log.get("resources_affected", [])
                    ]
        
        # Limit to last 500 logs to avoid token limits, and only use OK logs for baseline
        baseline_logs = [
            log for log in historical_logs
            if log.get("status") == "OK"
        ][-500:] if historical_logs else []
        
    except Exception as e:
        # If loading logs fails, continue without baseline (fallback to threshold-based analysis)
        baseline_logs = []
    
    # Convert metrics to JSON string for the prompt
    metrics_json = json.dumps(metrics, indent=2, default=str)
    
    # Prepare historical logs for the prompt (limit to avoid token limits)
    logs_sample = baseline_logs[:100] if baseline_logs else []  # Use first 100 for prompt
    logs_json = json.dumps(logs_sample, indent=2, default=str) if logs_sample else "No historical logs available"
    
    # Create prompt that asks for structured JSON response with baseline comparison
    if baseline_logs:
        prompt = f"""Analyze the following resource metrics and determine if there are any issues that require a support ticket.

Step 1: Establish Normal Behavior Baseline
First, analyze the historical logs (showing {len(baseline_logs)} normal operations) to understand what is normal for this resource:
{logs_json}

From these historical logs, determine the normal behavior patterns:
- What is the normal CPU usage range? (analyze logs with subtype "cpu_usage")
- What is the normal memory usage range? (analyze logs with subtype "memory_check")
- What is the normal disk usage range? (analyze logs with subtype "disk_io")
- What is the normal network traffic pattern? (analyze logs with subtype "network_traffic")
- What are the normal service health patterns? (analyze logs with subtype "service_health")

Step 2: Compare Current Metrics Against Baseline
Resource: {resource_name} (ID: {resource_id})
Current Metrics Data:
{metrics_json}

Compare the current metrics against the normal behavior baseline you established from the historical logs.

Step 3: Determine if Issue Exists
- If current metrics match normal behavior (within normal range) → has_issue: false, severity: "OK"
- If current metrics deviate significantly from normal behavior → has_issue: true with appropriate severity
- Severity should be based on how much the current metrics deviate from normal:
  * CRITICAL: Metrics are severely outside normal range (e.g., CPU 3x normal, memory 2x normal)
  * HIGH: Metrics are significantly outside normal range (e.g., CPU 2x normal)
  * MEDIUM: Metrics are moderately outside normal range (e.g., CPU 1.5x normal)
  * LOW: Metrics are slightly outside normal range (e.g., CPU 1.2x normal)
  * OK: Metrics are within normal range

Return a JSON response with the following structure:
{{
  "has_issue": true or false,
  "severity": "CRITICAL" or "HIGH" or "MEDIUM" or "LOW" or "OK",
  "issue_type": "cpu_spike" or "memory_leak" or "disk_full" or "network_issue" or "performance" or null,
  "description": "Brief description of the issue compared to normal behavior" or null,
  "recommendations": "What should be done" or null
}}

Important:
- Use the historical logs to understand what is normal for THIS specific resource
- Compare current metrics against THIS resource's normal behavior, not generic thresholds
- If no historical logs are available, use fallback thresholds:
  * CPU > 95%: CRITICAL, > 90%: HIGH, > 80%: MEDIUM, > 70%: LOW, <= 70%: OK
  * Memory > 95%: CRITICAL, > 90%: HIGH, > 80%: MEDIUM, > 70%: LOW, <= 70%: OK
  * Disk > 95%: CRITICAL, > 90%: HIGH, > 80%: MEDIUM, > 70%: LOW, <= 70%: OK
- Only return JSON, no additional text

Return only the JSON response:"""
    else:
        # Fallback to threshold-based analysis if no historical logs
        prompt = f"""Analyze the following resource metrics and determine if there are any issues that require a support ticket.

Resource: {resource_name} (ID: {resource_id})
Metrics Data:
{metrics_json}

Note: No historical logs available for this resource. Using standard thresholds.

Analyze the metrics and return a JSON response with the following structure:
{{
  "has_issue": true or false,
  "severity": "CRITICAL" or "HIGH" or "MEDIUM" or "LOW" or "OK",
  "issue_type": "cpu_spike" or "memory_leak" or "disk_full" or "network_issue" or "performance" or null,
  "description": "Brief description of the issue" or null,
  "recommendations": "What should be done" or null
}}

Thresholds for determining severity:
- CPU usage > 95%: CRITICAL
- CPU usage > 90%: HIGH
- CPU usage > 80%: MEDIUM
- CPU usage > 70%: LOW
- CPU usage <= 70%: OK (no issue)

- Memory usage > 95%: CRITICAL
- Memory usage > 90%: HIGH
- Memory usage > 80%: MEDIUM
- Memory usage > 70%: LOW
- Memory usage <= 70% or null: OK (no issue)

- Disk usage > 95%: CRITICAL
- Disk usage > 90%: HIGH
- Disk usage > 80%: MEDIUM
- Disk usage > 70%: LOW
- Disk usage <= 70% or null: OK (no issue)

- Network issues (unusual spikes/drops): MEDIUM or HIGH
- Normal network traffic: OK (no issue)

- Very low uptime (recent restart): LOW
- Normal uptime: OK (no issue)

Important:
- If all metrics are normal, return has_issue: false, severity: "OK"
- If any metric exceeds thresholds, return has_issue: true with appropriate severity
- Only return JSON, no additional text

Return only the JSON response:"""

    try:
        # Call NVIDIA API with modified prompt for structured response
        client = _get_client()
        if not client:
            return {"error": "NVIDIA API client not initialized. Check NVIDIA_API_KEY in .env"}
        
        completion = client.chat.completions.create(
            model=NVIDIA_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI assistant that analyzes resource metrics and returns structured JSON responses. Always return valid JSON only, no additional text."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,  # Lower temperature for more consistent JSON responses
            max_tokens=400,   # Increased tokens for baseline comparison analysis
            stream=False
        )
        
        # Get the response
        response_text = completion.choices[0].message.content
        response_text = _clean_unicode_text(response_text)
        
        # Try to extract JSON from response (handle cases where AI adds extra text)
        import re
        # Find JSON object that contains "has_issue" - handle nested braces
        json_match = re.search(r'\{[^{}]*"has_issue"[^}]*\}', response_text, re.DOTALL)
        if not json_match:
            # Try to find any JSON object in the response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group(0)
            # Clean up any trailing commas or invalid JSON
            response_text = response_text.strip()
        
        # Parse JSON response
        try:
            ai_analysis = json.loads(response_text)
            
            # Validate and normalize response
            has_issue = ai_analysis.get("has_issue", False)
            severity = ai_analysis.get("severity", "OK").upper()
            issue_type = ai_analysis.get("issue_type")
            description = ai_analysis.get("description")
            recommendations = ai_analysis.get("recommendations")
            
            # Normalize severity
            if severity == "OK" or not has_issue:
                severity = "OK"
                has_issue = False
            
            return {
                "has_issue": has_issue,
                "severity": severity,
                "issue_type": issue_type,
                "description": description,
                "recommendations": recommendations,
                "raw_response": response_text  # Include raw response for debugging
            }
        except json.JSONDecodeError as e:
            # If JSON parsing fails, try to extract information from text
            # Fallback: analyze the text response
            response_lower = response_text.lower()
            has_issue = "has_issue" in response_text and ("true" in response_lower or "yes" in response_lower or "critical" in response_lower or "high" in response_lower)
            
            severity = "OK"
            if "critical" in response_lower:
                severity = "CRITICAL"
                has_issue = True
            elif "high" in response_lower:
                severity = "HIGH"
                has_issue = True
            elif "medium" in response_lower:
                severity = "MEDIUM"
                has_issue = True
            elif "low" in response_lower:
                severity = "LOW"
                has_issue = True
            
            # Try to determine issue type
            issue_type = None
            if "cpu" in response_lower:
                issue_type = "cpu_spike"
            elif "memory" in response_lower:
                issue_type = "memory_leak"
            elif "disk" in response_lower:
                issue_type = "disk_full"
            elif "network" in response_lower:
                issue_type = "network_issue"
            
            return {
                "has_issue": has_issue,
                "severity": severity,
                "issue_type": issue_type,
                "description": response_text[:200] if response_text else None,
                "recommendations": None,
                "raw_response": response_text,
                "warning": "Failed to parse JSON, extracted from text"
            }
            
    except Exception as e:
        return {"error": f"NVIDIA API error: {str(e)}"}

def _clean_unicode_text(text):
    """
    Clean Unicode characters from text, replacing them with ASCII equivalents
    Args: text - Text string that may contain Unicode characters
    Returns: Cleaned text with Unicode characters replaced
    """
    if not text:
        return text
    
    # Replace common Unicode dash characters with regular dash
    text = text.replace('\u2013', '-')  # en-dash
    text = text.replace('\u2014', '-')  # em-dash
    text = text.replace('\u2015', '-')  # horizontal bar
    text = text.replace('\u2212', '-')  # minus sign
    
    # Replace other common Unicode characters
    text = text.replace('\u2018', "'")  # left single quotation mark
    text = text.replace('\u2019', "'")  # right single quotation mark
    text = text.replace('\u201c', '"')  # left double quotation mark
    text = text.replace('\u201d', '"')  # right double quotation mark
    
    return text

def _call_nvidia_api(prompt, data_type, use_streaming=False):
    """
    Helper function to make API call to NVIDIA Nemotron LLM using OpenAI SDK
    Args:
        prompt - The prompt text to send to the LLM
        data_type - Type of data being analyzed (for system message context)
        use_streaming - Whether to use streaming responses (default: False)
    Returns: Dictionary with "analysis" key or error information
    """
    client = _get_client()
    if not client:
        return {"error": "NVIDIA API client not initialized. Check NVIDIA_API_KEY in .env"}
    
    try:
        # Create chat completion using OpenAI SDK
        completion = client.chat.completions.create(
            model=NVIDIA_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"You are an AI assistant that analyzes {data_type} and provides actionable insights for system administrators."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,  # Controls randomness (0.0 = deterministic, 1.0 = creative)
            max_tokens=500,   # Maximum length of response
            stream=use_streaming  # Whether to stream the response
        )
        
        if use_streaming:
            # Handle streaming response
            analysis_content = ""
            for chunk in completion:
                if chunk.choices[0].delta.content is not None:
                    analysis_content += chunk.choices[0].delta.content
            # Clean up Unicode characters before returning
            analysis_content = _clean_unicode_text(analysis_content)
            return {"analysis": analysis_content}
        else:
            # Handle non-streaming response
            analysis = completion.choices[0].message.content
            # Clean up Unicode characters before returning
            analysis = _clean_unicode_text(analysis)
            return {"analysis": analysis}
            
    except Exception as e:
        return {"error": f"NVIDIA API error: {str(e)}"}
