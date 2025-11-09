#!/bin/bash

echo "🛑 Stopping Olympus Services..."

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if [ -f .olympus.pids ]; then
    while read pid; do
        if ps -p $pid > /dev/null 2>&1; then
            kill $pid
            echo "✅ Stopped process $pid"
        fi
    done < .olympus.pids
    rm .olympus.pids
    echo "✨ All services stopped!"
else
    echo "⚠️  No PID file found. Trying to kill by name..."
    pkill -f "python app.py"
    pkill -f "node server.js"
    pkill -f "npm run dev"
    echo "✅ Done!"
fi

