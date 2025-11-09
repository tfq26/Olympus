import { Sidebar } from "primereact/sidebar";
import { Button } from "primereact/button";
import { Divider } from "primereact/divider";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const OverviewSidebar = () => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="h-full">
      {/* Sidebar Toggle Button */}
      <Button
        className="w-12 h-full flex flex-col items-center justify-center p-0 rounded-none 
                   bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-gray-800/60 
                   border-l border-gray-100/60 dark:border-gray-700/60 transition-all duration-200"
        onClick={() => setVisible(true)}
        icon="pi pi-bars"
        tooltipOptions={{ position: "left" }}
      >
      </Button>

      {/* Sidebar */}
      <Sidebar
        visible={visible}
        onHide={() => setVisible(false)}
        position="right"
        className="w-full sm:w-80 md:w-96 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md 
                   border-l border-gray-200/60 dark:border-gray-800/60 text-gray-900 dark:text-gray-100"
        modal={false}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              System Overview
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Summary of current environment and metrics
            </p>
          </div>

          {/* Profile Button */}
          <Button
            label="View Profile"
            icon="pi pi-user"
            className="w-full p-button-sm p-button-outlined"
            onClick={() => {
              setVisible(false);
              navigate("/profile");
            }}
          />

          <Divider className="!my-4" />

          {/* Context */}
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4">
            <h3 className="text-sm font-semibold mb-1 text-gray-700 dark:text-gray-200">
              Current Context
            </h3>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 
                            bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 
                            rounded-md text-xs font-medium">
              <i className="pi pi-database text-sm" />
              production-api
            </div>
          </div>

          {/* Metrics */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
              Key Metrics
            </h3>
            <ul className="space-y-2">
              {[
                { icon: "pi pi-chart-line", label: "CPU Load", value: "12%" },
                { icon: "pi pi-server", label: "Running Instances", value: "24" },
                { icon: "pi pi-bolt", label: "Error Rate", value: "0.1%" },
              ].map((item) => (
                <li
                  key={item.label}
                  className="flex justify-between items-center rounded-lg px-3 py-2.5
                             bg-gray-100/60 dark:bg-gray-800/70 hover:bg-gray-200/60 dark:hover:bg-gray-700/70
                             transition-all duration-200"
                >
                  <span className="flex items-center text-sm">
                    <i className={`${item.icon} mr-2 text-indigo-500`} />
                    {item.label}
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                    {item.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Button */}
          <Button
            label="View Full Dashboard"
            icon="pi pi-external-link"
            className="w-full p-button-sm p-button-outlined p-button-secondary"
          />
        </div>
      </Sidebar>
    </div>
  );
};

export default OverviewSidebar;
