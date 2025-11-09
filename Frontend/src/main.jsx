import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrimeReactProvider } from "primereact/api";
import "primereact/resources/themes/saga-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "./App.css";

import App from "./App.jsx";
import { AuthProvider } from "./contexts/authContext.jsx";

const primeReactConfig = { ripple: true };

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PrimeReactProvider value={primeReactConfig}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </PrimeReactProvider>
  </StrictMode>
);
