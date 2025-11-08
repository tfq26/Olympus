// App.jsx
import Home from "./pages/Home";
import SystemHealth from "./components/SystemHealth";
import MenuBar from "./components/MenuBar";
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-app-surface pb-20 font-mono">
        <SystemHealth status="Nominal" />
        {/* Main Content */}
        <Home />

        {/* Fixed Dock navigation at the bottom */}
        <MenuBar />
        {/* <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/logs" element={<Logs />} />
        </Routes> */}
      </div>
    </BrowserRouter>
  );
}

export default App;
