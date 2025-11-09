# Olympus

## Infrastructure Orchestration Overview

Olympus integrates a multi-layer orchestration path for cloud infrastructure operations (Terraform) mediated by an NVIDIA‑routed Model Context Protocol (MCP) client.

### Flow
Frontend ➜ Flask (`/infra/*` endpoints) ➜ Node MCP Client (`mcp-client/server.js`) ➜ Terraform MCP Server (Docker, `mcps/mcp_server.py`) ➜ AWS resources via Terraform configs in `mcps/terraform/*`.

### Components
- **Flask Backend** (`app.py`): Exposes `/infra` blueprint with REST endpoints (S3, EC2, Lambda, ping). Proxies calls to the Node MCP client.
- **Node MCP Client** (`mcp-client/server.js`): Provides HTTP endpoints (`/terraform/*`) and MCP tools, including Terraform wrappers. Optionally uses an NVIDIA model (`model/router.js`) for natural language routing.
- **Terraform MCP Server** (`mcps/mcp_server.py`): Implements MCP tools (`create_s3_bucket`, `destroy_s3_bucket`, `create_ec2_instance`, etc.) running inside a Docker container.
- **Terraform Configs** (`mcps/terraform/s3`, `ec2`, `lambda`): Declarative resource definitions and state.

### Key Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `MODEL_API_KEY` | NVIDIA inference key for router | (required for LLM routing) |
| `NODE_MCP_URL` | Flask proxy target; base URL of Node server | `http://localhost:8080` |
| `INFRA_CLIENT_TIMEOUT` | Flask -> Node request timeout (seconds) | `300` |
| `PERSIST_TERRAFORM` | If `1`, keep a long‑lived Docker container (`mcps-terraform-persist`) | `0` (ephemeral) |
| `WORKSPACE_FOLDER` | Override auto workspace root resolution in Node client | auto-detected |

### REST Endpoints (Flask ➜ `/infra`)
| Method | Path | Description | Body |
|--------|------|-------------|------|
| GET | `/infra/ping` | Terraform MCP ping | - |
| POST | `/infra/s3` | Create S3 bucket | `{ "bucket_name": "my-bucket", "aws_region": "us-east-1" }` |
| DELETE | `/infra/s3/:bucket` | Destroy S3 bucket | - |
| POST | `/infra/ec2` | Create EC2 instance | - |
| DELETE | `/infra/ec2` | Destroy EC2 instance | - |
| POST | `/infra/lambda` | Create Lambda | `{ "function_name": "fn", "aws_region": "us-east-1", "source_code": "def handler..." }` |
| DELETE | `/infra/lambda` | Destroy Lambda | - |

### Node MCP Endpoints (`/terraform/*`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/terraform/ping` | Ping Terraform MCP server |
| GET | `/terraform/tools` | List available MCP tools |
| POST | `/terraform/s3` | Create bucket |
| DELETE | `/terraform/s3/:name` | Destroy bucket |
| POST | `/terraform/ec2` | Create EC2 |
| DELETE | `/terraform/ec2` | Destroy EC2 |
| POST | `/terraform/lambda` | Create Lambda |
| DELETE | `/terraform/lambda` | Destroy Lambda |

### MCP Tools (Node ➜ Terraform)
Exposed in `mcp-client/server.js` for LLM routing:
- `terraformPing`
- `createS3Bucket`
- `destroyS3Bucket`
- `createEC2`
- `destroyEC2`
- `createLambda`
- `destroyLambda`

### Persistent Mode
Set `PERSIST_TERRAFORM=1` before starting the Node MCP server to keep a long‑lived container (`mcps-terraform-persist`). Subsequent tool calls use `docker exec` for lower latency.

### Concurrency & Safety
- Per-domain mutex (S3/EC2/Lambda) prevents simultaneous Terraform state mutations.
- Automatic retries (exponential backoff) on transient failures.
- For large scale or true parallelism: switch to a remote backend (S3 + DynamoDB lock) in each `main.tf`.

### Example Create + Destroy Bucket (Frontend → Flask)
```bash
curl -X POST http://localhost:5000/infra/s3 \
	-H 'Content-Type: application/json' \
	-d '{"bucket_name":"demo-bucket-123","aws_region":"us-east-1"}'

curl -X DELETE http://localhost:5000/infra/s3/demo-bucket-123
```

### Suggested Remote Backend (Future)
```hcl
terraform {
	backend "s3" {
		bucket         = "olympus-terraform-state"
		key            = "s3/terraform.tfstate"
		region         = "us-east-1"
		dynamodb_table = "terraform-locks"
		encrypt        = true
	}
}
```

### Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| Slow first call | Container cold start | Enable `PERSIST_TERRAFORM=1` |
| State lock errors | Concurrent same-domain ops | Serialization already in place; consider remote backend |
| Unknown tool error | Tool name mismatch | Check `/terraform/tools` output |
| Timeout from Flask | Long Terraform apply | Increase `INFRA_CLIENT_TIMEOUT` or implement async job model |

### Next Enhancements
- Structured JSON outputs parsed from Terraform (instead of raw apply text)
- AuthN/AuthZ around `/infra` endpoints
- Queued async job execution for long-running applies
- Observability: log each infra action (request + duration + result) to a datastore

---
Infrastructure orchestration via Terraform + MCP enables reproducible, AI-assisted cloud operations with a clean multi-layer boundary.
