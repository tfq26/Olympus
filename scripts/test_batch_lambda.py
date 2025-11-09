#!/usr/bin/env python3
"""
Test script for Lambda batch creation
Creates 3 Lambda functions for customer 'rtg-test'
"""
import json
import sys
import urllib.request

def main():
    url = 'http://localhost:8080/nlp/execute'
    payload = {
        "tool": "batchCreate",
        "args": {
            "resource_type": "lambda",
            "count": 3,
            "customer_name": "rtg-test",
            "aws_region": "us-east-1"
        },
        "userConfirmed": True
    }
    
    print("🚀 Testing Lambda Batch Creation...")
    print(f"📦 Creating {payload['args']['count']} Lambda functions for customer: {payload['args']['customer_name']}")
    print(f"🌍 Region: {payload['args']['aws_region']}")
    print("-" * 60)
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            body = resp.read().decode('utf-8')
            print("\n📋 Response:")
            print(body)
            print("\n✅ Lambda batch creation test completed!")
    except urllib.error.HTTPError as e:
        print(f'\n❌ HTTP ERROR {e.code}:', e.read().decode('utf-8'))
        sys.exit(1)
    except Exception as e:
        print('\n❌ ERROR:', e)
        sys.exit(1)

if __name__ == '__main__':
    main()
