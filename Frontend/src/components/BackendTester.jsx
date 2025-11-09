import { useEffect, useState } from 'react';
import { pingBackend, nlp, NODE_BASE_URL } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';

export default function BackendTester() {
  const [ping, setPing] = useState(null);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await pingBackend();
        if (mounted) setPing(res);
      } catch (e) {
        if (mounted) setError(String(e.message || e));
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Show connection status indicator
  const isConnected = ping?.ok === true;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {/* Status Badge */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg backdrop-blur-md transition-all ${
          isConnected
            ? 'bg-green-900/40 border border-green-500/30 hover:bg-green-900/60'
            : 'bg-red-900/40 border border-red-500/30 hover:bg-red-900/60'
        }`}
        title={isConnected ? 'Backend Connected' : 'Backend Disconnected'}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}
        />
        <span className="text-xs font-medium text-gray-200">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        <i className={`pi ${isExpanded ? 'pi-chevron-down' : 'pi-chevron-up'} text-xs`} />
      </button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-14 right-0 w-80 p-4 rounded-xl border border-gray-700 bg-gray-900/95 backdrop-blur-md shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-200">Backend Status</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-gray-200 transition"
              >
                <i className="pi pi-times text-xs" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg">
                <span className="text-gray-400">Node MCP Server</span>
                <span
                  className={`font-mono ${
                    isConnected ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {isConnected ? '✓ Online' : '✗ Offline'}
                </span>
              </div>

              {ping && (
                <div className="py-2 px-3 bg-gray-800/50 rounded-lg">
                  <div className="text-gray-400 mb-1">Endpoint</div>
                  <div className="font-mono text-gray-300 text-xs break-all">
                    {NODE_BASE_URL}
                  </div>
                </div>
              )}

              {ping?.result && (
                <div className="py-2 px-3 bg-gray-800/50 rounded-lg">
                  <div className="text-gray-400 mb-1">Message</div>
                  <div className="text-green-400">{ping.result}</div>
                </div>
              )}

              {error && (
                <div className="py-2 px-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <div className="text-red-400">{error}</div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
