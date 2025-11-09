import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCcw, Send } from "lucide-react";
import SmallerChatBox from "../../components/SmallerChatBot";

const FLASK_BACKEND_URL = import.meta.env.VITE_FLASK_BACKEND_URL || "http://localhost:5000";

export default function LogsDashboard() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch logs from DynamoDB via Flask backend
  const fetchLogs = async (limit = 5) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${FLASK_BACKEND_URL}/monitor/mock/logs?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Extract logs array from response (Flask returns { logs: [...], total: N })
      const logsArray = data.logs || data || [];
      
      // Transform DynamoDB log format to table format
      const transformedLogs = logsArray.map((log) => ({
        id: log.log_code || log.id || "N/A",
        source: log.subtype || "Unknown",
        type: mapStatusToType(log.status),
        message: log.message || log.description || "No message",
        timestamp: formatTimestamp(log.time || log.timestamp),
        rawStatus: log.status,
        customer: log.customer_name || "Unknown",
      }));
      
      setLogs(transformedLogs);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching logs:", err);
      setError(err.message);
      setIsLoading(false);
      setLogs([
        {
          id: "ERROR",
          source: "System",
          type: "Error",
          message: `Failed to load logs: ${err.message}`,
          timestamp: formatTimestamp(new Date()),
        },
      ]);
    }
  };

  // Map DynamoDB status to table type
  const mapStatusToType = (status) => {
    const statusUpper = (status || "").toUpperCase();
    switch (statusUpper) {
      case "OK":
        return "Info";
      case "WARNING":
        return "Warning";
      case "ERROR":
      case "CRITICAL":
        return "Error";
      default:
        return "Info";
    }
  };

  // Load logs on component mount
  useEffect(() => {
    fetchLogs();
  }, []);

  // Utility to format all timestamps uniformly
  const formatTimestamp = (date) => {
    if (!date) return "Unknown";
    // If it's already a string in correct format, clean it up
    if (typeof date === "string") {
      // Remove timezone and T separator
      return date.substring(0, 19).replace("T", " ");
    }
    // convert to local time, format as YYYY-MM-DD HH:mm:ss
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const [chatValue, setChatValue] = useState("");
  const [sortKey, setSortKey] = useState("timestamp");
  const [sortOrder, setSortOrder] = useState("desc");

  const handleSort = (key) => {
    const order = sortKey === key && sortOrder === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortOrder(order);
    const sorted = [...logs].sort((a, b) => {
      if (a[key] < b[key]) return order === "asc" ? -1 : 1;
      if (a[key] > b[key]) return order === "asc" ? 1 : -1;
      return 0;
    });
    setLogs(sorted);
  };

  const getLogTypeStyle = (type) => {
    const map = {
      Info: "bg-blue-500/20 text-blue-400",
      Warning: "bg-yellow-500/20 text-yellow-400",
      Error: "bg-red-500/20 text-red-400",
    };
    return map[type] || "bg-gray-700/40 text-gray-300";
  };

  return (
    <main className="p-6 md:p-10 space-y-8 transition-colors duration-300">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex justify-between items-center"
      >
        <h1 className="text-3xl font-extrabold text-gray-100">
          Logs Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {isLoading ? "Loading..." : `${logs.length} logs`}
          </span>
          <button
            onClick={() => fetchLogs()}
            disabled={isLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCcw size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Logs Table - Compact (20% screen height, 5 logs max) */}
      <div className="rounded-2xl border border-gray-700/50 bg-white/10 dark:bg-zinc-900/60 backdrop-blur-md shadow-lg overflow-hidden">
        {error && (
          <div className="p-4 bg-red-500/20 border-b border-red-500/40 text-red-300">
            <p className="font-semibold">Error loading logs:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        {/* Fixed Header */}
        <div className="bg-zinc-900/80 backdrop-blur-sm border-b border-gray-700/40">
          <table className="w-full text-left text-sm text-gray-200">
            <thead>
              <tr className="text-indigo-300 text-xs uppercase">
                {[
                  { key: "id", label: "ID" },
                  { key: "source", label: "Source" },
                  { key: "type", label: "Type" },
                  { key: "message", label: "Message" },
                  { key: "timestamp", label: "Timestamp" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-3 py-2 cursor-pointer select-none font-semibold"
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      {sortKey === col.key && (
                        <span className="text-xs opacity-70">
                          {sortOrder === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto max-h-[15vh]">
          <table className="w-full text-left text-sm text-gray-200">
            <tbody>
              {isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-3 py-4 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-indigo-500"></div>
                      <span className="text-xs">Loading logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-3 py-4 text-center text-gray-400 text-xs">
                    No logs found
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <tr
                    key={`${log.id}-${index}`}
                    className="border-b border-gray-800/50 hover:bg-white/10 transition"
                  >
                    <td className="px-3 py-2 font-mono text-xs" style={{ width: "10%" }}>{log.id}</td>
                    <td className="px-3 py-2 text-xs" style={{ width: "15%" }}>{log.source}</td>
                    <td className="px-3 py-2" style={{ width: "10%" }}>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${getLogTypeStyle(
                          log.type
                        )}`}
                      >
                        {log.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-300 text-xs" style={{ width: "45%" }}>{log.message}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs" style={{ width: "20%" }}>{log.timestamp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chat Input */}
      <div className="flex items-center w-full gap-3 pt-4 border-t border-gray-800/50">
        {/* Left Refresh Button */}
        <button
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-all active:scale-95 disabled:opacity-50"
          onClick={() => fetchLogs()}
          disabled={isLoading}
        >
          <RefreshCcw size={18} strokeWidth={2} className={isLoading ? "animate-spin" : ""} />
        </button>

        <SmallerChatBox
          placeholder="Ask about logs or type a command..."
          actions={[
            {
              label: "Add Log Alert",
              icon: "pi pi-bell",
              templatePrompt: "Add a new log alert for [INSERT_LOG_TYPE].",
            },
            {
              label: "Filter Logs",
              icon: "pi pi-filter",
              templatePrompt: "Filter logs by [INSERT_FILTER_CRITERIA].",
            },
          ]}
        />
      </div>
    </main>
  );
}
