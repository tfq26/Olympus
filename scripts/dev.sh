#!/usr/bin/env bash
set -euo pipefail

# Unified dev startup script
# Starts: Python Flask backend, Node MCP server, Frontend Vite dev server
# Uses macOS zsh environment; assumes python3, node, npm installed.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Load .env into environment for this script (export only simple KEY=VAL lines)
if [[ -f .env ]]; then
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env | xargs)
fi

FLASK_PORT="${FLASK_PORT:-5000}"
FRONTEND_DIR="$ROOT_DIR/frontend"
MCP_DIR="$ROOT_DIR/mcp-client"

log() { printf "\e[32m[dev]\e[0m %s\n" "$*"; }
warn() { printf "\e[33m[warn]\e[0m %s\n" "$*"; }
err() { printf "\e[31m[err]\e[0m %s\n" "$*"; }

# Check prerequisites
command -v python3 >/dev/null || { err "python3 not found"; exit 1; }
command -v node >/dev/null || { err "node not found"; exit 1; }
command -v npm >/dev/null || { err "npm not found"; exit 1; }

# Kill previous processes on known ports to avoid conflicts
for PORT in "$FLASK_PORT" 8080 5173; do
  PIDS=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)
  if [[ -n "$PIDS" ]]; then
    log "Killing processes on port $PORT: $PIDS"
    kill -9 $PIDS || true
  fi
done

# Start Flask backend
log "Starting Flask backend on port $FLASK_PORT" 
(
  cd "$ROOT_DIR" && FLASK_PORT="$FLASK_PORT" python3 app.py
) &
FLASK_PID=$!
log "Flask PID: $FLASK_PID"

# Wait briefly for Flask to bind
sleep 2

# Health check Flask
if curl -fsS "http://localhost:$FLASK_PORT/monitor/mock/logs" >/dev/null; then
  log "Flask mock logs endpoint reachable"
else
  warn "Flask mock logs endpoint not reachable yet"
fi

# Start Node MCP server
log "Starting Node MCP server on port 8080"
(
  cd "$MCP_DIR" && node server.js
) &
NODE_PID=$!
log "Node MCP PID: $NODE_PID"

# Wait for Node
sleep 2
if curl -fsS "http://localhost:8080/health" >/dev/null; then
  log "MCP health OK"
else
  warn "MCP health endpoint not responding yet"
fi

# Start Frontend Vite dev server
log "Starting Frontend Vite dev server on port 5173"
(
  cd "$FRONTEND_DIR" && npm run dev
) &
VITE_PID=$!
log "Vite PID: $VITE_PID"

# Summary
log "All processes started. Use Ctrl+C to stop."
log "Flask:   http://localhost:$FLASK_PORT"
log "Node MCP: http://localhost:8080"
log "Frontend: http://localhost:5173"

# Trap Ctrl+C to kill background processes
trap 'log "Stopping..."; kill $FLASK_PID $NODE_PID $VITE_PID 2>/dev/null || true; wait; log "Stopped."; exit 0' INT TERM

# Tail minimal logs (press Ctrl+C to exit)
log "Tailing process output (Ctrl+C to terminate)"
wait
