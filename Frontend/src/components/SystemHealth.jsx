import { Badge } from "primereact/badge";
import { motion } from "motion/react";

export default function SystemHealthIndicator({ status = "Nominal" }) {
  const colorMap = {
    Nominal: "var(--color-indicator-nominal)",
    Warning: "var(--color-indicator-warning)",
    Critical: "var(--color-indicator-critical)",
  };

  const indicatorColor = colorMap[status];

  return (
    <div className="flex flex-row p-2 gap-2 items-center">
      <motion.div
        className="relative"
        animate={{ scale: [1, 1.25, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, easing: "ease-in-out" }}
      >
        {/* Glow Aura */}
        <span
          className="absolute inset-0 rounded-full blur-[6px] opacity-70"
          style={{ background: indicatorColor }}
        />

        {/* Core Dot */}
        <Badge
          value=""
          style={{
            background: indicatorColor,
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            position: "relative",
            zIndex: 1,
          }}
        />
      </motion.div>

      <h3 className="text-sm text-text-primary">System Health: {status}</h3>
    </div>
  );
}
