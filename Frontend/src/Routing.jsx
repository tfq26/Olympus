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
import LogsDashboard from "./pages/Logs/LogDashboard.jsx";
import MenuBar from "./components/MenuBar.jsx";

export const appRoutes = [
  { path: "/", element: <Home />, roles: ["user", "admin"] },
  { path: "/resources", element: <Dashboard />, roles: ["user", "admin"] },
  { path: "/tickets", element: <TicketsDashboard />, roles: ["user", "admin"] },
  { path: "/signin", element: <SignIn />, public: true, guestOnly: true },
  { path: "/logs", element: <LogsDashboard />, public: true }
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
      <div className="min-h-screen pb-20 text-text-primary bg-zinc-950 font-mono">
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

        {/* Bottom Dock Menu */}
        {user && <MenuBar />}
      </div>
    </Router>
  );
};

export default AppRouter;
