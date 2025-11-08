import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { useState, useEffect } from "react";
import { getRandomWelcome } from "../data/welcomeMessages";
import { motion } from "motion/react";
import OverviewSidebar from "../components/OverviewSidebar";

export default function Home() {
  const [value, setValue] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");

  useEffect(() => {
    setWelcomeMessage(getRandomWelcome());
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="mb-8 flex-row">
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="text-4xl font-bold text-text-primary text-center"
        >
          {welcomeMessage}
        </motion.h1>
        <div className="flex items-center justify-center w-full gap-4 mt-6 max-w-6xl mx-auto">
          <InputTextarea
            className="flex-1 bg-secondary p-3 rounded-lg shadow-2xl border border-primary w-full max-w-3xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
            style={{ minHeight: "2rem" }}
            autoResize
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={1}
            placeholder="Ask me anything about your infrastructure..."
          />
          <Button
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            icon="pi pi-send"
          />
        </div>
      </div>
      <div className="absolute right-0 align-middle">
        <OverviewSidebar />
      </div>
    </main>
  );
}
