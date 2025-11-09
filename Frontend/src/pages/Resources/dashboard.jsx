import React, { useState, useMemo, useRef } from "react";
import { Card } from "primereact/card";
import { Chart } from "primereact/chart";
import { Button } from "primereact/button";
import SmallerChatBox from "../../components/SmallerChatBot";
import { motion } from "framer-motion";
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
  const op = useRef(null);

  const chartData = useMemo(
    () => ({
      cpu: generateChartData("CPU Utilization", "#6366F1"),
      ram: generateChartData("RAM Usage", "#10B981"),
      networkIn: generateChartData("Network In (Mbps)", "#F59E0B"),
      diskIops: generateChartData("Disk IOPS", "#EF4444"),
      metric5: generateChartData("Load Balancer Latency", "#3B82F6"),
      metric6: generateChartData("Request Queue Depth", "#8B5CF6"),
    }),
    []
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

  const handleActionWithGraphs = (action) => {
    if (selectedGraphs.length === 0) {
      return `${action.label} what?`;
    }

    const resourceNames = selectedGraphs
      .map((key) => graphMetadata[key])
      .join(", ");

    return `${action.label} ${resourceNames}`;
  };

  const renderChartCard = (metricKey, title, cardActions) => {
    const data = chartData[metricKey];
    const options = getChartOptions(title);
    const isSelected = selectedGraphs.includes(metricKey);

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
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                {title}
              </h3>
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
        <span className="text-indigo-400">production-api</span>
      </motion.h1>

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
        {renderChartCard("cpu", "CPU Utilization (Past Hour)", [
          { label: "Scale Up", icon: "pi pi-arrow-up" },
          { label: "View Processes", icon: "pi pi-list" },
        ])}
        {renderChartCard("ram", "Memory Usage (Past Hour)", [
          { label: "Clear Cache", icon: "pi pi-trash" },
          { label: "Snapshots", icon: "pi pi-camera" },
        ])}
        {renderChartCard("networkIn", "Network In (Past 10 Min)", [
          { label: "Block IP", icon: "pi pi-ban" },
          { label: "Trace Route", icon: "pi pi-globe" },
        ])}
        {renderChartCard("diskIops", "Disk IOPS (Read/Write)", [
          { label: "Optimize", icon: "pi pi-sliders-h" },
          { label: "Increase Storage", icon: "pi pi-database" },
        ])}
        {renderChartCard("metric5", "Load Balancer Latency (ms)", [
          { label: "Check Health", icon: "pi pi-heart" },
        ])}
        {renderChartCard("metric6", "Request Queue Depth", [
          { label: "Scale Workers", icon: "pi pi-users" },
        ])}
      </motion.div>

      <div className="pt-6 border-t border-gray-700/40">
        <SmallerChatBox
          actions={actions}
          onActionClick={handleActionWithGraphs}
          selectedContext={selectedGraphs.map((key) => graphMetadata[key])}
        />
      </div>
    </main>
  );
}
