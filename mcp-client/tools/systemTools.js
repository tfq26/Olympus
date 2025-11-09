// tools/systemTools.js

/**
 * These are your MCP "tools" — each represents a callable function
 * that your model (router) can map to and execute dynamically.
 */
export const systemTools = {
  echo: {
    description: "Echoes the input text back to the user.",
    run: async ({ text }) => {
      return `Echo: ${text}`;
    },
  },

  getLogs: {
    description: "Fetches logs from your system or mock data source.",
    run: async ({ status = "all" }) => {
      // Simulate fetching log data
      const logs = [
        { id: 1, message: "Resource connected", status: "active" },
        { id: 2, message: "Cache refreshed", status: "active" },
        { id: 3, message: "Disk warning", status: "error" },
      ];

      const filtered = status === "all" ? logs : logs.filter((l) => l.status === status);
      return `Found ${filtered.length} ${status} logs:\n${JSON.stringify(filtered, null, 2)}`;
    },
  },

  getResource: {
    description: "Retrieves details about a system resource.",
    run: async ({ id }) => {
      // Simulate pulling resource metrics
      const mockResource = {
        id,
        uptime: "24h",
        cpuUsage: "67%",
        memoryUsage: "2.3 GB",
        health: "Good",
      };
      return `Resource ${id} info:\n${JSON.stringify(mockResource, null, 2)}`;
    },
  },

  restartService: {
    description: "Simulates restarting a service by name.",
    run: async ({ serviceName }) => {
      // This would normally call your orchestration or backend system
      return `Service "${serviceName}" has been restarted successfully ✅`;
    },
  },
};
