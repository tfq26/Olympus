# DynamoDB Logs Integration

## Overview

The MCP server is now integrated with the Flask backend to fetch logs from DynamoDB. Users can query logs for specific resources through the chatbot.

## Implementation

### Files Modified

1. **`mcp-client/server.js`**
   - Added `getLogsByResource` tool
   - Connects to Flask backend at `http://localhost:5000`
   - Fetches logs from `/monitor/mock/logs?resource_id=<id>`
   - Formats logs for display

2. **`mcp-client/model/router.js`**
   - Updated router prompt to recognize log queries
   - Added examples for `getLogsByResource` tool
   - Router now extracts resource IDs from natural language

### New Tool: `getLogsByResource`

**Description:** Gets logs for a specific resource from DynamoDB backend

**Arguments:**
- `resource_id` (required): Resource ID (e.g., "res_vm_001")

**Functionality:**
- Calls Flask backend API: `GET /monitor/mock/logs?resource_id=<id>`
- Fetches logs from DynamoDB (via Flask backend)
- Sorts logs by timestamp (newest first)
- Limits to 20 most recent logs
- Formats logs with status, timestamp, message, and metadata
- Provides status summary (count by status)

**Error Handling:**
- Backend not running: Shows connection error
- Resource not found: Shows 404 error
- No logs: Shows "No logs found" message
- Network errors: Shows error message

## Usage

### Through Chatbot (Natural Language)

Users can ask:
- "Show recent logs from res_vm_001"
- "Get logs for resource res_vm_002"
- "What are the logs for res_vm_003?"

### Direct Tool Call

```javascript
{
  "tool": "getLogsByResource",
  "args": {
    "resource_id": "res_vm_001"
  }
}
```

## Flow

1. **User types message** in frontend chatbot
2. **Frontend sends** via WebSocket to MCP server
3. **MCP server receives** message
4. **Router (NVIDIA LLM)** parses message and routes to `getLogsByResource`
5. **Tool executes** HTTP GET to Flask backend
6. **Flask backend** queries DynamoDB via `get_logs_by_resource()`
7. **Flask returns** JSON: `{ "logs": [...], "total": <count> }`
8. **Tool formats** logs into readable text
9. **Response sent** back via WebSocket
10. **Frontend displays** logs in chat

## Configuration

### Environment Variables

- `FLASK_BACKEND_URL`: Flask backend URL (default: `http://localhost:5000`)
- `MODEL_API_KEY`: NVIDIA API key (required)

### Backend Requirements

- Flask backend must be running on port 5000 (or configured URL)
- DynamoDB must be configured and accessible
- Endpoint: `GET /monitor/mock/logs?resource_id=<id>`

## Response Format

```
📊 Found 5 log(s) for resource: res_vm_001

Status Summary: OK: 3, ERROR: 1, WARNING: 1

Recent Logs (showing 5 of 5):

1. [ERROR] 2025-01-09T10:30:00Z
   Code: LOG_001 | Type: connection_error
   Failed to connect to database
   Customer: Acme Corp

2. [WARNING] 2025-01-09T10:25:00Z
   Code: LOG_002 | Type: high_memory
   Memory usage above threshold
   Customer: Acme Corp

...
```

## Testing

### Test Router
```bash
cd mcp-client
node -e "import('./model/router.js').then(async m => { const result = await m.interpretMessage('Show recent logs from res_vm_001'); console.log(JSON.stringify(result, null, 2)); })"
```

### Test Full Integration
```bash
# Terminal 1: Start Flask backend
python app.py

# Terminal 2: Start MCP server
cd mcp-client
npm start

# Terminal 3: Test via WebSocket
node test-logs-integration.js
```

### Test in Frontend
1. Start Flask backend: `python app.py`
2. Start MCP server: `cd mcp-client && npm start`
3. Start Frontend: `cd Frontend && npm run dev`
4. Open chatbot and type: "Show recent logs from res_vm_001"

## Troubleshooting

### Backend Not Running
Error: `Cannot connect to backend server`
Solution: Start Flask backend with `python app.py`

### Resource Not Found
Error: `Resource not found: res_vm_001`
Solution: Check if resource ID exists in DynamoDB/metrics.json

### No Logs Found
Response: `No logs found for resource: res_vm_001`
Solution: Resource exists but has no logs associated with it

### DynamoDB Connection Issues
Error: Backend returns 500 error
Solution: Check DynamoDB configuration and credentials

## Notes

- Logs are sorted by timestamp (newest first)
- Only 20 most recent logs are shown
- Status summary shows count by status type
- Customer name is included if available
- Log code and subtype are displayed for each log

