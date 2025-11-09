import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/authContext.jsx";
import Home from "./pages/Home";
import CloudDashboard from "./pages/Resources/dashboard.jsx";
import ManageResources from "./pages/Resources/ManageResources.jsx";
import OverviewSidebar from "./components/OverviewSidebar";
import TicketDashboard from "./pages/Tickets/TicketDashboard.jsx";
import TicketForm from "./pages/Tickets/TicketForm.jsx";
import LogDashboard from "./pages/LogsView/LogDashboard.jsx";
import Profile from "./pages/profile/profile.jsx";
import ErrorPage from "./pages/error.jsx";
import SignIn from "./pages/auth/FirebaseSignIn.jsx";
import TopNav from "./components/TopNav.jsx";

// Protected route wrapper
const ProtectedRoute = ({ element }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading session...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/signin" replace />;
  return element;
};

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-surface">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {/* Full viewport height layout */}
      <div className="relative flex flex-col h-screen bg-app-surface font-mono text-white">
        {/* Top navigation (only show when logged in) */}
        {user && <TopNav />}

        {/* Main content + Sidebar container */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main scrollable content */}
          <div className="flex-1 overflow-y-auto pb-20 px-4 md:px-8">
            <Routes>
              {/* Public route */}
              <Route
                path="/signin"
                element={user ? <Navigate to="/" replace /> : <SignIn />}
              />

              {/* Protected routes */}
              <Route path="/" element={<ProtectedRoute element={<Home />} />} />
              <Route
                path="/resources"
                element={<ProtectedRoute element={<CloudDashboard />} />}
              />
              <Route
                path="/resources/manage"
                element={<ProtectedRoute element={<ManageResources />} />}
              />
              <Route
                path="/tickets"
                element={<ProtectedRoute element={<TicketDashboard />} />}
              />
              <Route
                path="/tickets/new"
                element={<ProtectedRoute element={<TicketForm />} />}
              />
              <Route
                path="/logs"
                element={<ProtectedRoute element={<LogDashboard />} />}
              />
              <Route
                path="/profile"
                element={<ProtectedRoute element={<Profile />} />}
              />
              <Route path="*" element={<ErrorPage />} />
            </Routes>
          </div>

          {/* Sidebar (desktop only, only show when logged in) */}
          {user && (
            <div className="hidden lg:flex h-full border-l border-gray-800">
              <OverviewSidebar />
            </div>
          )}
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
