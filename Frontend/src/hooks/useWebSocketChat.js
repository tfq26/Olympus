import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Custom hook that mimics useChat but uses WebSocket to connect to the MCP server
 * This connects to the backend WebSocket server and uses the queryAI tool
 */
export function useWebSocketChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const messageIdCounter = useRef(0);
  const connectionStateRef = useRef("disconnected"); // disconnected, connecting, connected, error
  const pendingMessagesRef = useRef([]);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  // WebSocket URL (available across scopes)
  const WS_URL = import.meta.env.VITE_NODE_WS_URL || "ws://localhost:8080";

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return `msg-${Date.now()}-${++messageIdCounter.current}`;
  }, []);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    // Don't reconnect if already connecting or connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      connectionStateRef.current = "connected";
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      return; // Already connecting
    }

    // Clear any existing reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    connectionStateRef.current = "connecting";
    console.log("🔄 Attempting to connect to WebSocket server...");

  try {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.removeAllListeners?.();
        if (wsRef.current.readyState !== WebSocket.CLOSED) {
          wsRef.current.close();
        }
      }
  const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ Connected to WebSocket server");
        connectionStateRef.current = "connected";
        reconnectAttemptsRef.current = 0;
        setIsLoading(false);

        // Send any pending messages
        if (pendingMessagesRef.current.length > 0) {
          pendingMessagesRef.current.forEach((msg) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(msg);
            }
          });
          pendingMessagesRef.current = [];
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.needsConfirmation) {
            // Server is asking for confirmation before executing
            setMessages((prev) => [
              ...prev,
              {
                id: generateMessageId(),
                role: "assistant",
                content: data.message,
                needsConfirmation: true,
                intent: data.intent,
              },
            ]);
            setIsLoading(false);
          } else if (data.reply) {
            // Add assistant message
            setMessages((prev) => [
              ...prev,
              {
                id: generateMessageId(),
                role: "assistant",
                content: data.reply,
              },
            ]);
            setIsLoading(false);
          } else if (data.error) {
            // Handle error
            setMessages((prev) => [
              ...prev,
              {
                id: generateMessageId(),
                role: "assistant",
                content: `Error: ${data.error}`,
              },
            ]);
            setIsLoading(false);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
          setIsLoading(false);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Don't show error message immediately - wait for onclose
      };

      ws.onclose = (event) => {
        console.log("WebSocket connection closed", event.code, event.reason);
        connectionStateRef.current = "disconnected";
        setIsLoading(false);

        // Only attempt to reconnect if it wasn't a manual close (code 1000)
        // and we haven't exceeded max attempts
        if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          console.log(`🔄 Reconnection attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          // Only show error after max attempts
          connectionStateRef.current = "error";
          setMessages((prev) => {
            // Only add error message if we don't already have one
            const hasError = prev.some(
              (m) => m.role === "assistant" && m.content.includes("Connection error")
            );
            if (!hasError) {
              return [
                ...prev,
                {
                  id: generateMessageId(),
                  role: "assistant",
                  content: `⚠️ Unable to connect to server. Please make sure the server is running on ${WS_URL}`,
                },
              ];
            }
            return prev;
          });
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      connectionStateRef.current = "error";
      setIsLoading(false);
      
      // Only show error after a delay
      setTimeout(() => {
        if (connectionStateRef.current === "error") {
          setMessages((prev) => {
            const hasError = prev.some(
              (m) => m.role === "assistant" && m.content.includes("Connection error")
            );
            if (!hasError) {
              return [
                ...prev,
                {
                  id: generateMessageId(),
                  role: "assistant",
                  content: `⚠️ Connection error. Please make sure the server is running on ${WS_URL}`,
                },
              ];
            }
            return prev;
          });
        }
      }, 2000);
    }
  }, [generateMessageId]);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Send message via WebSocket
  const append = useCallback(
    (message) => {
      if (!message.content?.trim()) {
        return;
      }

      // Add user message to state
      const userMessage = {
        id: generateMessageId(),
        role: "user",
        content: message.content,
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Server expects either { message } or { intent, userConfirmed }
      const messageData = JSON.stringify({
        message: message.content
      });

      // Check connection state
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Connected - send immediately
        wsRef.current.send(messageData);
      } else if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        // Connecting - queue the message
        pendingMessagesRef.current.push(messageData);
      } else {
        // Not connected - try to connect first, then send
        if (connectionStateRef.current !== "connecting") {
          connect();
        }
        pendingMessagesRef.current.push(messageData);

        // Wait for connection and send
        const checkAndSend = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            clearInterval(checkAndSend);
            wsRef.current.send(messageData);
            // Remove from pending
            pendingMessagesRef.current = pendingMessagesRef.current.filter(
              (msg) => msg !== messageData
            );
          } else if (
            wsRef.current?.readyState === WebSocket.CLOSED &&
            connectionStateRef.current === "error"
          ) {
            // Connection failed after retries
            clearInterval(checkAndSend);
            setIsLoading(false);
            setMessages((prev) => {
              const hasError = prev.some(
                (m) => m.role === "assistant" && m.content.includes("Unable to connect")
              );
              if (!hasError) {
                return [
                  ...prev,
                  {
                    id: generateMessageId(),
                    role: "assistant",
                    content: "⚠️ Unable to connect to server. Please make sure the server is running on ws://localhost:8080",
                  },
                ];
              }
              return prev;
            });
          }
        }, 500);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkAndSend);
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            setIsLoading(false);
            pendingMessagesRef.current = pendingMessagesRef.current.filter(
              (msg) => msg !== messageData
            );
          }
        }, 10000);
      }
    },
    [connect, generateMessageId]
  );

  return {
    messages,
    append,
    isLoading,
    reload: () => {}, // Not implemented
    stop: () => {
      setIsLoading(false);
    },
    setMessages,
    // New: Confirm an intent
    confirm: useCallback(
      (intent) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.error("WebSocket not connected");
          return;
        }
        setIsLoading(true);
        const confirmData = JSON.stringify({
          intent,
          userConfirmed: true,
        });
        wsRef.current.send(confirmData);
      },
      []
    ),
  };
}

