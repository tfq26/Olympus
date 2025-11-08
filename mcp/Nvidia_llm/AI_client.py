import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
NVIDIA_API_URL = os.getenv("NVIDIA_API_URL", "https://integrate.api.nvidia.com/v1/chat/completions")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "nvidia/nemotron-70b-instruct")

def analyze_with_nvidia(metrics):
    """
    Analyzes AWS CloudWatch metrics using NVIDIA's Nemotron LLM.
    Takes raw CloudWatch metrics JSON and returns a human-readable summary.
    """
    if not NVIDIA_API_KEY:
        return {"error": "Missing NVIDIA_API_KEY"}

    # Format the metrics data for analysis
    metrics_json = json.dumps(metrics, indent=2, default=str)
    
    # Create a detailed prompt for the LLM
    prompt = f"""Analyze the following AWS CloudWatch EC2 metrics data and provide a concise, human-readable summary.

Focus on:
- CPU utilization trends and patterns
- Any anomalies or spikes
- Recommendations for scaling or optimization
- Overall health status

AWS CloudWatch Metrics Data:
{metrics_json}

Provide a clear, actionable summary in 2-3 sentences. If there are no datapoints, explain what this might mean."""

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": NVIDIA_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are an AI assistant that analyzes AWS CloudWatch metrics and provides actionable insights for system administrators."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.7,
        "max_tokens": 500,
        "stream": False
    }

    try:
        response = requests.post(NVIDIA_API_URL, headers=headers, json=payload, timeout=30)
        if response.status_code == 200:
            result = response.json()
            # Extract the analysis text from the response
            if "choices" in result and len(result["choices"]) > 0:
                analysis = result["choices"][0].get("message", {}).get("content", "")
                return {"analysis": analysis}
            return {"error": "Unexpected response format", "raw_response": result}
        else:
            return {"error": f"NVIDIA API failed with status {response.status_code}", "details": response.text}
    except requests.exceptions.Timeout:
        return {"error": "NVIDIA API request timed out"}
    except Exception as e:
        return {"error": str(e)}
