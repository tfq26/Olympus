# DynamoDB Logs Upload Guide

This guide explains how to upload logs from `logs.json` to DynamoDB so they can be accessed via the frontend.

## Prerequisites

1. **AWS Credentials**: Make sure your AWS credentials are configured:
   ```bash
   # Option 1: AWS CLI
   aws configure
   
   # Option 2: Environment variables
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_DEFAULT_REGION=us-east-1
   ```

2. **Environment Variables**: Check your `.env` file has DynamoDB configuration:
   ```env
   DYNAMODB_REGION=us-east-1
   DYNAMODB_TABLE_LOGS=logs-table
   DYNAMODB_TABLE_METRICS=metrics-table
   ```

3. **Dependencies**: Make sure Python packages are installed:
   ```bash
   pip install -r requirements.txt
   ```

## Upload Logs to DynamoDB

### Step 1: Upload Logs

Run the upload script:

```bash
python upload_logs_to_dynamodb.py
```

This will:
- Create the DynamoDB table if it doesn't exist
- Upload all logs from `logs.json` to DynamoDB
- Show progress and statistics

### Step 2: Verify Upload

Check if logs were uploaded successfully:

```bash
python check_dynamodb.py
```

This will show:
- DynamoDB connection status
- Number of logs in DynamoDB
- Number of resources in DynamoDB

## Accessing Logs from Frontend

Once logs are uploaded to DynamoDB, they can be accessed via:

### 1. Flask Backend API

```bash
# Get logs for a specific resource
curl "http://localhost:5000/monitor/mock/logs?resource_id=res_vm_001"

# Get all logs
curl "http://localhost:5000/monitor/mock/logs"
```

### 2. Frontend Chatbot

Ask the chatbot:
- "Show recent logs from ecs2"
- "Show first 50 logs from olympus"
- "Get logs for resource res_vm_001"

The chatbot will:
1. Route the query to `getLogsByResource` tool
2. Call Flask backend API
3. Fetch logs from DynamoDB
4. Display formatted logs in the chat

## How It Works

### Architecture

```
Frontend (React)
    ↓ WebSocket
MCP Server (Node.js)
    ↓ HTTP
Flask Backend (Python)
    ↓ boto3
DynamoDB
```

### Data Flow

1. **User asks for logs** in frontend chatbot
2. **MCP Server** routes query to `getLogsByResource` tool
3. **Tool** calls Flask backend: `GET /monitor/mock/logs?resource_id=<id>`
4. **Flask backend** calls `get_logs_by_resource()` from `log_data.py`
5. **log_data.py** tries DynamoDB first, falls back to JSON if DynamoDB unavailable
6. **DynamoDB** returns logs (with field mapping: `log_id` → `id`, `timestamp` → `time`)
7. **Flask backend** returns JSON response
8. **MCP Server** formats logs and sends to frontend
9. **Frontend** displays logs in chat

### Field Mapping

DynamoDB uses different field names than JSON:
- **JSON**: `id` → **DynamoDB**: `log_id` (partition key)
- **JSON**: `time` → **DynamoDB**: `timestamp` (sort key)

The `dynamodb_client.py` automatically handles this mapping:
- **Upload**: Maps `id` → `log_id`, `time` → `timestamp`
- **Download**: Maps `log_id` → `id`, `timestamp` → `time`

## Troubleshooting

### Logs Not Appearing in Frontend

1. **Check DynamoDB connection**:
   ```bash
   python check_dynamodb.py
   ```

2. **Verify Flask backend is running**:
   ```bash
   python app.py
   ```

3. **Verify MCP server is running**:
   ```bash
   cd mcp-client
   npm start
   ```

4. **Check logs in DynamoDB**:
   ```bash
   aws dynamodb scan --table-name logs-table --limit 5
   ```

### Upload Fails

1. **Check AWS credentials**:
   ```bash
   aws sts get-caller-identity
   ```

2. **Check table exists**:
   ```bash
   aws dynamodb describe-table --table-name logs-table
   ```

3. **Check IAM permissions**:
   - Need `dynamodb:PutItem`
   - Need `dynamodb:BatchWriteItem`
   - Need `dynamodb:Scan`
   - Need `dynamodb:Query`

### Backend Falls Back to JSON

If the backend falls back to JSON instead of using DynamoDB:

1. **Check DynamoDB connection**:
   ```bash
   python check_dynamodb.py
   ```

2. **Check environment variables**:
   ```bash
   cat .env | grep DYNAMODB
   ```

3. **Check table name matches**:
   - `.env`: `DYNAMODB_TABLE_LOGS=logs-table`
   - DynamoDB table name should match exactly

## Updating Logs

If you update `logs.json`, upload again:

```bash
python upload_logs_to_dynamodb.py
```

**Note**: This will add/update logs in DynamoDB. If a log with the same `id` exists, it will be overwritten.

## Performance

- **Upload speed**: ~100-500 logs/second (depending on AWS region and network)
- **10,000 logs**: ~20-100 seconds
- **Query speed**: DynamoDB queries are fast (< 100ms for most queries)

## Next Steps

1. Upload logs: `python upload_logs_to_dynamodb.py`
2. Start Flask backend: `python app.py`
3. Start MCP server: `cd mcp-client && npm start`
4. Start Frontend: `cd Frontend && npm run dev`
5. Test in chatbot: "Show recent logs from ecs2"

