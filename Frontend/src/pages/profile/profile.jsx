import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { auth, db } from "../../lib/firebase"; // adjust path if needed
import { doc, getDoc } from "firebase/firestore";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [extraData, setExtraData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch Firestore details (optional)
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) setExtraData(snap.data());
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-gray-400">
        Loading profile...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen text-gray-400">
        No user signed in.
      </div>
    );
  }

  return (
    <main className="p-6 md:p-10 space-y-8 transition-colors duration-300">
      {/* --- Header --- */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex justify-between items-center"
      >
        <h1 className="text-3xl font-extrabold text-gray-100">Profile Settings</h1>
      </motion.div>

      {/* --- Profile Card --- */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="rounded-2xl border border-gray-700/50 bg-white/10 dark:bg-zinc-900/60 backdrop-blur-md shadow-lg p-6 md:p-8 space-y-6"
      >
        {/* User Info */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center gap-6"
        >
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {user.displayName ? user.displayName[0] : "U"}
          </div>

          {/* Basic Info */}
          <div>
            <h2 className="text-2xl font-semibold text-gray-100">
              {user.displayName || "Unnamed User"}
            </h2>
            <p className="text-gray-400">{user.email}</p>
            <p className="text-sm text-indigo-400 font-medium">
              {extraData.role || "User"}
            </p>
          </div>
        </motion.div>

        {/* Account Details */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4"
        >
          <div className="bg-white/5 border border-gray-700/40 rounded-xl p-4">
            <p className="text-sm text-gray-400">Account Status</p>
            <p className="text-lg font-semibold text-green-400">
              {extraData.status || "Active"}
            </p>
          </div>

          <div className="bg-white/5 border border-gray-700/40 rounded-xl p-4">
            <p className="text-sm text-gray-400">User ID</p>
            <p className="text-lg font-mono text-gray-300">{user.uid}</p>
          </div>

          <div className="bg-white/5 border border-gray-700/40 rounded-xl p-4">
            <p className="text-sm text-gray-400">Joined</p>
            <p className="text-lg font-semibold text-gray-200">
              {extraData.joined || new Date(user.metadata.creationTime).toLocaleDateString()}
            </p>
          </div>
        </motion.div>

        {/* Placeholder Settings */}
        <motion.div
          variants={itemVariants}
          className="mt-8 space-y-4 border-t border-gray-800/40 pt-6"
        >
          <h3 className="text-lg font-semibold text-gray-100">Preferences</h3>
          <p className="text-gray-400 text-sm">
            Manage your preferences and connected integrations here.
          </p>

          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow-md hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/40 transition-all active:scale-95">
            Edit Profile
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
}
