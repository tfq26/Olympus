import { useCallback, useEffect, useRef } from "react";
import { useWebSocketChat } from "./useWebSocketChat";
import { parseWithAI } from "../lib/api";

/**
 * Wrapper around useWebSocketChat that automatically parses assistant responses with AI
 * This makes technical responses more user-friendly
 */
export function useAIParsedChat({ autoParseResponses = true } = {}) {
  const {
    messages,
    append: originalAppend,
    isLoading,
    reload,
    stop,
    setMessages,
    confirm,
  } = useWebSocketChat();

  const parsingRef = useRef(false);
  const lastParsedIdRef = useRef(null);

  // Parse assistant responses automatically
  useEffect(() => {
    if (!autoParseResponses || parsingRef.current || isLoading) return;

    const lastMessage = messages[messages.length - 1];
    
    // Only parse assistant messages that haven't been parsed yet
    if (
      lastMessage?.role === "assistant" &&
      lastMessage.id !== lastParsedIdRef.current &&
      !lastMessage.needsConfirmation &&
      !lastMessage.isParsed
    ) {
      // Check if the response looks like technical data (JSON, raw output, etc.)
      const content = lastMessage.content;
      const looksLikeTechnicalData =
        content.includes("{") ||
        content.includes("[") ||
        content.includes("✅") ||
        content.includes("❌") ||
        content.includes("Error:") ||
        content.length > 500;

      if (looksLikeTechnicalData) {
        parsingRef.current = true;
        lastParsedIdRef.current = lastMessage.id;

        parseWithAI(content, "User received this response in a chat. Make it conversational and easy to understand while keeping key information.")
          .then((parsed) => {
            if (parsed.parsed_response) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === lastMessage.id
                    ? {
                        ...msg,
                        content: parsed.parsed_response,
                        originalContent: content,
                        isParsed: true,
                      }
                    : msg
                )
              );
            }
          })
          .catch((error) => {
            console.error("AI parsing failed:", error);
            // Keep original message on error
          })
          .finally(() => {
            parsingRef.current = false;
          });
      }
    }
  }, [messages, isLoading, autoParseResponses, setMessages]);

  return {
    messages,
    append: originalAppend,
    isLoading: isLoading || parsingRef.current,
    reload,
    stop,
    setMessages,
    confirm,
    isParsing: parsingRef.current,
  };
}
