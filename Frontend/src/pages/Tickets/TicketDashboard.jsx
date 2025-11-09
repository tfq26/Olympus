import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "primereact/button";
import CreateTicketForm from "./TicketForm";

const initialTickets = [
  {
    id: "TCK-101",
    title: "Database Connection Error",
    status: "Open",
    priority: "High",
    assignee: "Alice",
    created: "2025-11-08",
  },
  {
    id: "TCK-102",
    title: "UI Bug in Dashboard",
    status: "In Progress",
    priority: "Medium",
    assignee: "Bob",
    created: "2025-11-06",
  },
  {
    id: "TCK-103",
    title: "Add Metrics Endpoint",
    status: "Resolved",
    priority: "Low",
    assignee: "Charlie",
    created: "2025-11-03",
  },
];

export default function TicketsDashboard() {
  const [tickets, setTickets] = useState(initialTickets);
  const [sortKey, setSortKey] = useState("id");
  const [sortOrder, setSortOrder] = useState("asc");
  const [showForm, setShowForm] = useState(false);

  const handleSort = (key) => {
    const order = sortKey === key && sortOrder === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortOrder(order);

    const sorted = [...tickets].sort((a, b) => {
      if (a[key] < b[key]) return order === "asc" ? -1 : 1;
      if (a[key] > b[key]) return order === "asc" ? 1 : -1;
      return 0;
    });

    setTickets(sorted);
  };

  const handleCreateTicket = (ticket) => {
    const id = `TCK-${100 + tickets.length + 1}`;
    setTickets([
      ...tickets,
      { ...ticket, id, created: new Date().toISOString().split("T")[0] },
    ]);
    setShowForm(false);
  };

  const getStatusStyle = (status) => {
    const styles = {
      Open: "bg-green-500/20 text-green-400",
      "In Progress": "bg-yellow-500/20 text-yellow-300",
      Resolved: "bg-blue-500/20 text-blue-400",
      Closed: "bg-gray-500/20 text-gray-300",
    };
    return styles[status] || "bg-gray-600/20 text-gray-300";
  };

  const getPriorityStyle = (priority) => {
    const styles = {
      Low: "bg-green-500/20 text-green-400",
      Medium: "bg-blue-500/20 text-blue-400",
      High: "bg-orange-500/20 text-orange-400",
      Critical: "bg-red-500/20 text-red-400",
    };
    return styles[priority] || "bg-gray-600/20 text-gray-300";
  };

  const renderSortIcon = (key) => {
    if (sortKey !== key) return <i className="pi pi-sort text-xs opacity-60" />;
    return sortOrder === "asc" ? (
      <i className="pi pi-sort-amount-up text-xs" />
    ) : (
      <i className="pi pi-sort-amount-down text-xs" />
    );
  };

  return (
    <main className="p-6 md:p-10 space-y-8 transition-colors duration-300">
      {!showForm ? (
        <>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex justify-between items-center"
          >
            <h1 className="text-3xl font-extrabold text-gray-100">
              Ticket Dashboard
            </h1>
            <Button
                iconPos="left"
                className="!h-12 !px-6 !text-base bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/40 transition-all flex items-center gap-2"
                onClick={() => setShowForm(true)}
                >
                <i className="pi pi-ticket text-lg"></i>
                <span>New Ticket</span>
                </Button>
                        </motion.div>

          {/* Custom Table */}
          <div className="overflow-x-auto rounded-2xl border border-gray-700/50 bg-white/10 dark:bg-zinc-900/60 backdrop-blur-md shadow-lg">
            <table className="w-full text-left text-sm md:text-base text-gray-200">
              <thead>
                <tr className="bg-white/5 border-b border-gray-700/40 text-indigo-300 text-sm uppercase">
                  {[
                    { key: "id", label: "ID" },
                    { key: "title", label: "Title" },
                    { key: "status", label: "Status" },
                    { key: "priority", label: "Priority" },
                    { key: "assignee", label: "Assignee" },
                    { key: "created", label: "Created" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 cursor-pointer select-none font-semibold"
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center gap-2">
                        {col.label}
                        {renderSortIcon(col.key)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="border-b border-gray-800/50 hover:bg-white/10 transition"
                  >
                    <td className="px-4 py-3 font-mono">{ticket.id}</td>
                    <td className="px-4 py-3">{ticket.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 text-xs rounded-full font-medium ${getStatusStyle(
                          ticket.status
                        )}`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 text-xs rounded-full font-medium ${getPriorityStyle(
                          ticket.priority
                        )}`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">{ticket.assignee}</td>
                    <td className="px-4 py-3">{ticket.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <CreateTicketForm
          onCreate={handleCreateTicket}
          onCancel={() => setShowForm(false)}
        />
      )}
    </main>
  );
}
