import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function TicketForm({ onCreate, onCancel }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    priority: "",
    assignee: "",
  });

  const priorities = ["Low", "Medium", "High", "Critical"];
  const categories = ["Bug", "Feature Request", "Performance", "Security"];

  const updateField = (key, value) => setForm({ ...form, [key]: value });

  const nextStep = () => setStep((s) => Math.min(s + 1, 2));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));
  const handleSubmit = () => onCreate(form);

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-2xl mx-auto bg-white/10 dark:bg-gray-900/60 border border-gray-700/50 backdrop-blur-md rounded-2xl shadow-lg p-8 space-y-6"
    >
      {/* --- Header --- */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-extrabold text-gray-100">
          {step === 0
            ? "Ticket Details"
            : step === 1
            ? "Assignment"
            : "Review & Submit"}
        </h2>
        <div className="text-sm text-gray-400">
          Step {step + 1} of 3
        </div>
      </div>

      {/* --- Progress Bar --- */}
      <div className="w-full bg-gray-800/40 rounded-full h-2 overflow-hidden">
        <div
          className="bg-indigo-500 h-full transition-all duration-300"
          style={{ width: `${((step + 1) / 3) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        {/* --- Step 1: Ticket Details --- */}
        {step === 0 && (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Enter ticket title"
                className="w-full px-4 py-2 rounded-lg bg-gray-800/60 border border-gray-700 text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={5}
                placeholder="Describe the issue or request..."
                className="w-full px-4 py-2 rounded-lg bg-gray-800/60 border border-gray-700 text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-800/60 border border-gray-700 text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        )}

        {/* --- Step 2: Assignment --- */}
        {step === 1 && (
          <motion.div
            key="assignment"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Priority
              </label>
              <div className="grid grid-cols-2 gap-3">
                {priorities.map((p) => (
                  <button
                    key={p}
                    onClick={() => updateField("priority", p)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      form.priority === p
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Assignee
              </label>
              <input
                type="text"
                value={form.assignee}
                onChange={(e) => updateField("assignee", e.target.value)}
                placeholder="Enter assignee name"
                className="w-full px-4 py-2 rounded-lg bg-gray-800/60 border border-gray-700 text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </motion.div>
        )}

        {/* --- Step 3: Review --- */}
        {step === 2 && (
          <motion.div
            key="review"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="bg-gray-800/60 border border-gray-700/50 p-5 rounded-lg space-y-3">
              <h3 className="text-lg font-semibold text-gray-100">
                Review Ticket Details
              </h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li><strong>Title:</strong> {form.title || "—"}</li>
                <li><strong>Description:</strong> {form.description || "—"}</li>
                <li><strong>Category:</strong> {form.category || "—"}</li>
                <li><strong>Priority:</strong> {form.priority || "—"}</li>
                <li><strong>Assignee:</strong> {form.assignee || "—"}</li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Navigation Buttons --- */}
      <div className="flex justify-between items-center pt-4">
        <button
          onClick={prevStep}
          disabled={step === 0}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            step === 0
              ? "text-gray-600 cursor-not-allowed"
              : "text-gray-300 hover:text-white"
          }`}
        >
          ← Back
        </button>

        <div className="flex gap-2">
          {step < 2 ? (
            <button
              onClick={nextStep}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 mx-2 py-2 rounded-lg shadow-md transition-all"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-lg shadow-md transition-all"
            >
              Create Ticket
            </button>
          )}
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-100 font-medium transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}
