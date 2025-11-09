# Test Commands for Log Retrieval

Use these commands in the frontend chatbot to test log retrieval from DynamoDB.

## Basic Log Queries

### By Resource Name
```
show recent logs from ecs2
```
```
show recent logs from olympus
```
```
show recent logs from ec2-olympus
```
```
get logs for olympus-test-ecs
```

### By Resource ID
```
show recent logs from res_vm_001
```
```
get logs for res_ec2_5adcfa8c
```
```
show logs from res_vm_001
```

## With Limits

### First N Logs
```
show first 50 logs from res_vm_001
```
```
show first 100 logs from ecs2
```
```
get 20 logs from olympus
```

### Recent Logs
```
show recent logs from res_vm_001
```
```
show latest logs from ecs2
```

## Variations to Test

### Different Phrasings
```
What are the logs for ecs2?
```
```
Display logs from res_vm_001
```
```
Fetch logs for olympus
```
```
View recent logs from ec2-olympus
```
```
List logs for res_vm_001
```

### With Resource Name Variations
```
show logs from ecs
```
```
show logs from ec2
```
```
show logs from olympus-test
```

## Expected Results

### Successful Response
You should see:
- 📊 Found X log(s) for resource: [resource_name]
- Status Summary: OK: X, ERROR: X, WARNING: X
- Recent Logs (showing X of Y):
  - List of logs with:
    - Status
    - Timestamp
    - Log code
    - Message
    - Customer name (if available)

### Error Responses
- **No logs found**: "No logs found for resource: [resource_name]"
- **Backend not running**: "❌ Error: Cannot connect to backend server..."
- **Resource not found**: "❌ Resource not found: [resource_name]"

## Testing Checklist

- [ ] Test with resource name: "show recent logs from ecs2"
- [ ] Test with resource ID: "show recent logs from res_vm_001"
- [ ] Test with limit: "show first 50 logs from res_vm_001"
- [ ] Test with partial name: "show logs from olympus"
- [ ] Test error case: "show logs from nonexistent_resource"
- [ ] Test with different phrasings

## Troubleshooting

### If you see generic AI responses:
1. Check MCP server is running: `cd mcp-client && npm start`
2. Check Flask backend is running: `python app.py`
3. Check logs are in DynamoDB: `python check_dynamodb.py`
4. Check router is working: Test in MCP server console

### If logs don't appear:
1. Verify logs were uploaded: `python check_dynamodb.py`
2. Check resource ID exists in logs: Check `logs.json` for `resources_affected`
3. Check backend logs: Look for errors in Flask console
4. Check MCP server logs: Look for routing/tool execution logs

## Quick Test Script

Run this to test the router directly:

```bash
cd mcp-client
node -e "import('./model/router.js').then(async m => { const result = await m.interpretMessage('show recent logs from ecs2'); console.log(JSON.stringify(result, null, 2)); })"
```

Expected output:
```json
{
  "tool": "getLogsByResource",
  "args": {
    "resource_name": "ecs2"
  }
}
```

