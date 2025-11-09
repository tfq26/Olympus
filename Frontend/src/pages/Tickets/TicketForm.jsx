import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "primereact/button";
import axios from "axios";
import { getResources } from "../../lib/api.js";

export default function CreateTicketForm({ onCreate, onCancel }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    priority: "Medium",
    assignee: "",
    resource_id: "",
    issue_type: "",
    customer_name: "",
    severity: "MEDIUM",
  });

  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [suggestedEmployee, setSuggestedEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Load employees and resources on mount
  useEffect(() => {
    loadEmployees();
    loadResources();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await axios.get("http://localhost:5001/monitor/employees");
      setEmployees(response.data.employees || []);
    } catch (error) {
      console.error("Failed to load employees:", error);
    }
  };

  const loadResources = async () => {
    try {
      const data = await getResources();
      const list = data.resources || data || [];
      // Normalize shape: ensure id & name fields exist
      const normalized = list.map(r => ({
        id: r.id || r.resource_id || r.instance_id || r.name,
        name: r.name || r.id || r.resource_id || r.instance_id || 'resource'
      })).filter(r => r.id);
      setResources(normalized);
    } catch (error) {
      console.error("Failed to load resources:", error);
    }
  };

  const handleAIAnalyze = async () => {
    if (!formData.resource_id) {
      alert("Please select a resource first");
      return;
    }

    setAiLoading(true);
    try {
      const response = await axios.post(
        `http://localhost:5001/monitor/metrics/analyze-and-create-tickets?resource_id=${formData.resource_id}`
      );

      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        const analysis = result.ai_analysis;

        setAiAnalysis(analysis);

        if (analysis.has_issue) {
          handleChange("title", `${analysis.severity}: ${analysis.issue_type || "Issue"} Detected`);
          handleChange("description", analysis.description || "");
          handleChange("severity", analysis.severity);
          handleChange("issue_type", analysis.issue_type || "general");
          handleChange("priority", mapSeverityToPriority(analysis.severity));

          if (result.ticket) {
            const ticket = result.ticket;
            if (ticket.suggested_employee_id || ticket.assigned_employee_ID) {
              const empId = ticket.assigned_employee_ID || ticket.suggested_employee_id;
              const employee = employees.find((e) => e.employee_id === empId);
              if (employee) {
                setSuggestedEmployee(employee);
                handleChange("assignee", employee.name);
              }
            }
          }
        } else {
          alert("No issues detected by AI for this resource.");
        }
      }
    } catch (error) {
      console.error("AI analysis failed:", error);
      alert("Failed to analyze resource. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const mapSeverityToPriority = (severity) => {
    const map = {
      CRITICAL: "Critical",
      HIGH: "High",
      MEDIUM: "Medium",
      LOW: "Low",
      OK: "Low",
    };
    return map[severity] || "Medium";
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const ticketData = {
        issue: formData.title,
        resource_id: formData.resource_id,
        severity: formData.severity,
        issue_type: formData.issue_type || "general",
        description: formData.description,
        customer_name: formData.customer_name || "Unknown",
      };

      const response = await axios.post("http://localhost:5001/monitor/tickets", ticketData);

      onCreate({
        ...response.data,
        assignee: formData.assignee,
      });
    } catch (error) {
      console.error("Failed to create ticket:", error);
      alert("Failed to create ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-100">Create New Ticket</h2>
        <Button
          icon="pi pi-times"
          className="p-button-text p-button-rounded"
          onClick={onCancel}
        />
      </div>

      <div className="flex justify-between items-center mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                currentStep >= step
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-700 text-gray-400"
              }`}
            >
              {step}
            </div>
            {step < 3 && (
              <div
                className={`w-20 h-1 mx-2 ${
                  currentStep > step ? "bg-indigo-600" : "bg-gray-700"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {currentStep === 1 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Resource *
            </label>
            <select
              value={formData.resource_id}
              onChange={(e) => handleChange("resource_id", e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Select a resource</option>
              {resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name} ({resource.id})
                </option>
              ))}
            </select>
          </div>

          <Button
            label={aiLoading ? "Analyzing..." : "AI Analyze Resource"}
            icon={aiLoading ? "pi pi-spin pi-spinner" : "pi pi-bolt"}
            onClick={handleAIAnalyze}
            disabled={!formData.resource_id || aiLoading}
            className="w-full bg-purple-600! hover:bg-purple-700! text-white! font-semibold! py-3! rounded-lg!"
          />

          {aiAnalysis && (
            <div className="p-4 bg-purple-900/30 border border-purple-700 rounded-lg">
              <h3 className="font-semibold text-purple-300 mb-2">AI Analysis Results</h3>
              <p className="text-sm text-gray-300">
                <strong>Severity:</strong> {aiAnalysis.severity}
              </p>
              <p className="text-sm text-gray-300">
                <strong>Issue Type:</strong> {aiAnalysis.issue_type}
              </p>
              <p className="text-sm text-gray-300 mt-2">{aiAnalysis.description}</p>
              {aiAnalysis.recommendations && (
                <p className="text-sm text-gray-400 mt-2">
                  <strong>Recommendations:</strong> {aiAnalysis.recommendations}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Brief description of the issue"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={4}
              placeholder="Detailed description of the issue"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Issue Type *
            </label>
            <select
              value={formData.issue_type}
              onChange={(e) => handleChange("issue_type", e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Select issue type</option>
              <option value="cpu_spike">CPU Spike</option>
              <option value="memory_leak">Memory Leak</option>
              <option value="disk_full">Disk Full</option>
              <option value="network_issue">Network Issue</option>
              <option value="security">Security</option>
              <option value="performance">Performance</option>
              <option value="error_log">Error Log</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="general">General</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Customer Name
            </label>
            <input
              type="text"
              value={formData.customer_name}
              onChange={(e) => handleChange("customer_name", e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Customer or client name"
            />
          </div>
        </motion.div>
      )}

      {currentStep === 2 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Priority *
            </label>
            <select
              value={formData.priority}
              onChange={(e) => handleChange("priority", e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Severity *
            </label>
            <select
              value={formData.severity}
              onChange={(e) => handleChange("severity", e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          {suggestedEmployee && (
            <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg">
              <h3 className="font-semibold text-green-300 mb-2">
                <i className="pi pi-sparkles mr-2"></i>
                AI Suggested Employee
              </h3>
              <p className="text-sm text-gray-300">
                <strong>Name:</strong> {suggestedEmployee.name}
              </p>
              <p className="text-sm text-gray-300">
                <strong>Experience:</strong> {suggestedEmployee.experience_level}
              </p>
              <p className="text-sm text-gray-300">
                <strong>Workload:</strong> {suggestedEmployee.current_workload} / {suggestedEmployee.max_workload}
              </p>
              <p className="text-sm text-gray-300">
                <strong>Skills:</strong> {suggestedEmployee.skills.join(", ")}
              </p>
              <p className="text-sm text-gray-300">
                <strong>Specializations:</strong> {suggestedEmployee.specializations.join(", ")}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Assignee
            </label>
            <select
              value={formData.assignee}
              onChange={(e) => handleChange("assignee", e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Auto-assign (AI will choose)</option>
              {employees.map((employee) => (
                <option key={employee.employee_id} value={employee.name}>
                  {employee.name} - {employee.experience_level} ({employee.current_workload}/{employee.max_workload})
                </option>
              ))}
            </select>
          </div>
        </motion.div>
      )}

      {currentStep === 3 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="space-y-4"
        >
          <h3 className="text-xl font-semibold text-gray-100 mb-4">Review Ticket</h3>
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg space-y-3">
            <div>
              <span className="text-sm text-gray-400">Resource:</span>
              <p className="text-gray-200 font-medium">{formData.resource_id}</p>
            </div>
            <div>
              <span className="text-sm text-gray-400">Title:</span>
              <p className="text-gray-200 font-medium">{formData.title}</p>
            </div>
            <div>
              <span className="text-sm text-gray-400">Description:</span>
              <p className="text-gray-200">{formData.description}</p>
            </div>
            <div>
              <span className="text-sm text-gray-400">Issue Type:</span>
              <p className="text-gray-200">{formData.issue_type}</p>
            </div>
            <div>
              <span className="text-sm text-gray-400">Priority:</span>
              <p className="text-gray-200">{formData.priority}</p>
            </div>
            <div>
              <span className="text-sm text-gray-400">Severity:</span>
              <p className="text-gray-200">{formData.severity}</p>
            </div>
            <div>
              <span className="text-sm text-gray-400">Assignee:</span>
              <p className="text-gray-200">{formData.assignee || "Auto-assign"}</p>
            </div>
            {formData.customer_name && (
              <div>
                <span className="text-sm text-gray-400">Customer:</span>
                <p className="text-gray-200">{formData.customer_name}</p>
              </div>
            )}
          </div>

          {aiAnalysis && (
            <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
              <h4 className="font-semibold text-blue-300 mb-2">AI Recommendations</h4>
              <p className="text-sm text-gray-300">{aiAnalysis.recommendations}</p>
            </div>
          )}
        </motion.div>
      )}

      <div className="flex justify-between mt-8">
        <Button
          label="Cancel"
          icon="pi pi-times"
          onClick={onCancel}
          className="p-button-text text-gray-400! hover:text-gray-200!"
        />

        <div className="flex gap-3">
          {currentStep > 1 && (
            <Button
              label="Previous"
              icon="pi pi-arrow-left"
              onClick={prevStep}
              className="bg-gray-700! hover:bg-gray-600! text-white! font-semibold! px-6! py-2! rounded-lg!"
            />
          )}

          {currentStep < 3 ? (
            <Button
              label="Next"
              icon="pi pi-arrow-right"
              iconPos="right"
              onClick={nextStep}
              disabled={
                (currentStep === 1 &&
                  (!formData.title ||
                    !formData.description ||
                    !formData.resource_id ||
                    !formData.issue_type)) ||
                (currentStep === 2 && !formData.priority)
              }
              className="bg-indigo-600! hover:bg-indigo-700! text-white! font-semibold! px-6! py-2! rounded-lg!"
            />
          ) : (
            <Button
              label={loading ? "Creating..." : "Create Ticket"}
              icon={loading ? "pi pi-spin pi-spinner" : "pi pi-check"}
              onClick={handleSubmit}
              disabled={loading}
              className="bg-green-600! hover:bg-green-700! text-white! font-semibold! px-6! py-2! rounded-lg!"
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
