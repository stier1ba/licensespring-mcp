#!/usr/bin/env node

/**
 * MCP Server Tester with Test Environment
 * Tests the LicenseSpring MCP servers using mock credentials
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import { readFileSync, writeFileSync } from 'fs';

class MCPServerTester {
  constructor() {
    this.results = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'test' ? '🧪' : 'ℹ️';
    const logMessage = `[${timestamp}] ${prefix} ${message}`;
    console.log(logMessage);
    this.results.push({ timestamp, type, message });
  }

  async testServer(serverPath, serverName, envFile = '.env.test') {
    this.log(`\n=== Testing ${serverName} ===`);
    
    return new Promise((resolve) => {
      // Set environment variables from test file
      const envContent = readFileSync(envFile, 'utf8');
      const envVars = {};
      envContent.split('\n').forEach(line => {
        if (line.trim() && !line.startsWith('#')) {
          const [key, value] = line.split('=');
          if (key && value) {
            envVars[key.trim()] = value.trim();
          }
        }
      });

      const server = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env, ...envVars }
      });

      let serverReady = false;
      let testResults = { passed: 0, failed: 0, serverName, tools: [], resources: [], prompts: [] };
      let startupError = null;

      // Handle server output
      server.stdout.on('data', (data) => {
        const output = data.toString();
        // MCP servers typically don't output to stdout except for protocol messages
      });

      // Handle server startup and errors
      server.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('running on stdio')) {
          this.log(`${serverName} started successfully`, 'success');
          serverReady = true;
          this.runMCPTests(server, testResults).then(() => {
            server.kill();
            resolve(testResults);
          }).catch(err => {
            this.log(`Test execution failed: ${err.message}`, 'error');
            testResults.failed++;
            server.kill();
            resolve(testResults);
          });
        } else if (output.includes('Error') || output.includes('error')) {
          startupError = output.trim();
          this.log(`Server startup error: ${startupError}`, 'error');
        } else {
          // Log other stderr output for debugging
          this.log(`Server stderr: ${output.trim()}`);
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
          if (startupError) {
            this.log(`Startup error was: ${startupError}`, 'error');
          }
          testResults.failed++;
        }
        resolve(testResults);
      });

      // Timeout after 10 seconds
      setTimeout(10000).then(() => {
        if (!serverReady) {
          this.log(`Server startup timeout (10s)`, 'error');
          testResults.failed++;
          server.kill();
          resolve(testResults);
        }
      });
    });
  }

  async runMCPTests(server, results) {
    try {
      // Test 1: Initialize
      this.log('Test 1: Initialize server', 'test');
      const initResponse = await this.sendMCPMessage(server, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {}, resources: {}, prompts: {} },
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });

      if (initResponse && initResponse.result && initResponse.result.capabilities) {
        this.log('✅ Initialize: SUCCESS', 'success');
        results.passed++;
        this.log(`   Protocol version: ${initResponse.result.protocolVersion}`);
        this.log(`   Server capabilities: ${Object.keys(initResponse.result.capabilities).join(', ')}`);
      } else {
        this.log('❌ Initialize: FAILED', 'error');
        this.log(`   Response: ${JSON.stringify(initResponse)}`);
        results.failed++;
        return; // Can't continue without initialization
      }

      // Test 2: List Tools
      this.log('Test 2: List tools', 'test');
      const toolsResponse = await this.sendMCPMessage(server, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      });

      if (toolsResponse && toolsResponse.result && Array.isArray(toolsResponse.result.tools)) {
        const toolCount = toolsResponse.result.tools.length;
        this.log(`✅ List tools: SUCCESS (${toolCount} tools found)`, 'success');
        results.passed++;
        results.tools = toolsResponse.result.tools;
        
        // Log available tools
        toolsResponse.result.tools.forEach(tool => {
          this.log(`   - ${tool.name}: ${tool.description}`);
        });
      } else {
        this.log('❌ List tools: FAILED', 'error');
        this.log(`   Response: ${JSON.stringify(toolsResponse)}`);
        results.failed++;
      }

      // Test 3: List Resources
      this.log('Test 3: List resources', 'test');
      const resourcesResponse = await this.sendMCPMessage(server, {
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/list',
        params: {}
      });

      if (resourcesResponse && resourcesResponse.result && Array.isArray(resourcesResponse.result.resources)) {
        const resourceCount = resourcesResponse.result.resources.length;
        this.log(`✅ List resources: SUCCESS (${resourceCount} resources found)`, 'success');
        results.passed++;
        results.resources = resourcesResponse.result.resources;
        
        // Log available resources
        resourcesResponse.result.resources.forEach(resource => {
          this.log(`   - ${resource.name}: ${resource.description}`);
        });
      } else {
        this.log('❌ List resources: FAILED', 'error');
        this.log(`   Response: ${JSON.stringify(resourcesResponse)}`);
        results.failed++;
      }

      // Test 4: List Prompts
      this.log('Test 4: List prompts', 'test');
      const promptsResponse = await this.sendMCPMessage(server, {
        jsonrpc: '2.0',
        id: 4,
        method: 'prompts/list',
        params: {}
      });

      if (promptsResponse && promptsResponse.result && Array.isArray(promptsResponse.result.prompts)) {
        const promptCount = promptsResponse.result.prompts.length;
        this.log(`✅ List prompts: SUCCESS (${promptCount} prompts found)`, 'success');
        results.passed++;
        results.prompts = promptsResponse.result.prompts;
        
        // Log available prompts
        promptsResponse.result.prompts.forEach(prompt => {
          this.log(`   - ${prompt.name}: ${prompt.description}`);
        });
      } else {
        this.log('❌ List prompts: FAILED', 'error');
        this.log(`   Response: ${JSON.stringify(promptsResponse)}`);
        results.failed++;
      }

      // Test 5: Try calling a tool (expect authentication error with real API)
      if (results.tools.length > 0) {
        const testTool = results.tools[0];
        this.log(`Test 5: Call tool '${testTool.name}' (expect auth error)`, 'test');
        
        // Create minimal valid arguments
        const args = this.createTestArguments(testTool.inputSchema);
        
        const toolResponse = await this.sendMCPMessage(server, {
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: testTool.name,
            arguments: args
          }
        });

        if (toolResponse) {
          if (toolResponse.result) {
            this.log(`✅ Tool call: SUCCESS (got result)`, 'success');
            results.passed++;
            
            if (toolResponse.result.isError) {
              this.log(`   Expected API error: Tool returned error as expected`);
            } else if (toolResponse.result.content) {
              this.log(`   Tool returned content (length: ${JSON.stringify(toolResponse.result.content).length})`);
            }
          } else if (toolResponse.error) {
            this.log(`✅ Tool call: SUCCESS (got error response)`, 'success');
            results.passed++;
            this.log(`   Error: ${toolResponse.error.message}`);
          } else {
            this.log('❌ Tool call: FAILED (no result or error)', 'error');
            results.failed++;
          }
        } else {
          this.log('❌ Tool call: FAILED (no response)', 'error');
          results.failed++;
        }
      }

    } catch (error) {
      this.log(`Test execution error: ${error.message}`, 'error');
      results.failed++;
    }
  }

  createTestArguments(inputSchema) {
    const args = {};
    
    if (inputSchema && inputSchema.properties) {
      Object.entries(inputSchema.properties).forEach(([key, prop]) => {
        if (prop.type === 'string') {
          args[key] = 'test-value';
        } else if (prop.type === 'number') {
          args[key] = 1;
        } else if (prop.type === 'boolean') {
          args[key] = true;
        } else if (prop.type === 'object') {
          args[key] = {};
        }
      });
    }
    
    return args;
  }

  async sendMCPMessage(server, message) {
    return new Promise((resolve, reject) => {
      const messageStr = JSON.stringify(message) + '\n';
      let response = '';
      let responseReceived = false;

      const onData = (data) => {
        response += data.toString();
        
        // Try to parse JSON responses line by line
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
            // Continue waiting for complete response
          }
        }
      };

      server.stdout.on('data', onData);
      server.stdin.write(messageStr);

      // Timeout after 5 seconds
      setTimeout(5000).then(() => {
        if (!responseReceived) {
          server.stdout.removeListener('data', onData);
          reject(new Error(`Timeout waiting for response to ${message.method}`));
        }
      });
    });
  }

  generateReport(allResults) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalServers: allResults.length,
        totalTests: allResults.reduce((sum, r) => sum + r.passed + r.failed, 0),
        totalPassed: allResults.reduce((sum, r) => sum + r.passed, 0),
        totalFailed: allResults.reduce((sum, r) => sum + r.failed, 0)
      },
      servers: allResults,
      logs: this.results
    };

    writeFileSync('mcp-test-results.json', JSON.stringify(report, null, 2));
    this.log(`Detailed test report saved to mcp-test-results.json`, 'info');
    
    return report;
  }
}

// Main execution
async function main() {
  const tester = new MCPServerTester();
  
  console.log('🚀 Starting LicenseSpring MCP Server Tests with Mock Environment\n');
  
  try {
    const allResults = [];
    
    // Test License API Server
    const licenseResults = await tester.testServer(
      'dist/license-api-server.js',
      'License API Server'
    );
    allResults.push(licenseResults);
    
    // Test Management API Server
    const managementResults = await tester.testServer(
      'dist/management-api-server.js',
      'Management API Server'
    );
    allResults.push(managementResults);
    
    // Generate report
    const report = tester.generateReport(allResults);
    
    // Summary
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    allResults.forEach(result => {
      console.log(`${result.serverName}: ${result.passed} passed, ${result.failed} failed`);
      console.log(`  Tools: ${result.tools.length}, Resources: ${result.resources.length}, Prompts: ${result.prompts.length}`);
    });
    console.log(`Total: ${report.summary.totalPassed} passed, ${report.summary.totalFailed} failed`);
    
    if (report.summary.totalFailed === 0) {
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
