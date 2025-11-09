#!/usr/bin/env node
// Test script to verify dashboard can fetch monitoring data
import fetch from 'node-fetch';

const NODE_URL = 'http://localhost:8080';

async function testMonitoring() {
  console.log('🧪 Testing monitoring endpoints...\n');

  try {
    // Test 1: Get all resources
    console.log('1️⃣ Fetching all resources...');
    const resourcesRes = await fetch(`${NODE_URL}/monitor/resources`);
    if (!resourcesRes.ok) throw new Error(`Resources failed: ${resourcesRes.status}`);
    const resourcesData = await resourcesRes.json();
    console.log(`✅ Found ${resourcesData.resources?.length || 0} resources`);
    
    if (resourcesData.resources && resourcesData.resources.length > 0) {
      const firstResource = resourcesData.resources[0];
      console.log(`   First resource: ${firstResource.id} (${firstResource.name})\n`);

      // Test 2: Get specific resource metrics
      console.log('2️⃣ Fetching metrics for first resource...');
      const metricsRes = await fetch(`${NODE_URL}/monitor/resource/${firstResource.id}`);
      if (!metricsRes.ok) throw new Error(`Metrics failed: ${metricsRes.status}`);
      const metricsData = await metricsRes.json();
      
      const metrics = metricsData.resource?.metrics || metricsData.metrics;
      if (metrics) {
        console.log('✅ Metrics retrieved:');
        console.log(`   CPU: ${metrics.cpu_usage_percent}%`);
        console.log(`   RAM: ${metrics.memory_usage_percent}%`);
        console.log(`   Disk: ${metrics.disk_usage_percent}%`);
        console.log(`   Network In: ${metrics.network_in_mbps} Mbps`);
      } else {
        console.log('⚠️  No metrics found in response');
      }
    } else {
      console.log('⚠️  No resources found - check Flask backend and metrics.json');
    }

    console.log('\n✅ All tests passed! Dashboard should load data correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\nMake sure:');
    console.log('  1. Node MCP server is running: node mcp-client/server.js');
    console.log('  2. Flask backend is running: python app.py');
    console.log('  3. metrics.json exists with sample data');
    process.exit(1);
  }
}

testMonitoring();
