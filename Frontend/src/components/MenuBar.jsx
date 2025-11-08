import { useState } from "react";
import { motion } from "framer-motion";
import "primeicons/primeicons.css";

const MenuBar = () => {
  const [hovered, setHovered] = useState(null);
  const [active, setActive] = useState(0);

  const items = [
    { label: "Home", icon: "pi pi-home", path: "/" },
    { label: "Resources", icon: "pi pi-database", path: "/resources" },
    { label: "Tickets", icon: "pi pi-ticket", path: "/tickets" },
    { label: "Logs", icon: "pi pi-file", path: "/logs" },
  ];

  return (
    <div className="flex justify-center p-4">
      <nav className="flex gap-2 bg-white/80 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg border border-gray-200">
        {items.map((item, i) => {
          const highlighted = hovered === i || active === i;

          return (
            <motion.button
              key={i}
              className="relative px-6 py-3 rounded-full flex items-center gap-3"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setActive(i)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {highlighted && (
                <motion.div
                  className="absolute inset-0 bg-blue-500 rounded-full"
                  layoutId="highlight"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: active === i ? 1 : 0.1 }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <i
                className={`${item.icon} relative z-10 text-xl`}
                style={{ color: highlighted ? "white" : "#64748b" }}
              />
              <span
                className="relative z-10 font-medium text-sm"
                style={{ color: highlighted ? "white" : "#64748b" }}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
};

export default MenuBar;
