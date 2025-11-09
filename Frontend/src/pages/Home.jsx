import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { useState, useEffect } from "react";
import { getRandomWelcome } from "../data/welcomeMessages";
import { motion } from "framer-motion";
import ChatBot from "../components/FullGeneralChatBot";

export default function Home() {
  const [value, setValue] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");

  useEffect(() => {
    setWelcomeMessage(getRandomWelcome());
  }, []);

  const handleSend = () => {
    // render ChatBot and pass the current textarea value as the initial message
    if (!value || !value.trim()) return;
    console.log("Home: submitting value ->", value);
    setShowChat(true);
    setChatInitial(value);
    setValue("");
    console.log("Home: showChat set to true, chatInitial ->", value);
  };

  const [showChat, setShowChat] = useState(false);
  const [chatInitial, setChatInitial] = useState("");

  return (
    <main className="flex flex-col items-center justify-center p-8 pt-32 transition-colors duration-300">
      <ChatBot
        welcomeMessage={welcomeMessage}
        placeholder="Ask me anything about your infrastructure..."
      />
    </main>
  );
}
