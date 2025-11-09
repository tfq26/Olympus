// server.js
import dotenv from "dotenv";
dotenv.config();

import { MCPServer } from "@modelcontextprotocol/sdk";
import express from "express";
import { WebSocketServer } from "ws";
import { interpretMessage } from "./model/router.js";

// 1️⃣ Define your MCP tools (functions)
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
    run: async ({ id }) => `Resource ${id}: {{ uptime: '24h', usage: '80%' }}`,
  },
};

// 2️⃣ Create MCP Server
const server = new MCPServer({ tools });

// 3️⃣ Setup Express + WebSocket transport
const app = express();
const wss = new WebSocketServer({ noServer: true });
const PORT = 8080;

app.get("/", (req, res) => {
  res.send("✅ MCP Server is running (ws://localhost:" + PORT + ")");
});

const httpServer = app.listen(PORT, () =>
  console.log(`🚀 MCP Server ready on ws://localhost:${PORT}`)
);

// 4️⃣ Handle WebSocket upgrades
httpServer.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.on("message", async (data) => {
      try {
        const { message } = JSON.parse(data.toString());
        console.log("🗣️ User:", message);

        // Ask NVIDIA model which tool to call
        const { tool, args } = await interpretMessage(message);
        console.log("🧩 Routed to:", tool, args);

        // Run the selected tool
        const result = await server.callTool(tool, args);
        console.log("✅ Tool result:", result);

        // Send back response
        ws.send(JSON.stringify({ reply: result }));
      } catch (err) {
        console.error("❌ Error processing message:", err);
        ws.send(JSON.stringify({ error: err.message }));
      }
    });
  });
});
