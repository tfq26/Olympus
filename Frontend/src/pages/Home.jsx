import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { useState, useEffect } from "react";
import { getRandomWelcome } from "../data/welcomeMessages";
import { motion } from "framer-motion";

export default function Home() {
  const [value, setValue] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");

  useEffect(() => {
    setWelcomeMessage(getRandomWelcome());
  }, []);

  const handleSend = () => {
    console.log("Sending query:", value);
  };

  return (
    <main className="flex flex-col items-center justify-center p-8 pt-32 transition-colors duration-300">
      <div className="flex flex-col items-center justify-center max-w-4xl w-full px-4">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-6xl font-extrabold text-gray-100 text-center mb-10 tracking-tight"
        >
          {welcomeMessage}
        </motion.h1>

        <div className="flex items-center w-full gap-3 mt-4">
          <InputTextarea
            className="flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-4 rounded-xl shadow-lg border border-transparent focus:ring-4 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            style={{ minHeight: "3rem" }}
            autoResize
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={1}
            placeholder="Ask me anything about your infrastructure..."
          />
          <Button
            onClick={handleSend}
            className="bg-indigo-600 text-white font-semibold h-12 w-12 flex items-center justify-center rounded-xl shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition-all duration-200"
            icon="pi pi-send"
            aria-label="Send Message"
            disabled={!value.trim()}
          />
        </div>
      </div>
    </main>
  );
}
