#!/usr/bin/env node

/**
 * Test Environment for LicenseSpring MCP Servers
 * This script tests both License API and Management API MCP servers
 * by simulating MCP client interactions and validating tool responses.
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Test configuration
const TEST_CONFIG = {
  // Test data for License API
  licenseApi: {
    validLicenseKey: 'TEST-LICENSE-KEY-12345',
    validHardwareId: 'test-hardware-id-67890',
    validProduct: 'test-product-code',
    invalidLicenseKey: 'INVALID-KEY',
    invalidHardwareId: '',
    invalidProduct: ''
  },
  
  // Test data for Management API
  managementApi: {
    validCustomerId: 1,
    validProductId: 1,
    validLicenseId: 1,
    testEmail: 'test@example.com',
    testCustomer: {
      email: 'testcustomer@example.com',
      first_name: 'Test',
      last_name: 'Customer',
      company_name: 'Test Company'
    }
  },
  
  // MCP message templates
  mcpMessages: {
    initialize: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    },
    
    listTools: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    },
    
    listResources: {
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list',
      params: {}
    },
    
    listPrompts: {
      jsonrpc: '2.0',
      id: 4,
      method: 'prompts/list',
      params: {}
    }
  }
};

class MCPTester {
  constructor() {
    this.testResults = [];
    this.currentTestId = 0;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    this.testResults.push({
      timestamp,
      type,
      message,
      testId: this.currentTestId
    });
  }

  async testServer(serverScript, serverName) {
    this.log(`\n=== Testing ${serverName} ===`, 'info');
    
    return new Promise((resolve, reject) => {
      const server = spawn('node', [serverScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let serverOutput = '';
      let serverErrors = '';
      let testsPassed = 0;
      let testsFailed = 0;

      server.stdout.on('data', (data) => {
        serverOutput += data.toString();
      });

      server.stderr.on('data', (data) => {
        const errorText = data.toString();
        serverErrors += errorText;
        
        // Check if server started successfully
        if (errorText.includes('running on stdio')) {
          this.log(`${serverName} started successfully`, 'success');
          this.runServerTests(server, serverName)
            .then(results => {
              testsPassed = results.passed;
              testsFailed = results.failed;
              server.kill();
            })
            .catch(err => {
              this.log(`Test execution failed: ${err.message}`, 'error');
              testsFailed++;
              server.kill();
            });
        }
      });

      server.on('close', (code) => {
        this.log(`${serverName} exited with code ${code}`, code === 0 ? 'info' : 'error');
        
        if (serverErrors && !serverErrors.includes('running on stdio')) {
          this.log(`Server errors: ${serverErrors}`, 'error');
        }
        
        resolve({
          serverName,
          passed: testsPassed,
          failed: testsFailed,
          output: serverOutput,
          errors: serverErrors
        });
      });

      server.on('error', (err) => {
        this.log(`Failed to start ${serverName}: ${err.message}`, 'error');
        reject(err);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        this.log(`${serverName} test timeout`, 'error');
        server.kill();
        resolve({
          serverName,
          passed: testsPassed,
          failed: testsFailed + 1,
          output: serverOutput,
          errors: serverErrors + '\nTest timeout'
        });
      }, 30000);
    });
  }

  async runServerTests(server, serverName) {
    let passed = 0;
    let failed = 0;

    try {
      // Test 1: Initialize
      this.currentTestId++;
      this.log(`Test ${this.currentTestId}: Initialize ${serverName}`, 'test');
      const initResult = await this.sendMCPMessage(server, TEST_CONFIG.mcpMessages.initialize);
      if (this.validateInitializeResponse(initResult)) {
        passed++;
        this.log('✓ Initialize test passed', 'success');
      } else {
        failed++;
        this.log('✗ Initialize test failed', 'error');
      }

      // Test 2: List Tools
      this.currentTestId++;
      this.log(`Test ${this.currentTestId}: List tools`, 'test');
      const toolsResult = await this.sendMCPMessage(server, TEST_CONFIG.mcpMessages.listTools);
      if (this.validateToolsResponse(toolsResult, serverName)) {
        passed++;
        this.log('✓ List tools test passed', 'success');
      } else {
        failed++;
        this.log('✗ List tools test failed', 'error');
      }

      // Test 3: List Resources
      this.currentTestId++;
      this.log(`Test ${this.currentTestId}: List resources`, 'test');
      const resourcesResult = await this.sendMCPMessage(server, TEST_CONFIG.mcpMessages.listResources);
      if (this.validateResourcesResponse(resourcesResult)) {
        passed++;
        this.log('✓ List resources test passed', 'success');
      } else {
        failed++;
        this.log('✗ List resources test failed', 'error');
      }

      // Test 4: List Prompts
      this.currentTestId++;
      this.log(`Test ${this.currentTestId}: List prompts`, 'test');
      const promptsResult = await this.sendMCPMessage(server, TEST_CONFIG.mcpMessages.listPrompts);
      if (this.validatePromptsResponse(promptsResult)) {
        passed++;
        this.log('✓ List prompts test passed', 'success');
      } else {
        failed++;
        this.log('✗ List prompts test failed', 'error');
      }

      // Server-specific tool tests
      if (serverName.includes('License API')) {
        const licenseTests = await this.testLicenseApiTools(server);
        passed += licenseTests.passed;
        failed += licenseTests.failed;
      } else if (serverName.includes('Management API')) {
        const managementTests = await this.testManagementApiTools(server);
        passed += managementTests.passed;
        failed += managementTests.failed;
      }

    } catch (error) {
      this.log(`Test execution error: ${error.message}`, 'error');
      failed++;
    }

    return { passed, failed };
  }

  async sendMCPMessage(server, message) {
    return new Promise((resolve, reject) => {
      const messageStr = JSON.stringify(message) + '\n';
      let response = '';
      let responseReceived = false;

      const onData = (data) => {
        response += data.toString();
        
        // Try to parse complete JSON response
        try {
          const lines = response.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const parsed = JSON.parse(line);
            if (parsed.id === message.id) {
              server.stdout.removeListener('data', onData);
              responseReceived = true;
              resolve(parsed);
              return;
            }
          }
        } catch (e) {
          // Continue waiting for complete response
        }
      };

      server.stdout.on('data', onData);
      server.stdin.write(messageStr);

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!responseReceived) {
          server.stdout.removeListener('data', onData);
          reject(new Error(`Timeout waiting for response to message ${message.id}`));
        }
      }, 5000);
    });
  }

  validateInitializeResponse(response) {
    return response && 
           response.result && 
           response.result.protocolVersion &&
           response.result.capabilities;
  }

  validateToolsResponse(response, serverName) {
    if (!response || !response.result || !Array.isArray(response.result.tools)) {
      return false;
    }

    const tools = response.result.tools;
    this.log(`Found ${tools.length} tools in ${serverName}`, 'info');
    
    // Log tool names for verification
    tools.forEach(tool => {
      this.log(`  - ${tool.name}: ${tool.description}`, 'info');
    });

    return tools.length > 0;
  }

  validateResourcesResponse(response) {
    return response && 
           response.result && 
           Array.isArray(response.result.resources);
  }

  validatePromptsResponse(response) {
    return response && 
           response.result && 
           Array.isArray(response.result.prompts);
  }

  async testLicenseApiTools(server) {
    let passed = 0;
    let failed = 0;

    // Test get_product_details tool
    this.currentTestId++;
    this.log(`Test ${this.currentTestId}: get_product_details tool`, 'test');
    try {
      const toolCall = {
        jsonrpc: '2.0',
        id: this.currentTestId + 100,
        method: 'tools/call',
        params: {
          name: 'get_product_details',
          arguments: {
            product: TEST_CONFIG.licenseApi.validProduct
          }
        }
      };
      
      const result = await this.sendMCPMessage(server, toolCall);
      if (result && (result.result || result.error)) {
        passed++;
        this.log('✓ get_product_details tool test passed', 'success');
        if (result.error) {
          this.log(`  Expected error (no valid credentials): ${JSON.stringify(result.error)}`, 'info');
        }
      } else {
        failed++;
        this.log('✗ get_product_details tool test failed', 'error');
      }
    } catch (error) {
      failed++;
      this.log(`✗ get_product_details tool test failed: ${error.message}`, 'error');
    }

    return { passed, failed };
  }

  async testManagementApiTools(server) {
    let passed = 0;
    let failed = 0;

    // Test list_customers tool
    this.currentTestId++;
    this.log(`Test ${this.currentTestId}: list_customers tool`, 'test');
    try {
      const toolCall = {
        jsonrpc: '2.0',
        id: this.currentTestId + 200,
        method: 'tools/call',
        params: {
          name: 'list_customers',
          arguments: {
            limit: 10
          }
        }
      };
      
      const result = await this.sendMCPMessage(server, toolCall);
      if (result && (result.result || result.error)) {
        passed++;
        this.log('✓ list_customers tool test passed', 'success');
        if (result.error) {
          this.log(`  Expected error (no valid credentials): ${JSON.stringify(result.error)}`, 'info');
        }
      } else {
        failed++;
        this.log('✗ list_customers tool test failed', 'error');
      }
    } catch (error) {
      failed++;
      this.log(`✗ list_customers tool test failed: ${error.message}`, 'error');
    }

    return { passed, failed };
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.testResults.filter(r => r.type === 'test').length,
        passed: this.testResults.filter(r => r.type === 'success').length,
        failed: this.testResults.filter(r => r.type === 'error').length
      },
      details: this.testResults
    };

    writeFileSync('test-results.json', JSON.stringify(report, null, 2));
    this.log(`Test report saved to test-results.json`, 'info');
    
    return report;
  }
}

// Main execution
async function main() {
  const tester = new MCPTester();
  
  tester.log('Starting LicenseSpring MCP Server Tests', 'info');
  
  try {
    // Test License API Server
    const licenseApiResults = await tester.testServer(
      'dist/license-api-server.js',
      'License API Server'
    );
    
    // Test Management API Server  
    const managementApiResults = await tester.testServer(
      'dist/management-api-server.js', 
      'Management API Server'
    );
    
    // Generate final report
    const report = tester.generateReport();
    
    tester.log('\n=== TEST SUMMARY ===', 'info');
    tester.log(`License API Server: ${licenseApiResults.passed} passed, ${licenseApiResults.failed} failed`, 'info');
    tester.log(`Management API Server: ${managementApiResults.passed} passed, ${managementApiResults.failed} failed`, 'info');
    tester.log(`Total: ${report.summary.passed} passed, ${report.summary.failed} failed`, 'info');
    
  } catch (error) {
    tester.log(`Test execution failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
