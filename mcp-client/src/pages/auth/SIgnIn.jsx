import React, { useState } from "react";

import { useAuth } from "../../contexts/authContext.jsx";

const SignIn = () => {
  const { loginWithGoogle, loading } = useAuth();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    try {
      setError(null);
      setBusy(true);
      await loginWithGoogle();
    } catch (err) {
      console.error("Firebase login failed", err);
      setError("We couldn't sign you in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen  dark:bg-gray-900 p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            Welcome back
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Sign in with your Google account to continue.
          </p>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || busy}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
        >
          <span className="pi pi-google text-lg" aria-hidden />
          {loading || busy ? "Signing you in..." : "Sign in with Google"}
        </button>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
};

export default SignIn;
