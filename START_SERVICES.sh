#!/bin/bash

# Script to start all required services for the Olympus project

echo "=========================================="
echo "Starting Olympus Services"
echo "=========================================="

# Check if services are already running
if lsof -ti:5000 > /dev/null 2>&1; then
    echo "⚠️  Flask backend is already running on port 5000"
else
    echo "📦 Starting Flask backend..."
    cd "$(dirname "$0")"
    python3 app.py &
    FLASK_PID=$!
    echo "✅ Flask backend started (PID: $FLASK_PID)"
    sleep 2
fi

if lsof -ti:8080 > /dev/null 2>&1; then
    echo "⚠️  MCP server is already running on port 8080"
else
    echo "📦 Starting MCP server..."
    cd "$(dirname "$0")/mcp-client"
    npm start &
    MCP_PID=$!
    echo "✅ MCP server started (PID: $MCP_PID)"
    sleep 2
fi

echo ""
echo "=========================================="
echo "Service Status"
echo "=========================================="
if lsof -ti:5000 > /dev/null 2>&1; then
    echo "✅ Flask backend: RUNNING on port 5000"
else
    echo "❌ Flask backend: NOT RUNNING"
fi

if lsof -ti:8080 > /dev/null 2>&1; then
    echo "✅ MCP server: RUNNING on port 8080"
else
    echo "❌ MCP server: NOT RUNNING"
fi

echo ""
echo "=========================================="
echo "Ready to test!"
echo "=========================================="
echo "Test commands:"
echo "  - show recent logs from res_vm_001"
echo "  - show recent logs from ecs2"
echo "  - show first 50 logs from res_vm_001"
echo ""
echo "To stop services:"
echo "  pkill -f 'python3 app.py'"
echo "  pkill -f 'node.*server.js'"

