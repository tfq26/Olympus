# AI Query Guide

## How to Query the NVIDIA AI Model

You can now query the NVIDIA AI model directly using the `queryAI` tool. This allows you to ask any question and get a direct response from the AI.

## Method 1: Direct Function Call (No Server Needed)

```bash
cd mcp-client
node -e "import('./model/router.js').then(async m => { const result = await m.queryAI('How many legs does a horse have?', 'You are a helpful assistant.'); console.log('AI Response:', result); }).catch(e => console.error('Error:', e.message))"
```

## Method 2: Via WebSocket Server (Using queryAI Tool)

### Step 1: Start the Server
```bash
cd mcp-client
npm start
```

### Step 2: Send Query via WebSocket

**Using the test script:**
```bash
node test-ai-query.js
```

**Or send this JSON directly:**
```json
{
  "tool": "queryAI",
  "args": {
    "prompt": "How many legs does a horse have?",
    "systemMessage": "You are a helpful assistant. Answer questions clearly and concisely."
  }
}
```

### Step 3: Using Node.js WebSocket Client

```javascript
import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
  ws.send(JSON.stringify({
    tool: "queryAI",
    args: {
      prompt: "Explain quantum computing in simple terms",
      systemMessage: "You are a helpful science teacher."
    }
  }));
});

ws.on("message", (data) => {
  console.log("AI Response:", data.toString());
  ws.close();
});
```

## Method 3: Via Message Routing (Automatic)

The server can also automatically route to queryAI if you send a message:

```json
{
  "message": "How many legs does a horse have?"
}
```

However, this will use the router which may route to other tools. For direct AI queries, use Method 2.

## Examples

### Example 1: Simple Question
```json
{
  "tool": "queryAI",
  "args": {
    "prompt": "What is the capital of France?",
    "systemMessage": "You are a helpful assistant."
  }
}
```

### Example 2: Code Explanation
```json
{
  "tool": "queryAI",
  "args": {
    "prompt": "Explain how async/await works in JavaScript",
    "systemMessage": "You are a programming tutor. Explain concepts clearly with examples."
  }
}
```

### Example 3: Without System Message
```json
{
  "tool": "queryAI",
  "args": {
    "prompt": "What is 2 + 2?"
  }
}
```

## Available Tools

1. **queryAI** - Query the NVIDIA AI model directly
   - `prompt` (required): The question or prompt to send to AI
   - `systemMessage` (optional): System message to set AI behavior

2. **echo** - Echo text back
3. **getLogs** - Get logs by status
4. **getResource** - Get resource information

## Quick Test Commands

### Test queryAI function directly:
```bash
cd mcp-client
node -e "import('./model/router.js').then(async m => { 
  const result = await m.queryAI('What is the speed of light?'); 
  console.log(result); 
})"
```

### Test via WebSocket:
```bash
# Terminal 1
npm start

# Terminal 2
node test-ai-query.js
```

## Response Format

The AI will return a plain text response:

```
A horse has four legs. This is typical for most mammals, including horses, which use their legs for movement and balance.
```

Or in WebSocket format:
```json
{
  "reply": "A horse has four legs. This is typical for most mammals..."
}
```

