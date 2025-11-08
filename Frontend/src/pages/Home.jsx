export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-primary p-8 rounded-xl shadow-2xl">
        <h1 className="text-6xl font-extrabold text-blue-600 dark:text-blue-400 mb-4 tracking-tighter">
          Olympus
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          A simple starting page — edit this to continue building your app.
        </p>
        <div className="flex justify-center">
          <a
            className="inline-block px-8 py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 transition duration-300 ease-in-out transform hover:scale-105"
            href="#"
          >
            Get started
          </a>
        </div>
      </div>
    </main>
  );
}
