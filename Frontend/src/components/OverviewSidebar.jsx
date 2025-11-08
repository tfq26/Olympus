import { Sidebar } from "primereact/sidebar";
import { Button } from "primereact/button";
import { useState } from "react";

const OverviewSidebar = () => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex justify-end bg-text-secondary rounded-tl-full rounded-bl-full p-4 hover:bg-text-secondary/90 transition-colors duration-300">
      <Button
        className="p-button-rounded p-button-info flex flex-col"
        onClick={() => setVisible(true)}
        maskClassName="backdrop-blur-sm"
      >
        <i className="pi pi-chevron-down text-text-primary text-sm -mb-1"></i>
        <i className="pi pi-chevron-up text-text-primary text-sm"></i>
      </Button>
      <Sidebar
        visible={visible}
        onHide={() => setVisible(false)}
        position="right"
        className="w-auto bg-text-secondary"
      >
        <div className="p-4 mr-20">
          <h2 className="text-xl mb-4">
            <b>Current Context:</b> <i>production-api</i>
          </h2>
          {/* Add more overview details here as needed */}
        </div>
      </Sidebar>
    </div>
  );
};

export default OverviewSidebar;
