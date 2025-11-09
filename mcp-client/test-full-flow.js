// Test the full flow: router -> tool execution
import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
  console.log("✅ Connected to MCP server");
  console.log("\n📤 Testing: 'show recent logs from res_vm_001'");
  console.log("Sending message to router...\n");
  
  ws.send(JSON.stringify({
    message: "show recent logs from res_vm_001"
  }));
});

ws.on("message", (data) => {
  try {
    const response = JSON.parse(data.toString());
    console.log("📥 Server Response:");
    if (response.reply) {
      console.log("\n" + response.reply);
      if (response.reply.includes("Echo:")) {
        console.log("\n❌ ERROR: Got echo response instead of logs!");
        console.log("This means the router fell back to echo tool.");
        console.log("Check MCP server console for errors.");
      } else if (response.reply.includes("📊")) {
        console.log("\n✅ SUCCESS: Got logs from DynamoDB!");
      } else if (response.reply.includes("Error") || response.reply.includes("❌")) {
        console.log("\n⚠️  Got error response (might be backend not running)");
      }
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
    console.error("\n⚠️  MCP Server is not running. Start it with:");
    console.error("   cd mcp-client && npm start");
  }
  process.exit(1);
});

setTimeout(() => {
  console.error("⏱️  Timeout waiting for response");
  process.exit(1);
}, 30000);

