"""
NVIDIA LLM Client - Integration with NVIDIA Nemotron for analyzing metrics and logs
Provides functions to analyze CloudWatch metrics, resource metrics, and logs using LLM
"""
import os
import json
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get NVIDIA API configuration from environment variables
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
NVIDIA_API_URL = os.getenv("NVIDIA_API_URL", "https://integrate.api.nvidia.com/v1/chat/completions")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "nvidia/nemotron-70b-instruct")

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

def _call_nvidia_api(prompt, data_type):
    """
    Helper function to make API call to NVIDIA Nemotron LLM
    Args:
        prompt - The prompt text to send to the LLM
        data_type - Type of data being analyzed (for system message context)
    Returns: Dictionary with "analysis" key or error information
    """
    # Set up API request headers
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Build the API payload following OpenAI-compatible format
    payload = {
        "model": NVIDIA_MODEL,
        "messages": [
            {
                "role": "system",
                "content": f"You are an AI assistant that analyzes {data_type} and provides actionable insights for system administrators."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.7,  # Controls randomness (0.0 = deterministic, 1.0 = creative)
        "max_tokens": 500,    # Maximum length of response
        "stream": False       # Return complete response, not streamed
    }

    try:
        # Make POST request to NVIDIA API
        response = requests.post(NVIDIA_API_URL, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            # Extract the analysis text from the API response
            if "choices" in result and len(result["choices"]) > 0:
                analysis = result["choices"][0].get("message", {}).get("content", "")
                return {"analysis": analysis}
            return {"error": "Unexpected response format", "raw_response": result}
        else:
            # Return error if API call failed
            return {"error": f"NVIDIA API failed with status {response.status_code}", "details": response.text}
    except requests.exceptions.Timeout:
        return {"error": "NVIDIA API request timed out"}
    except Exception as e:
        return {"error": str(e)}
