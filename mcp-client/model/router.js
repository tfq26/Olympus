import axios from "axios";

// NVIDIA NIM endpoint (correct URL from env)
const MODEL_API_URL = process.env.NVIDIA_API_URL 
  ? `${process.env.NVIDIA_API_URL}/chat/completions`
  : "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL_API_KEY = process.env.NVIDIA_API_KEY || process.env.MODEL_API_KEY;
const USE_SIMPLE_ROUTER = process.env.USE_SIMPLE_ROUTER === "1";

// Simple keyword-based router (fallback when NVIDIA API unavailable)
function simpleRouter(message) {
  const lower = message.toLowerCase();
  
  // S3 operations
  if (lower.includes("create") && (lower.includes("s3") || lower.includes("bucket"))) {
    const bucketMatch = message.match(/(?:bucket|called|named)\s+([a-z0-9-]+)/i);
    return { 
      tool: "createS3Bucket", 
      args: { bucket_name: bucketMatch?.[1] || "my-bucket", aws_region: "us-east-1" } 
    };
  }
  if (lower.includes("destroy") && (lower.includes("s3") || lower.includes("bucket"))) {
    const bucketMatch = message.match(/bucket\s+([a-z0-9-]+)/i);
    return { 
      tool: "destroyS3Bucket", 
      args: { bucket_name: bucketMatch?.[1] || "my-bucket" } 
    };
  }
  
  // EC2 operations
  if (lower.includes("create") && lower.includes("ec2")) {
    return { tool: "createEC2", args: {} };
  }
  if (lower.includes("destroy") && lower.includes("ec2")) {
    return { tool: "destroyEC2", args: {} };
  }
  
  // Lambda operations
  if (lower.includes("create") && lower.includes("lambda")) {
    const nameMatch = message.match(/(?:lambda|function)\s+([a-z0-9-_]+)/i);
    return { 
      tool: "createLambda", 
      args: { function_name: nameMatch?.[1] || "my-function", aws_region: "us-east-1" } 
    };
  }
  if (lower.includes("destroy") && lower.includes("lambda")) {
    return { tool: "destroyLambda", args: {} };
  }
  
  // Logs and metrics
  if (lower.includes("log")) {
    const resourceMatch = message.match(/(?:resource|id)[-:\s]+([a-z0-9-]+)/i);
    if (lower.includes("analy")) {
      return { tool: "analyzeLogs", args: resourceMatch ? { resource_id: resourceMatch[1] } : {} };
    }
    return { tool: "getLogs", args: resourceMatch ? { resource_id: resourceMatch[1] } : {} };
  }
  
  if (lower.includes("metric")) {
    const resourceMatch = message.match(/(?:resource|id)[-:\s]+([a-z0-9-]+)/i);
    if (resourceMatch) {
      return { tool: "getResourceMetrics", args: { resource_id: resourceMatch[1] } };
    }
    const instanceMatch = message.match(/instance[-:\s]+([a-z0-9-]+)/i);
    if (instanceMatch) {
      return { tool: "getMetrics", args: { instance_id: instanceMatch[1] } };
    }
    return { tool: "getResourceMetrics", args: { resource_id: "unknown" } };
  }
  
  // Tickets
  if (lower.includes("ticket")) {
    if (lower.includes("create")) {
      const issueMatch = message.match(/issue[:\s]+([^,]+)/i);
      const resourceMatch = message.match(/resource[-:\s]+([a-z0-9-]+)/i);
      return { 
        tool: "createTicket", 
        args: { 
          issue: issueMatch?.[1]?.trim() || "Issue", 
          resource_id: resourceMatch?.[1] || "unknown" 
        } 
      };
    }
    return { tool: "getTickets", args: {} };
  }
  
  // Health
  if (lower.includes("health") || lower.includes("customer")) {
    return { tool: "getCustomerHealth", args: {} };
  }
  
  // Terraform ping
  if (lower.includes("ping") && lower.includes("terraform")) {
    return { tool: "terraformPing", args: {} };
  }
  
  // Resource info
  if (lower.includes("resource") && !lower.includes("log") && !lower.includes("metric")) {
    const idMatch = message.match(/(?:resource|id)[-:\s]+([a-z0-9-]+)/i);
    return { tool: "getResource", args: { id: idMatch?.[1] || "unknown" } };
  }
  
  // Default: echo
  return { tool: "echo", args: { text: message } };
}

export async function interpretMessage(message) {
  // Use simple router if enabled or as fallback
  if (USE_SIMPLE_ROUTER || !MODEL_API_KEY) {
    console.log("Using simple keyword router");
    return simpleRouter(message);
  }

  try {
    const systemPrompt = `You are an MCP router. Given a user message, decide which tool to call and what arguments to send.

Available tools:
- echo: Echoes text back
- getLogs: Fetches logs (args: status?, resource_id?)
- getResource: Retrieves resource info (args: id)
- getMetrics: Get CloudWatch metrics (args: instance_id)
- getResourceMetrics: Get resource metrics (args: resource_id)
- analyzeLogs: Analyze logs with AI (args: resource_id?, status?)
- getCustomerHealth: Get customer health summary
- getTickets: Get tickets (args: status?, severity?, employee_id?)
- createTicket: Create a ticket (args: issue, resource_id, severity?, issue_type?, description?, customer_name?)
- terraformPing: Ping Terraform MCP server
- createS3Bucket: Create S3 bucket (args: bucket_name, aws_region?)
- destroyS3Bucket: Destroy S3 bucket (args: bucket_name)
- createEC2: Create EC2 instance
- destroyEC2: Destroy EC2 instance
- createLambda: Create Lambda function (args: function_name, aws_region?, source_code?)
- destroyLambda: Destroy Lambda function

Output ONLY valid JSON in this exact format:
{
  "tool": "<tool_name>",
  "args": { "key": "value" }
}

Do not include any explanation, just the JSON object.`;

    const response = await axios.post(
      MODEL_API_URL,
      {
        model: "nvidia/nvidia-nemotron-nano-9b-v2",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.2,
        max_tokens: 300,
        top_p: 0.95
      },
      {
        headers: {
          Authorization: `Bearer ${MODEL_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      }
    );

    // Parse NVIDIA response
    const text = response.data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", text);
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log("Router result (NVIDIA):", parsed);
    return parsed;
  } catch (err) {
    console.error("Router error, falling back to simple router:", err.response?.data?.detail || err.message);
    // fallback to simple router
    return simpleRouter(message);
  }
}
