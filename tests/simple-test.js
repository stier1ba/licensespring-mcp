#!/usr/bin/env node

/**
 * Simple MCP Server Tester
 * Tests the LicenseSpring MCP servers by starting them and sending basic MCP messages
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

class SimpleMCPTester {
  constructor() {
    this.results = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'test' ? '🧪' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async testServer(serverPath, serverName) {
    this.log(`\n=== Testing ${serverName} ===`);
    
    return new Promise((resolve) => {
      const server = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let serverReady = false;
      let testResults = { passed: 0, failed: 0, serverName };

      // Handle server startup
      server.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('running on stdio')) {
          this.log(`${serverName} started successfully`, 'success');
          serverReady = true;
          this.runBasicTests(server, testResults).then(() => {
            server.kill();
            resolve(testResults);
          });
        } else if (output.includes('Error') || output.includes('error')) {
          this.log(`Server error: ${output.trim()}`, 'error');
          testResults.failed++;
        }
      });

      server.on('error', (err) => {
        this.log(`Failed to start server: ${err.message}`, 'error');
        testResults.failed++;
        resolve(testResults);
      });

      server.on('close', (code) => {
        if (!serverReady) {
          this.log(`Server exited with code ${code} before becoming ready`, 'error');
          testResults.failed++;
        }
        resolve(testResults);
      });

      // Timeout
      setTimeout(15000).then(() => {
        if (!serverReady) {
          this.log(`Server startup timeout`, 'error');
          testResults.failed++;
          server.kill();
          resolve(testResults);
        }
      });
    });
  }

  async runBasicTests(server, results) {
    try {
      // Test 1: Initialize
      this.log('Test 1: Initialize server', 'test');
      const initResponse = await this.sendMessage(server, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });

      if (initResponse && initResponse.result && initResponse.result.capabilities) {
        this.log('✅ Initialize: SUCCESS', 'success');
        results.passed++;
      } else {
        this.log('❌ Initialize: FAILED', 'error');
        results.failed++;
        return; // Can't continue without initialization
      }

      // Test 2: List Tools
      this.log('Test 2: List tools', 'test');
      const toolsResponse = await this.sendMessage(server, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      });

      if (toolsResponse && toolsResponse.result && Array.isArray(toolsResponse.result.tools)) {
        const toolCount = toolsResponse.result.tools.length;
        this.log(`✅ List tools: SUCCESS (${toolCount} tools found)`, 'success');
        results.passed++;
        
        // Log available tools
        toolsResponse.result.tools.forEach(tool => {
          this.log(`   - ${tool.name}: ${tool.description}`);
        });
      } else {
        this.log('❌ List tools: FAILED', 'error');
        results.failed++;
      }

      // Test 3: List Resources
      this.log('Test 3: List resources', 'test');
      const resourcesResponse = await this.sendMessage(server, {
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/list',
        params: {}
      });

      if (resourcesResponse && resourcesResponse.result && Array.isArray(resourcesResponse.result.resources)) {
        const resourceCount = resourcesResponse.result.resources.length;
        this.log(`✅ List resources: SUCCESS (${resourceCount} resources found)`, 'success');
        results.passed++;
      } else {
        this.log('❌ List resources: FAILED', 'error');
        results.failed++;
      }

      // Test 4: List Prompts
      this.log('Test 4: List prompts', 'test');
      const promptsResponse = await this.sendMessage(server, {
        jsonrpc: '2.0',
        id: 4,
        method: 'prompts/list',
        params: {}
      });

      if (promptsResponse && promptsResponse.result && Array.isArray(promptsResponse.result.prompts)) {
        const promptCount = promptsResponse.result.prompts.length;
        this.log(`✅ List prompts: SUCCESS (${promptCount} prompts found)`, 'success');
        results.passed++;
      } else {
        this.log('❌ List prompts: FAILED', 'error');
        results.failed++;
      }

      // Test 5: Try a tool call (expect authentication error)
      if (toolsResponse && toolsResponse.result && toolsResponse.result.tools.length > 0) {
        const firstTool = toolsResponse.result.tools[0];
        this.log(`Test 5: Call tool '${firstTool.name}'`, 'test');
        
        // Create minimal valid arguments based on tool schema
        let args = {};
        if (firstTool.inputSchema && firstTool.inputSchema.properties) {
          const props = firstTool.inputSchema.properties;
          Object.keys(props).forEach(key => {
            const prop = props[key];
            if (prop.type === 'string') {
              args[key] = 'test-value';
            } else if (prop.type === 'number') {
              args[key] = 1;
            } else if (prop.type === 'boolean') {
              args[key] = true;
            }
          });
        }

        const toolResponse = await this.sendMessage(server, {
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: firstTool.name,
            arguments: args
          }
        });

        if (toolResponse && (toolResponse.result || toolResponse.error)) {
          this.log(`✅ Tool call: SUCCESS (got response)`, 'success');
          results.passed++;
          
          if (toolResponse.error) {
            this.log(`   Expected error: ${toolResponse.error.message}`);
          } else if (toolResponse.result && toolResponse.result.isError) {
            this.log(`   Expected API error in result`);
          }
        } else {
          this.log('❌ Tool call: FAILED', 'error');
          results.failed++;
        }
      }

    } catch (error) {
      this.log(`Test execution error: ${error.message}`, 'error');
      results.failed++;
    }
  }

  async sendMessage(server, message) {
    return new Promise((resolve, reject) => {
      const messageStr = JSON.stringify(message) + '\n';
      let response = '';
      let responseReceived = false;

      const onData = (data) => {
        response += data.toString();
        
        // Try to parse JSON responses
        const lines = response.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.id === message.id) {
              server.stdout.removeListener('data', onData);
              responseReceived = true;
              resolve(parsed);
              return;
            }
          } catch (e) {
            // Continue waiting
          }
        }
      };

      server.stdout.on('data', onData);
      server.stdin.write(messageStr);

      // Timeout after 3 seconds
      setTimeout(3000).then(() => {
        if (!responseReceived) {
          server.stdout.removeListener('data', onData);
          reject(new Error(`Timeout waiting for response to ${message.method}`));
        }
      });
    });
  }
}

// Main execution
async function main() {
  const tester = new SimpleMCPTester();
  
  console.log('🚀 Starting LicenseSpring MCP Server Tests\n');
  
  try {
    // Test License API Server
    const licenseResults = await tester.testServer(
      'dist/license-api-server.js',
      'License API Server'
    );
    
    // Test Management API Server
    const managementResults = await tester.testServer(
      'dist/management-api-server.js',
      'Management API Server'
    );
    
    // Summary
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    console.log(`License API Server:    ${licenseResults.passed} passed, ${licenseResults.failed} failed`);
    console.log(`Management API Server: ${managementResults.passed} passed, ${managementResults.failed} failed`);
    console.log(`Total:                 ${licenseResults.passed + managementResults.passed} passed, ${licenseResults.failed + managementResults.failed} failed`);
    
    if (licenseResults.failed + managementResults.failed === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed - check output above for details');
    }
    
  } catch (error) {
    console.error(`❌ Test execution failed: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
