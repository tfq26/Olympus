"""Flask route smoke test using Flask test client.
Verifies mock routes respond and CORS header is present when Origin is sent.
"""

import sys
import os
from pathlib import Path

# Ensure project root is on PYTHONPATH so we can import app
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from app import app
except ModuleNotFoundError as e:
    print("❌ Failed to import Flask app:", e)
    sys.exit(10)

client = app.test_client()

ORIGIN = "http://localhost:5173"

def assert_cors(headers):
    aca = headers.get("Access-Control-Allow-Origin") or headers.get("access-control-allow-origin")
    if not aca:
        print("❌ Missing Access-Control-Allow-Origin on Flask response")
        sys.exit(2)

def expect_ok(resp):
    if resp.status_code < 200 or resp.status_code >= 300:
        print(f"❌ Unexpected status {resp.status_code}: {resp.data[:200]!r}")
        sys.exit(1)

def main():
    # Basic mock metrics endpoint
    resp = client.get("/monitor/mock/metrics", headers={"Origin": ORIGIN})
    expect_ok(resp)
    assert_cors(resp.headers)
    print("✅ /monitor/mock/metrics OK with CORS")

    # Customer health summary (no LLM dependency)
    resp = client.get("/monitor/mock/customers/health", headers={"Origin": ORIGIN})
    expect_ok(resp)
    assert_cors(resp.headers)
    print("✅ /monitor/mock/customers/health OK with CORS")

    print("✅ Flask route smoke tests passed")

if __name__ == "__main__":
    main()
