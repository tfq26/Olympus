import os
import requests


class InfraClient:
    """
    Thin HTTP client that proxies Flask requests to the Node MCP client,
    which in turn invokes the Terraform MCP server via stdio Docker.
    """

    def __init__(self, base_url: str | None = None, timeout: int = 300):
        # Default to local Node server
        self.base_url = base_url or os.getenv("NODE_MCP_URL", "http://localhost:8080")
        self.timeout = int(os.getenv("INFRA_CLIENT_TIMEOUT", str(timeout)))

    def _request(self, method: str, path: str, json: dict | None = None):
        url = f"{self.base_url}{path}"
        try:
            resp = requests.request(method, url, json=json, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.RequestException as e:
            return {"ok": False, "error": str(e)}

    # --------- Terraform tools ---------
    def ping(self):
        return self._request("GET", "/terraform/ping")

    def s3_create(self, bucket_name: str, aws_region: str = "us-east-1"):
        payload = {"bucket_name": bucket_name, "aws_region": aws_region}
        return self._request("POST", "/terraform/s3", json=payload)

    def s3_destroy(self, bucket_name: str):
        return self._request("DELETE", f"/terraform/s3/{bucket_name}")

    def ec2_create(self):
        return self._request("POST", "/terraform/ec2")

    def ec2_destroy(self):
        return self._request("DELETE", "/terraform/ec2")

    def lambda_create(self, function_name: str, aws_region: str = "us-east-1", source_code: str | None = None):
        payload = {"function_name": function_name, "aws_region": aws_region, "source_code": source_code}
        return self._request("POST", "/terraform/lambda", json=payload)

    def lambda_destroy(self):
        return self._request("DELETE", "/terraform/lambda")
