// server.js
import dotenv from "dotenv";
dotenv.config();

// ✅ Import the correct MCP server class
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import express from "express";
import { WebSocketServer } from "ws";
import { interpretMessage } from "./model/router.js";

// 1️⃣ Define MCP Tools
const tools = {
  echo: {
    description: "Echoes text back to the user",
    run: async ({ text }) => `Echo: ${text}`,
  },
  getLogs: {
    description: "Fetches logs",
    run: async ({ status }) => `Logs fetched with status: ${status}`,
  },
  getResource: {
    description: "Retrieves resource info",
    run: async ({ id }) => `Resource ${id}: { uptime: '24h', usage: '80%' }`,
  },
};

// 2️⃣ Create MCP Server
const server = new McpServer({ tools });

// 3️⃣ Express + WebSocket setup
const app = express();
const wss = new WebSocketServer({ noServer: true });
const PORT = 8080;

app.get("/", (req, res) => {
  res.send("✅ MCP Server is running on ws://localhost:" + PORT);
});

const httpServer = app.listen(PORT, () =>
  console.log(`🚀 MCP Server ready on ws://localhost:${PORT}`)
);

// 4️⃣ WebSocket Message Handling
httpServer.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.on("message", async (data) => {
      try {
        const { message } = JSON.parse(data.toString());
        console.log("🗣️ User:", message);

        // Ask your NVIDIA model how to route it
        const { tool, args } = await interpretMessage(message);
        console.log("🧩 Routed to:", tool, args);

        // Run the mapped tool
        // ✅ NEW — call the tool manually
        if (!tools[tool]) {
          throw new Error(`Unknown tool: ${tool}`);
        }

        const result = await tools[tool].run(args);
        console.log("✅ Tool result:", result);

        // Send back response
        ws.send(JSON.stringify({ reply: result }));

        // Send result back to client
        ws.send(JSON.stringify({ reply: result }));
      } catch (err) {
        console.error("❌ Error processing message:", err);
        ws.send(JSON.stringify({ error: err.message }));
      }
    });
  });
});
