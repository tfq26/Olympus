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
