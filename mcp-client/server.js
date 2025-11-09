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
      return parsed;
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
      return parsed;
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
      return parsed;
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
      const res = await axios.get(`${FLASK_URL}/monitor/mock/metrics/${resource_id}`);
      return res.data;
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
          let registrationSucceeded = false;
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
            registrationSucceeded = true;
          } catch (e) {
            console.error(`❌ Failed to register ${typeAbbr} ${name} after retries:`, e.message);
            results.push({ index: i + 1, type: typeAbbr, name, status: 'created_but_not_registered', result: parsed });
          }
     