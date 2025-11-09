// server.js
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Load env from repo root first (unified env), then local .env for overrides
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
dotenv.config();

// ✅ Import the correct MCP server class
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import express from "express";
import bodyParser from "body-parser";
import { WebSocketServer } from "ws";
import { interpretMessage } from "./model/router.js";
import { callTerraformTool, listTerraformTools } from "./tools/terraformClient.js";
import axios from "axios";

// Flask backend URL for monitoring tools
const FLASK_URL = process.env.FLASK_URL || "http://localhost:5000";

// 1️⃣ Define MCP Tools (including Terraform proxy tools that leverage the NVIDIA router potential)
const tools = {
  echo: {
    description: "Echoes text back to the user",
    run: async ({ text }) => `Echo: ${text}`,
  },
  getLogs: {
    description: "Fetches logs (demo stub)",
    run: async ({ status }) => `Logs fetched with status: ${status}`,
  },
  getResource: {
    description: "Retrieves resource info (demo stub)",
    run: async ({ id }) => `Resource ${id}: { uptime: '24h', usage: '80%' }`,
  },
  terraformPing: {
    description: "Ping the Terraform MCP server to verify availability",
    run: async () => await callTerraformTool("ping", {}),
  },
  createS3Bucket: {
    description: "Create an S3 bucket via Terraform. Args: bucket_name, aws_region?",
    run: async ({ bucket_name, aws_region = "us-east-1" }) => {
      if (!bucket_name) throw new Error("bucket_name required");
      return await callTerraformTool("create_s3_bucket", { bucket_name, aws_region, auto_approve: true });
    },
  },
  destroyS3Bucket: {
    description: "Destroy an S3 bucket via Terraform. Args: bucket_name",
    run: async ({ bucket_name }) => {
      if (!bucket_name) throw new Error("bucket_name required");
      return await callTerraformTool("destroy_s3_bucket", { bucket_name, auto_approve: true });
    },
  },
  createEC2: {
    description: "Create an EC2 instance via Terraform",
    run: async () => await callTerraformTool("create_ec2_instance", { auto_approve: true }),
  },
  destroyEC2: {
    description: "Destroy the EC2 instance via Terraform",
    run: async () => await callTerraformTool("destroy_ec2", {}),
  },
  createLambda: {
    description: "Create a Lambda function via Terraform. Args: function_name, aws_region?, source_code?",
    run: async ({ function_name, aws_region = "us-east-1", source_code }) => {
      if (!function_name) throw new Error("function_name required");
      return await callTerraformTool("create_lambda_function", { function_name, aws_region, source_code, auto_approve: true });
    },
  },
  destroyLambda: {
    description: "Destroy the Lambda function via Terraform",
    run: async () => await callTerraformTool("destroy_lambda_function", { auto_approve: true }),
  },
  // Monitoring & Logs tools (proxy to Flask monitor endpoints)
  getMetrics: {
    description: "Get CloudWatch metrics for an EC2 instance. Args: instance_id",
    run: async ({ instance_id }) => {
      if (!instance_id) throw new Error("instance_id required");
      const res = await axios.get(`${FLASK_URL}/monitor/metrics`, { params: { instance_id } });
      return res.data;
    },
  },
  getResourceMetrics: {
    description: "Get mock resource metrics by resource_id. Args: resource_id",
    run: async ({ resource_id }) => {
      if (!resource_id) throw new Error("resource_id required");
      const res = await axios.get(`${FLASK_URL}/monitor/mock/metrics/${resource_id}`);
      return res.data;
    },
  },
  getLogs: {
    description: "Get logs with optional filters. Args: resource_id?, status?",
    run: async ({ resource_id, status }) => {
      const params = {};
      if (resource_id) params.resource_id = resource_id;
      if (status) params.status = status;
      const res = await axios.get(`${FLASK_URL}/monitor/mock/logs`, { params });
      return res.data;
    },
  },
  analyzeLogs: {
    description: "Analyze logs with AI. Args: resource_id?, status?",
    run: async ({ resource_id, status }) => {
      const params = {};
      if (resource_id) params.resource_id = resource_id;
      if (status) params.status = status;
      const res = await axios.get(`${FLASK_URL}/monitor/mock/logs/analysis`, { params });
      return res.data;
    },
  },
  getCustomerHealth: {
    description: "Get customer health summary from logs",
    run: async () => {
      const res = await axios.get(`${FLASK_URL}/monitor/mock/customers/health`);
      return res.data;
    },
  },
  getTickets: {
    description: "Get tickets with optional filters. Args: status?, severity?, employee_id?",
    run: async ({ status, severity, employee_id }) => {
      const params = {};
      if (status) params.status = status;
      if (severity) params.severity = severity;
      if (employee_id) params.employee_id = employee_id;
      const res = await axios.get(`${FLASK_URL}/monitor/tickets`, { params });
      return res.data;
    },
  },
  createTicket: {
    description: "Create a new ticket. Args: issue, resource_id, severity?, issue_type?, description?, customer_name?",
    run: async ({ issue, resource_id, severity, issue_type, description, customer_name }) => {
      if (!issue || !resource_id) throw new Error("issue and resource_id required");
      const res = await axios.post(`${FLASK_URL}/monitor/tickets`, {
        issue,
        resource_id,
        severity,
        issue_type,
        description,
        customer_name,
      });
      return res.data;
    },
  },
};

// 2️⃣ Create MCP Server
const server = new McpServer({ tools });

// 3️⃣ Express + WebSocket setup
const app = express();
app.use(bodyParser.json());
const wss = new WebSocketServer({ noServer: true });
const PORT = 8080;

app.get("/", (req, res) => {
  res.send("✅ MCP Server is running on ws://localhost:" + PORT);
});

// --------------------
// HTTP endpoints to trigger Terraform MCP tools via Docker stdio
// --------------------
app.get("/terraform/ping", async (req, res) => {
  try {
    const result = await callTerraformTool("ping", {});
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/terraform/tools", async (req, res) => {
  try {
    const result = await listTerraformTools();
    res.json({ ok: true, tools: result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --------------------
// Unified NLP endpoint - natural language → tool routing via NVIDIA
// Returns INTENT for user confirmation, does NOT execute automatically
// --------------------
app.post("/nlp", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ ok: false, error: "message required" });
    
    // Use NVIDIA router to determine tool and args
    const { tool, args } = await interpretMessage(message);
    
    // Check if tool exists
    if (!tools[tool]) {
      return res.status(404).json({ ok: false, error: `Unknown tool: ${tool}` });
    }
    
    // Determine if this is a destructive/infrastructure operation requiring confirmation
    const destructiveTools = [
      'createS3Bucket', 'destroyS3Bucket',
      'createEC2', 'destroyEC2',
      'createLambda', 'destroyLambda'
    ];
    
    const requiresConfirmation = destructiveTools.includes(tool);
    
    // Return intent WITHOUT executing
    res.json({
      ok: true,
      intent: {
        tool,
        args,
        description: tools[tool].description,
        requiresConfirmation
      },
      message: requiresConfirmation 
        ? "⚠️ This operation requires confirmation. Use /nlp/execute to proceed."
        : "This is a read-only operation and can be executed safely."
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --------------------
// Execute confirmed NLP intent
// --------------------
app.post("/nlp/execute", async (req, res) => {
  try {
    const { tool, args, userConfirmed } = req.body;
    
    if (!userConfirmed) {
      return res.status(400).json({ ok: false, error: "userConfirmed must be true" });
    }
    
    if (!tool || !args) {
      return res.status(400).json({ ok: false, error: "tool and args required" });
    }
    
    if (!tools[tool]) {
      return res.status(404).json({ ok: false, error: `Unknown tool: ${tool}` });
    }
    
    // Execute the tool
    const result = await tools[tool].run(args);
    res.json({ ok: true, tool, args, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/terraform/s3", async (req, res) => {
  try {
    const { bucket_name, aws_region = "us-east-1" } = req.body || {};
    if (!bucket_name) return res.status(400).json({ ok: false, error: "bucket_name is required" });
    const result = await callTerraformTool("create_s3_bucket", { bucket_name, aws_region, auto_approve: true });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete("/terraform/s3/:name", async (req, res) => {
  try {
    const bucket_name = req.params.name;
    const result = await callTerraformTool("destroy_s3_bucket", { bucket_name, auto_approve: true });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/terraform/ec2", async (req, res) => {
  try {
    const result = await callTerraformTool("create_ec2_instance", { auto_approve: true });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete("/terraform/ec2", async (req, res) => {
  try {
    const result = await callTerraformTool("destroy_ec2", {});
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/terraform/lambda", async (req, res) => {
  try {
    const { function_name, aws_region = "us-east-1", source_code } = req.body || {};
    if (!function_name) return res.status(400).json({ ok: false, error: "function_name is required" });
    const result = await callTerraformTool("create_lambda_function", { function_name, aws_region, source_code, auto_approve: true });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete("/terraform/lambda", async (req, res) => {
  try {
    const result = await callTerraformTool("destroy_lambda_function", { auto_approve: true });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --------------------
// Monitoring Endpoints (proxy to Flask)
// --------------------
app.get("/monitor/metrics/:instance_id", async (req, res) => {
  try {
    const { instance_id } = req.params;
    const result = await axios.get(`${FLASK_URL}/monitor/metrics`, { params: { instance_id } });
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/monitor/metrics/enriched/:instance_id", async (req, res) => {
  try {
    const { instance_id } = req.params;
    const { resource_id, auto_update } = req.query;
    const result = await axios.get(`${FLASK_URL}/monitor/metrics/enriched`, { 
      params: { instance_id, resource_id, auto_update } 
    });
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/monitor/resources", async (req, res) => {
  try {
    const result = await axios.get(`${FLASK_URL}/monitor/mock/metrics`);
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/monitor/resource/:resource_id", async (req, res) => {
  try {
    const { resource_id } = req.params;
    const result = await axios.get(`${FLASK_URL}/monitor/mock/metrics/${resource_id}`);
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/monitor/logs", async (req, res) => {
  try {
    const { resource_id, status } = req.query;
    const result = await axios.get(`${FLASK_URL}/monitor/mock/logs`, { 
      params: { resource_id, status } 
    });
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/monitor/logs/analysis", async (req, res) => {
  try {
    const { resource_id, status } = req.query;
    const result = await axios.get(`${FLASK_URL}/monitor/mock/logs/analysis`, { 
      params: { resource_id, status } 
    });
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const httpServer = app.listen(PORT, () =>
  console.log(`🚀 MCP Server ready on ws://localhost:${PORT}`)
);

// 4️⃣ WebSocket Message Handling
httpServer.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.on("message", async (data) => {
      try {
        const payload = JSON.parse(data.toString());
        const { message, intent, userConfirmed } = payload;
        
        // Two-phase: 1) Get intent, 2) Execute with confirmation
        if (intent && userConfirmed) {
          // Phase 2: User confirmed, execute the intent
          console.log("✅ User confirmed:", intent);
          
          if (!tools[intent.tool]) {
            throw new Error(`Unknown tool: ${intent.tool}`);
          }
          
          const result = await tools[intent.tool].run(intent.args);
          console.log("✅ Tool result:", result);
          
          ws.send(JSON.stringify({ 
            reply: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            intent: intent.tool 
          }));
        } else if (message) {
          // Phase 1: Parse user message and return intent
          console.log("🗣️ User:", message);

          // Ask NVIDIA model to route it
          const { tool, args } = await interpretMessage(message);
          console.log("🧩 Routed to:", tool, args);

          // Check if tool is destructive
          const destructiveTools = [
            'createS3Bucket', 'destroyS3Bucket',
            'createEC2', 'destroyEC2',
            'createLambda', 'destroyLambda'
          ];
          
          const requiresConfirmation = destructiveTools.includes(tool);
          
          if (requiresConfirmation) {
            // Send confirmation request to user
            ws.send(JSON.stringify({
              needsConfirmation: true,
              intent: { tool, args, description: tools[tool]?.description },
              message: `⚠️ This will execute: ${tool} with args ${JSON.stringify(args)}. Confirm to proceed.`
            }));
          } else {
            // Safe operation, execute immediately
            const result = await tools[tool].run(args);
            console.log("✅ Tool result:", result);
            ws.send(JSON.stringify({ 
              reply: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }));
          }
        } else {
          throw new Error("Invalid message format");
        }
      } catch (err) {
        console.error("❌ Error processing message:", err);
        ws.send(JSON.stringify({ error: err.message }));
      }
    });
  });
});
