import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "primereact/button";
import { OverlayPanel } from "primereact/overlaypanel";
import { InputTextarea } from "primereact/inputtextarea";
import { useWebSocketChat } from "../hooks/useWebSocketChat";

export default function SmallerChatBox({
  placeholder = "Ask me anything...",
  actions = [],
  onActionClick = null,
  selectedContext = [],
  systemPrompt = "",
  hidden = false,
}) {
  const [chatValue, setChatValue] = useState("");
  const [showChat, setShowChat] = useState(false);
  const op = useRef(null);
  const textareaRef = useRef(null);

  const { messages, append, isLoading } = useWebSocketChat();

  // Don't render if hidden prop is true
  if (hidden) return null;

  const handleSend = (customMessage = null) => {
    const messageToSend = customMessage || chatValue;
    if (!messageToSend.trim()) return;

    if (!showChat) setShowChat(true);

    // Build context-aware message
    let finalMessage = messageToSend;
    if (selectedContext.length > 0 && !customMessage) {
      finalMessage = `Context: ${selectedContext.join(
        ", "
      )}\n\n${messageToSend}`;
    }

    append({ role: "user", content: finalMessage });
    setChatValue("");
  };

  const handleActionSelect = (action) => {
    let message = "";

    if (onActionClick) {
      // Use custom handler to generate message
      message = onActionClick(action);
    } else {
      // Default behavior
      message = `${action.label}`;
      if (selectedContext.length > 0) {
        message += ` ${selectedContext.join(", ")}`;
      }
    }

    handleSend(message);
    op.current?.hide();
  };

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto">
      {/* Chat Window (visible only after first message) */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="mb-3 h-[50vh] overflow-y-auto rounded-xl p-4 shadow-lg bg-white/5 backdrop-blur border border-gray-800/40 space-y-3"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-lg text-sm border-l-4 ${
                  m.role === "assistant"
                    ? "bg-indigo-500/20 border-indigo-400"
                    : "bg-gray-700/20 border-gray-400"
                }`}
              >
                {m.content}
              </div>
            ))}

            {isLoading && (
              <div className="text-sm opacity-70 italic flex items-center gap-2">
                <span className="pi pi-spin pi-spinner" />
                Thinking...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Context Indicator */}
      {selectedContext.length > 0 && (
        <div className="mb-2 flex items-center gap-2 text-xs text-indigo-300">
          <span className="pi pi-info-circle" />
          <span>
            Context: {selectedContext.slice(0, 3).join(", ")}
            {selectedContext.length > 3 &&
              ` +${selectedContext.length - 3} more`}
          </span>
        </div>
      )}

      {/* Input Bar */}
      <div className="flex items-center w-full gap-3 pt-3 border-t border-gray-700/40">
        {/* Dynamic Actions OverlayButton */}
        {actions.length > 0 && (
          <div className="relative">
            <Button
              icon="pi pi-plus"
              className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 h-10 w-10 flex items-center justify-center rounded-lg shadow hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              onClick={(e) => op.current.toggle(e)}
            />
            <OverlayPanel
              ref={op}
              className="dark:bg-gray-800 bg-white rounded-lg shadow-xl border border-gray-700/20"
            >
              <div className="flex flex-col p-2 space-y-1">
                {actions.map((item) => (
                  <Button
                    key={item.label}
                    label={item.label}
                    icon={item.icon}
                    onClick={() => handleActionSelect(item)}
                    className="p-button-text gap-2 text-sm justify-start dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/40 rounded-md transition"
                  />
                ))}
              </div>
            </OverlayPanel>
          </div>
        )}

        {/* Message Input */}
        <InputTextarea
          className="flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-3 rounded-lg shadow border border-transparent focus:ring-4 focus:ring-indigo-500/40 resize-none"
          autoResize
          ref={textareaRef}
          value={chatValue}
          onChange={(e) => setChatValue(e.target.value)}
          rows={1}
          placeholder={placeholder}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            !e.shiftKey &&
            (e.preventDefault(), handleSend())
          }
        />

        {/* Send Button */}
        <Button
          icon="pi pi-send"
          onClick={() => handleSend()}
          disabled={!chatValue.trim()}
          className="bg-indigo-600 text-white h-10 w-10 flex items-center justify-center rounded-lg shadow hover:bg-indigo-700 transition disabled:opacity-40"
        />
      </div>
    </div>
  );
}
