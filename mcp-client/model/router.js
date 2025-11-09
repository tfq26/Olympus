import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// NVIDIA endpoint and key - using OpenAI-compatible chat completions endpoint
const MODEL_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL_API_KEY = process.env.MODEL_API_KEY;

if (!MODEL_API_KEY) {
  console.error("⚠️ WARNING: MODEL_API_KEY is not set in environment variables");
}

// Query the NVIDIA AI model directly with any prompt
export async function queryAI(prompt, systemMessage = null) {
  try {
    const messages = [];
    
    if (systemMessage) {
      messages.push({
        role: "system",
        content: systemMessage
      });
    }
    
    messages.push({
      role: "user",
      content: prompt
    });

    const response = await axios.post(
      MODEL_API_URL,
      {
        model: "nvidia/nvidia-nemotron-nano-9b-v2",
        messages: messages,
        temperature: 0.6,
        top_p: 0.95,
        max_tokens: 2048,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false
      },
      {
        headers: {
          Authorization: `Bearer ${MODEL_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    const text = response.data?.choices?.[0]?.message?.content || "";

    if (!text) {
      console.error("No response text found:", JSON.stringify(response.data, null, 2));
      throw new Error("Empty response from NVIDIA API");
    }

    return text.trim();
  } catch (err) {
    console.error("AI query error:", {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data
    });
    throw err;
  }
}

// Pre-process message to detect log queries before sending to LLM
function detectLogQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  // EXCLUDE "summarize logs from all customers" - this should NOT be detected as a regular log query
  if (lowerMessage.includes('summarize') && lowerMessage.includes('all customer')) {
    return false; // This is handled separately as a summary query
  }
  
  // Keywords that indicate a log query
  const logKeywords = [
    'show', 'get', 'fetch', 'display', 'list', 'view', 'see',
    'logs', 'log', 'logging',
    'recent', 'latest', 'first', 'last', 'oldest', 'newest'
    // Removed 'summarize', 'summary', 'summaries' - these are handled separately
  ];
  
  // Check if message contains log-related keywords
  const hasLogKeyword = logKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Patterns that strongly indicate log queries (excluding summary patterns)
  const logPatterns = [
    /show.*log/i,
    /get.*log/i,
    /fetch.*log/i,
    /display.*log/i,
    /view.*log/i,
    /see.*log/i,
    /log.*from/i,
    /log.*for/i,
    /recent.*log/i,
    /latest.*log/i,
    /first.*log/i,
    /last.*log/i
    // Removed /summarize.*log/i, /summary.*log/i - these are handled separately
  ];
  
  const matchesPattern = logPatterns.some(pattern => pattern.test(message));
  
  return hasLogKeyword && (matchesPattern || lowerMessage.includes('from') || lowerMessage.includes('for'));
}

// Extract resource identifier and limit from message
function extractLogQueryParams(message) {
  const lowerMessage = message.toLowerCase();
  const actionWords = ['show', 'get', 'fetch', 'display', 'view', 'see', 'list', 'recent', 'latest', 'first', 'last'];
  
  // Extract limit (e.g., "first 50", "50 logs", "show 100", "first 50 logs")
  const limitPatterns = [
    /(?:first|last|show|get|fetch|display|view)\s+(\d+)\s*(?:logs?|entries?|records?)?/i,
    /(\d+)\s*(?:logs?|entries?|records?)/i
  ];
  
  let limit = null;
  for (const pattern of limitPatterns) {
    const match = message.match(pattern);
    if (match) {
      limit = parseInt(match[1]);
      break;
    }
  }
  
  // Extract resource identifier - look for patterns like:
  // "from X", "for X", "of X", "X logs"
  let resourceIdentifier = null;
  
  // Better approach: Find the last occurrence of "from/for/of" and extract what follows
  // This handles cases like "show recent logs from ecs2" correctly
  const fromForOfMatches = [...message.matchAll(/(?:^|\s)(?:from|for|of)\s+([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)*)/gi)];
  
  if (fromForOfMatches.length > 0) {
    // Use the last match (most specific one)
    const lastMatch = fromForOfMatches[fromForOfMatches.length - 1];
    let candidate = lastMatch[1].trim();
    
    // Remove trailing words that aren't part of resource name
    candidate = candidate.replace(/\s+(dynabodv|dynamodb|logs?|and|or|,).*$/i, '').trim();
    
    // Filter out action words
    const words = candidate.split(/\s+/);
    const filteredWords = words.filter(word => !actionWords.includes(word.toLowerCase()));
    
    if (filteredWords.length > 0) {
      resourceIdentifier = filteredWords.join(' ').trim();
    } else if (words.length > 0 && !actionWords.includes(words[0].toLowerCase())) {
      // If filtering removed everything but the first word is not an action word, use it
      resourceIdentifier = words[0].trim();
    }
  }
  
  // Fallback: Try to find resource before "logs" if "from/for/of" didn't work
  if (!resourceIdentifier) {
    const resourceBeforeLogs = message.match(/([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)*)\s+logs?/i);
    if (resourceBeforeLogs) {
      let candidate = resourceBeforeLogs[1].trim();
      const words = candidate.split(/\s+/);
      const filteredWords = words.filter(word => !actionWords.includes(word.toLowerCase()));
      if (filteredWords.length > 0) {
        resourceIdentifier = filteredWords.join(' ').trim();
      }
    }
  }
  
  // Final fallback: Split by "from/for/of" and take the first non-action word
  if (!resourceIdentifier) {
    const parts = message.split(/\s+(?:from|for|of)\s+/i);
    if (parts.length > 1) {
      const afterFrom = parts[parts.length - 1].trim();
      // Take words until we hit a stop word or end
      const words = afterFrom.split(/\s+/);
      const resourceWords = [];
      for (const word of words) {
        const cleanWord = word.replace(/[,\s]*$/, ''); // Remove trailing punctuation
        if (actionWords.includes(cleanWord.toLowerCase()) || 
            ['dynabodv', 'dynamodb', 'logs'].includes(cleanWord.toLowerCase())) {
          break;
        }
        resourceWords.push(cleanWord);
      }
      if (resourceWords.length > 0) {
        resourceIdentifier = resourceWords.join(' ').trim();
      }
    }
  }
  
  // Determine if it's a resource ID (starts with "res_") or resource name
  const isResourceId = resourceIdentifier && /^res_/i.test(resourceIdentifier);
  
  return {
    resourceIdentifier,
    isResourceId,
    limit,
    hasResource: !!resourceIdentifier
  };
}

export async function interpretMessage(message) {
  try {
    const lowerMessage = message.toLowerCase().trim();
    console.log(`🔍 Router received message: "${message}"`);
    
    // PRIORITY 1: Check for ANY summary query FIRST - BEFORE log queries
    // This includes "all customers" and filtered summaries
    const summaryPatterns = [
      /summarize.*(?:logs?|log)/i,
      /summary.*(?:logs?|log)/i,
      /show.*summary/i,
      /get.*summary/i,
      /display.*summary/i,
      /view.*summary/i
    ];
    
    const isSummaryQuery = summaryPatterns.some(pattern => pattern.test(message));
    
    if (isSummaryQuery) {
      console.log(`✅ Detected summary query pattern`);
      
      // Check for "all customers" pattern first
      const allCustomersPatterns = [
        /summarize.*(?:logs?|log).*all\s+customers?/i,
        /summarize.*all\s+customers?/i,
        /summary.*(?:logs?|log).*all\s+customers?/i,
        /summary.*all\s+customers?/i,
        /all\s+customers?.*(?:summary|summarize)/i,
        /(?:show|get|display|view).*summary.*all\s+customers?/i,
        /summarize.*(?:logs?|log).*for\s+all\s+customers?/i
      ];
      
      const isAllCustomers = allCustomersPatterns.some(pattern => pattern.test(message)) ||
        (lowerMessage.includes('summarize') && lowerMessage.includes('all customer')) ||
        (lowerMessage.includes('summary') && lowerMessage.includes('all customer'));
      
      if (isAllCustomers) {
        console.log(`✅✅✅ ROUTING TO summarizeAllLogs (all customers): "${message}"`);
        return { tool: 'summarizeAllLogs', args: {} };
      }
      
      // Extract filters from message for filtered summaries
      const args = {};
      
      // Extract customer name (common customer names from the data)
      const customerNames = [
        "Rocket Startup Labs", "TechCore Solutions", "DataFlow Technologies",
        "ShopFast eCommerce", "CloudMart Wholesale"
      ];
      
      for (const customerName of customerNames) {
        const customerLower = customerName.toLowerCase();
        if (lowerMessage.includes(customerLower)) {
          args.customer_name = customerName;
          console.log(`✅ Extracted customer: ${customerName}`);
          break;
        }
        // Also check for partial matches (first word + last word)
        const customerWords = customerLower.split(/\s+/);
        if (customerWords.length > 1) {
          const firstWord = customerWords[0];
          const lastWord = customerWords[customerWords.length - 1];
          if (lowerMessage.includes(firstWord) && lowerMessage.includes(lastWord)) {
            args.customer_name = customerName;
            console.log(`✅ Extracted customer (partial match): ${customerName}`);
            break;
          }
        }
      }
      
      // Extract status (OK, WARNING, ERROR, CRITICAL)
      const statusKeywords = {
        "OK": ["ok", "success", "healthy", "successful"],
        "WARNING": ["warning", "warn", "warnings"],
        "ERROR": ["error", "errors", "failed", "failure", "failures"],
        "CRITICAL": ["critical", "severe", "urgent", "criticals"]
      };
      
      for (const [status, keywords] of Object.entries(statusKeywords)) {
        if (keywords.some(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(message);
        })) {
          args.status = status;
          console.log(`✅ Extracted status: ${status}`);
          break;
        }
      }
      
      // Extract resource ID (starts with "res_")
      const resourceIdMatch = message.match(/\bres_[a-z0-9_]+\b/i);
      if (resourceIdMatch) {
        args.resource_id = resourceIdMatch[0];
        console.log(`✅ Extracted resource_id: ${resourceIdMatch[0]}`);
      }
      
      // Route to summarizeAllLogs with extracted filters (or empty if no filters)
      console.log(`✅✅✅ ROUTING TO summarizeAllLogs with filters:`, args);
      return { tool: 'summarizeAllLogs', args };
    }
    
    // PRIORITY 2: Pre-process: Detect resource-specific log queries (NOT summaries)
    // This should NOT catch summary queries since we check above first
    const isLogQuery = detectLogQuery(message);
    
    if (isLogQuery) {
      const params = extractLogQueryParams(message);
      console.log(`🔍 Extracted log query params:`, JSON.stringify(params));
      
      // Only route to getLogsByResource if we have a specific resource
      if (params.hasResource && params.resourceIdentifier) {
        // Direct routing to getLogsByResource - bypass LLM for clear log queries
        const args = {};
        
        if (params.isResourceId) {
          args.resource_id = params.resourceIdentifier;
        } else {
          args.resource_name = params.resourceIdentifier;
        }
        
        if (params.limit) {
          args.limit = params.limit;
        }
        
        console.log(`🔍 Detected log query: ${JSON.stringify({ tool: 'getLogsByResource', args })}`);
        return { tool: 'getLogsByResource', args };
      }
    }
    
    // Standard LLM routing for other queries
    const prompt = `
You are an MCP router. Given a user message, decide which tool to call and what arguments to send.

🚨 CRITICAL ROUTING RULES - FOLLOW THESE EXACTLY (in order of priority):

1. **SUMMARY QUERIES**: If the message contains "summarize", "summary", or asks for a summary/overview:
   - Use "summarizeAllLogs" tool
   - Extract filters from the message:
     * customer_name: Extract customer names like "Rocket Startup Labs", "TechCore Solutions", "DataFlow Technologies", "ShopFast eCommerce", "CloudMart Wholesale"
     * status: Extract status like "OK", "WARNING", "ERROR", "CRITICAL"
     * resource_id: Extract resource IDs like "res_vm_001" (starts with "res_")
   - If no filters, use empty args: {}
   - Examples:
     * "summarize logs from all customers" → { "tool": "summarizeAllLogs", "args": {} }
     * "show summary for Rocket Startup Labs" → { "tool": "summarizeAllLogs", "args": { "customer_name": "Rocket Startup Labs" } }
     * "summarize ERROR logs" → { "tool": "summarizeAllLogs", "args": { "status": "ERROR" } }
     * "summary of CRITICAL logs for TechCore Solutions" → { "tool": "summarizeAllLogs", "args": { "customer_name": "TechCore Solutions", "status": "CRITICAL" } }
     * "summarize logs for res_vm_001" → { "tool": "summarizeAllLogs", "args": { "resource_id": "res_vm_001" } }

2. **LOG QUERIES**: If the user asks for specific logs (not summary):
   - Use "getLogsByResource" tool
   - Extract resource identifier (name or ID)
   - Examples:
     * "show recent logs from ecs2" → { "tool": "getLogsByResource", "args": { "resource_name": "ecs2" } }
     * "get logs for res_vm_001" → { "tool": "getLogsByResource", "args": { "resource_id": "res_vm_001" } }

3. **GENERAL QUESTIONS**: Use "queryAI" for general questions not about logs or resources.

Available tools:
- "summarizeAllLogs": Summarizes logs with optional filters (customer_name, status, resource_id). 
  Args: {} OR { "customer_name": "<name>", "status": "<OK|WARNING|ERROR|CRITICAL>", "resource_id": "<res_xxx>" }
  - Use for ANY summary/overview request
  - Can filter by customer, status, or resource
- "getLogsByResource": Gets specific logs for a resource. 
  Args: { "resource_id": "<id>", "limit": <number> } OR { "resource_name": "<name>", "limit": <number> }
- "queryAI": For general questions. Args: { "prompt": "<question>" }

User message: "${message}"

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "tool": "tool_name",
  "args": { ... }
}
`;

    // NVIDIA API uses OpenAI-compatible format with "messages" array
    const response = await axios.post(
      MODEL_API_URL,
      {
        model: "nvidia/nvidia-nemotron-nano-9b-v2",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.6,
        top_p: 0.95,
        max_tokens: 2048,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false
      },
      {
        headers: {
          Authorization: `Bearer ${MODEL_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // NVIDIA API response format (OpenAI-compatible)
    let text = response.data?.choices?.[0]?.message?.content || "";

    if (!text) {
      console.error("No response text found:", JSON.stringify(response.data, null, 2));
      throw new Error("Empty response from NVIDIA API");
    }

    // Remove markdown code blocks if present (```json ... ``` or ``` ... ```)
    text = text.trim();
    if (text.startsWith("```")) {
      // Remove opening ```json or ```
      text = text.replace(/^```(?:json)?\s*\n?/, "");
      // Remove closing ```
      text = text.replace(/\n?```\s*$/, "");
      text = text.trim();
    }

    // Try parsing the JSON output
    try {
      const result = JSON.parse(text);
      return result;
    } catch (parseError) {
      console.error("Failed to parse JSON response:", text);
      console.error("Parse error:", parseError.message);
      // Try to extract JSON from the text if it's embedded in other text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          throw new Error(`Failed to parse JSON: ${parseError.message}`);
        }
      }
      throw parseError;
    }
  } catch (err) {
    console.error("Router error:", {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      stack: err.stack
    });
    
    // If it's a log query that failed, try to extract params manually as fallback
    const isLogQuery = detectLogQuery(message);
    if (isLogQuery) {
      const params = extractLogQueryParams(message);
      if (params.hasResource) {
        console.log("🔄 Router error, but detected log query - routing to getLogsByResource anyway");
        const args = {};
        if (params.isResourceId) {
          args.resource_id = params.resourceIdentifier;
        } else {
          args.resource_name = params.resourceIdentifier;
        }
        if (params.limit) {
          args.limit = params.limit;
        }
        return { tool: 'getLogsByResource', args };
      }
    }
    
    // Final fallback to echo only if it's not a log query
    console.log("⚠️ Falling back to echo tool");
    return { tool: "echo", args: { text: message } };
  }
}
