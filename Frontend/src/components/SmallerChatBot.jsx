import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "primereact/button";
import { OverlayPanel } from "primereact/overlaypanel";
import { InputTextarea } from "primereact/inputtextarea";
import { useWebSocketChat } from "../hooks/useWebSocketChat";

export default function SmallerChatBox({
  placeholder = "Ask me anything...",
  actions = [],
}) {
  const [chatValue, setChatValue] = useState("");
  const [showChat, setShowChat] = useState(false);
  const op = useRef(null);
  const textareaRef = useRef(null);

  const { messages, append, isLoading } = useWebSocketChat();

  const handleSend = () => {
    if (!chatValue.trim()) return;
    if (!showChat) setShowChat(true);
    append({ role: "user", content: chatValue });
    setChatValue("");
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
                className={`p-3 rounded-lg text-sm border-l-4 whitespace-pre-wrap font-mono ${
                  m.role === "assistant"
                    ? "bg-indigo-500/20 border-indigo-400 max-h-[45vh] overflow-y-auto"
                    : "bg-gray-700/20 border-gray-400"
                }`}
              >
                {m.content}
              </div>
            ))}

            {isLoading && <div className="text-sm opacity-70 italic">...</div>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Bar */}
      <div className="flex items-center w-full gap-3 pt-3 border-t border-gray-700/40">
        {/* Dynamic Actions OverlayButton */}
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
                  className="p-button-text gap-2 text-sm justify-start dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/40 rounded-md transition"
                  onClick={() => {
                    // If the action provides a templatePrompt, populate the chat input with it
                    if (item.templatePrompt) {
                      setChatValue(item.templatePrompt);
                      // open the panel if not shown and focus the input
                      if (!showChat) setShowChat(true);
                      // focus the textarea after overlay closes
                      op.current?.hide();
                      setTimeout(() => textareaRef.current?.focus(), 50);
                    } else if (typeof item.onClick === "function") {
                      // call custom handler if provided
                      item.onClick();
                      op.current?.hide();
                    } else {
                      op.current?.hide();
                    }
                  }}
                />
              ))}
            </div>
          </OverlayPanel>
        </div>

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
          onClick={handleSend}
          disabled={!chatValue.trim()}
          className="bg-indigo-600 text-white h-10 w-10 flex items-center justify-center rounded-lg shadow hover:bg-indigo-700 transition disabled:opacity-40"
        />
      </div>
    </div>
  );
}
