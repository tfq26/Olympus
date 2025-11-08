// App.jsx
import React from 'react';
import Home from './pages/Home';
import DockMenu from './components/DockMenu';

function App() {
  return (
    // Main container: full viewport height, light background, and padding at bottom
    <div className="min-h-screen bg-gray-100 pb-20">
      
      {/* Main Content */}
      <Home />

      {/* Spacer to prevent content overlap with Dock */}
      <div className="h-20 sm:h-24"></div>

      {/* Fixed Dock navigation at the bottom */}
      <DockMenu position="bottom" />
    </div>
  );
}

export default App;
