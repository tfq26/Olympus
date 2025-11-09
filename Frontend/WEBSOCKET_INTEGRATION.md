# WebSocket Integration Guide

## Overview

The frontend chatbot is now connected to the backend WebSocket server. When users type messages in the chatbot, they are sent to the NVIDIA LLM via WebSocket and the responses are displayed in real-time.

## How It Works

1. **Frontend (ChatBot.jsx)**: User types a message and clicks send
2. **WebSocket Hook (useWebSocketChat.js)**: Connects to `ws://localhost:8080`
3. **Backend (server.js)**: Receives the message and calls the `queryAI` tool
4. **NVIDIA LLM**: Processes the prompt and returns a response
5. **Frontend**: Displays the AI response in the chat interface

## Files Changed

### New Files
- `Frontend/src/hooks/useWebSocketChat.js` - Custom hook that manages WebSocket connection and messages

### Modified Files
- `Frontend/src/components/ChatBot.jsx` - Updated to use `useWebSocketChat` instead of `useChat`

## Setup Instructions

### 1. Start the Backend Server

```bash
cd mcp-client
npm start
```

The server should be running on `ws://localhost:8080`

### 2. Start the Frontend

```bash
cd Frontend
npm run dev
```

### 3. Test the Chatbot

1. Open the frontend application in your browser
2. Type a message in the chatbot
3. The message will be sent to the NVIDIA LLM via WebSocket
4. The AI response will appear in the chat

## Message Flow

```
User Input → ChatBot Component → useWebSocketChat Hook → WebSocket → Backend Server → queryAI Tool → NVIDIA LLM → Response → WebSocket → Frontend → Display
```

## WebSocket Message Format

### Request (Frontend to Backend)
```json
{
  "tool": "queryAI",
  "args": {
    "prompt": "User's question here",
    "systemMessage": "You are a helpful assistant. Answer questions clearly and concisely."
  }
}
```

### Response (Backend to Frontend)
```json
{
  "reply": "AI response text here"
}
```

## Features

- ✅ Real-time WebSocket communication
- ✅ Automatic reconnection on connection loss
- ✅ Loading states while waiting for AI response
- ✅ Error handling with user-friendly messages
- ✅ Maintains existing UI design (no visual changes)

## Troubleshooting

### Connection Refused Error

If you see "Connection error" messages:

1. **Check if backend server is running:**
   ```bash
   curl http://localhost:8080
   ```

2. **Start the backend server:**
   ```bash
   cd mcp-client
   npm start
   ```

3. **Check WebSocket connection:**
   - Open browser DevTools → Network → WS
   - Look for connection to `ws://localhost:8080`

### No Response from AI

1. **Check backend logs** for errors
2. **Verify NVIDIA API key** is set in `.env` file
3. **Check browser console** for WebSocket errors

### Messages Not Appearing

1. **Check browser console** for JavaScript errors
2. **Verify WebSocket connection** is established
3. **Check network tab** for WebSocket messages

## Configuration

### Change WebSocket URL

Edit `Frontend/src/hooks/useWebSocketChat.js`:
```javascript
const ws = new WebSocket("ws://localhost:8080"); // Change this URL
```

### Change System Message

Edit `Frontend/src/hooks/useWebSocketChat.js`:
```javascript
systemMessage: "You are a helpful assistant. Answer questions clearly and concisely."
```

## API Compatibility

The `useWebSocketChat` hook is designed to be compatible with the `useChat` hook from `@ai-sdk/react`, so the ChatBot component works without major changes.

### Supported Methods
- `messages` - Array of chat messages
- `append(message)` - Send a new message
- `isLoading` - Loading state
- `stop()` - Stop loading
- `setMessages` - Set messages directly

### Not Supported
- `reload()` - Not implemented (returns empty function)

