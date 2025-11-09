import { useEffect, useState } from 'react';
import { pingBackend, nlp, NODE_BASE_URL } from '../lib/api';

export default function BackendTester() {
  const [ping, setPing] = useState(null);
  const [error, setError] = useState(null);
  const [prompt, setPrompt] = useState('Say hello');
  const [reply, setReply] = useState(null);

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

  const onSend = async () => {
    setReply(null);
    setError(null);
    try {
      const res = await nlp(prompt);
      setReply(res);
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto my-6 p-4 rounded-xl border border-gray-800 bg-zinc-950/60">
      <div className="text-sm text-gray-400 mb-2">Node MCP base URL: <code>{NODE_BASE_URL}</code></div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-mono">Ping:</span>
        {ping ? (
          <pre className="text-xs bg-black/40 p-2 rounded border border-gray-800 overflow-x-auto">{JSON.stringify(ping, null, 2)}</pre>
        ) : error ? (
          <span className="text-red-400">{error}</span>
        ) : (
          <span className="text-gray-500">Loading...</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm">Test NLP via Flask</label>
        <textarea
          className="w-full p-3 bg-white/5 border-2 border-primary rounded-xl"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
        <button
          onClick={onSend}
          className="self-start px-4 py-2 rounded-lg bg-primary text-black font-semibold border border-primary hover:bg-transparent hover:text-primary transition"
        >Send</button>
        {reply && (
          <pre className="mt-2 text-xs bg-black/40 p-3 rounded border border-gray-800 overflow-x-auto">{JSON.stringify(reply, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
