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

export async function interpretMessage(message) {
  try {
    const prompt = `
You are an MCP router. Given a user message, decide which tool to call
and what arguments to send.

Available tools:
- "echo": Echoes text back to the user. Args: { "text": "<message>" }
- "getLogs": Fetches logs. Args: { "status": "<status>" }
- "getResource": Retrieves resource info. Args: { "id": "<resource_id>" }

Output JSON only (no markdown, no code blocks, just raw JSON):
{
  "tool": "<tool_name>",
  "args": { ... }
}

User: ${message}
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
    // fallback
    return { tool: "echo", args: { text: message } };
  }
}
