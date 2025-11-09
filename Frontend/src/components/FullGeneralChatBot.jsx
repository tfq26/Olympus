import { useState } from "react";
import { useWebSocketChat } from "../hooks/useWebSocketChat";
import { motion, AnimatePresence } from "framer-motion";

const models = [
  { name: "Hermès", value: ["gemini-2.0-flash", "gemini-2.5-pro"] },
];

export default function ChatBot({
  welcomeMessage = "Welcome! How can I help you today?",
  placeholder = "Ask me anything about your infrastructure...",
}) {
  const [input, setInput] = useState("");
  const [isStarted, setIsStarted] = useState(false);

  const { messages, append, isLoading } = useWebSocketChat();

  const handleSubmit = () => {
    if (!input.trim()) return;
    if (!isStarted) setIsStarted(true);

    append({ role: "user", content: input });
    setInput("");
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
                id="welcome-input"
                name="welcomeMessage"
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
                  className={`p-4 rounded-lg shadow-md text-sm text-text-primary border-l-4 whitespace-pre-wrap font-mono ${
                    m.role === "assistant"
                      ? "mr-8 bg-[rgba(159,112,253,0.15)] border-nebula-magenta max-h-[70vh] overflow-y-auto"
                      : "ml-8 bg-[rgba(28,19,99,0.4)] border-nebula-cyan"
                  }`}
                >
                  {m.content}
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
                id="chat-message-input"
                name="chatMessage"
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
