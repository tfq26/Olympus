// tools/terraformClient.js
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

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
  let forcedEphemeral = false;
  if (persist) {
    // If a previously created persistent container keeps exiting, fall back automatically
    try {
      const status = execFileSync("docker", ["ps", "-a", "--filter", "name=mcps-terraform-persist", "--format", "{{.Status}}"], { encoding: "utf8" }).trim();
      if (status && /Exited/i.test(status)) {
        forcedEphemeral = true;
      }
    } catch {}
    if (!forcedEphemeral) ensurePersistentContainer({ envFile, mcpsDir });
  }

  const usePersist = persist && !forcedEphemeral;
  const argsBase = usePersist
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

  // Use Client class which handles initialize handshake automatically
  const client = new Client(
    { name: "node-mcp-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const attempt = async () => {
    // connect() calls transport.start() and sends initialize automatically
    await client.connect(transport);
    try {
      // Use proper callTool method instead of raw request
      const result = await client.callTool({ name: toolName, arguments: args || {} }, CallToolResultSchema);
      // Extract text content if available
      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find(c => c.type === 'text');
        return textContent?.text || JSON.stringify(result.content);
      }
      return result;
    } finally {
      await client.close();
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
    const running = execFileSync("docker", ["ps", "-q", "--filter", "name=mcps-terraform-persist"], { encoding: "utf8" }).trim();
    if (running) return; // already running
  } catch {}

  // If an exited container with the same name exists, remove it first
  try {
    const any = execFileSync("docker", ["ps", "-aq", "--filter", "name=mcps-terraform-persist"], { encoding: "utf8" }).trim();
    if (any) {
      execFileSync("docker", ["rm", "-f", "mcps-terraform-persist"], { stdio: "ignore" });
    }
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
    "--entrypoint",
    "/bin/sh",
    "mcps-terraform",
    "-c",
    "tail -f /dev/null",
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
  const client = new Client(
    { name: "node-mcp-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  try {
    const res = await client.listTools();
    return res.tools; // Return tools array
  } finally {
    await client.close();
  }
}

// ---------------- Infra diagnostics (non-throwing) ----------------
function tryExec(cmd, args) {
  try {
    const out = execFileSync(cmd, args, { encoding: "utf8" }).trim();
    return { ok: true, out };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function diagnoseTerraformInfra() {
  const workspaceRoot = resolveWorkspaceRoot();
  const envFile = path.join(workspaceRoot, "server/.env");

  const docker = tryExec("docker", ["version", "--format", "{{.Server.Version}}"]);
  const image = tryExec("docker", ["image", "inspect", "mcps-terraform", "-f", "{{.Id}}"]);
  const persistStatus = tryExec("docker", ["ps", "-a", "--filter", "name=mcps-terraform-persist", "--format", "{{.Names}}:{{.Status}}"]);

  let env = { exists: false, hasAwsCreds: false };
  try {
    if (fs.existsSync(envFile)) {
      env.exists = true;
      const txt = fs.readFileSync(envFile, "utf8");
      env.hasAwsCreds = /AWS_ACCESS_KEY_ID=/.test(txt) && /AWS_SECRET_ACCESS_KEY=/.test(txt);
    }
  } catch {}

  return {
    dockerAvailable: docker.ok,
    dockerVersion: docker.ok ? docker.out : undefined,
    imageAvailable: image.ok,
    imageId: image.ok ? image.out : undefined,
    persistentContainer: persistStatus.ok ? persistStatus.out || "missing" : `error: ${persistStatus.error}`,
    envFile: {
      path: envFile,
      exists: env.exists,
      hasAwsCreds: env.hasAwsCreds,
    },
  };
}
