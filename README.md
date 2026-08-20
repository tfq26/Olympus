# Olympus

AI-operated cloud infrastructure platform: monitor AWS resources, triage incidents, and provision/destroy infrastructure — all through natural-language chat instead of the AWS console or raw Terraform.

Built at a hackathon as a full-stack system spanning a React frontend, two backend services (Flask + Node), an LLM-powered routing/analysis layer, and containerized Terraform execution.

## What It Does

Olympus gives an operator a single chat interface to run three workflows that are normally spread across separate tools:

- **Monitoring** — pulls live EC2 metrics from CloudWatch (`mcp/monitor/cloudwatch_client.py`), or serves a mock fleet (`metrics.json`, `logs.json`) for demo/testing, and sends both metrics and logs to an NVIDIA-hosted LLM for health analysis and anomaly detection (`mcp/Nvidia_llm/AI_client.py`).
- **Incident/ticketing** — `mcp/monitor/ticket_system.py` auto-creates tickets from detected issues, assigns them against an employee workload model, and routes anything flagged `CRITICAL` through an admin approval step before it can be actioned (`employees.json`, `admins.json`, `tickets.json`).
- **Infrastructure automation** — natural-language requests ("create an S3 bucket called demo-assets") are routed to typed MCP tool calls that run real Terraform (`create_s3_bucket`, `create_ec2_instance`, `create_lambda`, and their `destroy_*` counterparts) inside a Docker container.

## Architecture

```
React/Vite Frontend
       │  REST + WebSocket
       ▼
Node MCP Client (mcp-client/server.js)  ──NL routing──▶ NVIDIA NIM (model/router.js)
       │  MCP tool calls
       ▼
Terraform MCP Server (mcps/mcp_server.py, Docker)
       │
       ▼
AWS (Terraform configs in mcps/terraform/{s3,ec2,lambda})

Flask Backend (app.py)
  ├─ /infra   → proxies to the Node MCP client for provisioning
  └─ /monitor → CloudWatch + mock-fleet metrics, log analysis, ticketing
```

Two backends exist because the Node service owns MCP/Terraform orchestration and the WebSocket path to the frontend, while Flask owns AWS SDK access (boto3) for CloudWatch and the ticket/employee data layer — the `/infra` blueprint proxies through to Node rather than duplicating Terraform logic in Python.

## Engineering Highlights

**LLM tool-routing with a deterministic fallback.** Chat messages are interpreted by an NVIDIA Nemotron model into a structured `{ tool, args }` call (`mcp-client/model/router.js`). When `USE_SIMPLE_ROUTER=1` or the API is unavailable, a keyword/regex router covers the same tool surface so the demo doesn't hard-depend on a third-party API being up.

**Per-domain mutexes around Terraform state.** Concurrent S3/EC2/Lambda operations are serialized per resource type to prevent two requests from racing on the same Terraform state file, with exponential-backoff retries on transient failures. `PERSIST_TERRAFORM=1` trades isolation for latency by keeping a long-lived container (`mcps-terraform-persist`) alive between calls instead of paying Docker cold-start cost on every request.

**Critical-path human approval.** Ticket creation isn't fully autonomous — `ticket_system.py` separates "create from detected issue" from "approve/reject if CRITICAL," so an LLM-detected incident can page an admin instead of silently triggering an action.

**Unified env across three runtimes.** `scripts/sync-env.mjs` fans a single root `.env` out to `mcp-client/.env` and to `Frontend/.env.local` (filtered to `VITE_`-prefixed keys), so Python, Node, and Vite stay in sync from one source of truth (see `DEPLOYMENT.md`).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite (rolldown-vite), Tailwind CSS, Chart.js, Firebase, Vercel AI SDK |
| Backend | Flask (Python) + Express (Node), WebSocket (`ws`) |
| AI/Routing | NVIDIA NIM (Nemotron) for NL→tool routing and metrics/log analysis |
| Infra | Terraform, Docker, AWS (S3, EC2, Lambda, CloudWatch via boto3) |
| Protocol | Model Context Protocol (`@modelcontextprotocol/sdk`) |
| CI | GitHub Actions — backend import check, Node router sanity build, frontend lint |

## Project Structure

```
app.py                  Flask entrypoint — /infra and /monitor blueprints
mcp/infra/               Flask-side infra proxy routes
mcp/monitor/              CloudWatch client, ticketing, mock log/metrics data
mcp/Nvidia_llm/           NVIDIA LLM client for analysis
mcp-client/               Node MCP server — NL routing, Terraform tool calls, WebSocket API
mcps/                     Terraform MCP server (Dockerized) + Terraform configs (s3/ec2/lambda)
Frontend/                React/Vite UI
scripts/                 Env sync, CI-support test scripts, dev/stop helpers
```

## Getting Started

```bash
npm run install:all   # installs root, mcp-client, and Frontend deps
npm run sync-env       # fans root .env out to mcp-client/.env and Frontend/.env.local
npm run dev             # starts Flask (:5000), Node MCP client (:8080), and the frontend (:5173),
                          # then opens the browser once all three ports are up
```

Requires a root `.env` — see `.env.example` and `DEPLOYMENT.md` for the full variable list (NVIDIA API key, AWS credentials if exercising live Terraform, optional Firebase auth config).

## Testing

```bash
npm run test:stack   # python import check + Flask route check + frontend lint + Node CORS check
```

CI (`.github/workflows/ci.yml`) runs three independent jobs on push/PR: a Python import sanity check for the Flask backend, a build/sanity check of the Node router against a test API key, and ESLint for the frontend.

## What This Demonstrates

Coordinating three runtimes (Python, Node, browser) behind one conversational interface; wrapping a non-deterministic LLM router with a deterministic fallback so demos don't depend on an external API's uptime; and treating infrastructure mutation as something that needs concurrency control and human sign-off, not just an exposed API.
