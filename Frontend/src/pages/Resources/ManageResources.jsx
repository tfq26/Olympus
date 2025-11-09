import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../contexts/authContext.jsx";
import { canPerform } from "../../lib/permissions.js";
import { getResources } from "../../lib/api.js";

export default function ManageResources() {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "EC2",
    region: "us-east-1",
    tags: "",
  });

  const canManage = user && (canPerform(user.role, "createResource") || canPerform(user.role, "deleteResource"));

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const data = await getResources();
      setResources(data.resources || []);
    } catch (error) {
      console.error("Failed to fetch resources:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!canPerform(user.role, "createResource")) {
      alert("You don't have permission to create resources");
      return;
    }

    try {
      // Call create resource API
      const tags = formData.tags ? formData.tags.split(",").map(t => t.trim()) : [];
      console.log("Creating resource:", { ...formData, tags });
      
      // TODO: Implement actual API call
      alert("Resource creation will be implemented via backend API");
      
      setShowCreateModal(false);
      setFormData({ name: "", type: "EC2", region: "us-east-1", tags: "" });
      fetchResources();
    } catch (error) {
      console.error("Failed to create resource:", error);
      alert("Failed to create resource");
    }
  };

  const handleDelete = async (resourceId) => {
    if (!canPerform(user.role, "deleteResource")) {
      alert("You don't have permission to delete resources");
      return;
    }

    if (!confirm(`Are you sure you want to delete resource ${resourceId}?`)) {
      return;
    }

    try {
      // TODO: Implement actual API call
      console.log("Deleting resource:", resourceId);
      alert("Resource deletion will be implemented via backend API");
      fetchResources();
    } catch (error) {
      console.error("Failed to delete resource:", error);
      alert("Failed to delete resource");
    }
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <i className="pi pi-lock text-6xl text-gray-500"></i>
          <h2 className="text-2xl font-bold text-gray-300">Access Denied</h2>
          <p className="text-gray-400">
            You need admin or engineer permissions to manage resources.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="p-6 md:p-10 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <h1 className="text-3xl font-extrabold text-gray-100">
          Manage Resources
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          <i className="pi pi-plus"></i>
          Create Resource
        </button>
      </motion.div>

      {/* Resources List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading resources...</div>
        ) : resources.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <i className="pi pi-inbox text-4xl mb-4"></i>
            <p>No resources found</p>
          </div>
        ) : (
          resources.map((resource) => (
            <motion.div
              key={resource.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-indigo-500/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-100 mb-2">
                    {resource.name || resource.id}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Type:</span>
                      <span className="ml-2 text-gray-200">{resource.type}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Region:</span>
                      <span className="ml-2 text-gray-200">{resource.region || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                        resource.status === "running" ? "bg-green-900/30 text-green-400" : "bg-gray-700 text-gray-300"
                      }`}>
                        {resource.status || "unknown"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">ID:</span>
                      <span className="ml-2 text-gray-200 font-mono text-xs">{resource.id}</span>
                    </div>
                  </div>
                  {resource.tags && resource.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {resource.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-indigo-900/30 border border-indigo-700/40 rounded text-xs text-indigo-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {canPerform(user.role, "deleteResource") && (
                  <button
                    onClick={() => handleDelete(resource.id)}
                    className="ml-4 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-400 rounded-lg transition-colors"
                    title="Delete Resource"
                  >
                    <i className="pi pi-trash"></i>
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-gray-100 mb-4">Create New Resource</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Resource Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:border-indigo-500 focus:outline-none"
                  placeholder="my-web-server"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="EC2">EC2 Instance</option>
                  <option value="S3">S3 Bucket</option>
                  <option value="Lambda">Lambda Function</option>
                  <option value="RDS">RDS Database</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Region
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="us-east-1">US East (N. Virginia)</option>
                  <option value="us-west-2">US West (Oregon)</option>
                  <option value="eu-west-1">EU (Ireland)</option>
                  <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:border-indigo-500 focus:outline-none"
                  placeholder="production, web, frontend"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreate}
                disabled={!formData.name.trim()}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: "", type: "EC2", region: "us-east-1", tags: "" });
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
