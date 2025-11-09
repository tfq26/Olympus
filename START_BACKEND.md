# How to Start Flask Backend

## ✅ Dependencies Installed!

All Python dependencies have been installed in a virtual environment.

## Quick Start

### Option 1: Use the Start Script (Recommended)
```bash
./START_FLASK.sh
```

### Option 2: Manual Start
```bash
# Activate virtual environment
source venv/bin/activate

# Start Flask backend
python app.py
```

## Verify It's Working

Once Flask backend starts, you should see:
```
 * Running on http://127.0.0.1:5000
```

Test it:
```bash
curl http://localhost:5000/monitor/mock/logs?resource_id=res_vm_001
```

## Full Setup (First Time Only)

If you need to set up from scratch:
```bash
./setup.sh
```

This will:
1. Create virtual environment
2. Install all dependencies
3. Set up the project

## Starting All Services

```bash
# Terminal 1: Flask Backend
./START_FLASK.sh
# OR
source venv/bin/activate && python app.py

# Terminal 2: MCP Server
cd mcp-client && npm start

# Terminal 3: Frontend (if needed)
cd Frontend && npm run dev
```

## Troubleshooting

### "ModuleNotFoundError: No module named 'openai'"
- Make sure you activated the virtual environment: `source venv/bin/activate`
- If still fails, run: `pip install -r requirements.txt`

### "Port 5000 already in use"
- Another process is using port 5000
- Find and kill it: `lsof -ti:5000 | xargs kill`
- Or change port in `app.py`

### "Cannot connect to DynamoDB"
- Check AWS credentials are configured
- Or logs will fall back to JSON file (which is fine for testing)

## Next Steps

1. Start Flask backend: `./START_FLASK.sh`
2. Test in chatbot: `show recent logs from res_vm_001`
3. You should now see logs instead of error messages!

