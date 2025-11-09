#!/usr/bin/env python3
import json
import sys
import urllib.request

def main():
    url = 'http://localhost:8080/nlp/execute'
    payload = {
        "tool": "batchCreate",
        "args": {"resource_type": "ec2", "count": 3, "customer_name": "rtg-test"},
        "userConfirmed": True
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            body = resp.read().decode('utf-8')
            print(body)
    except Exception as e:
        print('ERROR:', e)
        sys.exit(1)

if __name__ == '__main__':
    main()
