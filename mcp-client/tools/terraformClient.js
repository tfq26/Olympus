// tools/terraformClient.js
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveWorkspaceRoot() {
  // Allow override via env, else assume repo root is parent of mcp-client
  const envRoot = process.env.WORKSPACE_FOLDER;
  if (envRoot) return envRoot;
  return path.resolve(__dirname, "../../");
}

export async function callTerraformTool(toolName, args) {
  // Serialize operations per resource domain to avoid Terraform state race conditions
  const domain = toolName.includes("s3") ? "s3" : toolName.includes("ec2") ? "ec2" : toolName.includes("lambda") ? "lambda" : "misc";
  const release = await acquire(domain);
  const workspaceRoot = resolveWorkspaceRoot();
  const envFile = path.join(workspaceRoot, "server/.env");
  const mcpsDir = path.join(workspaceRoot, "mcps");

  const persist = process.env.PERSIST_TERRAFORM === "1";
  if (persist) {
    ensurePersistentContainer({ envFile, mcpsDir });
  }

  const argsBase = persist
    ? [
        "exec",
        "-i",
        "mcps-terraform-persist",
        "python",
        "mcp_server.py",
      ]
    : [
        "run",
        "-i",
        "--rm",
        "--env-file",
        envFile,
        "-v",
        `${mcpsDir}:/app`,
        "mcps-terraform",
      ];

  const transport = new StdioClientTransport({
    command: "docker",
    args: argsBase,
  });

  const client = new Client({ name: "node-mcp-client", version: "1.0.0" }, { capabilities: {} });
  const attempt = async () => {
    await client.connect(transport);
    try {
      if (toolName === "ping") {
        const res = await client.request({ method: "tools/call", params: { name: "ping", arguments: {} } });
        return res?.result ?? res;
      }
      // Call any tool by name
      const res = await client.request({ method: "tools/call", params: { name: toolName, arguments: args || {} } });
      return res?.result ?? res;
    } finally {
      await client.close();
      if (transport.close) await transport.close();
    }
  };

  try {
    return await withRetry(attempt, { retries: 2, baseDelayMs: 500 });
  } finally {
    release();
  }
}

// ---------------- Concurrency control (simple per-domain mutex) ----------------
const queues = new Map(); // domain -> promise chain

async function acquire(domain) {
  const prev = queues.get(domain) || Promise.resolve();
  let release;
  const p = prev.then(() => new Promise((r) => (release = r)));
  queues.set(domain, p);
  await prev; // wait until previous completes
  return () => {
    if (release) release();
    // Reset chain to resolved once released
    queues.set(domain, Promise.resolve());
  };
}

// ---------------- Retry helper ----------------
async function withRetry(fn, { retries = 2, baseDelayMs = 300 } = {}) {
  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === retries) break;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      attempt += 1;
    }
  }
  throw lastErr;
}

// ---------------- Persistent container helper ----------------
function ensurePersistentContainer({ envFile, mcpsDir }) {
  try {
    const out = execFileSync("docker", ["ps", "-q", "--filter", "name=mcps-terraform-persist"], { encoding: "utf8" }).trim();
    if (out) return; // already running
  } catch {}

  // Start a long-lived container with mounted volume and env
  const args = [
    "run",
    "-d",
    "--name",
    "mcps-terraform-persist",
    "--env-file",
    envFile,
    "-v",
    `${mcpsDir}:/app`,
    "mcps-terraform",
    "sleep",
    "infinity",
  ];
  execFileSync("docker", args, { stdio: "ignore" });
}

export async function listTerraformTools() {
  const workspaceRoot = resolveWorkspaceRoot();
  const envFile = path.join(workspaceRoot, "server/.env");
  const mcpsDir = path.join(workspaceRoot, "mcps");
  const persist = process.env.PERSIST_TERRAFORM === "1";
  if (persist) ensurePersistentContainer({ envFile, mcpsDir });

  const argsBase = persist
    ? ["exec", "-i", "mcps-terraform-persist", "python", "mcp_server.py"]
    : ["run", "-i", "--rm", "--env-file", envFile, "-v", `${mcpsDir}:/app`, "mcps-terraform"];

  const transport = new StdioClientTransport({ command: "docker", args: argsBase });
  const client = new Client({ name: "node-mcp-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  try {
    const res = await client.request({ method: "tools/list", params: {} });
    return res;
  } finally {
    await client.close();
    if (transport.close) await transport.close();
  }
}
