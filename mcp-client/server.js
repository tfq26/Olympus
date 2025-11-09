// server.js
import dotenv from "dotenv";
dotenv.config();

// ✅ Import the correct MCP server class
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import express from "express";
import { WebSocketServer } from "ws";
import axios from "axios";
import { interpretMessage, queryAI } from "./model/router.js";

// Flask backend URL
const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || "http://localhost:5000";

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
  getLogsByResource: {
    description: "Gets logs for a specific resource from DynamoDB backend. Can accept resource ID or resource name, and optional limit",
    run: async ({ resource_id, resource_name, limit }) => {
      // Determine which identifier was provided
      const identifier = resource_id || resource_name;
      
      if (!identifier) {
        return "Error: resource_id or resource_name is required. Please provide a resource ID (e.g., res_vm_001) or resource name (e.g., olympus-ec2)";
      }
      
      // Parse and validate limit
      const logLimit = limit ? Math.min(Math.max(parseInt(limit) || 20, 1), 100) : 20; // Default 20, max 100

      try {
        // First, try to resolve resource name to resource ID if name was provided
        let actualResourceId = resource_id;
        
        if (resource_name && !resource_id) {
          // Search for resource by name
          try {
            const resourcesResponse = await axios.get(`${FLASK_BACKEND_URL}/monitor/mock/metrics`, {
              timeout: 10000
            });
            
            const resources = resourcesResponse.data.resources || [];
            // Normalize search term - remove common prefixes/suffixes and split by common delimiters
            const normalizedSearch = resource_name.toLowerCase().replace(/[-_]/g, ' ').trim();
            const searchTerms = normalizedSearch.split(/\s+/);
            
            // Try to find resource by name (case-insensitive, partial matching)
            const foundResource = resources.find(r => {
              const name = r.name?.toLowerCase() || '';
              const id = r.id?.toLowerCase() || '';
              const instanceId = r.instance_id?.toLowerCase() || '';
              const tagName = r.tags?.Name?.toLowerCase() || '';
              
              // Check if any search term matches any part of the resource identifiers
              return searchTerms.some(term => 
                name.includes(term) || 
                id.includes(term) || 
                instanceId.includes(term) || 
                tagName.includes(term) ||
                name.includes(resource_name.toLowerCase()) ||
                tagName.includes(resource_name.toLowerCase())
              );
            });
            
            if (foundResource) {
              actualResourceId = foundResource.id;
              console.log(`✅ Resolved resource name "${resource_name}" to resource ID: ${actualResourceId}`);
            } else {
              // If not found by name, try using the identifier directly as resource_id
              actualResourceId = identifier;
              console.log(`⚠️ Resource name "${resource_name}" not found, trying as resource ID: ${actualResourceId}`);
            }
          } catch (searchError) {
            // If resource search fails, try using identifier directly
            actualResourceId = identifier;
            console.log(`⚠️ Could not search for resources, using identifier directly: ${actualResourceId}`);
          }
        } else {
          actualResourceId = identifier;
        }

        // Call Flask backend to get logs from DynamoDB
        const response = await axios.get(`${FLASK_BACKEND_URL}/monitor/mock/logs`, {
          params: {
            resource_id: actualResourceId
          },
          timeout: 10000 // 10 second timeout
        });

        const data = response.data;
        const logs = data.logs || [];
        const total = data.total || 0;

        if (total === 0) {
          return `No logs found for resource: ${identifier}${actualResourceId !== identifier ? ` (searched as: ${actualResourceId})` : ''}`;
        }

        // Sort logs by timestamp (newest first) - limit to requested number
        const sortedLogs = logs
          .sort((a, b) => {
            const timeA = new Date(a.time || a.timestamp || 0);
            const timeB = new Date(b.time || b.timestamp || 0);
            return timeB - timeA;
          })
          .slice(0, logLimit); // Show requested number of logs

        // Count by status (for all logs, not just displayed ones)
        const statusCounts = {};
        logs.forEach(log => {
          const status = log.status || "UNKNOWN";
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        // Generate human-readable summary using NVIDIA LLM (before formatting logs)
        let llmSummary = "";
        try {
          console.log("🤖 Generating LLM summary of logs...");
          
          // Prepare log samples for analysis (use first 15 logs for context)
          const sampleLogs = sortedLogs.slice(0, 15);
          
          const summaryPrompt = `Analyze the following system logs for resource "${identifier}" and provide a clear, human-readable summary in plain English.

**Log Statistics:**
- Total logs found: ${total}
- Status breakdown: ${Object.entries(statusCounts).map(([status, count]) => `${status}: ${count}`).join(", ")}
- Time range: ${sortedLogs.length > 0 ? (sortedLogs[sortedLogs.length - 1].time || sortedLogs[sortedLogs.length - 1].timestamp || "Unknown") : "N/A"} to ${sortedLogs.length > 0 ? (sortedLogs[0].time || sortedLogs[0].timestamp || "Unknown") : "N/A"}

**Sample Logs (most recent ${sampleLogs.length}):**
${sampleLogs.map((log, idx) => {
  const time = log.time || log.timestamp || "Unknown";
  const status = log.status || "UNKNOWN";
  const subtype = log.subtype || "N/A";
  const message = log.message || log.description || log.log_code || "System event";
  const customer = log.customer_name || "Unknown customer";
  const logInfo = message && message !== "No message" ? message : `${subtype} event`;
  return `${idx + 1}. [${status}] ${time.substring(0, 16)} - ${subtype}: ${logInfo.substring(0, 80)}${logInfo.length > 80 ? '...' : ''} (${customer})`;
}).join("\n")}

**Please provide a concise analysis including:**
1. **Executive Summary**: Overall health status (2-3 sentences)
2. **Key Issues**: Critical or warning-level problems that need attention
3. **Patterns**: Notable trends or recurring issues
4. **Recommendations**: Actionable steps to improve system health

Write in clear, professional English suitable for a DevOps team. Focus on what matters most.`;

          llmSummary = await queryAI(summaryPrompt, "You are an experienced DevOps engineer analyzing system logs. Provide clear, actionable insights in a professional but accessible tone.");
          console.log("✅ LLM summary generated successfully");
        } catch (llmError) {
          console.error("⚠️ LLM summary generation failed:", llmError.message);
          llmSummary = ""; // Will skip summary if LLM fails
        }

        // Build formatted response with summary first, then detailed logs
        let formattedResponse = `📊 **Log Report for Resource: ${identifier}**`;
        if (actualResourceId !== identifier) {
          formattedResponse += ` (ID: ${actualResourceId})`;
        }
        formattedResponse += `\n\n`;
        
        formattedResponse += `**Statistics:**\n`;
        formattedResponse += `- Total logs: ${total}\n`;
        formattedResponse += `- Status breakdown: ${Object.entries(statusCounts).map(([status, count]) => `**${status}**: ${count}`).join(", ")}\n`;
        if (logLimit < total) {
          formattedResponse += `- Displaying: ${sortedLogs.length} most recent logs\n`;
        }
        formattedResponse += `\n`;

        // Add AI summary if available
        if (llmSummary) {
          formattedResponse += `🤖 **AI Analysis Summary**\n`;
          formattedResponse += `${llmSummary}\n\n`;
          formattedResponse += `---\n\n`;
        }

        // Add detailed log list
        formattedResponse += `**Recent Logs:**\n\n`;
        sortedLogs.forEach((log, index) => {
          const time = log.time || log.timestamp || "Unknown time";
          const status = log.status || "UNKNOWN";
          const subtype = log.subtype || "N/A";
          const message = log.message || log.description || "No message";
          const logCode = log.log_code || log.id || "N/A";

          // Use emoji for status
          const statusEmoji = {
            "OK": "✅",
            "ERROR": "❌",
            "WARNING": "⚠️",
            "CRITICAL": "🔴",
            "STALE": "🟡"
          }[status] || "📋";

          formattedResponse += `${index + 1}. ${statusEmoji} **[${status}]** ${time}\n`;
          formattedResponse += `   • Code: ${logCode} | Type: ${subtype}\n`;
          if (message && message !== "No message") {
            formattedResponse += `   • Message: ${message}\n`;
          }
          if (log.customer_name) {
            formattedResponse += `   • Customer: ${log.customer_name}\n`;
          }
          formattedResponse += `\n`;
        });

        return formattedResponse;
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
          return `❌ Error: Cannot connect to backend server. Please make sure the Flask backend is running on ${FLASK_BACKEND_URL}`;
        }
        
        if (error.response) {
          // Backend returned an error
          const status = error.response.status;
          const errorMsg = error.response.data?.error || error.message;
          
          if (status === 404) {
            return `❌ Resource not found: ${identifier}${actualResourceId !== identifier ? ` (searched as: ${actualResourceId})` : ''}`;
          }
          
          return `❌ Error fetching logs: ${errorMsg} (Status: ${status})`;
        }
        
        return `❌ Error fetching logs: ${error.message}`;
      }
    },
  },
  summarizeAllLogs: {
    description: "Summarizes logs with optional filters (customer, status, resource). Can summarize all customers or filtered by customer name, status, or resource ID.",
    run: async ({ customer_name, status, resource_id }) => {
      try {
        // Build query parameters for Flask backend
        const params = {};
        if (customer_name) params.customer_name = customer_name;
        if (status) params.status = status;
        if (resource_id) params.resource_id = resource_id;

        console.log(`📊 Requesting logs summary with filters:`, params);

        // Call Flask backend to get logs summary with filters
        const response = await axios.get(`${FLASK_BACKEND_URL}/monitor/mock/logs/summary`, {
          params,
          timeout: 10000
        });

        const data = response.data;
        const overall = data.overall || {};
        const customers = data.customers || [];
        const filters = data.filters_applied || {};
        const logs = data.logs || [];
        const totalLogsAvailable = data.total_logs_available || 0;
        const totalLogsReturned = data.total_logs_returned || 0;

        console.log(`📊 Summary data received from Flask backend:`, {
          total_logs: overall.total_logs,
          total_customers: overall.total_customers,
          health_score: overall.health_score,
          OK: overall.OK,
          WARNING: overall.WARNING,
          ERROR: overall.ERROR,
          CRITICAL: overall.CRITICAL,
          filters_applied: filters,
          logs_count: logs.length,
          total_logs_available: totalLogsAvailable
        });

        if (!overall.total_logs || overall.total_logs === 0) {
          const filterText = Object.entries(filters)
            .filter(([key, value]) => value)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");
          return `No logs found${filterText ? ` with filters: ${filterText}` : ""}. Please check your filters or make sure logs are loaded in DynamoDB or logs.json file.`;
        }

        // Format response: Summary first, then logs (if filters are applied)
        let formattedResponse = `Overall Statistics\n`;
        
        // Show filters if any were applied
        const activeFilters = Object.entries(filters)
          .filter(([key, value]) => value)
          .map(([key, value]) => `${key}: ${value}`);
        
        if (activeFilters.length > 0) {
          formattedResponse += `Filters: ${activeFilters.join(", ")}\n`;
        }
        
        formattedResponse += `\n`;
        formattedResponse += `Total Logs: ${overall.total_logs || 0}\n`;
        formattedResponse += `Total Customers: ${overall.total_customers || 0}\n`;
        formattedResponse += `Overall Health Score: ${overall.health_score || 0}%\n`;
        formattedResponse += `\n`;
        formattedResponse += `Status Breakdown\n`;
        formattedResponse += `\n`;
        formattedResponse += `OK: ${overall.OK || 0}\n`;
        formattedResponse += `WARNING: ${overall.WARNING || 0}\n`;
        formattedResponse += `ERROR: ${overall.ERROR || 0}\n`;
        formattedResponse += `CRITICAL: ${overall.CRITICAL || 0}\n`;

        // If filters are applied and logs are available, add log entries at the top
        // Format: Logs first (scrollable), then summary
        if (logs.length > 0) {
          // Start with logs section
          let logsSection = `═══════════════════════════════════════════════════════════════\n`;
          logsSection += `LOG ENTRIES (${totalLogsReturned} of ${totalLogsAvailable} logs)\n`;
          logsSection += `═══════════════════════════════════════════════════════════════\n\n`;
          
          logs.forEach((log, index) => {
            const time = log.time || log.timestamp || "Unknown time";
            const status = log.status || "UNKNOWN";
            const subtype = log.subtype || "N/A";
            const message = log.message || log.description || "No message";
            const logCode = log.log_code || log.id || "N/A";
            const customer = log.customer_name || "Unknown";
            
            // Use emoji for status
            const statusEmoji = {
              "OK": "✅",
              "ERROR": "❌",
              "WARNING": "⚠️",
              "CRITICAL": "🔴",
              "STALE": "🟡"
            }[status] || "📋";
            
            // Format time to be more readable (remove timezone if present)
            const timeStr = time.substring(0, 19).replace('T', ' ');
            
            logsSection += `${index + 1}. ${statusEmoji} [${status}] ${timeStr}\n`;
            logsSection += `   ID: ${logCode} | Type: ${subtype} | Customer: ${customer}\n`;
            if (message && message !== "No message") {
              // Truncate long messages
              const msgPreview = message.length > 100 ? message.substring(0, 100) + "..." : message;
              logsSection += `   Message: ${msgPreview}\n`;
            }
            if (log.resources_affected && log.resources_affected.length > 0) {
              logsSection += `   Resources: ${log.resources_affected.join(", ")}\n`;
            }
            logsSection += `\n`;
          });
          
          if (totalLogsAvailable > totalLogsReturned) {
            logsSection += `\n... and ${totalLogsAvailable - totalLogsReturned} more logs (showing first ${totalLogsReturned})\n`;
          }
          
          logsSection += `\n`;
          logsSection += `═══════════════════════════════════════════════════════════════\n`;
          logsSection += `SUMMARY\n`;
          logsSection += `═══════════════════════════════════════════════════════════════\n\n`;
          
          // Put logs at the top, summary after
          formattedResponse = logsSection + formattedResponse;
        }

        return formattedResponse;
      } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
          return `❌ Error: Cannot connect to backend server. Please make sure the Flask backend is running on ${FLASK_BACKEND_URL}`;
        }
        
        if (error.response) {
          const status = error.response.status;
          const errorMsg = error.response.data?.error || error.message;
          return `❌ Error fetching logs summary: ${errorMsg} (Status: ${status})`;
        }
        
        return `❌ Error fetching logs summary: ${error.message}`;
      }
    },
  },
  getResourceByName: {
    description: "Searches for a resource by name, instance ID, or resource ID",
    run: async ({ name }) => {
      if (!name) {
        return "Error: name is required. Please provide a resource name, instance ID, or resource ID";
      }

      try {
        const response = await axios.get(`${FLASK_BACKEND_URL}/monitor/mock/metrics`, {
          timeout: 10000
        });

        const resources = response.data.resources || [];
        
        // Search for resource by name, id, or instance_id (case-insensitive)
        const foundResources = resources.filter(r => 
          r.name?.toLowerCase().includes(name.toLowerCase()) ||
          r.id?.toLowerCase().includes(name.toLowerCase()) ||
          r.instance_id?.toLowerCase().includes(name.toLowerCase()) ||
          r.tags?.Name?.toLowerCase().includes(name.toLowerCase())
        );

        if (foundResources.length === 0) {
          return `No resources found matching: ${name}`;
        }

        if (foundResources.length === 1) {
          const resource = foundResources[0];
          return `✅ Found resource:\nID: ${resource.id}\nName: ${resource.name || 'N/A'}\nInstance ID: ${resource.instance_id || 'N/A'}\nStatus: ${resource.status || 'N/A'}`;
        }

        // Multiple matches
        let result = `Found ${foundResources.length} resources matching "${name}":\n\n`;
        foundResources.forEach((r, idx) => {
          result += `${idx + 1}. ID: ${r.id}\n   Name: ${r.name || 'N/A'}\n   Instance ID: ${r.instance_id || 'N/A'}\n\n`;
        });
        return result;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          return `❌ Error: Cannot connect to backend server. Please make sure the Flask backend is running on ${FLASK_BACKEND_URL}`;
        }
        return `❌ Error searching for resources: ${error.message}`;
      }
    },
  },
  queryAI: {
    description: "Query the NVIDIA AI model with any prompt",
    run: async ({ prompt, systemMessage }) => {
      try {
        const response = await queryAI(prompt, systemMessage);
        return response;
      } catch (error) {
        return `Error querying AI: ${error.message}`;
      }
    },
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
        const payload = JSON.parse(data.toString());
        
        // Check if direct tool/args are provided (bypasses router)
        if (payload.tool && payload.args) {
          console.log("🔧 Direct tool call:", payload.tool, payload.args);
          
          if (!tools[payload.tool]) {
            throw new Error(`Unknown tool: ${payload.tool}`);
          }

          const result = await tools[payload.tool].run(payload.args);
          console.log("✅ Tool result:", result);

          // Send result back to client
          ws.send(JSON.stringify({ reply: result }));
        } 
        // Otherwise, use message routing through NVIDIA model
        else if (payload.message) {
          console.log("🗣️ User message received:", payload.message);

          try {
            // Ask your NVIDIA model how to route it
            const { tool, args } = await interpretMessage(payload.message);
            console.log("🧩 Router decision - Tool:", tool, "Args:", JSON.stringify(args));

            // Run the mapped tool
            if (!tools[tool]) {
              console.error(`❌ Unknown tool: ${tool}`);
              console.error(`Available tools:`, Object.keys(tools));
              throw new Error(`Unknown tool: ${tool}. Available tools: ${Object.keys(tools).join(", ")}`);
            }

            console.log(`🔧 Executing tool: ${tool} with args:`, JSON.stringify(args));
            const result = await tools[tool].run(args);
            console.log("✅ Tool execution completed. Result length:", result?.length || 0, "characters");
            
            // Truncate very long results for logging
            if (result && result.length > 500) {
              console.log("✅ Tool result preview (first 500 chars):", result.substring(0, 500) + "...");
              console.log("✅ Tool result preview (last 200 chars):", "..." + result.substring(result.length - 200));
            } else {
              console.log("✅ Tool result:", result);
            }

            // Send result back to client
            ws.send(JSON.stringify({ reply: result }));
          } catch (routerError) {
            console.error("❌ Error in router or tool execution:");
            console.error("  Message:", routerError.message);
            console.error("  Stack:", routerError.stack);
            ws.send(JSON.stringify({ error: routerError.message }));
          }
        } else {
          throw new Error("Invalid payload: must include either 'message' or 'tool' and 'args'");
        }
      } catch (err) {
        console.error("❌ Error processing message:", err);
        ws.send(JSON.stringify({ error: err.message }));
      }
    });
  });
});
