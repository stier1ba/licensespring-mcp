#!/usr/bin/env node

/**
 * Basic test to check if MCP servers can start and respond
 */

import { spawn } from 'child_process';

function testServer(serverPath, serverName) {
  console.log(`\n=== Testing ${serverName} ===`);
  
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      LICENSE_API_KEY: 'test-api-key',
      LICENSE_SHARED_KEY: 'test-shared-key',
      MANAGEMENT_API_KEY: 'test-management-key'
    };

    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env,
      cwd: process.cwd()
    });

    let output = '';
    let errors = '';
    let serverStarted = false;

    server.stdout.on('data', (data) => {
      output += data.toString();
      console.log('STDOUT:', data.toString());
    });

    server.stderr.on('data', (data) => {
      const text = data.toString();
      errors += text;
      console.log('STDERR:', text);
      
      if (text.includes('running on stdio')) {
        console.log(`✅ ${serverName} started successfully!`);
        serverStarted = true;
        
        // Send a simple initialize message
        const initMessage = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: { name: 'test', version: '1.0.0' }
          }
        }) + '\n';
        
        console.log('Sending initialize message...');
        server.stdin.write(initMessage);
        
        // Wait a bit then kill
        setTimeout(() => {
          server.kill();
          resolve({ success: true, output, errors });
        }, 2000);
      }
    });

    server.on('error', (err) => {
      console.log(`❌ Failed to start ${serverName}: ${err.message}`);
      resolve({ success: false, error: err.message, output, errors });
    });

    server.on('close', (code) => {
      console.log(`${serverName} exited with code ${code}`);
      if (!serverStarted) {
        resolve({ success: false, error: `Exited with code ${code}`, output, errors });
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!serverStarted) {
        console.log(`❌ ${serverName} startup timeout`);
        server.kill();
        resolve({ success: false, error: 'Startup timeout', output, errors });
      }
    }, 10000);
  });
}

async function main() {
  console.log('🚀 Basic MCP Server Test\n');
  
  try {
    // Test License API Server
    const licenseResult = await testServer('dist/license-api-server.js', 'License API Server');
    console.log('\nLicense API Result:', licenseResult.success ? 'SUCCESS' : 'FAILED');
    if (!licenseResult.success) {
      console.log('Error:', licenseResult.error);
    }
    
    // Test Management API Server
    const managementResult = await testServer('dist/management-api-server.js', 'Management API Server');
    console.log('\nManagement API Result:', managementResult.success ? 'SUCCESS' : 'FAILED');
    if (!managementResult.success) {
      console.log('Error:', managementResult.error);
    }
    
    console.log('\n📊 Summary:');
    console.log(`License API Server: ${licenseResult.success ? 'PASS' : 'FAIL'}`);
    console.log(`Management API Server: ${managementResult.success ? 'PASS' : 'FAIL'}`);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

main();
