import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Dock } from "primereact/dock";
import { Tooltip } from "primereact/tooltip";
import "primeicons/primeicons.css";
import "primereact/resources/themes/lara-light-indigo/theme.css"; // or your chosen theme
import "primereact/resources/primereact.min.css";

export default function MenuBar() {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);

  // Define navigation items
  const items = [
    {
      label: "Home",
      icon: "pi pi-home",
      command: () => handleNavigate(0, "/"),
    },
    {
      label: "Resources",
      icon: "pi pi-database",
      command: () => handleNavigate(1, "/resources"),
    },
    {
      label: "Tickets",
      icon: "pi pi-ticket",
      command: () => handleNavigate(2, "/tickets"),
    },
    {
      label: "Logs",
      icon: "pi pi-file",
      command: () => handleNavigate(3, "/logs"),
    },
  ];

  const handleNavigate = (index, path) => {
    setActiveIndex(index);
    navigate(path);
  };

  // Custom dock item templates (for styling and tooltips)
  const itemTemplate = (item, options) => {
    const isActive = items[activeIndex].label === item.label;

    return (
      <>
        <Tooltip target={`.dock-icon-${item.label}`} content={item.label} position="top" />

        <div
          className={`dock-icon-${item.label} flex flex-col items-center justify-center transition-all duration-200 ${
            isActive ? "scale-110" : "scale-100"
          }`}
          onClick={item.command}
        >
          <i
            className={`${item.icon} text-2xl sm:text-3xl transition-colors duration-300 ${
              isActive
                ? "text-indigo-500 dark:text-indigo-400"
                : "text-gray-700 dark:text-gray-300"
            }`}
          />
        </div>
      </>
    );
  };

  return (
    <div className="fixed bottom-2 left-0 right-0 flex justify-center z-50 pointer-events-none">
      <div className="pointer-events-auto">
        <Dock
          model={items}
          position="bottom"
          itemTemplate={itemTemplate}
          className="backdrop-blur-lg rounded-2xl shadow-lg px-4 py-2"
        />
      </div>
    </div>
  );
}
