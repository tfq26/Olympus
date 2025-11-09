#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

kill_by_port() {
  local port=$1
  local pids
  pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN || true)
  if [[ -n "$pids" ]]; then
    echo "Killing processes on port $port: $pids"
    kill -9 $pids || true
  else
    echo "No listener on port $port"
  fi
}

kill_by_port "${FLASK_PORT:-5000}"
kill_by_port 8080
kill_by_port 5173

echo "Done."