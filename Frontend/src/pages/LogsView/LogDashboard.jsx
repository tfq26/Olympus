import React, { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCcw, Send } from "lucide-react"; // <-- lightweight icons
import SmallerChatBox from "../../components/SmallerChatBot";

export default function LogsDashboard() {
  const [logs, setLogs] = useState([
    {
      id: "LOG-003",
      source: "Compute Engine",
      type: "Error",
      message: "CPU usage exceeded threshold on instance-2",
      timestamp: "2025-11-08 15:21:12",
    },
    {
      id: "LOG-002",
      source: "Load Balancer",
      type: "Warning",
      message: "High response latency detected in region us-east-1",
      timestamp: "2025-11-08 15:24:50",
    },
    {
      id: "LOG-003",
      source: "Database",
      type: "Info",
      message: "Connection pool reinitialized successfully.",
      timestamp: "2025-11-08 15:25:02",
    },
  ]);

  // Utility to format all timestamps uniformly
  const formatTimestamp = (date) => {
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

  // Chat send handler
  const handleSend = () => {
    if (!chatValue.trim()) return;
    const newLog = {
      id: `LOG-${String(logs.length + 1).padStart(3, "0")}`,
      source: "System",
      type: "Info",
      message: chatValue,
      timestamp: formatTimestamp(new Date()), // ✅ uniform format
    };
    setLogs([newLog, ...logs]);
    setChatValue("");
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
      </motion.div>

      {/* Logs Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-700/50 bg-white/10 dark:bg-zinc-900/60 backdrop-blur-md shadow-lg">
        <table className="w-full text-left text-sm md:text-base text-gray-200">
          <thead>
            <tr className="bg-white/5 border-b border-gray-700/40 text-indigo-300 text-sm uppercase">
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
                  className="px-4 py-3 cursor-pointer select-none font-semibold"
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

          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-gray-800/50 hover:bg-white/10 transition"
              >
                <td className="px-4 py-3 font-mono">{log.id}</td>
                <td className="px-4 py-3">{log.source}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-3 py-1 text-xs rounded-full font-medium ${getLogTypeStyle(
                      log.type
                    )}`}
                  >
                    {log.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">{log.message}</td>
                <td className="px-4 py-3 text-gray-400">{log.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chat Input */}
      <div className="flex items-center w-full gap-3 pt-4 border-t border-gray-800/50">
        {/* Left Refresh Button */}
        <button
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-all active:scale-95"
          onClick={() =>
            setLogs([
              {
                id: `LOG-${String(logs.length + 1).padStart(3, "0")}`,
                source: "Manual Action",
                type: "Info",
                message: "Manual refresh triggered.",
                timestamp: formatTimestamp(new Date()), // ✅ same uniform format
              },
              ...logs,
            ])
          }
        >
          <RefreshCcw size={18} strokeWidth={2} />
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
        {/*         
        <input
          type="text"
          placeholder="Ask about logs or type a command..."
          value={chatValue}
          onChange={(e) => setChatValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 bg-white/90 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 rounded-lg shadow-md border border-transparent focus:ring-4 focus:ring-indigo-500/40 focus:border-indigo-500 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all"
        />

        <button
          onClick={handleSend}
          disabled={!chatValue.trim()}
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-indigo-600 text-white font-semibold shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/40 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={18} strokeWidth={2} />
        </button>
 */}
      </div>
    </main>
  );
}
