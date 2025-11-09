#!/bin/bash

echo "🚀 Starting Olympus Services..."

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Start Flask backend
echo "📦 Starting Flask Backend..."
source venv/bin/activate
python app.py > logs/flask.log 2>&1 &
FLASK_PID=$!
echo "✅ Flask running (PID: $FLASK_PID) - http://localhost:5000"

# Start MCP Server
echo "🔧 Starting MCP Server..."
cd mcp-client
node server.js > ../logs/mcp.log 2>&1 &
MCP_PID=$!
echo "✅ MCP Server running (PID: $MCP_PID) - ws://localhost:8080"

# Start Frontend
echo "🎨 Starting Frontend..."
cd ../Frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend running (PID: $FRONTEND_PID) - http://localhost:5173"

# Save PIDs to file for later cleanup
cd ..
echo "$FLASK_PID" > .olympus.pids
echo "$MCP_PID" >> .olympus.pids
echo "$FRONTEND_PID" >> .olympus.pids

echo ""
echo "✨ All services started!"
echo "📊 Flask Backend: http://localhost:5000"
echo "🔌 MCP Server: ws://localhost:8080"
echo "🌐 Frontend: http://localhost:5173"
echo ""
echo "To stop all services, run: ./stop_all.sh"
echo "Logs are in the logs/ directory"

