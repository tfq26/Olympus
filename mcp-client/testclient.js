import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
  console.log("✅ Connected to MCP server");
  // Try sending a natural language prompt
  ws.send(JSON.stringify({ message: "Show me all active logs" }));
});

ws.on("message", (data) => {
  console.log("💬 Server replied:", data.toString());
});
