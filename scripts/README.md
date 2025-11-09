# Test Scripts

This directory contains test scripts for validating batch resource creation functionality.

## Available Scripts

### Individual Resource Type Tests

#### 1. EC2 Batch Test
```bash
python3 scripts/test_batch.py
```
Creates 3 EC2 instances for customer `rtg-test`.

#### 2. S3 Batch Test
```bash
python3 scripts/test_batch_s3.py
```
Creates 3 S3 buckets for customer `rtg-test`.

#### 3. Lambda Batch Test
```bash
python3 scripts/test_batch_lambda.py
```
Creates 3 Lambda functions for customer `rtg-test`.

### Comprehensive Test Suite

#### Run All Tests
```bash
python3 scripts/test_batch_all.py
```
Runs batch creation tests for all resource types (EC2, S3, Lambda) sequentially and provides a summary report.

## Test Features

- ✅ Tests single Terraform apply with count parameter
- ✅ Validates batch group ID assignment (shared 3-digit suffix)
- ✅ Confirms customer_name tracking in DynamoDB
- ✅ Measures execution time for each test
- ✅ Provides detailed success/failure reporting

## Expected Naming Pattern

All batch-created resources follow this pattern:
```
customer-resourcetype-batchGroupId-index
```

Examples:
- EC2: `rtg-test-ec2-501-1`, `rtg-test-ec2-501-2`, `rtg-test-ec2-501-3`
- S3: `rtg-test-s3-502-1`, `rtg-test-s3-502-2`, `rtg-test-s3-502-3`
- Lambda: `rtg-test-lambda-503-1`, `rtg-test-lambda-503-2`, `rtg-test-lambda-503-3`

The shared batch group ID (e.g., `501`, `502`, `503`) makes it easy to identify resources that were created together.

## Verifying Results

### Check DynamoDB Registration
```bash
# Get all resources for customer
curl "http://localhost:5000/monitor/resources?customer_name=rtg-test"

# Get specific resource type
curl "http://localhost:5000/monitor/resources?customer_name=rtg-test&type=EC2"

# Get specific batch group
curl "http://localhost:5000/monitor/resources?batch_group=501"
```

### Check AWS Console
- **EC2**: AWS Console → EC2 → Instances
- **S3**: AWS Console → S3 → Buckets
- **Lambda**: AWS Console → Lambda → Functions

## Prerequisites

- Node MCP server running on port 8080
- Flask backend running on port 5000
- Valid AWS credentials configured
- DynamoDB table for resource tracking

## Troubleshooting

If tests fail:

1. **Check server is running:**
   ```bash
   curl http://localhost:8080/health
   ```

2. **Check AWS credentials:**
   ```bash
   curl http://localhost:8080/aws/credentials/check
   ```

3. **View server logs:**
   ```bash
   # If running in background, check process
   ps aux | grep "node.*server.js"
   ```

4. **Restart services:**
   ```bash
   # Restart Node MCP server
   pkill -f 'node.*mcp-client/server.js'
   node mcp-client/server.js &
   
   # Restart Flask backend (if needed)
   # ... your Flask restart command ...
   ```

## Notes

- Each test creates 3 resources by default
- Tests use customer name `rtg-test` by default
- Default region is `us-east-1`
- Batch operations use a single Terraform apply (no state overwrites)
- All resources are automatically registered in DynamoDB with customer tracking
