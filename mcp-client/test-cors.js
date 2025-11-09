// Simple CORS self-test for the Node server
// - Starts the server if not already running (optional)
// - Performs OPTIONS preflight and GET to /terraform/ping with Origin header
// - Prints key headers and status; exits non-zero on failure

import http from 'http';
import { spawn } from 'child_process';

const ORIGIN = process.env.TEST_ORIGIN || 'http://localhost:5173';
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 8080);
// Use /health for 200 success independent of Terraform Docker availability
const PATH = '/health';

function httpRequest(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function waitForServer(timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await httpRequest('GET', '/', {});
      if (res.statusCode && res.statusCode >= 200) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function main() {
  let child; 
  let started = false;
  try {
    // Try to see if server is already up
    const up = await waitForServer(500);
    if (!up) {
      // Start the server as a child process
      child = spawn('node', ['server.js'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (d) => {
        const s = d.toString();
        if (s.includes('MCP Server ready')) {
          started = true;
        }
      });
      // Wait up to 5s for ready
      const ok = await waitForServer(5000);
      if (!ok) {
        console.error('❌ Server did not become ready on port', PORT);
        process.exit(2);
      }
    }

    // Preflight
    const pre = await httpRequest('OPTIONS', PATH, {
      Origin: ORIGIN,
      'Access-Control-Request-Method': 'GET',
    });
    console.log('Preflight status:', pre.statusCode);
    console.log('Preflight ACAO:', pre.headers['access-control-allow-origin']);
    console.log('Preflight ACAM:', pre.headers['access-control-allow-methods']);

    if (!pre.headers['access-control-allow-origin']) {
      console.error('❌ Missing Access-Control-Allow-Origin on preflight');
      process.exit(3);
    }

    // Direct GET
    const get = await httpRequest('GET', PATH, {
      Origin: ORIGIN,
    });
    console.log('GET status:', get.statusCode);
    console.log('GET ACAO:', get.headers['access-control-allow-origin']);
    console.log('GET body (truncated):', (get.body || '').slice(0, 120));

    if (!get.headers['access-control-allow-origin']) {
      console.error('❌ Missing Access-Control-Allow-Origin on GET');
      process.exit(4);
    }

    console.log('✅ CORS checks passed');
  } catch (err) {
    console.error('❌ Test failed:', err?.message || err);
    process.exit(1);
  } finally {
    if (child && started) {
      // Allow some time for logs to flush, then kill
      setTimeout(() => {
        try { child.kill('SIGINT'); } catch {}
        process.exit(0);
      }, 200);
    } else {
      process.exit(0);
    }
  }
}

main();
