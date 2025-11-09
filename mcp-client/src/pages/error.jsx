// src/pages/NotFound.jsx
import React from 'react';
import { Button } from 'primereact/button';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen  dark:bg-gray-900 text-center p-6">
      <div className="max-w-md">
        <h1 className="text-6xl font-extrabold text-blue-600 dark:text-blue-400 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
          Page Not Found
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Oops! The page you’re looking for doesn’t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            label="Go Home"
            icon="pi pi-home"
            className="p-button-rounded p-button-primary"
            onClick={() => navigate('/')}
          />
          <Button
            label="Contact Support"
            icon="pi pi-envelope"
            className="p-button-rounded p-button-outlined"
            onClick={() => (window.location.href = 'mailto:support@yourapp.com')}
          />
        </div>
      </div>
    </div>
  );
};

export default NotFound;
