import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCcw, MessageSquare, X, Filter } from "lucide-react";
import SmallerChatBox from "../../components/SmallerChatBot";
import { getLogs, getLogsAnalysis, getResources } from "../../lib/api";

export default function LogsDashboard() {
  const [chatHidden, setChatHidden] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [resources, setResources] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Fetch resources for filter dropdown
  useEffect(() => {
    const fetchResourcesData = async () => {
      try {
        const data = await getResources();
        setResources(data.resources || []);
      } catch (err) {
        console.error('Failed to fetch resources:', err);
      }
    };
    fetchResourcesData();
  }, []);

  // Fetch logs based on filters
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLogs(resourceFilter || null, statusFilter || null);
      // Transform logs to match component format
      const transformedLogs = (data.logs || []).map(log => ({
        id: log.id || log.log_code || `LOG-${Date.now()}`,
        source: log.source || log.subtype || 'Unknown',
        type: mapStatusToType(log.status),
        message: log.message || `${log.subtype}: ${log.log_code}`,
        timestamp: formatTimestamp(log.timestamp || new Date().toISOString()),
        rawLog: log
      }));
      setLogs(transformedLogs);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Poll every 30 seconds
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [statusFilter, resourceFilter]);

  // Map log status to UI type
  const mapStatusToType = (status) => {
    const map = {
      'OK': 'Info',
      'INFO': 'Info',
      'WARNING': 'Warning',
      'WARN': 'Warning',
      'ERROR': 'Error',
      'CRITICAL': 'Error',
      'STALE': 'Warning'
    };
    return map[status?.toUpperCase()] || 'Info';
  };

  // Fetch AI analysis
  const handleAnalyze = async () => {
    try {
      setShowAnalysis(true);
      const data = await getLogsAnalysis(resourceFilter || null, statusFilter || null);
      setAnalysis(data);
    } catch (err) {
      console.error('Failed to analyze logs:', err);
      setError(err.message);
    }
  };

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

        {/* Chat Toggle Button */}
        <button
          onClick={() => setChatHidden(!chatHidden)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-md transition-all font-medium ${
            chatHidden
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
        >
          {chatHidden ? (
            <>
              <MessageSquare size={18} />
              <span>Show Chat</span>
            </>
          ) : (
            <>
              <X size={18} />
              <span>Hide Chat</span>
            </>
          )}
        </button>
      </motion.div>

      {/* Filters Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-4 items-center bg-white/5 p-4 rounded-xl border border-gray-700/50"
      >
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-indigo-400" />
          <span className="text-gray-300 font-medium">Filters:</span>
        </div>
        
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-gray-800 text-gray-200 border border-gray-600 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="INFO">Info</option>
          <option value="WARNING">Warning</option>
          <option value="ERROR">Error</option>
          <option value="CRITICAL">Critical</option>
        </select>

        {/* Resource Filter */}
        <select
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-gray-800 text-gray-200 border border-gray-600 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Resources</option>
          {resources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.name || resource.id}
            </option>
          ))}
        </select>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          className="ml-auto px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-all font-medium flex items-center gap-2"
        >
          <span>🔍</span>
          <span>AI Analysis</span>
        </button>
      </motion.div>

      {/* Loading/Error States */}
      {loading && (
        <div className="text-center text-gray-400 py-8">
          Loading logs...
        </div>
      )}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
          Error: {error}
        </div>
      )}

      {/* AI Analysis Panel */}
      {showAnalysis && analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-purple-300">AI Analysis</h2>
            <button
              onClick={() => setShowAnalysis(false)}
              className="text-gray-400 hover:text-gray-200 transition"
            >
              <X size={20} />
            </button>
          </div>
          <div className="text-gray-300 whitespace-pre-wrap">
            {analysis.analysis || JSON.stringify(analysis, null, 2)}
          </div>
        </motion.div>
      )}

      {/* Logs Table */}
      {!loading && logs.length > 0 && (
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
      )}

      {!loading && logs.length === 0 && (
        <div className="text-center text-gray-400 py-8 bg-white/5 rounded-xl border border-gray-700/50">
          No logs found. Try adjusting your filters.
        </div>
      )}

      {/* Chat Section */}
      {!chatHidden && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="pt-4 border-t border-gray-800/50"
        >
          <div className="flex items-start w-full gap-3">
            {/* Left Refresh Button */}
            <button
              className="h-10 w-10 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-all active:scale-95"
              onClick={fetchLogs}
            >
              <RefreshCcw size={18} strokeWidth={2} />
            </button>

            <div className="flex-1">
              <SmallerChatBox
                placeholder="Ask about logs or type a command..."
                actions={[
                  {
                    label: "Add Log Alert",
                    icon: "pi pi-bell",
                  },
                  {
                    label: "Filter Logs",
                    icon: "pi pi-filter",
                  },
                  {
                    label: "Analyze Errors",
                    icon: "pi pi-exclamation-triangle",
                  },
                ]}
                hidden={chatHidden}
              />
            </div>
          </div>
        </motion.div>
      )}
    </main>
  );
}
