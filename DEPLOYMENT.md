# Olympus Deployment & Environment Guide

This document explains how to run the full stack (Frontend, Flask backend, Node MCP client, Terraform MCP server) with a unified environment configuration.

## 1. Unified Environment Strategy

All shared variables live in the repository root `.env` file. Each service loads from it:

- Flask (`app.py`) uses `python-dotenv` via `load_dotenv()`.
- Node MCP (`mcp-client/server.js`) loads the root `.env` first, then its own `mcp-client/.env` override.
- Frontend (Vite) reads variables from `Frontend/.env.local` (only `VITE_` prefixed keys). A sync script creates/copies them from root.

### Root `.env` Example
See `.env.example` for all supported variables.

Required (minimum):
```
MODEL_API_KEY=your-nvidia-api-key
FLASK_URL=http://localhost:5000
FRONTEND_ORIGIN=http://localhost:5173
PERSIST_TERRAFORM=1
VITE_NODE_WS_URL=ws://localhost:8080
VITE_FLASK_URL=http://localhost:5000
```

Terraform / AWS variables (if using live AWS):
```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
```

Firebase (if auth enabled):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 2. Syncing Environment Files

After creating root `.env` run:
```
node scripts/sync-env.mjs
```
This will:
- Copy full `.env` to `mcp-client/.env`.
- Extract `VITE_` vars into `Frontend/.env.local`.

Re-run whenever `.env` changes.

## 3. Service Ports & Architecture

**Optimized Flow:**
```
Frontend (React/Vite) → Node MCP Server (Primary Backend)
                         ├→ Terraform MCP (Docker stdio)
                         ├→ Flask (Monitoring/AI endpoints)
                         └→ NVIDIA API (Natural language routing)
```

| Service            | Port | Role                                        |
|--------------------|------|---------------------------------------------|
| **Node MCP Client** | 8080 | **Primary backend** - HTTP + WebSocket + Terraform proxy + NVIDIA routing |
| Frontend (Vite)    | 5173 | Dev server, reads VITE_* vars              |
| Flask Backend      | 5000 | Monitoring endpoints (metrics, logs, tickets, AI analysis) |
| Terraform MCP (Docker) | (container) | Accessed via stdio by Node |

**Why Node is primary:**
- Single entry point for frontend (simpler architecture)
- WebSocket support for real-time chat
- Already proxies both Terraform AND Flask monitoring endpoints
- NVIDIA natural language routing built-in
- Reduces network hops: Frontend → Node → Terraform (vs Frontend → Flask → Node → Terraform)

## 4. Startup Sequence (Local Dev)

### Quick Start (Single Command)

From the repository root, run all services at once:
```bash
npm run dev
```

This uses `concurrently` to start:
- **Flask backend** (port 5000) - Blue output
- **Node MCP server** (port 8080) - Green output  
- **Frontend** (port 5173) - Magenta output

All services run in parallel with color-coded logs for easy debugging.

### Manual Startup (Alternative)

If you prefer to run services individually or need more control:

1. Ensure dependencies installed:
```bash
pip install -r requirements.txt
npm --prefix mcp-client install
npm --prefix Frontend install
```

2. Build / pull Terraform MCP Docker image if needed:
```bash
# Example (adjust Dockerfile path if present)
docker build -t mcps-terraform ./mcps
```

3. **Start Node MCP server first** (primary backend):
```bash
node mcp-client/server.js
```
   - Listens on port 8080
   - Provides infrastructure, monitoring proxy, and NLP endpoints

4. Start Flask backend (monitoring/AI):
```bash
python app.py
```
   - Listens on port 5000
   - Node proxies monitoring requests here

5. Start Frontend:
```bash
npm --prefix Frontend run dev
```
   - Opens on http://localhost:5173
   - Connects to Node MCP (8080) as primary backend

6. Test:
   - Chat connects to `ws://localhost:8080` (WebSocket)
   - Infrastructure ops go to `http://localhost:8080/terraform/*`
   - Natural language goes to `http://localhost:8080/nlp`

## 5. Testing NLP → Tool Flow

**Direct to Node (recommended):**
```bash
curl -X POST http://localhost:8080/nlp \
  -H 'Content-Type: application/json' \
  -d '{"message":"Create an S3 bucket named demo-bucket-123"}'
```
Expected: JSON with chosen tool (`createS3Bucket`) and execution result.

**Via Flask (legacy path):**
```bash
curl -X POST http://localhost:5000/infra/nlp \
  -H 'Content-Type: application/json' \
  -d '{"message":"Destroy S3 bucket demo-bucket-123"}'
```
(Flask forwards to Node internally)

## 6. Environment Variable Precedence

1. Node loads root `.env` then local `mcp-client/.env` (local overrides win).
2. Frontend only sees variables prefixed with `VITE_` from `Frontend/.env.local`.
3. Flask loads root `.env` early; all `os.getenv(...)` calls can access them.

## 7. Adding New Variables

1. Add to root `.env` and `.env.example`.
2. Re-run `node scripts/sync-env.mjs`.
3. In Frontend, reference with `import.meta.env.VITE_NEW_VAR` (must have `VITE_` prefix).
4. In Node/Flask, use `process.env.NEW_VAR` / `os.getenv('NEW_VAR')`.

## 8. Common Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Frontend can't reach Flask | CORS not configured or wrong origin | Ensure `FRONTEND_ORIGIN` matches dev URL |
| WebSocket fails to connect | Wrong `VITE_NODE_WS_URL` | Update root `.env`, sync env, reload frontend |
| NVIDIA router errors | Missing or invalid `MODEL_API_KEY` | Provide valid key in `.env` |
| Terraform tool timeouts | Docker container not built/running | Build image and verify Node logs |
| Type errors referencing `Frontend` and `frontend` | Both folders exist with different casing | **CRITICAL: Consolidate folders immediately** - Run `rm -rf frontend` to delete lowercase folder, OR merge unique files first. Having both causes import errors. |
| Dashboard shows no data | Flask backend not running or metrics.json missing | Start Flask with `python app.py`, ensure `mcp/monitor/mock/metrics.json` exists |
| "File name differs only in casing" errors | Duplicate Frontend/frontend folders | Delete one folder (see above) |

## 9. Production Considerations

- Use separate `.env.production` and load accordingly.
- Consider secrets manager (AWS SSM / Vault) instead of flat files.
- Lock down CORS origins to specific domains.
- Add health endpoints (`/health`) for Flask and Node.

## 10. Next Steps / Enhancements

- Add automated env validation script.
- Add basic integration tests hitting Flask + Node + Terraform path.
- Introduce Docker Compose to orchestrate all services.

---
**You now have a unified environment strategy.** Keep `.env.example` updated whenever new variables are introduced.
