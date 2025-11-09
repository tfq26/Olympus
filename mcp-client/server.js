// server.js
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Load env from repo root first (unified env), then local .env for overrides
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
dotenv.config();

// ✅ Import the correct MCP server class
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { WebSocketServer } from "ws";
import { interpretMessage, explainError } from "./model/router.js";
import { callTerraformTool, listTerraformTools, diagnoseTerraformInfra } from "./tools/terraformClient.js";
import axios from "axios";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { LambdaClient, GetFunctionCommand } from "@aws-sdk/client-lambda";

// Flask backend URL for monitoring tools
const FLASK_URL = process.env.FLASK_URL || "http://localhost:5000";

// Store last error for context-aware explanations
let lastError = null;

// Helper function to generate valid AWS resource names
function generateResourceName(resourceType, customerName = '', prefix = '') {
  // Sanitize customer name: lowercase, remove invalid chars, replace spaces/underscores with hyphens
  const sanitizedCustomer = customerName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .replace(/-+/g, '-'); // collapse multiple hyphens
  
  // Generate random 6-digit ID
  const randomId = Math.floor(100000 + Math.random() * 900000);
  
  // Resource type abbreviation
  const typeMap = {
    's3': 's3',
    'bucket': 's3',
    'ec2': 'ec2',
    'instance': 'ec2',
    'lambda': 'lambda',
    'function': 'lambda',
    'rds': 'rds',
    'database': 'rds'
  };
  
  const typeAbbr = typeMap[resourceType.toLowerCase()] || resourceType.toLowerCase();
  
  // Build name: prefix-customer-type-id or customer-type-id
  const parts = [
    prefix,
    sanitizedCustomer,
    typeAbbr,
    randomId.toString()
  ].filter(Boolean); // Remove empty strings
  
  const finalName = parts.join('-');
  
  // Ensure it meets AWS requirements (3-63 chars for S3)
  if (finalName.length < 3) {
    return `resource-${typeAbbr}-${randomId}`;
  }
  if (finalName.length > 63) {
    // Truncate customer name if too long
    const maxCustomerLen = 63 - typeAbbr.length - randomId.toString().length - (prefix ? prefix.length + 3 : 2);
    const truncatedCustomer = sanitizedCustomer.substring(0, maxCustomerLen);
    return [prefix, truncatedCustomer, typeAbbr, randomId].filter(Boolean).join('-');
  }
  
  return finalName;
}

// Helper function to parse Terraform output for success/failure
function parseTerraformOutput(terraformResult, resourceType, resourceName, isDestroy = false) {
  const resultStr = typeof terraformResult === 'string' ? terraformResult : JSON.stringify(terraformResult);
  
  // Check for common success patterns
  const successPatterns = [
    /Creation complete/i,
    /Apply complete/i,
    /successfully created/i,
    /Destruction complete/i,
    /successfully destroyed/i,
    /Destroy complete/i
  ];
  
  // Check for common error patterns
  const errorPatterns = [
    /Error:/i,
    /Failed/i,
    /InvalidParameterValue/i,
    /InvalidBucketName/i,
    /UnauthorizedOperation/i,
    /AccessDenied/i,
    /ResourceConflict/i
  ];
  
  const hasSuccess = successPatterns.some(pattern => pattern.test(resultStr));
  const hasError = errorPatterns.some(pattern => pattern.test(resultStr));
  
  if (hasError) {
    // Extract error message
    const errorMatch = resultStr.match(/Error: (.+?)(?:\n|$)/);
    const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error occurred';
    
    return `❌ **${resourceType} ${isDestroy ? 'Destruction' : 'Creation'} Failed**\n\n` +
           `Resource: ${resourceName}\n` +
           `Error: ${errorMsg}\n\n` +
           `💡 Use "why did it fail?" to get detailed explanation and next steps.`;
  }
  
  if (hasSuccess || !hasError) {
    // Extract resource ID or ARN if available
    const arnMatch = resultStr.match(/arn:aws:[^:]+:[^:]+:[^:]+:([^\s"]+)/);
    const idMatch = resultStr.match(/id\s*=\s*"?([a-zA-Z0-9-]+)"?/);
    
    let details = '';
    if (arnMatch) {
      details = `\nARN: ${arnMatch[0]}`;
    } else if (idMatch) {
      details = `\nID: ${idMatch[1]}`;
    }
    
    return `✅ **${resourceType} ${isDestroy ? 'Destroyed' : 'Created'} Successfully!**\n\n` +
           `Resource: ${resourceName}${details}\n\n` +
           `🎉 Your ${resourceType.toLowerCase()} is ready to use.`;
  }
  
  // Fallback - return raw output
  return resultStr;
}

// Helper to extract identifiers (ID/ARN) from Terraform output
function extractIdentifiers(terraformResult) {
  const resultStr = typeof terraformResult === 'string' ? terraformResult : JSON.stringify(terraformResult);
  const arnMatch = resultStr.match(/arn:aws:[^\s\"]+/);
  const idMatch = resultStr.match(/\bid\s*=\s*"?([a-zA-Z0-9-_./:]+)"?/);
  return {
    arn: arnMatch ? arnMatch[0] : null,
    id: idMatch ? idMatch[1] : null,
  };
}

// 1️⃣ Define MCP Tools (including Terraform proxy tools that leverage the NVIDIA router potential)
const tools = {
  echo: {
    description: "Echoes text back to the user",
    run: async ({ text }) => `Echo: ${text}`,
  },
  explainLastError: {
    description: "Explains the most recent error that occurred",
    run: async ({ query }) => {
      if (!lastError) {
        return "I don't see any recent errors. If you encountered an error, please try the operation again and I'll be able to explain what went wrong.";
      }
      
      // Use AI to explain the stored error
      const explanation = await explainError(
        lastError.operation,
        lastError.message,
        lastError.context
      );
      
      return explanation;
    },
  },
  getLogs: {
    description: "Fetches logs (demo stub)",
    run: async ({ status }) => `Logs fetched with status: ${status}`,
  },
  getResource: {
    description: "Retrieves resource info (demo stub)",
    run: async ({ id }) => `Resource ${id}: { uptime: '24h', usage: '80%' }`,
  },
  terraformPing: {
    description: "Ping the Terraform MCP server to verify availability",
    run: async () => await callTerraformTool("ping", {}),
  },
  createS3Bucket: {
    description: "Create an S3 bucket via Terraform. Args: bucket_name, aws_region?, customer_name?",
    run: async ({ bucket_name, aws_region, customer_name }) => {
      const defaultRegion = process.env.AWS_REGION || "us-east-1";
      let region = aws_region || defaultRegion;
      // Always generate a unique bucket name using customer, resource type, and random
      const baseCustomer = customer_name || bucket_name || 'default';
      let finalBucketName = generateResourceName('s3', baseCustomer);
      // Ensure compliant characters and length
      finalBucketName = finalBucketName
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, '-')
        .replace(/^[^a-z0-9]+/, '')
        .replace(/[^a-z0-9]+$/, '')
        .substring(0, 63);
      
      let result = await callTerraformTool("create_s3_bucket", { 
        bucket_name: finalBucketName, 
        aws_region: region, 
        auto_approve: true 
      });

      // Heuristic: If AuthorizationHeaderMalformed indicates a different expected region, retry once with that region
      try {
        const txt = typeof result === 'string' ? result : JSON.stringify(result);
        const mal = /AuthorizationHeaderMalformed[^\n]*expecting '\s*([a-z0-9-]+)\s*'/i.exec(txt);
        if (mal && mal[1] && mal[1] !== region) {
          const expected = mal[1];
          console.warn(`S3 region mismatch detected (sent ${region}, expected ${expected}). Retrying in expected region...`);
          region = expected;
          result = await callTerraformTool("create_s3_bucket", { 
            bucket_name: finalBucketName, 
            aws_region: region, 
            auto_approve: true 
          });
        }
      } catch {}
      // Register in monitoring (best effort)
      try {
        const ids = extractIdentifiers(result);
        const tags = [];
        if (ids.id) tags.push(ids.id);
        if (ids.arn) tags.push(ids.arn);
        await axios.post(`${FLASK_URL}/monitor/resources`, {
          name: finalBucketName,
          type: 'S3',
          region: aws_region,
          tags,
          status: 'running',
          created_by: 'mcp',
          customer_name: customer_name || baseCustomer
        });
      } catch (e) {
        console.warn('⚠️ Failed to register S3 bucket:', e.message);
      }
      // Parse Terraform output and only return concise success/fail message
      const parsed = parseTerraformOutput(result, 'S3 Bucket', finalBucketName);
      return { ok: true, type: 'S3', name: finalBucketName, region, result: parsed };
    },
  },
  destroyS3Bucket: {
    description: "Destroy an S3 bucket via Terraform. Args: bucket_name",
    run: async ({ bucket_name }) => {
      if (!bucket_name) throw new Error("bucket_name required");
      const result = await callTerraformTool("destroy_s3_bucket", { bucket_name, auto_approve: true });
      return parseTerraformOutput(result, 'S3 Bucket', bucket_name, true);
    },
  },
  createEC2: {
    description: "Create an EC2 instance via Terraform. Args: instance_name?, customer_name?, aws_region?",
    run: async ({ instance_name, customer_name, aws_region = "us-east-1" }) => {
      // Always generate a unique instance name using customer, resource type, and random
      const baseCustomer = customer_name || instance_name || 'default';
      const finalInstanceName = generateResourceName('ec2', baseCustomer);
      
      const result = await callTerraformTool("create_ec2_instance", { 
        instance_count: 1,
        name_prefix: finalInstanceName,
        aws_region,
        auto_approve: true 
      });
      // Register EC2 in monitoring
      try {
        const ids = extractIdentifiers(result);
        const tags = [];
        if (ids.id) tags.push(ids.id);
        if (ids.arn) tags.push(ids.arn);
        await axios.post(`${FLASK_URL}/monitor/resources`, {
          name: finalInstanceName,
          type: 'EC2',
          region: aws_region,
          tags,
          status: 'running',
          created_by: 'mcp',
          customer_name: customer_name || baseCustomer
        });
      } catch (e) {
        console.warn('⚠️ Failed to register EC2 instance:', e.message);
      }
      const parsed = parseTerraformOutput(result, 'EC2 Instance', finalInstanceName);
      return { ok: true, type: 'EC2', name: finalInstanceName, region: aws_region, result: parsed };
    },
  },
  destroyEC2: {
    description: "Destroy the EC2 instance via Terraform",
    run: async () => {
      const result = await callTerraformTool("destroy_ec2", {});
      return parseTerraformOutput(result, 'EC2 Instance', 'instance', true);
    },
  },
  createLambda: {
    description: "Create a Lambda function via Terraform. Args: function_name, aws_region?, source_code?, customer_name?",
    run: async ({ function_name, aws_region = "us-east-1", source_code, customer_name }) => {
      // Always generate a unique function name using customer, resource type, and random
      const baseCustomer = customer_name || function_name || 'default';
      const finalFunctionName = generateResourceName('lambda', baseCustomer);
      
      const result = await callTerraformTool("create_lambda_function", { 
        function_name: finalFunctionName, 
        aws_region, 
        source_code, 
        auto_approve: true 
      });
      // Register Lambda in monitoring
      try {
        const ids = extractIdentifiers(result);
        const tags = [];
        if (ids.id) tags.push(ids.id);
        if (ids.arn) tags.push(ids.arn);
        await axios.post(`${FLASK_URL}/monitor/resources`, {
          name: finalFunctionName,
          type: 'Lambda',
          region: aws_region,
          tags,
          status: 'running',
          created_by: 'mcp',
          customer_name: customer_name || baseCustomer
        });
      } catch (e) {
        console.warn('⚠️ Failed to register Lambda function:', e.message);
      }
      const parsed = parseTerraformOutput(result, 'Lambda Function', finalFunctionName);
      return { ok: true, type: 'LAMBDA', name: finalFunctionName, region: aws_region, result: parsed };
    },
  },
  destroyLambda: {
    description: "Destroy the Lambda function via Terraform",
    run: async () => {
      const result = await callTerraformTool("destroy_lambda_function", { auto_approve: true });
      return parseTerraformOutput(result, 'Lambda Function', 'function', true);
    },
  },
  // Monitoring & Logs tools (proxy to Flask monitor endpoints)
  getMetrics: {
    description: "Get CloudWatch metrics for an EC2 instance. Args: instance_id",
    run: async ({ instance_id }) => {
      if (!instance_id) throw new Error("instance_id required");
      const res = await axios.get(`${FLASK_URL}/monitor/metrics`, { params: { instance_id } });
      return res.data;
    },
  },
  getResourceMetrics: {
    description: "Get mock resource metrics by resource_id. Args: resource_id",
    run: async ({ resource_id }) => {
      if (!resource_id) throw new Error("resource_id required");
      try {
        const res = await axios.get(`${FLASK_URL}/monitor/mock/metrics/${resource_id}`);
        return res.data;
      } catch (e) {
        // If resource not found, return friendly message instead of error
        if (e.response?.status === 404) {
          return {
            resource: {
              id: resource_id,
              name: resource_id,
              type: 'Unknown',
              status: 'not_found',
              metrics: {}
            },
            message: `⚠️ Resource ${resource_id} not found in monitoring system. It may not be registered yet or may have been deleted.`
          };
        }
        throw e;
      }
    },
  },
  getLogs: {
    description: "Get logs with optional filters. Args: resource_id?, status?",
    run: async ({ resource_id, status }) => {
      const params = {};
      if (resource_id) params.resource_id = resource_id;
      if (status) params.status = status;
      const res = await axios.get(`${FLASK_URL}/monitor/mock/logs`, { params });
      return res.data;
    },
  },
  analyzeLogs: {
    description: "Analyze logs with AI. Args: resource_id?, status?",
    run: async ({ resource_id, status }) => {
      const params = {};
      if (resource_id) params.resource_id = resource_id;
      if (status) params.status = status;
      const res = await axios.get(`${FLASK_URL}/monitor/mock/logs/analysis`, { params });
      return res.data;
    },
  },
  getCustomerHealth: {
    description: "Get customer health summary from logs",
    run: async () => {
      const res = await axios.get(`${FLASK_URL}/monitor/mock/customers/health`);
      return res.data;
    },
  },
  getTickets: {
    description: "Get tickets with optional filters. Args: status?, severity?, employee_id?",
    run: async ({ status, severity, employee_id }) => {
      const params = {};
      if (status) params.status = status;
      if (severity) params.severity = severity;
      if (employee_id) params.employee_id = employee_id;
      const res = await axios.get(`${FLASK_URL}/monitor/tickets`, { params });
      return res.data;
    },
  },
  createTicket: {
    description: "Create a new ticket. Args: issue, resource_id, severity?, issue_type?, description?, customer_name?",
    run: async ({ issue, resource_id, severity, issue_type, description, customer_name }) => {
      if (!issue || !resource_id) throw new Error("issue and resource_id required");
      const res = await axios.post(`${FLASK_URL}/monitor/tickets`, {
        issue,
        resource_id,
        severity,
        issue_type,
        description,
        customer_name,
      });
      return res.data;
    },
  },
  batchCreate: {
    description: "Create multiple resources sequentially (stop on first failure). Args: resource_type ['s3'|'ec2'|'lambda'], count [number], customer_name?, aws_region?",
    run: async ({ resource_type, count, customer_name, aws_region = "us-east-1" }) => {
      if (!resource_type || !count) {
        throw new Error("resource_type and count are required");
      }
      const numCount = parseInt(count, 10);
      if (isNaN(numCount) || numCount < 1 || numCount > 20) {
        throw new Error("count must be a number between 1 and 20");
      }
      const validTypes = ['s3', 'ec2', 'lambda'];
      if (!validTypes.includes(resource_type.toLowerCase())) {
        throw new Error(`resource_type must be one of: ${validTypes.join(', ')}`);
      }
      console.log(`🔄 Batch creating ${numCount} ${resource_type} resources for ${customer_name || 'default customer'}...`);
      const batchGroupId = Math.floor(100 + Math.random() * 900).toString().padStart(3, '0');
      const results = [];
      let failure = null;
      const sanitizedCustomer = (customer_name || 'default').toLowerCase().replace(/[^a-z0-9-]/g, '-');
      try {
        const typeAbbr = resource_type.toLowerCase();
        const prefixBase = `${sanitizedCustomer}-${typeAbbr}-${batchGroupId}`;
        let tfResult;
        try {
          if (typeAbbr === 'ec2') {
            tfResult = await retryWithBackoff(
              async () => await callTerraformTool("create_ec2_instance", { 
                instance_count: numCount, 
                name_prefix: prefixBase, 
                auto_approve: true 
              }),
              `Batch create ${numCount} EC2 instances`
            );
          } else if (typeAbbr === 's3') {
            tfResult = await retryWithBackoff(
              async () => await callTerraformTool("create_s3_bucket", { 
                bucket_count: numCount,
                bucket_name_prefix: prefixBase,
                aws_region,
                auto_approve: true 
              }),
              `Batch create ${numCount} S3 buckets`
            );
          } else if (typeAbbr === 'lambda') {
            tfResult = await retryWithBackoff(
              async () => await callTerraformTool("create_lambda_function", { 
                function_count: numCount,
                function_name_prefix: prefixBase,
                aws_region,
                auto_approve: true 
              }),
              `Batch create ${numCount} Lambda functions`
            );
          }
        } catch (retryError) {
          failure = { index: 1, error: retryError.message };
          throw retryError;
        }
        const resourceTypeDisplay = typeAbbr === 's3' ? 'S3 Buckets' : (typeAbbr === 'lambda' ? 'Lambda Functions' : 'EC2 Instances');
        const parsed = parseTerraformOutput(tfResult, resourceTypeDisplay, prefixBase);
        const text = typeof tfResult === 'string' ? tfResult : JSON.stringify(tfResult);
        console.log(`📝 Registering ${numCount} resources in DynamoDB...`);
        for (let i = 0; i < numCount; i++) {
          const name = `${prefixBase}-${i + 1}`;
          try {
            const tags = [];
            if (typeAbbr === 'ec2') {
              const idMatches = text.match(/"i-[a-f0-9]{8,}"/g) || [];
              if (idMatches[i]) tags.push(idMatches[i].replace(/"/g, ''));
            } else if (typeAbbr === 's3') {
              const arnPattern = new RegExp(`arn:aws:s3:::${name}`, 'g');
              if (arnPattern.test(text)) tags.push(`arn:aws:s3:::${name}`);
            } else if (typeAbbr === 'lambda') {
              const arnMatches = text.match(/arn:aws:lambda:[^"]+:function:[^"]+/g) || [];
              if (arnMatches[i]) tags.push(arnMatches[i]);
            }
            await registerResourceWithRetry({
              name,
              type: typeAbbr.toUpperCase(),
              region: aws_region,
              tags,
              status: 'running',
              created_by: 'mcp',
              batch_group: batchGroupId,
              customer_name: customer_name || 'default'
            }, typeAbbr.toUpperCase());
            // AWS existence check
            const exists = await awsResourceExists(typeAbbr.toUpperCase(), name, aws_region);
            if (!exists) {
              await removeResourceFromDynamoDB(name, customer_name || 'default');
              results.push({ index: i + 1, type: typeAbbr, name, status: 'not_found_in_aws', result: parsed });
            } else {
              results.push({ index: i + 1, type: typeAbbr, name, status: 'created', result: parsed });
            }
          } catch (e) {
            console.error(`❌ Failed to register ${typeAbbr} ${name} after retries:`, e.message);
            results.push({ index: i + 1, type: typeAbbr, name, status: 'created_but_not_registered', result: parsed });
          }
        }
      } catch (e) {
        if (!failure) {
          failure = { index: 1, error: e.message };
        }
      }
      const successCount = results.length;
      const registeredCount = results.filter(r => r.status === 'created').length;
      let summary = `\n🚀 **Batch Creation Result**\n\n`;
      summary += `📊 **Progress:** ${successCount}/${numCount} processed\n`;
      if (registeredCount < successCount) {
        summary += `⚠️  **Registration:** ${registeredCount}/${successCount} registered in monitoring\n`;
      }
      summary += `🏷️ Customer: ${customer_name || 'default'} | 🌍 Region: ${aws_region}\n`;
      if (results.length > 0) {
        summary += `\n✅ **Created:**\n`;
        results.forEach(r => {
          const statusIcon = r.status === 'created' ? '✅' : (r.status === 'not_found_in_aws' ? '🗑️' : '⚠️');
          summary += `  ${statusIcon} ${r.type.toUpperCase()} ${r.name}\n`;
        });
      }
      if (failure) {
        summary += `\n❌ **Aborted on Failure at item ${failure.index}:** ${failure.error}\n`;
        summary += `\nℹ️ Remaining ${numCount - successCount} resource(s) were NOT created.\n`;
        throw new Error(summary);
      }
      if (registeredCount < successCount) {
        summary += `\n⚠️  Some resources created but not registered or not found in AWS. Refresh your dashboard to see them.`;
      } else {
        summary += `\n🎉 Completed without errors. All resources registered and verified in AWS.`;
      }
      return summary;
    },
  },
};

// 2️⃣ Create MCP Server
const server = new McpServer({ tools });

// 3️⃣ Express + WebSocket setup
const app = express();

// CORS configuration
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);
app.options("*", cors());

app.use(bodyParser.json());
const wss = new WebSocketServer({ noServer: true });
const PORT = 8080;

app.get("/", (req, res) => {
  res.send("✅ MCP Server is running on ws://localhost:" + PORT);
});

// Lightweight health endpoint (does not invoke Docker / Terraform)
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "node-mcp",
    terraformPersistent: process.env.PERSIST_TERRAFORM === "1",
    timestamp: new Date().toISOString(),
  });
});

// --------------------
// HTTP endpoints to trigger Terraform MCP tools via Docker stdio
// --------------------
app.get("/terraform/ping", async (req, res) => {
  try {
    const result = await callTerraformTool("ping", {});
    res.json({ ok: true, result });
  } catch (e) {
    // Differentiate infrastructure / protocol failure from generic error
    const isProtocol = /validation errors for JSONRP/i.test(e.message || "");
    const payload = {
      ok: false,
      infraUnavailable: !isProtocol, // treat non-protocol errors as infra/container issues
      protocolError: isProtocol,
      error: e.message,
      diagnostics: diagnoseTerraformInfra(),
    };
    // Return 503 for infra/container issues, 500 for protocol parsing
    res.status(isProtocol ? 500 : 503).json(payload);
  }
});

// AWS credentials health check (uses STS GetCallerIdentity)
app.get("/aws/credentials/check", async (req, res) => {
  try {
    const region = process.env.AWS_REGION || "us-east-1";
    const client = new STSClient({ region });
    const out = await client.send(new GetCallerIdentityCommand({}));
    // Optional DynamoDB connectivity check for deeper health signal
    let dynamoStatus = "skipped";
    let dynamoTables = null;
    try {
      const ddb = new DynamoDBClient({ region });
      const tables = await ddb.send(new ListTablesCommand({ Limit: 5 }));
      dynamoStatus = "ok";
      dynamoTables = tables.TableNames || [];
    } catch (dErr) {
      dynamoStatus = `error: ${dErr.name || dErr.message}`;
    }
    res.json({
      ok: true,
      account: out.Account,
      userId: out.UserId,
      arn: out.Arn,
      region,
      dynamo: dynamoStatus,
      sampleTables: dynamoTables
    });
  } catch (e) {
    res.status(200).json({
      ok: false,
      status: "warn",
      reason: e.name || e.code || e.message || "Unknown AWS auth error",
    });
  }
});

app.get("/terraform/tools", async (req, res) => {
  try {
    const result = await listTerraformTools();
    res.json({ ok: true, tools: result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Infra diagnostics endpoint
app.get("/infra/terraform", (req, res) => {
  try {
    const diag = diagnoseTerraformInfra();
    res.json({ ok: true, diagnostics: diag });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --------------------
// Unified NLP endpoint - natural language → tool routing via NVIDIA
// Auto-executes read-only operations, returns intent for destructive ops
// --------------------
app.post("/nlp", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ ok: false, error: "message required" });
    
    // Use NVIDIA router to determine tool and args
    const { tool, args } = await interpretMessage(message);
    
    // Check if tool exists
    if (!tools[tool]) {
      return res.status(404).json({ ok: false, error: `Unknown tool: ${tool}` });
    }
    
    // Determine if this is a destructive/infrastructure operation requiring confirmation
    const destructiveTools = [
      'createS3Bucket', 'destroyS3Bucket',
      'createEC2', 'destroyEC2',
      'createLambda', 'destroyLambda',
      'createTicket'  // Tickets modify state
    ];
    
    const requiresConfirmation = destructiveTools.includes(tool);
    
    if (requiresConfirmation) {
      // Return intent WITHOUT executing for destructive operations
      res.json({
        ok: true,
        intent: {
          tool,
          args,
          description: tools[tool].description,
          requiresConfirmation: true
        },
        message: "⚠️ This operation requires confirmation. Use /nlp/execute to proceed."
      });
    } else {
      // Auto-execute read-only operations and return result
      try {
        const result = await tools[tool].run(args);
        res.json({
          ok: true,
          tool,
          args,
          result,
          message: "Executed successfully"
        });
      } catch (toolError) {
        // Get AI explanation for the error
        const explanation = await explainError(
          tool,
          toolError.message,
          { args, description: tools[tool].description }
        );
        res.status(500).json({
          ok: false,
          error: toolError.message,
          explanation
        });
      }
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --------------------
// Execute confirmed NLP intent
// --------------------
app.post("/nlp/execute", async (req, res) => {
  try {
    const { tool, args, userConfirmed } = req.body;
    
    if (!userConfirmed) {
      return res.status(400).json({ ok: false, error: "userConfirmed must be true" });
    }
    
    if (!tool || !args) {
      return res.status(400).json({ ok: false, error: "tool and args required" });
    }
    
    if (!tools[tool]) {
      return res.status(404).json({ ok: false, error: `Unknown tool: ${tool}` });
    }
    
    // Execute the tool
    try {
      const result = await tools[tool].run(args);
      res.json({ ok: true, tool, args, result });
    } catch (toolError) {
      // Get AI explanation for the error
      const explanation = await explainError(
        tool,
        toolError.message,
        { args, description: tools[tool].description }
      );
      res.status(500).json({
        ok: false,
        error: toolError.message,
        explanation
      });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/terraform/s3", async (req, res) => {
  try {
    const { bucket_name, aws_region = "us-east-1" } = req.body || {};
    if (!bucket_name) return res.status(400).json({ ok: false, error: "bucket_name is required" });
    const result = await callTerraformTool("create_s3_bucket", { bucket_name, aws_region, auto_approve: true });
    const identifiers = extractIdentifiers(result);
    res.json({ ok: true, result, identifiers });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete("/terraform/s3/:name", async (req, res) => {
  try {
    const bucket_name = req.params.name;
    const result = await callTerraformTool("destroy_s3_bucket", { bucket_name, auto_approve: true });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/terraform/ec2", async (req, res) => {
  try {
    const { instance_count = 1, instance_name_prefix = 'mcp-demo-instance' } = req.body || {};
    const result = await callTerraformTool("create_ec2_instance", { instance_count, name_prefix: instance_name_prefix, auto_approve: true });
    const identifiers = extractIdentifiers(result);
    res.json({ ok: true, result, instance_count, instance_name_prefix, identifiers });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete("/terraform/ec2", async (req, res) => {
  try {
    const result = await callTerraformTool("destroy_ec2", {});
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/terraform/lambda", async (req, res) => {
  try {
    const { function_name, aws_region = "us-east-1", source_code } = req.body || {};
    if (!function_name) return res.status(400).json({ ok: false, error: "function_name is required" });
    const result = await callTerraformTool("create_lambda_function", { function_name, aws_region, source_code, auto_approve: true });
    const identifiers = extractIdentifiers(result);
    res.json({ ok: true, result, function_name, aws_region, identifiers });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete("/terraform/lambda", async (req, res) => {
  try {
    const result = await callTerraformTool("destroy_lambda_function", { auto_approve: true });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --------------------
// Monitoring Endpoints (proxy to Flask)
// --------------------
app.get("/monitor/metrics/:instance_id", async (req, res) => {
  try {
    const { instance_id } = req.params;
    const result = await axios.get(`${FLASK_URL}/monitor/metrics`, { params: { instance_id } });
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/monitor/metrics/enriched/:instance_id", async (req, res) => {
  try {
    const { instance_id } = req.params;
    const { resource_id, auto_update } = req.query;
    const result = await axios.get(`${FLASK_URL}/monitor/metrics/enriched`, { 
      params: { instance_id, resource_id, auto_update } 
    });
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Resources registry fetch (prefer real registry, fallback to mock metrics)
app.get("/monitor/resources", async (req, res) => {
  try {
    let data;
    try {
      // Try real resources registry with query parameters
      const queryParams = new URLSearchParams(req.query).toString();
      const url = `${FLASK_URL}/monitor/resources${queryParams ? '?' + queryParams : ''}`;
      const reg = await axios.get(url);
      data = reg.data;
    } catch (inner) {
      console.warn('⚠️ Falling back to mock metrics for resources:', inner.message);
      const mock = await axios.get(`${FLASK_URL}/monitor/mock/metrics`);
      data = mock.data;
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/monitor/resource/:resource_id", async (req, res) => {
  try {
    const { resource_id } = req.params;
    const result = await axios.get(`${FLASK_URL}/monitor/mock/metrics/${resource_id}`);
    res.json(result.data);
  } catch (e) {
    // If resource not found, return mock/empty metrics instead of error
    if (e.response?.status === 404) {
      console.warn(`⚠️ Resource ${resource_id} not found in metrics, returning mock data`);
      res.json({
        resource: {
          id: resource_id,
          name: resource_id,
          type: 'Unknown',
          status: 'unknown',
          metrics: {
            cpu_usage_percent: 0,
            memory_usage_percent: 0,
            network_in_mbps: 0,
            disk_iops: 0
          },
          health_score: 0
        },
        analysis: {
          analysis: "⚠️ This resource is not yet available in the monitoring system. Metrics will appear once the resource is fully initialized."
        }
      });
    } else {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
});

app.get("/monitor/logs", async (req, res) => {
  try {
    const { resource_id, status } = req.query;
    const result = await axios.get(`${FLASK_URL}/monitor/mock/logs`, { 
      params: { resource_id, status } 
    });
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/monitor/logs/analysis", async (req, res) => {
  try {
    const { resource_id, status } = req.query;
    const result = await axios.get(`${FLASK_URL}/monitor/mock/logs/analysis`, { 
      params: { resource_id, status } 
    });
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Resource management endpoints
app.post("/monitor/resources", async (req, res) => {
  try {
    const result = await axios.post(`${FLASK_URL}/monitor/resources`, req.body);
    res.status(result.status).json(result.data);
  } catch (e) {
    const status = e.response?.status || 500;
    res.status(status).json({ ok: false, error: e.message, details: e.response?.data });
  }
});

app.delete("/monitor/resources/:resource_id", async (req, res) => {
  try {
    const { resource_id } = req.params;
    const result = await axios.delete(`${FLASK_URL}/monitor/resources/${resource_id}`);
    res.json(result.data);
  } catch (e) {
    const status = e.response?.status || 500;
    res.status(status).json({ ok: false, error: e.message, details: e.response?.data });
  }
});

app.put("/monitor/resources/:resource_id", async (req, res) => {
  try {
    const { resource_id } = req.params;
    const result = await axios.put(`${FLASK_URL}/monitor/resources/${resource_id}`, req.body);
    res.json(result.data);
  } catch (e) {
    const status = e.response?.status || 500;
    res.status(status).json({ ok: false, error: e.message, details: e.response?.data });
  }
});

// Customer summary endpoint
app.get("/monitor/customers/summary", async (req, res) => {
  try {
    const result = await axios.get(`${FLASK_URL}/monitor/mock/customers/health`);
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// AI-powered response parsing endpoint
app.post("/ai/parse", async (req, res) => {
  try {
    const { data, context } = req.body;
    
    if (!data) {
      return res.status(400).json({ ok: false, error: 'No data provided' });
    }

    // Call NVIDIA API to parse the data into user-friendly text
    const NVIDIA_API_KEY = process.env.MODEL_API_KEY;
    if (!NVIDIA_API_KEY) {
      throw new Error('NVIDIA API key not configured');
    }

    const systemPrompt = `You are a helpful infrastructure monitoring assistant. Your job is to take technical data and present it in a clear, user-friendly way.

When analyzing data:
- Use natural language and conversational tone
- Highlight important metrics and trends
- Use emojis sparingly to emphasize status (✅ good, ⚠️ warning, ❌ critical)
- Structure information with clear sections
- Focus on actionable insights
- Keep responses concise but informative

For customer summaries, focus on:
- Overall health status of each customer
- Critical issues that need attention
- Resource usage patterns
- Recommendations for improvement`;

    const userPrompt = context 
      ? `Context: ${context}\n\nData to analyze:\n${JSON.stringify(data, null, 2)}`
      : `Please provide a user-friendly summary of this data:\n${JSON.stringify(data, null, 2)}`;

    const response = await axios.post(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      {
        model: 'nvidia/llama-3.1-nemotron-70b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = response.data.choices[0]?.message?.content || 'Unable to parse response';
    
    res.json({ 
      ok: true, 
      parsed_response: aiResponse,
      raw_data: data
    });

  } catch (e) {
    console.error('AI parsing error:', e.message);
    res.status(500).json({ 
      ok: false, 
      error: e.message,
      fallback: 'Unable to parse data with AI. Please check the raw data in the response.'
    });
  }
});

const httpServer = app.listen(PORT, () =>
  console.log(`🚀 MCP Server ready on ws://localhost:${PORT}`)
);

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff(operation, operationName, maxRetries = RETRY_CONFIG.maxRetries) {
  let lastError;
  let delay = RETRY_CONFIG.initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} for ${operationName}...`);
      const result = await operation();
      const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
      const hasError = /Error:|Failed|InvalidParameterValue|InvalidBucketName|UnauthorizedOperation|AccessDenied/i.test(resultStr);
      if (hasError && attempt < maxRetries) {
        console.warn(`⚠️ Attempt ${attempt} detected error in result, retrying...`);
        lastError = new Error(`Operation returned error: ${resultStr.substring(0, 200)}`);
        await sleep(delay);
        delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
        continue;
      }
      if (attempt > 1) {
        console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      if (attempt < maxRetries) {
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await sleep(delay);
        delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
      }
    }
  }
  throw new Error(`${operationName} failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
}

async function verifyResourceRegistration(resourceName, customerName, maxWaitMs = 5000) {
  const startTime = Date.now();
  const pollInterval = 500;
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await axios.get(`${FLASK_URL}/monitor/resources?customer_name=${customerName}`);
      const resources = response.data.resources || [];
      const found = resources.find(r => r.name === resourceName);
      if (found) {
        console.log(`✅ Verified ${resourceName} in DynamoDB (took ${Date.now() - startTime}ms)`);
        return found;
      }
    } catch (e) {
      console.warn(`⚠️ Verification check failed: ${e.message}`);
    }
    await sleep(pollInterval);
  }
  console.warn(`⚠️ Could not verify ${resourceName} in DynamoDB after ${maxWaitMs}ms`);
  return null;
}

async function registerResourceWithRetry(resourceData, resourceType, maxRetries = 3) {
  return retryWithBackoff(
    async () => {
      const response = await axios.post(`${FLASK_URL}/monitor/resources`, resourceData);
      if (response.data.success) {
        await sleep(500);
        const verified = await verifyResourceRegistration(
          resourceData.name,
          resourceData.customer_name || 'default',
          3000
        );
        if (!verified) {
          throw new Error('Resource registration succeeded but verification failed - possible DynamoDB delay');
        }
      }
      return response.data;
    },
    `Register ${resourceType} ${resourceData.name}`,
    maxRetries
  );
}

async function awsResourceExists(type, name, region = "us-east-1") {
  try {
    if (type === "S3") {
      const s3 = new S3Client({ region });
      await s3.send(new HeadBucketCommand({ Bucket: name }));
      return true;
    } else if (type === "EC2") {
      const ec2 = new EC2Client({ region });
      const res = await ec2.send(new DescribeInstancesCommand({
        Filters: [{ Name: "tag:Name", Values: [name] }]
      }));
      return (res.Reservations || []).some(r => r.Instances && r.Instances.length > 0);
    } else if (type === "LAMBDA") {
      const lambda = new LambdaClient({ region });
      await lambda.send(new GetFunctionCommand({ FunctionName: name }));
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

async function removeResourceFromDynamoDB(resourceName, customerName) {
  try {
    // Get resource ID from DynamoDB
    const response = await axios.get(`${FLASK_URL}/monitor/resources?customer_name=${customerName}`);
    const resources = response.data.resources || [];
    const found = resources.find(r => r.name === resourceName);
    if (found && found.id) {
      await axios.delete(`${FLASK_URL}/monitor/resources/${found.id}`);
      console.warn(`🗑️ Removed ${resourceName} from DynamoDB (not found in AWS)`);
    }
  } catch (e) {
    console.warn(`⚠️ Failed to remove ${resourceName} from DynamoDB: ${e.message}`);
  }
}

function normalizeToolToType(toolName) {
  // Map tool names to the type strings expected by awsResourceExists
  const map = {
    createS3Bucket: 'S3',
    destroyS3Bucket: 'S3',
    createEC2: 'EC2',
    destroyEC2: 'EC2',
    createLambda: 'LAMBDA',
    destroyLambda: 'LAMBDA'
  };
  return map[toolName] || null;
}

// 4️⃣ WebSocket Message Handling
httpServer.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.on("message", async (data) => {
      try {
        const payload = JSON.parse(data.toString());
        const { message, intent, userConfirmed } = payload;
        
        // Two-phase: 1) Get intent, 2) Execute with confirmation
        if (intent && userConfirmed) {
          // Phase 2: User confirmed, execute the intent
          console.log("✅ User confirmed:", intent);
          
          if (!tools[intent.tool]) {
            throw new Error(`Unknown tool: ${intent.tool}`);
          }
          
          try {
            const result = await tools[intent.tool].run(intent.args);
            console.log("✅ Tool result:", result);

            // Only verify for create operations where we can determine a name
            const normalizedType = normalizeToolToType(intent.tool);
            const createdName = (result && typeof result === 'object' && result.name) 
              ? result.name 
              : (intent.args.bucket_name || intent.args.instance_name || intent.args.function_name);
            const region = (result && typeof result === 'object' && result.region) 
              ? result.region 
              : (intent.args.aws_region || "us-east-1");

            let replyPayload = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

            if (intent.tool.startsWith('create') && normalizedType && createdName) {
              const exists = await awsResourceExists(normalizedType, createdName, region);
              if (!exists) {
                // Resource does not exist in AWS, remove from DynamoDB if present
                await removeResourceFromDynamoDB(createdName, intent.args.customer_name || 'default');
                ws.send(JSON.stringify({ 
                  reply: `⚠️ Resource ${createdName} was not found in AWS after creation. It has been removed from the registry.\n\n${replyPayload}`
                }));
                return;
              }
            }

            ws.send(JSON.stringify({ 
              reply: replyPayload,
              intent: intent.tool 
            }));
          } catch (toolError) {
            // Tool execution failed - store error and get AI explanation
            console.error("❌ Tool execution failed:", toolError.message);
            
            // Store error for future reference
            lastError = {
              operation: intent.tool,
              message: toolError.message,
              context: {
                args: intent.args,
                description: intent.description || tools[intent.tool]?.description,
                timestamp: new Date().toISOString()
              }
            };
            
            const explanation = await explainError(
              intent.tool, 
              toolError.message,
              {
                args: intent.args,
                description: intent.description || tools[intent.tool]?.description
              }
            );
            
            ws.send(JSON.stringify({ 
              reply: explanation
            }));
          }
        } else if (message) {
          // Phase 1: Parse user message and return intent
          console.log("🗣️ User:", message);

          // Ask NVIDIA model to route it
          const { tool, args } = await interpretMessage(message);
          console.log("🧩 Routed to:", tool, args);

          // Check if tool is destructive
          const destructiveTools = [
            'createS3Bucket', 'destroyS3Bucket',
            'createEC2', 'destroyEC2',
            'createLambda', 'destroyLambda',
            'batchCreate'
          ];
          
          const requiresConfirmation = destructiveTools.includes(tool);
          
          if (requiresConfirmation) {
            // Build a friendly confirmation message
            const prettyArgs = Object.entries(args || {})
              .filter(([, v]) => v !== undefined && v !== null && v !== '')
              .map(([k, v]) => `• ${k.replace(/_/g, ' ')}: ${v}`)
              .join("\n");
            const titles = {
              createS3Bucket: 'Create S3 Bucket',
              destroyS3Bucket: 'Destroy S3 Bucket',
              createEC2: 'Create EC2 Instance',
              destroyEC2: 'Destroy EC2 Instance',
              createLambda: 'Create Lambda Function',
              destroyLambda: 'Destroy Lambda Function',
              batchCreate: 'Batch Create Resources'
            };
            const title = titles[tool] || tool;

            ws.send(JSON.stringify({
              needsConfirmation: true,
              intent: { tool, args, description: tools[tool]?.description },
              message: `⚠️ ${title}\n\n${prettyArgs || 'No parameters provided.'}\n\nConfirm to proceed.`
            }));
          } else {
            // Safe operation, execute immediately
            try {
              const result = await tools[tool].run(args);
              console.log("✅ Tool result:", result);
              ws.send(JSON.stringify({ 
                reply: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
              }));
            } catch (toolError) {
              // Tool execution failed - store error and get AI explanation
              console.error("❌ Tool execution failed:", toolError.message);
              
              // Store error for future reference
              lastError = {
                operation: tool,
                message: toolError.message,
                context: {
                  args: args,
                  description: tools[tool]?.description,
                  timestamp: new Date().toISOString()
                }
              };
              
              const explanation = await explainError(
                tool, 
                toolError.message,
                {
                  args: args,
                  description: tools[tool]?.description
                }
              );
              
              ws.send(JSON.stringify({ 
                reply: explanation
              }));
            }
          }
        } else {
          throw new Error("Invalid message format");
        }
      } catch (err) {
        console.error("❌ Error processing message:", err);
        // For general errors (not tool-specific), send a simple error message
        ws.send(JSON.stringify({ error: err.message }));
      }
    });
  });
});
