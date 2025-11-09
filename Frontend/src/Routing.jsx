import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useAuth } from "./contexts/authContext.jsx";

import Home from "./pages/Home.jsx";
import SignIn from "./pages/auth/FirebaseSignIn.jsx";
import Dashboard from "./pages/Resources/dashboard.jsx";
import TicketsDashboard from "./pages/Tickets/TicketDashboard.jsx";
import NotFound from "./pages/error.jsx";
import LogsDashboard from "./pages/LogsView/LogDashboard.jsx";
import ProfilePage from "./pages/profile/profile.jsx";
import SystemHealth from "./components/SystemHealth.jsx";
import OverviewSidebar from "./components/OverviewSidebar.jsx";
import TopNav from "./components/TopNav.jsx";

export const appRoutes = [
  { path: "/", element: <Home />, roles: ["user", "admin"] },
  { path: "/resources", element: <Dashboard />, roles: ["user", "admin"] },
  { path: "/tickets", element: <TicketsDashboard />, roles: ["user", "admin"] },
  { path: "/signin", element: <SignIn />, public: true, guestOnly: true },
  { path: "/logs", element: <LogsDashboard />, public: true },
  { path: "/profile", element: <ProfilePage />, public: true },
];

const ProtectedRoute = ({ element, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!user) return <Navigate to="/signin" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role))
    return <Navigate to="/" replace />;
  return element;
};

const AppRouter = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading session...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="relative flex flex-col h-screen bg-app-surface font-mono text-white">
        {/* Top status header + navigation */}
        <SystemHealth status="Nominal" />
        <TopNav />

        {/* Main content + Sidebar container */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main scrollable content */}
          <div className="flex-1 overflow-y-auto pb-20 px-4 md:px-8 text-text-primary">
            <Routes>
              {appRoutes.map((route, i) => {
                if (route.public) {
                  const element =
                    user && route.guestOnly ? (
                      <Navigate to="/" replace />
                    ) : (
                      route.element
                    );
                  return <Route key={i} path={route.path} element={element} />;
                }

                return (
                  <Route
                    key={i}
                    path={route.path}
                    element={
                      <ProtectedRoute
                        element={route.element}
                        allowedRoles={route.roles}
                      />
                    }
                  />
                );
              })}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>

          {/* Sidebar (desktop only) */}
          <div className="hidden lg:flex h-full border-l border-gray-800">
            <OverviewSidebar />
          </div>
        </div>
      </div>
    </Router>
  );
};

export default AppRouter;
