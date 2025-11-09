# Debugging "Summarize Logs from All Customers"

## Issue: "No logs found" Error

If you're getting "No logs found" when asking to summarize logs from all customers, follow these steps:

## 1. Check Router Detection

The router should correctly detect "summarize logs from all customers" and route to `summarizeAllLogs` tool.

### Test Router:
```bash
cd mcp-client
node -e "import('./model/router.js').then(async m => { const r = await m.interpretMessage('summarize logs from all customers'); console.log(JSON.stringify(r, null, 2)); })"
```

**Expected Output:**
```json
{
  "tool": "summarizeAllLogs",
  "args": {}
}
```

If it returns `getLogsByResource` instead, the router needs to be fixed.

## 2. Check Flask Backend

### Test Flask Endpoint:
```bash
curl "http://localhost:5000/monitor/mock/logs/summary" | python3 -m json.tool
```

**Expected Output:**
```json
{
  "overall": {
    "total_logs": 10000,
    "total_customers": 5,
    "health_score": 89.2,
    "OK": 9017,
    "WARNING": 402,
    "ERROR": 389,
    "CRITICAL": 192
  },
  "customers": [...]
}
```

If you get an error, check:
- Flask backend is running: `./START_FLASK.sh`
- Logs are loaded (DynamoDB or JSON file)
- Check Flask logs for errors

## 3. Check MCP Server Logs

When you send "summarize logs from all customers", check the MCP server logs for:

1. **Router Detection:**
   ```
   🔍 Router received message: "summarize logs from all customers"
   ✅✅✅ ROUTING TO summarizeAllLogs: "summarize logs from all customers"
   ```

2. **Tool Execution:**
   ```
   🧩 Router decision - Tool: summarizeAllLogs Args: {}
   🔧 Executing tool: summarizeAllLogs with args: {}
   📊 Summary data received: { total_logs: 10000, total_customers: 5, ... }
   ```

3. **Error Messages:**
   - If you see "No logs found for resource: all customers" → Router is routing to wrong tool
   - If you see "Cannot connect to backend server" → Flask backend is not running
   - If you see "No logs found in summary response" → Flask backend returned empty logs

## 4. Check Logs Source

### Verify DynamoDB:
```bash
cd mcp/monitor
python3 -c "from dynamodb_client import get_all_logs; logs = get_all_logs(); print(f'Logs from DynamoDB: {len(logs) if logs else 0}')"
```

### Verify JSON File:
```bash
python3 -c "import json; data = json.load(open('logs.json')); print(f'Logs from JSON: {len(data.get(\"logs\", []))}')"
```

## 5. Common Issues

### Issue 1: Router Routing to Wrong Tool
**Symptom:** "No logs found for resource: all customers"

**Fix:**
1. Restart MCP server: `cd mcp-client && npm start`
2. Check router logs to see what tool was selected
3. Verify router.js has the latest changes

### Issue 2: Flask Backend Not Running
**Symptom:** "Cannot connect to backend server"

**Fix:**
1. Start Flask backend: `./START_FLASK.sh`
2. Verify it's running: `curl http://localhost:5000/monitor/mock/logs/summary`

### Issue 3: No Logs in Database
**Symptom:** "No logs found for any customers"

**Fix:**
1. Upload logs to DynamoDB: `python3 upload_logs_to_dynamodb.py`
2. Or verify logs.json file exists and has data
3. Check Flask logs for errors loading logs

### Issue 4: WebSocket Connection Issues
**Symptom:** "WebSocket is closed before the connection is established"

**Fix:**
1. Make sure MCP server is running: `cd mcp-client && npm start`
2. Check if port 8080 is available
3. Check MCP server logs for connection errors

## 6. Step-by-Step Testing

1. **Start Flask Backend:**
   ```bash
   ./START_FLASK.sh
   ```

2. **Verify Flask is Running:**
   ```bash
   curl "http://localhost:5000/monitor/mock/logs/summary" | python3 -m json.tool | head -20
   ```

3. **Start MCP Server:**
   ```bash
   cd mcp-client && npm start
   ```

4. **Test Router:**
   ```bash
   cd mcp-client
   node -e "import('./model/router.js').then(async m => { const r = await m.interpretMessage('summarize logs from all customers'); console.log(JSON.stringify(r, null, 2)); })"
   ```

5. **Test in Frontend:**
   - Open frontend: `http://localhost:5174/logs`
   - Send message: "summarize logs from all customers"
   - Check browser console for errors
   - Check MCP server logs for routing and execution

## 7. Expected Flow

1. **Frontend** → Sends WebSocket message: `{"message": "summarize logs from all customers"}`
2. **MCP Server** → Router detects "summarize logs from all customers"
3. **Router** → Returns `{tool: "summarizeAllLogs", args: {}}`
4. **MCP Server** → Executes `summarizeAllLogs` tool
5. **Tool** → Calls Flask backend: `GET /monitor/mock/logs/summary`
6. **Flask Backend** → Loads logs from DynamoDB (or JSON), calculates summary
7. **Tool** → Formats response with statistics and AI summary
8. **MCP Server** → Sends formatted response to frontend
9. **Frontend** → Displays summary in chat

## 8. Debugging Checklist

- [ ] Flask backend is running (`./START_FLASK.sh`)
- [ ] Flask endpoint returns data (`curl http://localhost:5000/monitor/mock/logs/summary`)
- [ ] MCP server is running (`cd mcp-client && npm start`)
- [ ] Router correctly detects query (test with node command)
- [ ] Logs exist in DynamoDB or JSON file
- [ ] WebSocket connection is established (check browser console)
- [ ] No errors in MCP server logs
- [ ] No errors in Flask backend logs
- [ ] No errors in browser console

## 9. Quick Fixes

### Restart Everything:
```bash
# Stop Flask backend (Ctrl+C)
# Stop MCP server (Ctrl+C)

# Start Flask backend
./START_FLASK.sh

# In another terminal, start MCP server
cd mcp-client && npm start

# Test in frontend
```

### Clear and Reload:
```bash
# Clear browser cache
# Reload frontend page
# Try query again
```

## 10. Still Not Working?

Check the actual error message:
- If it says "No logs found for resource: all customers" → Router issue
- If it says "Cannot connect to backend" → Flask not running
- If it says "No logs found for any customers" → No logs in database
- If it says "Unknown tool" → Tool not registered in server.js

Check server logs for the exact error and fix accordingly.

