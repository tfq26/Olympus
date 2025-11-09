# Quick Fix: Start Flask Backend

## The Problem
You're getting this error:
```
❌ Error: Cannot connect to backend server. Please make sure the Flask backend is running on http://localhost:5000
```

## The Solution
**Start the Flask backend!**

### Option 1: Manual Start
```bash
python app.py
```

### Option 2: Use the Start Script
```bash
./START_SERVICES.sh
```

## Verify It's Working

### 1. Check Flask Backend is Running
```bash
curl http://localhost:5000/monitor/mock/logs?resource_id=res_vm_001
```

You should see JSON with logs, not a connection error.

### 2. Test in Chatbot
Type in the chatbot:
```
show recent logs from res_vm_001
```

You should now see formatted logs instead of the error message!

## What's Happening

1. ✅ Router detects: "show recent logs from res_vm_001"
2. ✅ Routes to: `getLogsByResource` tool
3. ✅ Tool executes: Tries to call Flask backend
4. ❌ Flask backend: NOT RUNNING → Returns error
5. ✅ Error message: Displayed in chatbot

Once Flask backend is running:
1. ✅ Router detects log query
2. ✅ Routes to `getLogsByResource` tool  
3. ✅ Tool executes: Calls Flask backend
4. ✅ Flask backend: RUNNING → Returns logs from DynamoDB
5. ✅ Logs displayed: Formatted in chatbot

## Full Service Checklist

Make sure all services are running:

```bash
# Terminal 1: Flask Backend
python app.py

# Terminal 2: MCP Server  
cd mcp-client && npm start

# Terminal 3: Frontend
cd Frontend && npm run dev
```

## Test Again

After starting Flask backend, try:
```
show recent logs from res_vm_001
```

You should now see:
```
📊 Found 10000 log(s) for resource: res_vm_001

Status Summary: OK: 5000, ERROR: 2000, WARNING: 2500, CRITICAL: 500

Recent Logs (showing 20 of 10000):

1. [ERROR] 2025-11-01T00:10:00Z
   Code: VM_0002 | Type: service_health
   Failed to connect to database
   Customer: TechCore Solutions

...
```

