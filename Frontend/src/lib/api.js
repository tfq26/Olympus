// Primary backend is now the Node MCP server (which proxies to Flask for monitoring if needed)
export const NODE_BASE_URL = import.meta.env.VITE_NODE_URL || 'http://localhost:8080';
// Keep Flask URL for direct monitoring calls if needed (optional)
export const FLASK_BASE_URL = import.meta.env.VITE_FLASK_URL || 'http://localhost:5000';

export async function pingBackend() {
  const res = await fetch(`${NODE_BASE_URL}/terraform/ping`);
  if (!res.ok) throw new Error(`Ping failed: ${res.status}`);
  return res.json();
}

export async function nlp(message) {
  const res = await fetch(`${NODE_BASE_URL}/nlp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch (e) { /* ignore read error */ }
    throw new Error(`NLP failed: ${res.status} ${detail}`);
  }
  return res.json();
}

export async function executeIntent(tool, args) {
  const res = await fetch(`${NODE_BASE_URL}/nlp/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, args, userConfirmed: true }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch (e) { /* ignore read error */ }
    throw new Error(`Execute failed: ${res.status} ${detail}`);
  }
  return res.json();
}

// Infrastructure operations (S3, EC2, Lambda)
export async function createS3(bucket_name, aws_region = 'us-east-1') {
  const res = await fetch(`${NODE_BASE_URL}/terraform/s3`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket_name, aws_region }),
  });
  if (!res.ok) throw new Error(`S3 create failed: ${res.status}`);
  return res.json();
}

export async function destroyS3(bucket_name) {
  const res = await fetch(`${NODE_BASE_URL}/terraform/s3/${bucket_name}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`S3 destroy failed: ${res.status}`);
  return res.json();
}

export async function createEC2() {
  const res = await fetch(`${NODE_BASE_URL}/terraform/ec2`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`EC2 create failed: ${res.status}`);
  return res.json();
}

export async function destroyEC2() {
  const res = await fetch(`${NODE_BASE_URL}/terraform/ec2`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`EC2 destroy failed: ${res.status}`);
  return res.json();
}

export async function createLambda(function_name, aws_region = 'us-east-1', source_code = null) {
  const res = await fetch(`${NODE_BASE_URL}/terraform/lambda`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function_name, aws_region, source_code }),
  });
  if (!res.ok) throw new Error(`Lambda create failed: ${res.status}`);
  return res.json();
}

export async function destroyLambda() {
  const res = await fetch(`${NODE_BASE_URL}/terraform/lambda`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Lambda destroy failed: ${res.status}`);
  return res.json();
}

// Monitoring operations
export async function getResources() {
  const res = await fetch(`${NODE_BASE_URL}/monitor/resources`);
  if (!res.ok) throw new Error(`Get resources failed: ${res.status}`);
  return res.json();
}

export async function getResourceMetrics(resource_id) {
  const res = await fetch(`${NODE_BASE_URL}/monitor/resource/${resource_id}`);
  if (!res.ok) throw new Error(`Get resource metrics failed: ${res.status}`);
  return res.json();
}

export async function getEC2Metrics(instance_id) {
  const res = await fetch(`${NODE_BASE_URL}/monitor/metrics/${instance_id}`);
  if (!res.ok) throw new Error(`Get EC2 metrics failed: ${res.status}`);
  return res.json();
}

export async function getEC2MetricsEnriched(instance_id, resource_id = null, auto_update = true) {
  const params = new URLSearchParams({ instance_id });
  if (resource_id) params.append('resource_id', resource_id);
  if (auto_update !== undefined) params.append('auto_update', auto_update);
  
  const res = await fetch(`${NODE_BASE_URL}/monitor/metrics/enriched/${instance_id}?${params}`);
  if (!res.ok) throw new Error(`Get enriched metrics failed: ${res.status}`);
  return res.json();
}

// Logs operations
export async function getLogs(resource_id = null, status = null) {
  const params = new URLSearchParams();
  if (resource_id) params.append('resource_id', resource_id);
  if (status) params.append('status', status);
  
  const res = await fetch(`${NODE_BASE_URL}/monitor/logs?${params}`);
  if (!res.ok) throw new Error(`Get logs failed: ${res.status}`);
  return res.json();
}

export async function getLogsAnalysis(resource_id = null, status = null) {
  const params = new URLSearchParams();
  if (resource_id) params.append('resource_id', resource_id);
  if (status) params.append('status', status);
  
  const res = await fetch(`${NODE_BASE_URL}/monitor/logs/analysis?${params}`);
  if (!res.ok) throw new Error(`Get logs analysis failed: ${res.status}`);
  return res.json();
}
