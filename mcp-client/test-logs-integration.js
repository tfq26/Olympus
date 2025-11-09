// Test script for logs integration
import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
  console.log("✅ Connected to MCP server");
  console.log("\n📤 Testing: 'Show recent logs from res_vm_001'");
  
  ws.send(JSON.stringify({
    message: "Show recent logs from res_vm_001"
  }));
});

ws.on("message", (data) => {
  try {
    const response = JSON.parse(data.toString());
    console.log("\n📥 Server Response:");
    if (response.reply) {
      console.log(response.reply);
    } else if (response.error) {
      console.error("❌ Error:", response.error);
    }
    ws.close();
    process.exit(0);
  } catch (e) {
    console.log("📥 Raw Response:", data.toString());
    ws.close();
    process.exit(0);
  }
});

ws.on("error", (error) => {
  console.error("❌ WebSocket error:", error.message);
  if (error.code === 'ECONNREFUSED') {
    console.error("\n⚠️  MCP Server is not running. Start it with: npm start");
  }
  process.exit(1);
});

setTimeout(() => {
  console.error("⏱️  Timeout waiting for response");
  process.exit(1);
}, 30000);

