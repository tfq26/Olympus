import os
import requests
from dotenv import load_dotenv

load_dotenv()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")

def analyze_with_nvidia(metrics):
    """
    Sends system metrics to NVIDIA LLM for insights.
    """
    if not NVIDIA_API_KEY:
        return {"error": "Missing NVIDIA_API_KEY"}

    url = "https://api.nvidia.com/v1/nemo/nemotron-nano-9b-v2/infer"
    headers = {"Authorization": f"Bearer {NVIDIA_API_KEY}"}
    prompt = f"Analyze the following AWS metrics and summarize issues:\n{metrics}"

    try:
        response = requests.post(url, headers=headers, json={"prompt": prompt})
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"Failed with {response.status_code}", "details": response.text}
    except Exception as e:
        return {"error": str(e)}
