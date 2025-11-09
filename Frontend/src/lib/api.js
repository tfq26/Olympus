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

export async function createEC2({ instance_count = 1, instance_name_prefix = null, aws_region = 'us-east-1' } = {}) {
  const payload = { instance_count };
  if (instance_name_prefix) payload.instance_name_prefix = instance_name_prefix;
  if (aws_region) payload.aws_region = aws_region;
  const res = await fetch(`${NODE_BASE_URL}/terraform/ec2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
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

// AWS credentials health
export async function checkAwsCredentials() {
  const res = await fetch(`${NODE_BASE_URL}/aws/credentials/check`);
  if (!res.ok) {
    if (res.status === 404) {
      // Endpoint missing on server: treat as warn instead of throwing to avoid Critical noise
      return { ok: false, status: 'warn', reason: 'credentials check endpoint not found' };
    }
    throw new Error(`AWS credentials check failed: ${res.status}`);
  }
  return res.json();
}

// Monitoring operations
export async function getResources(filters = {}) {
  const params = new URLSearchParams();
  if (filters.customer_name) params.append('customer_name', filters.customer_name);
  if (filters.type) params.append('type', filters.type);
  if (filters.batch_group) params.append('batch_group', filters.batch_group);
  
  const queryString = params.toString();
  const url = `${NODE_BASE_URL}/monitor/resources${queryString ? '?' + queryString : ''}`;
  
  const res = await fetch(url);
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

// Resource management operations
export async function createResource(resourceData) {
  const res = await fetch(`${NODE_BASE_URL}/monitor/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resourceData),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || `Create resource failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteResource(resource_id) {
  const res = await fetch(`${NODE_BASE_URL}/monitor/resources/${resource_id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || `Delete resource failed: ${res.status}`);
  }
  return res.json();
}

export async function updateResource(resource_id, updates) {
  const res = await fetch(`${NODE_BASE_URL}/monitor/resources/${resource_id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || `Update resource failed: ${res.status}`);
  }
  return res.json();
}

// Customer operations
export async function getCustomersSummary() {
  const res = await fetch(`${NODE_BASE_URL}/monitor/customers/summary`);
  if (!res.ok) throw new Error(`Get customers summary failed: ${res.status}`);
  return res.json();
}

// AI parsing operations
export async function parseWithAI(data, context = null) {
  const res = await fetch(`${NODE_BASE_URL}/ai/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, context }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || `AI parsing failed: ${res.status}`);
  }
  return res.json();
}
