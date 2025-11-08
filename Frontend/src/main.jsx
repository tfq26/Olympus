import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// --- PrimeReact Imports ---

// 1. Import the PrimeReactProvider component
import { PrimeReactProvider } from "primereact/api";

// 2. Import CSS resources (You may need to install these packages: primereact, primeicons)
// Note: This assumes you have PrimeReact installed.
import "primereact/resources/themes/saga-blue/theme.css"; // Choose your desired theme
import "primereact/resources/primereact.min.css"; // Core CSS
// FIXED: This line is corrected to use the standard import path for PrimeIcons.
import "primeicons/primeicons.css"; // PrimeIcons

// --- End PrimeReact Imports ---

import "./App.css";
import App from "./App.jsx";

// Optional: Define a configuration value object for the provider
const primeReactConfig = {
  ripple: true, // Enables the ripple effect globally for all components
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* 3. Wrap your App component with the PrimeReactProvider */}
    <PrimeReactProvider value={primeReactConfig}>
      <App />
    </PrimeReactProvider>
  </StrictMode>
);
