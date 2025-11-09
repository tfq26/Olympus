#!/usr/bin/env python3
"""
Comprehensive batch creation test script
Tests EC2, S3, and Lambda batch creation sequentially
"""
import json
import sys
import time
import urllib.request

def test_batch_create(resource_type, count=3, customer_name="rtg-test", aws_region="us-east-1"):
    """Test batch creation for a specific resource type"""
    url = 'http://localhost:8080/nlp/execute'
    payload = {
        "tool": "batchCreate",
        "args": {
            "resource_type": resource_type,
            "count": count,
            "customer_name": customer_name,
            "aws_region": aws_region
        },
        "userConfirmed": True
    }
    
    resource_icons = {
        "ec2": "💻",
        "s3": "🪣",
        "lambda": "λ"
    }
    icon = resource_icons.get(resource_type, "📦")
    
    print(f"\n{'='*70}")
    print(f"{icon} Testing {resource_type.upper()} Batch Creation")
    print(f"{'='*70}")
    print(f"📊 Count: {count}")
    print(f"👤 Customer: {customer_name}")
    print(f"🌍 Region: {aws_region}")
    print("-" * 70)
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    
    start_time = time.time()
    
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            elapsed = time.time() - start_time
            body = resp.read().decode('utf-8')
            print(f"\n✅ {resource_type.upper()} Batch Creation Successful!")
            print(f"⏱️  Time taken: {elapsed:.2f} seconds")
            print(f"\n📋 Response:")
            print(body)
            return True
    except urllib.error.HTTPError as e:
        elapsed = time.time() - start_time
        error_body = e.read().decode('utf-8')
        print(f"\n❌ {resource_type.upper()} Batch Creation Failed!")
        print(f"⏱️  Time taken: {elapsed:.2f} seconds")
        print(f"HTTP Error {e.code}:")
        print(error_body)
        return False
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"\n❌ {resource_type.upper()} Batch Creation Failed!")
        print(f"⏱️  Time taken: {elapsed:.2f} seconds")
        print(f"Error: {e}")
        return False

def main():
    print("\n" + "="*70)
    print("🚀 COMPREHENSIVE BATCH CREATION TEST SUITE")
    print("="*70)
    print("This script will test batch creation for:")
    print("  • EC2 Instances")
    print("  • S3 Buckets")
    print("  • Lambda Functions")
    print("="*70)
    
    results = {}
    resource_types = ["ec2", "s3", "lambda"]
    
    for resource_type in resource_types:
        success = test_batch_create(resource_type)
        results[resource_type] = success
        
        # Small delay between tests
        if resource_type != resource_types[-1]:
            print(f"\n⏳ Waiting 3 seconds before next test...")
            time.sleep(3)
    
    # Summary
    print("\n" + "="*70)
    print("📊 TEST SUMMARY")
    print("="*70)
    
    for resource_type, success in results.items():
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{resource_type.upper():10s} : {status}")
    
    total = len(results)
    passed = sum(1 for s in results.values() if s)
    
    print("-" * 70)
    print(f"Total: {passed}/{total} tests passed")
    print("="*70)
    
    # Exit with appropriate code
    if passed == total:
        print("\n🎉 All batch creation tests completed successfully!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed!")
        sys.exit(1)

if __name__ == '__main__':
    main()
