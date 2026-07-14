# Olympus
## Run everything with one command

Requirements:
- macOS with zsh
- python3, node, npm in PATH

Steps:
1. Copy and edit `.env` at the repo root as needed (ports, API keys).
2. From the repo root, run:

```
make dev
```

This starts:
- Flask backend on http://localhost:${FLASK_PORT:-5000}
- Node MCP server on http://localhost:8080
- Frontend (Vite) on http://localhost:5173

To stop the stack:

```
make stop
```

To check listeners:

```
make status
```

Notes:
- The dev script will terminate any existing listeners on the ports (Flask_PORT, 8080, 5173) to avoid conflicts.
- Node server automatically loads the root `.env`.
- Frontend expects its own `.env` under `frontend/` if you need custom VITE_ variables.

Modern infrastructure management platform with AI-powered natural language control, real-time monitoring, and intelligent log analysis.

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** 18+ (for frontend and Node MCP server)
- **Python** 3.11+ (for Flask monitoring backend)
- **Docker** (for Terraform MCP container)
- **AWS credentials** (optional, for live infrastructure)

### 2. Installation

```bash
# Clone the repository
git clone <repository-url>
cd Olympus

# Install all dependencies
npm run setup
```

This command:
- Installs root dependencies (concurrently)
- Installs Node MCP dependencies
- Installs Frontend dependencies
- Syncs environment variables to all services

### 3. Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

**Minimum required variables:**
```env
MODEL_API_KEY=your-nvidia-api-key
VITE_NODE_URL=http://localhost:8080
VITE_NODE_WS_URL=ws://localhost:8080
FLASK_URL=http://localhost:5000
FRONTEND_ORIGIN=http://localhost:5173
PERSIST_TERRAFORM=1
```

**For AWS integration:**
```env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_DEFAULT_REGION=us-east-1
```

After updating `.env`, sync it:
```bash
npm run sync-env
```

### 4. Start Development / Demo

Run the full stack with a single command (auto-installs, syncs env, and starts all services):
```bash
npm run demo
```

This starts:
- 🔵 **Flask Backend** (port 5000) - Monitoring & AI analysis
- 🟢 **Node MCP Server** (port 8080) - Primary backend & Terraform proxy
- 🟣 **Frontend** (port 5173) - React UI

Open your browser to **http://localhost:5173**

If you prefer to start without reinstalling/syncing each time, use:
```bash
npm run dev
```

## 📁 Project Structure

```
Olympus/
├── Frontend/               # React + Vite frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route pages (Dashboard, Logs, Tickets)
│   │   ├── lib/           # API client
│   │   └── hooks/         # Custom React hooks (WebSocket)
│   └── package.json
├── mcp-client/            # Node MCP server (primary backend)
│   ├── server.js          # Express server + WebSocket
│   ├── model/             # NVIDIA routing & NLP
│   └── package.json
├── backend/               # Flask monitoring backend
│   ├── app.py             # Flask app with monitoring endpoints
│   └── requirements.txt
├── mcps/                  # Terraform MCP (Docker)
├── scripts/               # Utility scripts
│   └── sync-env.mjs       # Environment sync tool
├── .env                   # Root environment config
└── package.json           # Root scripts (npm run dev)
```

## 🎯 Features

### Infrastructure Management
- **Natural Language Control**: "Create an S3 bucket for production logs"
- **Terraform Integration**: Automated infrastructure provisioning
- **Two-Phase Confirmation**: Safety checks before destructive operations
- **Real-time Feedback**: WebSocket updates during deployments

### Monitoring & Observability
- **Live Metrics Dashboard**: CPU, RAM, Network, Disk usage
- **Log Analysis**: Filter by status, resource, and AI-powered insights
- **Ticket Management**: Track issues and incidents
- **Auto-refresh**: Real-time data polling every 10-30 seconds

### AI-Powered Features
- **Intent Recognition**: Natural language → infrastructure actions
- **Log Analysis**: Intelligent pattern detection and recommendations
- **Chat Assistant**: Conversational interface for all operations

## 📚 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start all services (Flask + Node + Frontend) |
| `npm run dev:flask` | Start Flask backend only |
| `npm run dev:node` | Start Node MCP server only |
| `npm run dev:frontend` | Start Frontend only |
| `npm run setup` | Install all dependencies + sync env |
| `npm run install:all` | Install dependencies for all services |
| `npm run sync-env` | Sync root .env to all services |
| `npm run build` | Build frontend for production |
| `npm run test` | Run all tests |

## 🏗️ Architecture

```
Frontend (React/Vite :5173)
    ↓
Node MCP Server (Express :8080) ← Primary Backend
    ├→ Terraform MCP (Docker stdio)
    ├→ Flask Backend (Monitoring :5000)
    └→ NVIDIA API (NLP routing)
```

**Why Node is primary:**
- Single entry point reduces complexity
- WebSocket support for real-time updates
- Unified routing for all infrastructure + monitoring
- Proxies both Terraform and Flask endpoints

## 🔒 Security

- **Confirmation Flow**: Destructive operations require explicit user confirmation
- **Environment Isolation**: Sensitive keys in `.env` (gitignored)
- **CORS Protection**: Configured for localhost origins only
- **Firebase Auth**: Optional user authentication (configurable)

## 🧪 Testing

Run backend validation:
```bash
npm run test:node
```

Run frontend linting:
```bash
npm run test:frontend
```

Run full test suite:
```bash
npm test
```

## 📖 Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed deployment guide
- [Frontend/WEBSOCKET_INTEGRATION.md](./Frontend/WEBSOCKET_INTEGRATION.md) - WebSocket implementation
- [.env.example](./.env.example) - Environment variable reference

## 🐛 Troubleshooting

**Services won't start:**
1. Check all ports are free (5000, 5173, 8080)
2. Verify `.env` exists and has required variables
3. Run `npm run sync-env` to update service configs
4. Check Python dependencies: `pip install -r requirements.txt`

**Frontend can't connect to backend:**
1. Ensure `VITE_NODE_URL=http://localhost:8080` in `.env`
2. Restart frontend after changing env vars
3. Check Node server is running on port 8080

**Terraform operations fail:**
1. Verify Docker is running
2. Check AWS credentials in `.env`
3. Ensure `PERSIST_TERRAFORM=1` for state persistence

See [DEPLOYMENT.md](./DEPLOYMENT.md) for more troubleshooting tips.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

See [LICENSE](./LICENSE) file for details.
```