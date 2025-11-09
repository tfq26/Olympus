import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import CloudDashboard from "./pages/CloudDashboard";
import ProfilePage from "./pages/profile/profile";
import SystemHealth from "./components/SystemHealth";
import MenuBar from "./components/MenuBar";
import OverviewSidebar from "./components/OverviewSidebar";

function App() {
  return (
    <BrowserRouter>
      {/* Full viewport height layout */}
      <div className="relative flex flex-col h-screen bg-app-surface font-mono text-white">
        {/* Top status header */}
        <SystemHealth status="Nominal" />

        {/* Main content + Sidebar container */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main scrollable content */}
          <div className="flex-1 overflow-y-auto pb-20 px-4 md:px-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<CloudDashboard />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Routes>
          </div>

          {/* Sidebar (desktop only) */}
          <div className="hidden lg:flex h-full border-l border-gray-800">
            <OverviewSidebar />
          </div>
        </div>

        {/* Fixed bottom MenuBar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950 border-t border-gray-800">
          <MenuBar />
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
