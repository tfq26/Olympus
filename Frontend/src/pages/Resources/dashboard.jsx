import React, { useState, useMemo, useRef } from "react";
import { Card } from "primereact/card";
import { Chart } from "primereact/chart";
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { OverlayPanel } from "primereact/overlaypanel";
import { motion } from "framer-motion";
import "primeicons/primeicons.css";

// --- Chart Helpers ---
const generateChartData = (label, color) => {
  const dataPoints = Array.from({ length: 12 }, () => Math.floor(Math.random() * 100));
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
  const [chatValue, setChatValue] = useState("");
  const op = useRef(null);

  const handleSend = () => {
    console.log("Sending message:", chatValue);
  };

  const handleAction = (action) => {
    console.log("Action selected:", action);
    op.current?.hide();
  };

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

  const renderChartCard = (metricKey, title, actions) => {
    const data = chartData[metricKey];
    const options = getChartOptions(title);

    return (
      <motion.div key={metricKey} variants={itemVariants} className="h-full">
        <Card
          className="h-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm"
          header={
            <div className="p-3 border-b border-gray-100/60 dark:border-gray-700/50">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                {title}
              </h3>
            </div>
          }
          footer={
            <div className="flex justify-end gap-2 p-2 border-t border-gray-100/60 dark:border-gray-700/50">
              {actions.map((a, i) => (
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
          <div className="h-40 px-2">
            <Chart type="line" data={data} options={options} className="h-full" />
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

      {/* AI Assistant Chat Input with Plus Button */}
      <div className="flex items-center w-full gap-3 pt-4 border-t border-gray-800/50">
        {/* Plus Button with OverlayPanel */}
        <div className="relative">
          <Button
            icon="pi pi-plus"
            className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 h-10 w-10 flex items-center justify-center rounded-lg shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
            onClick={(e) => op.current.toggle(e)}
            aria-haspopup
            aria-controls="action_popup"
          />
          <OverlayPanel
            ref={op}
            id="action_popup"
            style={{ width: "220px" }}
            className="dark:bg-gray-800 bg-white rounded-lg shadow-xl border border-gray-200/20 dark:border-gray-700/50"
            >
            <div className="flex flex-col space-y-2 p-3"> {/* ← added padding */}
                <Button
                label="Add Metric Alert"
                icon="pi pi-bell"
                className="p-button-text text-sm justify-start dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md transition-all"
                onClick={() => handleAction("Add Metric Alert")}
                />
                <Button
                label="Run Diagnostic"
                icon="pi pi-wrench"
                className="p-button-text text-sm justify-start dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md transition-all"
                onClick={() => handleAction("Run Diagnostic")}
                />
                <Button
                label="View Logs"
                icon="pi pi-external-link"
                className="p-button-text text-sm justify-start dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md transition-all"
                onClick={() => handleAction("View Logs")}
                />
            </div>
            </OverlayPanel>
        </div>

        {/* Input Field */}
        <InputTextarea
          className="flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-3 rounded-lg shadow-md border border-transparent focus:ring-4 focus:ring-indigo-500/40 focus:border-indigo-500 resize-none transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          style={{ minHeight: "2.5rem" }}
          autoResize
          value={chatValue}
          onChange={(e) => setChatValue(e.target.value)}
          rows={1}
          placeholder="Ask me anything about your infrastructure..."
        />

        {/* Send Button */}
        <Button
          onClick={handleSend}
          className="bg-indigo-600 text-white font-semibold h-10 w-10 flex items-center justify-center rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/40 transition-all duration-200"
          icon="pi pi-send"
          aria-label="Send Message"
          disabled={!chatValue.trim()}
        />
      </div>
    </main>
  );
}
