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
  
  // Robust batch count extractor avoiding the "2" in "ec2"
  const extractBatchCount = (msg) => {
    const rx = /(?<![A-Za-z0-9])(\d+)\s+(?:ec2|instances?|buckets?|lambdas?|functions?)/i;
    const m = msg.match(rx);
    return m ? parseInt(m[1], 10) : 1;
  };
  const batchCount = extractBatchCount(message);
  
  // Helper to extract explicit name after phrases like "named", "called", "that is named", "that is called"
  const extractExplicitName = (msg, kindPatterns) => {
    // Build a combined regex that looks for any of the kind patterns optionally followed by qualifiers then named/called
    // Examples we want to match:
    // "create a lambda function that is named lambdaTest26"
    // "create s3 bucket called my-bucket-123"
    // "spin up ec2 instance named DemoBox_01"
    const nameRegexes = [
      /named\s+([A-Za-z0-9-_\.]+)/i,
      /called\s+([A-Za-z0-9-_\.]+)/i,
      /that\s+is\s+named\s+([A-Za-z0-9-_\.]+)/i,
      /that\s+is\s+called\s+([A-Za-z0-9-_\.]+)/i,
      /name\s+([A-Za-z0-9-_\.]+)/i
    ];
    for (const rx of nameRegexes) {
      const m = msg.match(rx);
      if (m) return m[1];
    }
    // Fallback: after resource type directly: e.g. "lambda function lambdaTest26"
    const direct = msg.match(new RegExp(`${kindPatterns.join('|')}\s+([A-Za-z0-9-_\.]+)`, 'i'));
    return direct ? direct[1] : '';
  };

  // Customer extractor (captures phrases like "for johns pizza company" until next keyword or EOL)
  const extractCustomer = (msg) => {
    const m = msg.match(/(?:for|customer|client|company)\s+([A-Za-z0-9'_\s-]+?)(?=(?:\s+(?:please|create|make|spin|deploy|with|using|on|in|region|named|called|ec2|instance|s3|bucket|lambda|function)\b|$))/i);
    return m ? m[1].trim() : '';
  };

  // S3 operations
  if (lower.includes("create") && (lower.includes("s3") || lower.includes("bucket"))) {
    // Accept explicit name using helper
    const explicitName = extractExplicitName(message, ["bucket", "s3"]);
    const bucketMatch = explicitName ? [null, explicitName] : message.match(/(?:bucket|s3)\s+([a-z0-9][a-z0-9\.-]+[a-z0-9])/i);
    const customerName = extractCustomer(message);
    
    // Handle batch creation
    if (batchCount > 1) {
      return {
        tool: "batchCreate",
        args: {
          resource_type: "s3",
          count: batchCount,
          customer_name: customerName,
          aws_region: "us-east-1"
        }
      };
    }
    
    return { 
      tool: "createS3Bucket", 
      args: { 
        bucket_name: bucketMatch?.[1] || "",
        customer_name: customerName,
        aws_region: "us-east-1" 
      } 
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
  if (lower.includes("create") && (lower.includes("ec2") || lower.includes("instance") || lower.includes("ecs2"))) {
    const explicitName = extractExplicitName(message, ["instance", "ec2", "ecs2"]);
    const nameMatch = explicitName ? [null, explicitName] : message.match(/(?:instance|ec2|ecs2)\s+([A-Za-z0-9-_]+)/i);
  const rawCustomer = extractCustomer(message);
    // Build instance_name if missing using customer
    let instanceName = nameMatch?.[1] || "";
    if (instanceName && ["instance","ec2","ecs2"].includes(instanceName.toLowerCase())) {
      instanceName = "";
    }
    if (!instanceName && rawCustomer) {
      const sanitized = rawCustomer.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g,'');
      instanceName = `${sanitized}-ec2`; // prefix with ec2 suffix
    }
    // Handle batch creation
    if (batchCount > 1) {
      return {
        tool: "batchCreate",
        args: {
          resource_type: "ec2",
          count: batchCount,
          customer_name: rawCustomer,
          aws_region: "us-east-1"
        }
      };
    }
    return {
      tool: "createEC2",
      args: {
        instance_name: instanceName,
        customer_name: rawCustomer,
        aws_region: "us-east-1"
      }
    };
  }
  if (lower.includes("destroy") && (lower.includes("ec2") || lower.includes("instance"))) {
    return { tool: "destroyEC2", args: {} };
  }
  
  // Lambda operations
  if (lower.includes("create") && lower.includes("lambda")) {
    const explicitName = extractExplicitName(message, ["lambda", "function"]);
    const nameMatch = explicitName ? [null, explicitName] : message.match(/(?:lambda|function)\s+([A-Za-z0-9-_]+)/i);
    const customerName = extractCustomer(message);
    let functionName = nameMatch?.[1] || "";
    if (["lambda","function"].includes(functionName.toLowerCase())) {
      functionName = "";
    }
    if (!functionName && customerName) {
      const sanitized = customerName.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
      functionName = `${sanitized}-lambda`;
    }
    
    // Handle batch creation
    if (batchCount > 1) {
      return {
        tool: "batchCreate",
        args: {
          resource_type: "lambda",
          count: batchCount,
          customer_name: customerName,
          aws_region: "us-east-1"
        }
      };
    }
    
    return { 
      tool: "createLambda", 
      args: { 
        function_name: functionName,
        customer_name: customerName,
        aws_region: "us-east-1" 
      } 
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
  
  // CPU, memory, metrics queries
  if (lower.includes("cpu") || lower.includes("memory") || lower.includes("ram") || 
      lower.includes("disk") || lower.includes("network") || lower.includes("utilization") ||
      lower.includes("usage") || lower.includes("metric") || lower.includes("performance")) {
    const resourceMatch = message.match(/(?:resource|id)[-:\s]+([a-z0-9-]+)/i);
    if (resourceMatch) {
      return { tool: "getResourceMetrics", args: { resource_id: resourceMatch[1] } };
    }
    const instanceMatch = message.match(/instance[-:\s]+([a-z0-9-]+)/i);
    if (instanceMatch) {
      return { tool: "getMetrics", args: { instance_id: instanceMatch[1] } };
    }
    // Default to fetching metrics for first available resource
    return { tool: "getResourceMetrics", args: { resource_id: "i-1234567890abcdef0" } };
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
  
  // Error explanation requests
  if (lower.includes("why") || lower.includes("what happened") || lower.includes("explain") || 
      lower.includes("error") || lower.includes("failed") || lower.includes("wrong")) {
    // User is asking about an error - return a special tool to trigger error explanation
    return { tool: "explainLastError", args: { query: message } };
  }
  
  // Default: echo
  return { tool: "echo", args: { text: message } };
}

export async function interpretMessage(message) {
  // Use simple router if enabled or as fallback
  if (USE_SIMPLE_ROUTER || !MODEL_API_KEY) {
    console.log("Using simple keyword router (USE_SIMPLE_ROUTER or no API key)");
    return simpleRouter(message);
  }

  try {
    console.log(`🤖 Calling NVIDIA API: ${MODEL_API_URL}`);
    
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
- createS3Bucket: Create S3 bucket (args: bucket_name?, aws_region?, customer_name?)
- destroyS3Bucket: Destroy S3 bucket (args: bucket_name)
- createEC2: Create EC2 instance (args: instance_name?, aws_region?, customer_name?)
- destroyEC2: Destroy EC2 instance
- createLambda: Create Lambda function (args: function_name?, aws_region?, source_code?, customer_name?)
- destroyLambda: Destroy Lambda function
- explainLastError: Explain the most recent error (args: query)
- batchCreate: Create multiple resources at once (args: resource_type ["s3"|"ec2"|"lambda"], count [number], customer_name?, aws_region?)

BATCH CREATION RULES:
- If user says "create X instances/buckets/functions" where X > 1, use batchCreate tool
- Extract the number from phrases like "4 EC2", "3 buckets", "5 lambda functions"
- Examples:
  * "create 4 EC2 instances for RTG" → {"tool": "batchCreate", "args": {"resource_type": "ec2", "count": 4, "customer_name": "RTG"}}
  * "make 3 S3 buckets for Acme" → {"tool": "batchCreate", "args": {"resource_type": "s3", "count": 3, "customer_name": "Acme"}}
  * "deploy 5 lambda functions for client X" → {"tool": "batchCreate", "args": {"resource_type": "lambda", "count": 5, "customer_name": "client X"}}

CUSTOMER NAME EXTRACTION:
Extract customer name from phrases like:
- "for customer X"
- "for client X"  
- "for company X"
- "for X"
- "X's bucket/instance/function"
- "X needs a resource"

If bucket_name, instance_name, or function_name is invalid (uppercase, spaces, etc), leave it empty and provide customer_name instead.
The system will auto-generate a valid name from customer_name + resource type + random ID.

Examples:
- "Create EC2 for John's Pizza" → {"tool": "createEC2", "args": {"customer_name": "John's Pizza"}}
- "Create S3 bucket for Acme Corp" → {"tool": "createS3Bucket", "args": {"customer_name": "Acme Corp"}}
- "Make Lambda for TechStartup" → {"tool": "createLambda", "args": {"customer_name": "TechStartup"}}

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
    console.log("📥 NVIDIA response:", text);
    
    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("❌ No JSON found in response:", text);
      throw new Error("No JSON found in response");
    }

    let parsed = JSON.parse(jsonMatch[0]);
    console.log("✅ Router result (NVIDIA):", parsed);

    // Post-normalization: ensure args are populated from message if model omitted them
    const lower = message.toLowerCase();

    const extractBatchCount = (msg) => {
      const rx = /(?<![A-Za-z0-9])(\d+)\s+(?:ec2|instances?|buckets?|lambdas?|functions?)/i;
      const m = msg.match(rx);
      return m ? parseInt(m[1], 10) : 1;
    };
    const extractCustomer = (msg) => {
      const m = msg.match(/(?:for|customer|client|company)\s+([A-Za-z0-9'_\s-]+?)(?=(?:\s+(?:please|create|make|spin|deploy|with|using|on|in|region|named|called|ec2|instance|s3|bucket|lambda|function)\b|$))/i);
      return m ? m[1].trim() : '';
    };
    const extractExplicitName = (msg, kinds) => {
      const nameRegexes = [
        /named\s+([A-Za-z0-9-_\.]+)/i,
        /called\s+([A-Za-z0-9-_\.]+)/i,
        /that\s+is\s+named\s+([A-Za-z0-9-_\.]+)/i,
        /that\s+is\s+called\s+([A-Za-z0-9-_\.]+)/i,
        /name\s+([A-Za-z0-9-_\.]+)/i
      ];
      for (const rx of nameRegexes) {
        const m = msg.match(rx);
        if (m) return m[1];
      }
      const direct = msg.match(new RegExp(`${kinds.join('|')}\s+([A-Za-z0-9-_\.]+)`, 'i'));
      return direct ? direct[1] : '';
    };

    const norm = (toolName, args = {}) => ({ tool: toolName, args });

    if (parsed.tool === 'createEC2') {
      const customer = extractCustomer(message);
      const explicit = extractExplicitName(message, ['instance','ec2','ecs2']);
      let name = parsed.args?.instance_name || explicit;
      if (!name && customer) {
        const sanitized = customer.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
        name = `${sanitized}-ec2`;
      }
      parsed = norm('createEC2', {
        instance_name: name || parsed.args?.instance_name || '',
        customer_name: parsed.args?.customer_name || customer || '',
        aws_region: parsed.args?.aws_region || 'us-east-1'
      });
    } else if (parsed.tool === 'createS3Bucket') {
      const customer = extractCustomer(message);
      const explicit = extractExplicitName(message, ['bucket','s3']);
      const bucket = parsed.args?.bucket_name || explicit || '';
      parsed = norm('createS3Bucket', {
        bucket_name: bucket,
        customer_name: parsed.args?.customer_name || customer || '',
        aws_region: parsed.args?.aws_region || 'us-east-1'
      });
    } else if (parsed.tool === 'createLambda') {
      const customer = extractCustomer(message);
      const explicit = extractExplicitName(message, ['lambda','function']);
      let func = parsed.args?.function_name || explicit || '';
      if ((!func || ['lambda','function'].includes(func.toLowerCase())) && customer) {
        const sanitized = customer.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
        func = `${sanitized}-lambda`;
      }
      parsed = norm('createLambda', {
        function_name: func,
        customer_name: parsed.args?.customer_name || customer || '',
        aws_region: parsed.args?.aws_region || 'us-east-1',
        source_code: parsed.args?.source_code || null
      });
    } else if (parsed.tool !== 'batchCreate') {
      // If model missed batch but user asked for a number, preserve batch intent
      const count = extractBatchCount(message);
      if (count > 1) {
        if (lower.includes('ec2') || lower.includes('instance')) {
          parsed = norm('batchCreate', { resource_type: 'ec2', count, customer_name: extractCustomer(message), aws_region: 'us-east-1' });
        } else if (lower.includes('s3') || lower.includes('bucket')) {
          parsed = norm('batchCreate', { resource_type: 's3', count, customer_name: extractCustomer(message), aws_region: 'us-east-1' });
        } else if (lower.includes('lambda') || lower.includes('function')) {
          parsed = norm('batchCreate', { resource_type: 'lambda', count, customer_name: extractCustomer(message), aws_region: 'us-east-1' });
        }
      }
    }

    return parsed;
  } catch (err) {
    console.error("❌ Router error:", err.response?.data || err.message);
    console.log("⚠️ Falling back to simple keyword router");
    // fallback to simple router
    return simpleRouter(message);
  }
}

/**
 * Use AI to explain an error and provide next steps
 * @param {string} operation - The operation that failed (e.g., "createS3Bucket")
 * @param {string} errorMessage - The raw error message
 * @param {object} context - Additional context (args, tool description, etc.)
 * @returns {Promise<string>} - Human-friendly error explanation with next steps
 */
export async function explainError(operation, errorMessage, context = {}) {
  // If no API key, return simple explanation
  if (!MODEL_API_KEY) {
    return `❌ **Operation Failed: ${operation}**\n\nError: ${errorMessage}\n\n**Next Steps:**\n1. Check if you have the required AWS permissions\n2. Verify your AWS credentials are configured correctly\n3. Ensure the resource name follows AWS naming conventions\n4. Check if the resource already exists`;
  }

  try {
    console.log(`🤖 Asking AI to explain error for: ${operation}`);
    
    // Detect specific common errors and provide enhanced context
    let additionalContext = '';
    
    if (errorMessage.includes('InvalidBucketName')) {
      const bucketName = context.args?.bucket_name || 'unknown';
      additionalContext = `
      
The bucket name "${bucketName}" violates S3 naming rules. Common issues:
- Uppercase letters (not allowed)
- Invalid characters (only lowercase, numbers, hyphens, periods)
- Too short (< 3 chars) or too long (> 63 chars)
- Must start/end with letter or number`;
    } else if (errorMessage.includes('BucketAlreadyExists')) {
      additionalContext = '\n\nS3 bucket names are globally unique across ALL AWS accounts.';
    } else if (errorMessage.includes('AccessDenied')) {
      additionalContext = '\n\nThis is typically an IAM permissions issue with your AWS credentials.';
    }
    
    const systemPrompt = `You are a helpful DevOps assistant explaining infrastructure errors to users.

Your job is to:
1. Explain the error in simple, clear terms
2. Identify the root cause
3. Provide 3-5 specific, actionable next steps to fix the issue
4. Be encouraging and helpful

Format your response as:
❌ **What Happened:**
[Brief explanation]

🔍 **Root Cause:**
[Why this error occurred]

✅ **Next Steps:**
1. [Specific action]
2. [Specific action]
3. [Specific action]

Use emojis, markdown formatting, and be concise but informative.`;

    const userPrompt = `Operation: ${operation}
Error Message: ${errorMessage}
${context.args ? `Arguments: ${JSON.stringify(context.args)}` : ''}
${context.description ? `Tool Description: ${context.description}` : ''}${additionalContext}

Please explain this error and provide next steps to fix it.`;

    const response = await axios.post(
      MODEL_API_URL,
      {
        model: "nvidia/nvidia-nemotron-nano-9b-v2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
        top_p: 0.95
      },
      {
        headers: {
          Authorization: `Bearer ${MODEL_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );

    const explanation = response.data.choices?.[0]?.message?.content || "";
    console.log("✅ AI error explanation generated");
    return explanation;
  } catch (err) {
    console.error("❌ Error generating explanation:", err.message);
    
    // Enhanced fallback with specific guidance
    let fallbackMessage = `❌ **Operation Failed: ${operation}**\n\nError: ${errorMessage}\n\n`;
    
    if (errorMessage.includes('InvalidBucketName')) {
      const bucketName = context.args?.bucket_name || 'unknown';
      fallbackMessage += `🔍 **Root Cause:**\nThe bucket name "${bucketName}" doesn't meet S3 naming requirements.\n\n✅ **Next Steps:**\n1. Use only lowercase letters: change "${bucketName}" to "${bucketName.toLowerCase()}"\n2. Replace invalid characters with hyphens\n3. Ensure name is 3-63 characters long\n4. Must start and end with letter/number\n5. Try: "${bucketName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}"`;
    } else if (errorMessage.includes('BucketAlreadyExists')) {
      fallbackMessage += `🔍 **Root Cause:**\nThis bucket name is already taken by someone (globally unique across ALL AWS).\n\n✅ **Next Steps:**\n1. Add your account ID or unique suffix\n2. Try: "${context.args?.bucket_name}-${Date.now()}"\n3. Use company prefix: "mycompany-${context.args?.bucket_name}"\n4. Check if you own it: aws s3 ls`;
    } else {
      fallbackMessage += `**Next Steps:**\n1. Check if you have the required AWS permissions\n2. Verify your AWS credentials are configured correctly\n3. Ensure the resource name follows AWS naming conventions\n4. Review the error message above for specific details`;
    }
    
    return fallbackMessage;
  }
}
