export default function Home() {
  return (
    // 'h-screen' ensures it fills the entire view, typical for a desktop app's main window
    <main className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      
      {/* Optional: Title Bar Area for Mac/Windows Feel (Simulated) */}
      <header className="flex-shrink-0 w-full p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <p className="text-sm font-medium text-center">
          <span className="text-blue-500">Olympus</span> Desktop Application
        </p>
      </header>

      {/* Main Content Area: Centered in the middle of the application window */}
      <div className="flex-grow flex items-center justify-center p-8">
        <div className="max-w-xl w-full text-center bg-white dark:bg-gray-800 p-12 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
          <h1 className="text-5xl font-extrabold text-blue-700 dark:text-blue-400 mb-4 tracking-tight">
            <span role="img" aria-label="mountain" className="mr-2">🏔️</span> Olympus
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-10 leading-relaxed">
            A simple starting page for your cross-platform desktop application. You can edit this file to begin building out the main user interface.
          </p>
          
          <div className="flex justify-center space-x-4">
            <a
              className="px-6 py-3 text-base font-semibold text-white bg-green-500 rounded-md shadow-lg hover:bg-green-600 transition duration-150 ease-in-out transform hover:scale-[1.02]"
              href="#"
            >
              🚀 Get Started
            </a>
            <a
              className="px-6 py-3 text-base font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-150 ease-in-out"
              href="#"
            >
              Configuration
            </a>
          </div>
        </div>
      </div>
      
      {/* Optional: Status Bar at the bottom */}
      <footer className="flex-shrink-0 w-full p-1 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex justify-between px-3">
            <span>Status: Ready</span>
            <span>v1.0.0</span>
        </div>
      </footer>
    </main>
  );
}