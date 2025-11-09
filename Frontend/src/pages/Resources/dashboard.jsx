import React, { useState, useMemo, useRef, useEffect } from "react";
import { Card } from "primereact/card";
import { Chart } from "primereact/chart";
import { Button } from "primereact/button";
import SmallerChatBox from "../../components/SmallerChatBot";
import { motion } from "framer-motion";
import { getResources, getResourceMetrics } from "../../lib/api";
import "primeicons/primeicons.css";

const actions = [
  {
    label: "Summarize",
    icon: "pi pi-align-left",
  },
  {
    label: "Report",
    icon: "pi pi-chart-bar",
  },
  {
    label: "Explain",
    icon: "pi pi-comment",
  },
];

// --- Chart Helpers ---
const generateChartData = (label, color) => {
  const dataPoints = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 100)
  );
  return {
    labels: Array.from({ length: 12 }, (_, i) => `${i * 5}s ago`),
    datasets: [
      {
        label,
        data: dataPoints,
        fill: false,
        borderColor: color,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  };
};

const getChartOptions = (title) => ({
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: true, text: title, font: { size: 13, weight: "600" } },
  },
  scales: {
    x: { grid: { color: "rgba(150,150,150,0.05)" }, ticks: { display: false } },
    y: {
      beginAtZero: true,
      max: 100,
      grid: { color: "rgba(150,150,150,0.05)" },
      ticks: { stepSize: 25, callback: (val) => `${val}%` },
    },
  },
});

// --- Motion Variants for Animation ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

// --- Main Component ---
export default function CloudDashboard() {
  const [selectedGraphs, setSelectedGraphs] = useState([]);
  const [resources, setResources] = useState([]);
  const [selectedResource, setSelectedResource] = useState(null);
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customerFilter, setCustomerFilter] = useState('all');
  const op = useRef(null);

  // Fetch available resources on mount
  useEffect(() => {
    const fetchResources = async () => {
      try {
        setLoading(true);
        const data = await getResources();
        setResources(data.resources || []);
        // Auto-select first resource
        if (data.resources && data.resources.length > 0) {
          setSelectedResource(data.resources[0]);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to fetch resources:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchResources();
  }, []);

  // Extract unique customer names from resources
  const uniqueCustomers = useMemo(() => {
    const customers = resources
      .map(r => {
        // Extract customer name from resource name pattern: {customer}-{type}-{id}
        const match = r.name?.match(/^([^-]+)-/);
        return match ? match[1] : null;
      })
      .filter(c => c !== null);
    return ['all', ...new Set(customers)];
  }, [resources]);

  // Filter resources by customer
  const filteredResources = useMemo(() => {
    if (customerFilter === 'all') return resources;
    return resources.filter(r => {
      const match = r.name?.match(/^([^-]+)-/);
      const customer = match ? match[1] : null;
      return customer === customerFilter;
    });
  }, [resources, customerFilter]);

  // Update selected resource when filter changes
  useEffect(() => {
    if (filteredResources.length > 0 && !filteredResources.find(r => r.id === selectedResource?.id)) {
      setSelectedResource(filteredResources[0]);
    }
  }, [filteredResources]);

  // Fetch metrics for selected resource
  useEffect(() => {
    if (!selectedResource) return;

    const fetchMetrics = async () => {
      try {
        const data = await getResourceMetrics(selectedResource.id);
        setLiveMetrics(data.resource || data);
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
        setError(err.message);
      }
    };

    fetchMetrics();
    // Poll every 10 seconds for live updates
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, [selectedResource]);

  // Generate chart data from live metrics or fallback to mock
  const generateChartDataFromMetrics = (metricKey, label, color) => {
    if (!liveMetrics || !liveMetrics.metrics) {
      // Fallback to mock data
      return generateChartData(label, color);
    }

    const metrics = liveMetrics.metrics;
    let value = 0;

    switch (metricKey) {
      case 'cpu':
        value = metrics.cpu_usage_percent || 0;
        break;
      case 'ram':
        value = metrics.memory_usage_percent || 0;
        break;
      case 'networkIn':
        value = metrics.network_in_mbps || 0;
        break;
      case 'diskIops':
        value = metrics.disk_iops || 0;
        break;
      case 'metric5':
        value = Math.random() * 100; // Placeholder
        break;
      case 'metric6':
        value = Math.random() * 100; // Placeholder
        break;
      default:
        value = 0;
    }

    // Create historical data with current value as latest point
    const dataPoints = Array.from({ length: 11 }, () => 
      Math.max(0, value + (Math.random() - 0.5) * 20)
    );
    dataPoints.push(value);

    return {
      labels: Array.from({ length: 12 }, (_, i) => `${(11 - i) * 5}s ago`),
      datasets: [
        {
          label,
          data: dataPoints,
          fill: false,
          borderColor: color,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    };
  };

  const chartData = useMemo(
    () => ({
      cpu: generateChartDataFromMetrics("cpu", "CPU Utilization", "#6366F1"),
      ram: generateChartDataFromMetrics("ram", "RAM Usage", "#10B981"),
      networkIn: generateChartDataFromMetrics("networkIn", "Network In (Mbps)", "#F59E0B"),
      diskIops: generateChartDataFromMetrics("diskIops", "Disk IOPS", "#EF4444"),
      metric5: generateChartDataFromMetrics("metric5", "Load Balancer Latency", "#3B82F6"),
      metric6: generateChartDataFromMetrics("metric6", "Request Queue Depth", "#8B5CF6"),
    }),
    [liveMetrics]
  );

  const graphMetadata = {
    cpu: "CPU Utilization",
    ram: "Memory Usage",
    networkIn: "Network In",
    diskIops: "Disk IOPS",
    metric5: "Load Balancer Latency",
    metric6: "Request Queue Depth",
  };

  const toggleGraphSelection = (metricKey) => {
    setSelectedGraphs((prev) =>
      prev.includes(metricKey)
        ? prev.filter((k) => k !== metricKey)
        : [...prev, metricKey]
    );
  };

  const handleActionWithGraphs = async (action) => {
    if (selectedGraphs.length === 0) {
      return `${action.label} what?`;
    }

    // Gather context: selected graphs + current metric values
    const context = {
      resource: {
        name: selectedResource?.name || 'Unknown',
        id: selectedResource?.id,
        type: selectedResource?.type || 'Unknown',
        region: selectedResource?.region || 'us-east-1',
        status: selectedResource?.status || 'unknown'
      },
      selectedMetrics: selectedGraphs.map(key => {
        const metricData = chartData[key];
        const latestValue = metricData.datasets[0].data[metricData.datasets[0].data.length - 1];
        let unit = '%';
        if (liveMetrics?.metrics) {
          const metrics = liveMetrics.metrics;
          switch (key) {
            case 'cpu':
              return { name: graphMetadata[key], value: metrics.cpu_usage_percent?.toFixed(1) || latestValue?.toFixed(1), unit: '%' };
            case 'ram':
              return { name: graphMetadata[key], value: metrics.memory_usage_percent?.toFixed(1) || latestValue?.toFixed(1), unit: '%' };
            case 'networkIn':
              return { name: graphMetadata[key], value: metrics.network_in_mbps?.toFixed(2) || latestValue?.toFixed(2), unit: 'Mbps' };
            case 'diskIops':
              return { name: graphMetadata[key], value: metrics.disk_iops || latestValue?.toFixed(0), unit: 'IOPS' };
            default:
              return { name: graphMetadata[key], value: latestValue?.toFixed(1), unit };
          }
        }
        return { name: graphMetadata[key], value: latestValue?.toFixed(1), unit };
      }),
      timestamp: new Date().toISOString()
    };

    // Map action to AI prompt context
    const actionPrompts = {
      'Summarize': `Provide a concise summary of the current state of these metrics for ${context.resource.name}. Focus on overall health and notable patterns.`,
      'Report': `Generate a detailed technical report for these metrics on ${context.resource.name}. Include current values, trends, and any anomalies or concerns.`,
      'Explain': `Explain what these metrics mean for ${context.resource.name} in simple terms. Help the user understand the significance of the current values and what actions (if any) they should take.`
    };

    const promptContext = actionPrompts[action.label] || `Analyze these metrics for ${context.resource.name}`;

    try {
      // Call AI parse endpoint
      const response = await fetch(`${import.meta.env.VITE_NODE_URL || 'http://localhost:8080'}/ai/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: context, context: promptContext })
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI response');
      }

      const result = await response.json();
      return result.parsed_response || 'Unable to generate response';
    } catch (error) {
      console.error('AI action error:', error);
      return `❌ Failed to ${action.label.toLowerCase()}: ${error.message}`;
    }
  };

  const renderChartCard = (metricKey, title, cardActions) => {
    const data = chartData[metricKey];
    const options = getChartOptions(title);
    const isSelected = selectedGraphs.includes(metricKey);

    // Get current value for display
    let currentValue = 'N/A';
    let unit = '%';
    if (liveMetrics?.metrics) {
      const metrics = liveMetrics.metrics;
      switch (metricKey) {
        case 'cpu':
          currentValue = metrics.cpu_usage_percent?.toFixed(1) || 'N/A';
          break;
        case 'ram':
          currentValue = metrics.memory_usage_percent?.toFixed(1) || 'N/A';
          break;
        case 'networkIn':
          currentValue = metrics.network_in_mbps?.toFixed(2) || 'N/A';
          unit = 'Mbps';
          break;
        case 'diskIops':
          currentValue = metrics.disk_iops || 'N/A';
          unit = 'IOPS';
          break;
        default:
          currentValue = data.datasets[0].data[data.datasets[0].data.length - 1]?.toFixed(1) || 'N/A';
      }
    } else {
      currentValue = data.datasets[0].data[data.datasets[0].data.length - 1]?.toFixed(1) || 'N/A';
    }

    return (
      <motion.div key={metricKey} variants={itemVariants} className="h-full">
        <Card
          className={`h-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl border shadow-sm cursor-pointer transition-all duration-200 ${
            isSelected
              ? "border-indigo-500 ring-2 ring-indigo-500/50 shadow-indigo-500/30"
              : "border-gray-200/60 dark:border-gray-700/50 hover:border-indigo-400/50"
          }`}
          onClick={() => toggleGraphSelection(metricKey)}
          header={
            <div className="p-3 border-b border-gray-100/60 dark:border-gray-700/50 flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                  {title}
                </h3>
                <div className="text-2xl font-bold text-indigo-400 mt-1">
                  {currentValue} <span className="text-sm text-gray-400">{unit}</span>
                </div>
              </div>
              {isSelected && (
                <span className="pi pi-check-circle text-indigo-500 text-lg" />
              )}
            </div>
          }
          footer={
            <div
              className="flex justify-end gap-2 p-2 border-t border-gray-100/60 dark:border-gray-700/50"
              onClick={(e) => e.stopPropagation()}
            >
              {cardActions.map((a, i) => (
                <Button
                  key={i}
                  label={a.label}
                  icon={a.icon}
                  className="p-button-sm p-button-outlined text-xs"
                />
              ))}
            </div>
          }
        >
          <div className="h-40 px-2 pointer-events-none">
            <Chart
              type="line"
              data={data}
              options={options}
              className="h-full"
            />
          </div>
        </Card>
      </motion.div>
    );
  };

  const nothingFound = !selectedResource || selectedResource?.name === 'N/A' || selectedResource?.id === 'N/A';
  return (
    <main className="p-4 md:p-8 space-y-8 transition-colors duration-300">
      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-3xl md:text-4xl font-extrabold text-gray-100 text-center tracking-tight"
      >
        Resource Dashboard:{" "}
        <span className="text-indigo-400">
          {loading ? 'Loading...' : (selectedResource?.name || selectedResource?.id || 'N/A')}
        </span>
      </motion.h1>

      {nothingFound ? (
        <div className="flex flex-col items-center justify-center py-16">
          <span className="pi pi-search text-5xl text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-400">Nothing found</h2>
          <p className="text-gray-500 mt-2">No resources available to display.</p>
        </div>
      ) : (
        <>
          {/* Resource Selector & Status */}
          <div className="flex flex-wrap justify-center items-center gap-4">
            {/* Customer Filter */}
            {uniqueCustomers.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Customer:</label>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 capitalize"
                >
                  {uniqueCustomers.map(customer => (
                    <option key={customer} value={customer} className="capitalize">
                      {customer === 'all' ? 'All Customers' : customer}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Resource Selector */}
            {/* ...existing resource selector and dashboard UI... */}
            
            {liveMetrics && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-900/20 border border-green-500/30 rounded-lg">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-green-400">Live Data</span>
              </div>
            )}

            {error && (
              <div className="px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Selection Info */}
          {selectedGraphs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm text-indigo-300"
            >
              {selectedGraphs.length} graph{selectedGraphs.length !== 1 ? "s" : ""}{" "}
              selected
              <Button
                label="Clear"
                className="p-button-text p-button-sm ml-2 text-indigo-400"
                onClick={() => setSelectedGraphs([])}
              />
            </motion.div>
          )}

          {/* Dashboard Grid */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {renderChartCard("cpu", "CPU Utilization (Past Hour)", [])}
            {renderChartCard("ram", "Memory Usage (Past Hour)", [])}
            {renderChartCard("networkIn", "Network In (Past 10 Min)", [])}
            {renderChartCard("diskIops", "Disk IOPS (Read/Write)", [])}
            {renderChartCard("metric5", "Load Balancer Latency (ms)", [])}
            {renderChartCard("metric6", "Request Queue Depth", [])}
          </motion.div>

          <div className="pt-6 border-t border-gray-700/40">
            <SmallerChatBox
              actions={actions}
              onActionClick={handleActionWithGraphs}
              selectedContext={selectedGraphs.map((key) => graphMetadata[key])}
            />
          </div>
        </>
      )}
    </main>
  );
}
