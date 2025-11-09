import { useState } from "react";
import { useWebSocketChat } from "../hooks/useWebSocketChat";
import { motion, AnimatePresence } from "framer-motion";

const models = [
  { name: "Hermès", value: ["gemini-2.0-flash", "gemini-2.5-pro"] },
];

// Helper to parse and format AI responses
const formatAIResponse = (content) => {
  if (!content) return "";

  // Try to parse if it looks like JSON
  if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(content);
      
      // If it has a result field, format it nicely
      if (parsed.result) {
        if (typeof parsed.result === 'string') {
          return parsed.result;
        }
        if (typeof parsed.result === 'object') {
          return formatObjectResponse(parsed.result);
        }
      }
      
      // If it has a reply field
      if (parsed.reply) {
        return parsed.reply;
      }

      // If it's a tool execution result
      if (parsed.tool) {
        return formatToolResponse(parsed);
      }

      // Otherwise format the whole object
      return formatObjectResponse(parsed);
    } catch {
      // Not JSON, return as-is
      return content;
    }
  }

  return content;
};

// Format object responses into readable text
const formatObjectResponse = (obj) => {
  if (!obj || typeof obj !== 'object') return String(obj);

  let output = [];

  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "No items found.";
    
    obj.forEach((item, index) => {
      if (typeof item === 'object') {
        output.push(`\n**Item ${index + 1}:**`);
        output.push(formatObjectResponse(item));
      } else {
        output.push(`• ${item}`);
      }
    });
    return output.join('\n');
  }

  // Handle objects
  Object.entries(obj).forEach(([key, value]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    if (value === null || value === undefined) {
      output.push(`**${label}:** N/A`);
    } else if (typeof value === 'object') {
      output.push(`**${label}:**`);
      output.push(formatObjectResponse(value));
    } else {
      output.push(`**${label}:** ${value}`);
    }
  });

  return output.join('\n');
};

// Format tool execution results
const formatToolResponse = (data) => {
  let output = [];

  if (data.ok === false) {
    output.push(`❌ **Error:** ${data.error || 'Operation failed'}`);
    return output.join('\n');
  }

  output.push(`✅ **Tool:** ${data.tool || 'Unknown'}`);
  
  if (data.args && Object.keys(data.args).length > 0) {
    output.push('\n**Parameters:**');
    Object.entries(data.args).forEach(([key, value]) => {
      output.push(`  • ${key}: ${value}`);
    });
  }

  if (data.result) {
    output.push('\n**Result:**');
    if (typeof data.result === 'string') {
      output.push(data.result);
    } else {
      output.push(formatObjectResponse(data.result));
    }
  }

  return output.join('\n');
};

export default function ChatBot({
  welcomeMessage = "Welcome! How can I help you today?",
  placeholder = "Ask me anything about your infrastructure...",
}) {
  const [input, setInput] = useState("");
  const [isStarted, setIsStarted] = useState(false);

  const { messages, append, isLoading, confirm } = useWebSocketChat();

  const handleSubmit = () => {
    if (!input.trim()) return;
    if (!isStarted) setIsStarted(true);

    append({ role: "user", content: input });
    setInput("");
  };

  const handleConfirm = (intent) => {
    confirm(intent);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col text-text-primary items-center justify-center w-full max-w-4xl mx-auto p-4 md:p-8">
      <AnimatePresence mode="wait">
        {!isStarted ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center w-full"
          >
            <h1 className="text-4xl md:text-6xl font-extrabold text-center mb-10 tracking-tight font-serif">
              {welcomeMessage}
            </h1>

            <div className="flex items-center w-full gap-3">
              <textarea
                className="flex-1 bg-white/5 p-4 rounded-xl shadow-lg border-2 border-primary resize-none transition-all duration-200 "
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={placeholder}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="h-12 w-12 flex bg-primary items-center justify-center rounded-xl shadow-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed font-semibold"
                aria-label="Send Message"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full h-[80vh] flex flex-col"
          >
            <div className="flex-1 overflow-y-auto space-y-4 rounded-t-xl p-4 shadow-lg backdrop-blur-sm bg-[rgba(255,255,255,0.03)] border-t border-l border-r border-[rgba(255,255,255,0.1)]">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-4 rounded-lg shadow-md  text-sm text-text-primary border-l-4 ${
                    m.role === "assistant"
                      ? "mr-8 bg-[rgba(159,112,253,0.15)] border-nebula-magenta"
                      : "ml-8 bg-[rgba(28,19,99,0.4)] border-nebula-cyan"
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {m.role === "assistant" ? formatAIResponse(m.content) : m.content}
                  </div>
                  
                  {/* Confirmation buttons for destructive operations */}
                  {m.needsConfirmation && m.intent && (
                    <div className="mt-4 pt-4 border-t border-nebula-magenta/30 flex gap-3">
                      <button
                        onClick={() => handleConfirm(m.intent)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        ✓ Confirm & Execute
                      </button>
                      <button
                        onClick={() => {
                          // Just acknowledge, don't execute
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        ✗ Cancel
                      </button>
                      <div className="text-xs text-gray-400 self-center ml-2">
                        Tool: <code className="bg-black/30 px-2 py-1 rounded">{m.intent.tool}</code>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-[rgba(159,112,253,0.1)] text-text-secondary">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-nebula-magenta"></div>
                  <span className=" text-sm">Processing your request...</span>
                </div>
              )}
            </div>

            <div className="rounded-b-xl p-4 shadow-lg space-y-3 backdrop-blur-sm bg-[rgba(255,255,255,0.03)] border-b border-l border-r border-[rgba(255,255,255,0.1)]">
              <textarea
                className="w-full rounded-lg p-3 resize-none border-2  bg-[rgba(255,255,255,0.05)] text-text-primary border-primary"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Type your message..."
              />

              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex gap-2 text-xl items-center italic  text-text-primary border-gray-500 border-2 p-2 rounded-lg">
                  <i className="pi pi-globe"></i>
                  <h1>{models[0].name}</h1>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isLoading}
                  className="px-6 py-2 font-semibold rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed  shadow-lg bg-primary text-text-primary"
                >
                  Send
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
