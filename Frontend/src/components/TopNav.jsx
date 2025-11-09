import { NavLink } from "react-router-dom";
import { Badge } from "primereact/badge";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { checkAwsCredentials } from "../lib/api.js";
import { useAuth } from "../contexts/authContext.jsx";
import { canPerform } from "../lib/permissions.js";

export default function TopNav() {
  const { user } = useAuth();
  const [status, setStatus] = useState("Nominal");
  const [indicatorColor, setIndicatorColor] = useState("rgb(16, 185, 129)");
  const linkBase =
    "px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150";
  const inactive = "text-gray-300 hover:text-white hover:bg-gray-800";
  const active = "text-white bg-gray-800";

  const navItems = [
    { to: "/", label: "Home", icon: "pi pi-home" },
    { to: "/resources", label: "Resources", icon: "pi pi-database" },
    { to: "/tickets", label: "Tickets", icon: "pi pi-ticket" },
    { to: "/logs", label: "Logs", icon: "pi pi-file" },
    { to: "/profile", label: "Profile", icon: "pi pi-user" },
  ];

  // Add Manage link for admin/engineer users
  if (user && (canPerform(user.role, "createResource") || canPerform(user.role, "deleteResource"))) {
    navItems.splice(2, 0, {
      to: "/resources/manage",
      label: "Manage",
      icon: "pi pi-cog",
    });
  }

  const colorMap = {
    Nominal: "rgb(16, 185, 129)", // emerald-500
    Warning: "rgb(245, 158, 11)", // amber-500
    Critical: "rgb(239, 68, 68)", // red-500
  };

  useEffect(() => {
    let cancelled = false;

    const compute = (res) => {
      // If basic STS ok but Dynamo error -> Warning; if both ok -> Nominal; if credentials missing -> Warning
      if (!res.ok) return "Warning";
      if (res.dynamo && res.dynamo !== 'ok' && res.dynamo !== 'skipped') return 'Warning';
      return 'Nominal';
    };

    const checkNow = async () => {
      try {
        const res = await checkAwsCredentials();
        const s = compute(res);
        if (!cancelled) {
          setStatus(s);
          setIndicatorColor(colorMap[s]);
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("Critical");
          setIndicatorColor(colorMap["Critical"]);
        }
      }
    };

    // initial check and interval refresh
    checkNow();
    const id = setInterval(checkNow, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <nav className="w-full border-b border-gray-800 bg-gray-900/80 backdrop-blur supports-backdrop-filter:bg-gray-900/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Left: Logo + System Health */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
             <span className="text-sm font-semibold tracking-wide text-white">
                Olympus
              </span>
            </div>

            {/* System Health Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-gray-800/50 border border-gray-700/50">
              <motion.div
                className="relative"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* Glow */}
                <span
                  className="absolute inset-0 rounded-full blur-xs opacity-60"
                  style={{ background: indicatorColor }}
                />
                {/* Core */}
                <Badge
                  value=""
                  style={{
                    background: indicatorColor,
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    position: "relative",
                    zIndex: 1,
                  }}
                />
              </motion.div>
              <span className="text-xs text-gray-300 font-medium">
                System: {status}
              </span>
            </div>
          </div>

          {/* Right: Nav Items */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? active : inactive}`
                }
              >
                <span className="inline-flex items-center gap-2">
                  <i className={`${item.icon} text-base`} />
                  <span className="hidden sm:inline">{item.label}</span>
                </span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
