# Debugging Router Issues

## Problem: Getting "Echo" response instead of logs

If you're seeing "Echo: show recent logs from res_vm_001" instead of actual logs, here's how to debug:

## Quick Fixes

### 1. Check Services Are Running

```bash
# Check MCP server
lsof -ti:8080 && echo "✅ MCP server running" || echo "❌ MCP server NOT running"

# Check Flask backend  
lsof -ti:5000 && echo "✅ Flask backend running" || echo "❌ Flask backend NOT running"
```

### 2. Start Required Services

```bash
# Terminal 1: Flask backend
python app.py

# Terminal 2: MCP server
cd mcp-client && npm start

# Terminal 3: Frontend
cd Frontend && npm run dev
```

### 3. Check MCP Server Logs

When you send a message, check the MCP server console. You should see:
```
🗣️ User: show recent logs from res_vm_001
🔍 Detected log query: {"tool":"getLogsByResource","args":{"resource_id":"res_vm_001"}}
🧩 Routed to: getLogsByResource {"resource_id":"res_vm_001"}
🔧 Executing tool: getLogsByResource
✅ Tool result: ...
```

If you see errors instead, that's the issue.

## Common Issues

### Issue 1: Router Falls Back to Echo

**Symptom**: Getting "Echo: ..." response

**Possible Causes**:
1. Router error (NVIDIA API failure, parsing error)
2. Tool execution error (Flask backend not running)
3. Router not detecting log query

**Fix**: 
- Check MCP server logs for errors
- Make sure Flask backend is running
- Check router is detecting log queries (should see "🔍 Detected log query")

### Issue 2: Flask Backend Not Running

**Symptom**: Error message about connecting to backend

**Fix**:
```bash
python app.py
```

### Issue 3: Router Not Detecting Log Queries

**Symptom**: Router routes to wrong tool or falls back to echo

**Fix**:
- Check router logs for "🔍 Detected log query"
- If not detected, check message format matches patterns
- Test router directly: `node -e "import('./model/router.js').then(async m => { const r = await m.interpretMessage('show recent logs from res_vm_001'); console.log(r); })"`

### Issue 4: Logs Not in DynamoDB

**Symptom**: "No logs found" or empty response

**Fix**:
```bash
# Upload logs to DynamoDB
python upload_logs_to_dynamodb.py

# Verify logs are in DynamoDB
python check_dynamodb.py
```

## Testing the Router

### Test 1: Router Detection

```bash
cd mcp-client
node -e "import('./model/router.js').then(async m => { const result = await m.interpretMessage('show recent logs from res_vm_001'); console.log(JSON.stringify(result, null, 2)); })"
```

**Expected**: `{"tool":"getLogsByResource","args":{"resource_id":"res_vm_001"}}`

### Test 2: Full Flow (WebSocket)

```bash
cd mcp-client
node test-full-flow.js
```

### Test 3: Flask Backend

```bash
curl "http://localhost:5000/monitor/mock/logs?resource_id=res_vm_001"
```

## Debugging Steps

1. **Check Router Logs**: Look for "🔍 Detected log query" in MCP server console
2. **Check Tool Execution**: Look for "🔧 Executing tool: getLogsByResource"
3. **Check Flask Backend**: Verify it's running and accessible
4. **Check DynamoDB**: Verify logs are uploaded
5. **Check Error Messages**: Look for error messages in MCP server console

## Expected Flow

```
User types: "show recent logs from res_vm_001"
    ↓
Frontend sends: {"message": "show recent logs from res_vm_001"}
    ↓
MCP Server receives message
    ↓
Router detects log query: ✅
    ↓
Router routes to: getLogsByResource
    ↓
Tool executes: Calls Flask backend
    ↓
Flask backend: Queries DynamoDB
    ↓
Tool formats logs: Returns formatted string
    ↓
MCP Server: Sends formatted logs to frontend
    ↓
Frontend: Displays logs
```

## If Still Not Working

1. **Restart all services**: Stop and restart MCP server, Flask backend, frontend
2. **Check .env file**: Make sure MODEL_API_KEY is set
3. **Check AWS credentials**: Make sure DynamoDB is accessible
4. **Check browser console**: Look for WebSocket errors
5. **Check network**: Make sure ports 5000 and 8080 are accessible

