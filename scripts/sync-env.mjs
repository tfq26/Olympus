#!/usr/bin/env node
// Sync root .env into Frontend/.env.local (VITE_* only) and mcp-client/.env (all)
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const repoRoot = path.resolve(process.cwd());
const rootEnvPath = path.join(repoRoot, '.env');
if (!fs.existsSync(rootEnvPath)) {
  const examplePath = path.join(repoRoot, '.env.example');
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, rootEnvPath);
    console.log('No .env found. Bootstrapped from .env.example');
  } else {
    console.error('No .env found and .env.example is missing. Please create a .env at repo root.');
    process.exit(1);
  }
}

// Parse root .env
const rootEnvContent = fs.readFileSync(rootEnvPath, 'utf8');
const parsed = dotenv.parse(rootEnvContent);

// 1) Write mcp-client/.env with all vars
const mcpEnvPath = path.join(repoRoot, 'mcp-client', '.env');
fs.writeFileSync(mcpEnvPath, rootEnvContent, 'utf8');
console.log(`Wrote ${mcpEnvPath}`);

// 2) Write Frontend/.env.local with only VITE_* keys
const frontendDir = fs.existsSync(path.join(repoRoot, 'Frontend')) ? 'Frontend' : 'frontend';
const frontendEnvPath = path.join(repoRoot, frontendDir, '.env.local');
const viteLines = Object.entries(parsed)
  .filter(([k]) => k.startsWith('VITE_'))
  .map(([k, v]) => `${k}=${v}`)
  .join('\n') + '\n';
fs.writeFileSync(frontendEnvPath, viteLines, 'utf8');
console.log(`Wrote ${frontendEnvPath}`);

console.log('✅ Env sync complete');
