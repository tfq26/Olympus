import axios from "axios";

// NVIDIA endpoint and key
const MODEL_API_URL = "https://integrate.api.nvidia.com/v1/infer";
const MODEL_API_KEY = process.env.MODEL_API_KEY;

export async function interpretMessage(message) {
  try {
    const prompt = `
You are an MCP router. Given a user message, decide which tool to call
and what arguments to send.

Output JSON only:
{
  "tool": "<tool_name>",
  "args": { ... }
}

User: ${message}
`;

    // NVIDIA expects an "input" array, not "prompt"
    const response = await axios.post(
      MODEL_API_URL,
      {
        input: [
          {
            role: "user",
            content: prompt
          }
        ],
        model: "meta/llama-3.1-70b-instruct", // example model, replace with yours
        temperature: 0,
        max_tokens: 200
      },
      {
        headers: {
          Authorization: `Bearer ${MODEL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    // NVIDIA responses use `output_text`
    const text =
      response.data.output?.[0]?.content?.[0]?.text ||
      response.data.output_text ||
      "";

    // Try parsing the JSON output
    return JSON.parse(text);
  } catch (err) {
    console.error("Router error:", err.response?.data || err.message);
    // fallback
    return { tool: "echo", args: { text: message } };
  }
}
