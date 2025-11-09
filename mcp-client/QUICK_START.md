# Quick Start Guide

## Starting the Server

### Option 1: Using npm script
```bash
cd mcp-client
npm start
```

### Option 2: Direct node command
```bash
cd mcp-client
node server.js
```

## Testing the Server

### 1. Test HTTP Endpoint
```bash
curl http://localhost:8080
```

### 2. Test Router Function (No Server Needed)
```bash
cd mcp-client
node -e "import('./model/router.js').then(async m => { const result = await m.interpretMessage('Get logs with status active'); console.log('Result:', JSON.stringify(result, null, 2)); }).catch(e => console.error('Error:', e.message))"
```

### 3. Run Full Test Suite
```bash
cd mcp-client
npm test
```

## Common Issues

### Port 8080 already in use
If you get "EADDRINUSE" error:
```bash
# Find process using port 8080
lsof -i :8080

# Kill the process
kill -9 <PID>
```

### Connection Refused
- Make sure the server is running
- Check that you're in the correct directory (`mcp-client`)
- Verify port 8080 is not blocked by firewall

### API Key Issues
- Check `.env` file exists: `cat .env`
- Verify API key is set: `cat .env | grep MODEL_API_KEY`
- Make sure you're in the `mcp-client` directory when running commands

## Server Logs

When the server is running, you'll see logs like:
```
🚀 MCP Server ready on ws://localhost:8080
🗣️ User: Get logs with status active
🧩 Routed to: getLogs { status: 'active' }
✅ Tool result: Logs fetched with status: active
```

