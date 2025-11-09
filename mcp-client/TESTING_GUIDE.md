# Testing Guide - NVIDIA Model Response

## Prerequisites
1. Make sure you have the `.env` file with `MODEL_API_KEY` set
2. Ensure all dependencies are installed: `npm install`

## Step 1: Test Router Function Directly

Test if the NVIDIA model is responding through the router:

```bash
cd mcp-client
node -e "import('./model/router.js').then(async m => { const result = await m.interpretMessage('Get logs with status active'); console.log('Result:', JSON.stringify(result, null, 2)); }).catch(e => console.error('Error:', e.message))"
```

**Expected Output:**
```json
{
  "tool": "getLogs",
  "args": {
    "status": "active"
  }
}
```

## Step 2: Test Multiple Messages

Test with different messages to verify routing:

```bash
# Test 1: Get logs
node -e "import('./model/router.js').then(async m => { const result = await m.interpretMessage('Show me error logs'); console.log('Result:', JSON.stringify(result, null, 2)); }).catch(e => console.error('Error:', e))"

# Test 2: Get resource
node -e "import('./model/router.js').then(async m => { const result = await m.interpretMessage('Get resource 123'); console.log('Result:', JSON.stringify(result, null, 2)); }).catch(e => console.error('Error:', e))"

# Test 3: Echo
node -e "import('./model/router.js').then(async m => { const result = await m.interpretMessage('Echo this message'); console.log('Result:', JSON.stringify(result, null, 2)); }).catch(e => console.error('Error:', e))"
```

## Step 3: Test with Full Server (WebSocket)

### 3a. Start the Server
```bash
cd mcp-client
node server.js
```

You should see:
```
🚀 MCP Server ready on ws://localhost:8080
```

### 3b. Test HTTP Endpoint
In another terminal:
```bash
curl http://localhost:8080
```

**Expected Output:**
```
✅ MCP Server is running on ws://localhost:8080
```

### 3c. Test WebSocket Connection

Create a test file `test-ws.js`:
```javascript
import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
  console.log("Connected!");
  ws.send(JSON.stringify({ message: "Get logs with status active" }));
});

ws.on("message", (data) => {
  console.log("Response:", data.toString());
  ws.close();
});

ws.on("error", (error) => {
  console.error("Error:", error.message);
});
```

Run it:
```bash
node test-ws.js
```

**Expected Output:**
```
Connected!
Response: {"reply":"Logs fetched with status: active"}
```

## Step 4: Run Full Test Suite

```bash
cd mcp-client
npm test
```

This runs all endpoint tests including:
- Router function test
- HTTP server test
- WebSocket server test
- Multiple message test

## Step 5: Check Server Logs

When the server is running, watch the console output. You should see:

```
🗣️ User: Get logs with status active
🧩 Routed to: getLogs { status: 'active' }
✅ Tool result: Logs fetched with status: active
```

## What to Look For

### ✅ Success Indicators:
- Router returns valid JSON with `tool` and `args` fields
- Tool name matches available tools: `echo`, `getLogs`, `getResource`
- Arguments are correctly extracted (status, id, text)
- Server logs show routing decisions
- No error messages in console

### ❌ Error Indicators:
- "Router error" messages in console
- "Unknown tool" errors
- Empty or invalid JSON responses
- Connection timeouts
- API key errors (401 Unauthorized)

## Troubleshooting

### If model is not responding:

1. **Check API Key:**
   ```bash
   cat .env | grep MODEL_API_KEY
   ```

2. **Test API directly:**
   ```bash
   curl -X POST https://integrate.api.nvidia.com/v1/chat/completions \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "nvidia/nvidia-nemotron-nano-9b-v2",
       "messages": [{"role": "user", "content": "Hello"}],
       "max_tokens": 50
     }'
   ```

3. **Check network connectivity:**
   ```bash
   ping integrate.api.nvidia.com
   ```

4. **Check for rate limits:**
   - Look for 429 (Too Many Requests) errors
   - Wait a few seconds between requests

## Quick Test Command

All-in-one test:
```bash
cd mcp-client && \
node -e "import('./model/router.js').then(async m => { 
  console.log('Testing NVIDIA model...'); 
  const tests = [
    'Get logs with status active',
    'Show me resource 456',
    'Echo this test'
  ]; 
  for (const msg of tests) { 
    const result = await m.interpretMessage(msg); 
    console.log(\`\nMessage: \${msg}\nResult: \${JSON.stringify(result, null, 2)}\`); 
  } 
}).catch(e => console.error('Error:', e.message))"
```

