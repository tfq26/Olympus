// Test script to query the AI directly using the queryAI tool
import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
  console.log("✅ Connected to server");
  console.log("\n📤 Querying AI with prompt: 'how to make a sandwich?'");
  
  // Use the queryAI tool directly
  ws.send(JSON.stringify({
    tool: "queryAI",
    args: {
      prompt: "how to make a sandwich?",
      systemMessage: "You are a helpful assistant. Answer questions clearly and concisely."
    }
  }));
});

ws.on("message", (data) => {
  console.log("\n📥 AI Response:");
  console.log(data.toString());
  ws.close();
  process.exit(0);
});

ws.on("error", (error) => {
  console.error("❌ Error:", error.message);
  if (error.code === 'ECONNREFUSED') {
    console.error("\n⚠️  Server is not running. Start it with: npm start");
  }
  process.exit(1);
});

setTimeout(() => {
  console.error("⏱️  Timeout waiting for response");
  process.exit(1);
}, 30000);

