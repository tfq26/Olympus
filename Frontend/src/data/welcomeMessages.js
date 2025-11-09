export const welcomeMessages = {
  welcome_1: "Welcome to Olympus. How can I support your systems today?",
  welcome_2:
    "You're now connected to Olympus. What would you like to manage or explore?",
  welcome_3: "Hello from Olympus. Ready to oversee your infrastructure?",
  welcome_4: "Welcome back to Olympus. What task should we tackle first?",
  welcome_5:
    "Olympus online and standing by. How may I assist with your environment?",
};

export function getRandomWelcome() {
  const vals = Object.values(welcomeMessages);
  return vals[Math.floor(Math.random() * vals.length)];
}

export default welcomeMessages;
