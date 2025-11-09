#!/bin/bash

# Start Flask backend with virtual environment

cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Run: ./setup.sh"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Start Flask backend
echo "🚀 Starting Flask backend..."
python app.py

