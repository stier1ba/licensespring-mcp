#!/usr/bin/env node

/**
 * MCP Protocol Compliance Test Suite
 * Tests that both servers properly implement MCP specifications
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

class MCPComplianceTester {
  constructor() {
    this.results = [];
    this.testId = 0;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'test' ? '🧪' : type === 'warn' ? '⚠️' : 'ℹ️';
    const logMessage = `[${timestamp}] ${prefix} ${message}`;
    console.log(logMessage);
    this.results.push({ timestamp, type, message, testId: this.testId });
  }

  async testServerCompliance(serverPath, serverName) {
    this.log(`\n=== Testing MCP Compliance: ${serverName} ===`);
    
    return new Promise((resolve) => {
      const env = {
        ...process.env,
        LICENSE_API_KEY: '08b410a0-bf46-4663-a320-b13bc7bce70f',
        LICENSE_SHARED_KEY: 'test-shared-key',
        MANAGEMENT_API_KEY: 'nERvcb52.CN24IJyQvsROSHy6LmdVWTdVqtMfoNyj'
      };

      const server = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: env,
        cwd: process.cwd()
      });

      let serverStarted = false;
      let testResults = { 
        serverName, 
        passed: 0, 
        failed: 0, 
        complianceIssues: []
      };

      server.stderr.on('data', (data) => {
        const text = data.toString();
        if (text.includes('running on stdio')) {
          this.log(`${serverName} started successfully`, 'success');
          serverStarted = true;
          this.runComplianceTests(server, testResults).then(() => {
            server.kill();
            resolve(testResults);
          }).catch(err => {
            this.log(`Compliance test execution failed: ${err.message}`, 'error');
            testResults.failed++;
            server.kill();
            resolve(testResults);
          });
        }
      });

      server.on('error', (err) => {
        this.log(`Failed to start server: ${err.message}`, 'error');
        testResults.failed++;
        resolve(testResults);
      });

      server.on('close', (code) => {
        if (!serverStarted) {
          this.log(`Server exited with code ${code} before becoming ready`, 'error');
          testResults.failed++;
        }
        resolve(testResults);
      });

      setTimeout(() => {
        if (!serverStarted) {
          this.log(`Server startup timeout`, 'error');
          testResults.failed++;
          server.kill();
          resolve(testResults);
        }
      }, 15000);
    });
  }

  async runComplianceTests(server, results) {
    try {
      // Test 1: Protocol Version Compliance
      await this.testProtocolVersion(server, results);
      
      // Test 2: Capabilities Declaration
      await this.testCapabilities(server, results);
      
      // Test 3: Tool Schema Compliance
      await this.testToolSchemas(server, results);
      
      // Test 4: Error Handling Compliance
      await this.testErrorHandling(server, results);
      
      // Test 5: Invalid Input Handling
      await this.testInvalidInputs(server, results);
      
      // Test 6: Resource Schema Compliance
      await this.testResourceSchemas(server, results);

    } catch (error) {
      this.log(`Compliance test execution error: ${error.message}`, 'error');
      results.failed++;
    }
  }

  async testProtocolVersion(server, results) {
    this.testId++;
    this.log(`Test ${this.testId}: Protocol Version Compliance`, 'test');
    
    const initResponse = await this.sendMCPMessage(server, {
      jsonrpc: '2.0',
      id: this.testId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {}, prompts: {} },
        clientInfo: { name: 'compliance-test', version: '1.0.0' }
      }
    });

    if (initResponse?.result?.protocolVersion === '2024-11-05') {
      this.log('✅ Protocol version compliance: PASS', 'success');
      results.passed++;
    } else {
      this.log('❌ Protocol version compliance: FAIL', 'error');
      results.failed++;
      results.complianceIssues.push('Invalid or missing protocol version');
    }
  }

  async testCapabilities(server, results) {
    this.testId++;
    this.log(`Test ${this.testId}: Capabilities Declaration`, 'test');
    
    const initResponse = await this.sendMCPMessage(server, {
      jsonrpc: '2.0',
      id: this.testId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {}, prompts: {} },
        clientInfo: { name: 'compliance-test', version: '1.0.0' }
      }
    });

    const capabilities = initResponse?.result?.capabilities;
    if (capabilities && typeof capabilities === 'object') {
      this.log('✅ Capabilities declaration: PASS', 'success');
      results.passed++;
      this.log(`   Declared capabilities: ${Object.keys(capabilities).join(', ')}`);
    } else {
      this.log('❌ Capabilities declaration: FAIL', 'error');
      results.failed++;
      results.complianceIssues.push('Missing or invalid capabilities declaration');
    }
  }

  async testToolSchemas(server, results) {
    this.testId++;
    this.log(`Test ${this.testId}: Tool Schema Compliance`, 'test');
    
    const toolsResponse = await this.sendMCPMessage(server, {
      jsonrpc: '2.0',
      id: this.testId,
      method: 'tools/list',
      params: {}
    });

    const tools = toolsResponse?.result?.tools;
    if (Array.isArray(tools)) {
      let schemaCompliant = true;
      let issues = [];
      
      tools.forEach(tool => {
        // Check required fields
        if (!tool.name || typeof tool.name !== 'string') {
          schemaCompliant = false;
          issues.push(`Tool missing or invalid name: ${JSON.stringify(tool)}`);
        }
        if (!tool.description || typeof tool.description !== 'string') {
          schemaCompliant = false;
          issues.push(`Tool '${tool.name}' missing or invalid description`);
        }
        if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
          schemaCompliant = false;
          issues.push(`Tool '${tool.name}' missing or invalid inputSchema`);
        }
        
        // Check schema structure
        if (tool.inputSchema) {
          if (tool.inputSchema.type !== 'object') {
            issues.push(`Tool '${tool.name}' inputSchema should have type 'object'`);
          }
          if (!tool.inputSchema.properties) {
            issues.push(`Tool '${tool.name}' inputSchema missing properties`);
          }
        }
      });
      
      if (schemaCompliant && issues.length === 0) {
        this.log('✅ Tool schema compliance: PASS', 'success');
        results.passed++;
      } else {
        this.log('❌ Tool schema compliance: FAIL', 'error');
        results.failed++;
        results.complianceIssues.push(...issues);
      }
    } else {
      this.log('❌ Tool schema compliance: FAIL (no tools array)', 'error');
      results.failed++;
      results.complianceIssues.push('tools/list did not return tools array');
    }
  }

  async testErrorHandling(server, results) {
    this.testId++;
    this.log(`Test ${this.testId}: Error Handling Compliance`, 'test');
    
    // Test invalid method
    const invalidMethodResponse = await this.sendMCPMessage(server, {
      jsonrpc: '2.0',
      id: this.testId,
      method: 'invalid/method',
      params: {}
    });

    if (invalidMethodResponse?.error) {
      this.log('✅ Error handling (invalid method): PASS', 'success');
      results.passed++;
    } else {
      this.log('❌ Error handling (invalid method): FAIL', 'error');
      results.failed++;
      results.complianceIssues.push('Server should return error for invalid methods');
    }
  }

  async testInvalidInputs(server, results) {
    this.testId++;
    this.log(`Test ${this.testId}: Invalid Input Handling`, 'test');
    
    // Get first tool to test with invalid inputs
    const toolsResponse = await this.sendMCPMessage(server, {
      jsonrpc: '2.0',
      id: this.testId + 100,
      method: 'tools/list',
      params: {}
    });

    const tools = toolsResponse?.result?.tools;
    if (tools && tools.length > 0) {
      const firstTool = tools[0];
      
      // Test with missing required parameters
      const invalidCallResponse = await this.sendMCPMessage(server, {
        jsonrpc: '2.0',
        id: this.testId,
        method: 'tools/call',
        params: {
          name: firstTool.name,
          arguments: {} // Empty arguments when some are required
        }
      });

      if (invalidCallResponse?.error || 
          (invalidCallResponse?.result?.isError && 
           invalidCallResponse.result.content?.[0]?.text?.includes('Error'))) {
        this.log('✅ Invalid input handling: PASS', 'success');
        results.passed++;
      } else {
        this.log('❌ Invalid input handling: FAIL', 'error');
        results.failed++;
        results.complianceIssues.push('Server should handle invalid inputs gracefully');
      }
    } else {
      this.log('⚠️ Invalid input handling: SKIP (no tools to test)', 'warn');
    }
  }

  async testResourceSchemas(server, results) {
    this.testId++;
    this.log(`Test ${this.testId}: Resource Schema Compliance`, 'test');
    
    const resourcesResponse = await this.sendMCPMessage(server, {
      jsonrpc: '2.0',
      id: this.testId,
      method: 'resources/list',
      params: {}
    });

    const resources = resourcesResponse?.result?.resources;
    if (Array.isArray(resources)) {
      let schemaCompliant = true;
      let issues = [];
      
      resources.forEach(resource => {
        if (!resource.name || typeof resource.name !== 'string') {
          schemaCompliant = false;
          issues.push(`Resource missing or invalid name: ${JSON.stringify(resource)}`);
        }
        if (!resource.description || typeof resource.description !== 'string') {
          schemaCompliant = false;
          issues.push(`Resource '${resource.name}' missing or invalid description`);
        }
        if (!resource.uri || typeof resource.uri !== 'string') {
          schemaCompliant = false;
          issues.push(`Resource '${resource.name}' missing or invalid uri`);
        }
      });
      
      if (schemaCompliant && issues.length === 0) {
        this.log('✅ Resource schema compliance: PASS', 'success');
        results.passed++;
      } else {
        this.log('❌ Resource schema compliance: FAIL', 'error');
        results.failed++;
        results.complianceIssues.push(...issues);
      }
    } else {
      this.log('✅ Resource schema compliance: PASS (no resources)', 'success');
      results.passed++;
    }
  }

  async sendMCPMessage(server, message) {
    return new Promise((resolve, reject) => {
      const messageStr = JSON.stringify(message) + '\n';
      let response = '';
      let responseReceived = false;

      const onData = (data) => {
        response += data.toString();
        
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

      setTimeout(() => {
        if (!responseReceived) {
          server.stdout.removeListener('data', onData);
          reject(new Error(`Timeout waiting for response to ${message.method}`));
        }
      }, 5000);
    });
  }

  generateComplianceReport(allResults) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalServers: allResults.length,
        totalTests: allResults.reduce((sum, r) => sum + r.passed + r.failed, 0),
        totalPassed: allResults.reduce((sum, r) => sum + r.passed, 0),
        totalFailed: allResults.reduce((sum, r) => sum + r.failed, 0),
        totalIssues: allResults.reduce((sum, r) => sum + r.complianceIssues.length, 0)
      },
      servers: allResults,
      logs: this.results
    };

    writeFileSync('mcp-compliance-results.json', JSON.stringify(report, null, 2));
    this.log(`MCP compliance report saved to mcp-compliance-results.json`, 'info');
    
    return report;
  }
}

async function main() {
  const tester = new MCPComplianceTester();
  
  console.log('🚀 MCP Protocol Compliance Test Suite\n');
  
  try {
    const allResults = [];
    
    // Test License API Server
    const licenseResults = await tester.testServerCompliance('dist/license-api-server.js', 'License API Server');
    allResults.push(licenseResults);
    
    // Test Management API Server
    const managementResults = await tester.testServerCompliance('dist/management-api-server.js', 'Management API Server');
    allResults.push(managementResults);
    
    // Generate report
    const report = tester.generateComplianceReport(allResults);
    
    // Summary
    console.log('\n📊 MCP COMPLIANCE SUMMARY');
    console.log('==========================');
    allResults.forEach(result => {
      console.log(`\n${result.serverName}:`);
      console.log(`  Tests: ${result.passed} passed, ${result.failed} failed`);
      console.log(`  Compliance Issues: ${result.complianceIssues.length}`);
      if (result.complianceIssues.length > 0) {
        result.complianceIssues.forEach(issue => {
          console.log(`    - ${issue}`);
        });
      }
    });
    
    console.log(`\nOverall: ${report.summary.totalPassed} passed, ${report.summary.totalFailed} failed`);
    console.log(`Total Compliance Issues: ${report.summary.totalIssues}`);
    
    if (report.summary.totalFailed === 0 && report.summary.totalIssues === 0) {
      console.log('\n🎉 All compliance tests passed!');
    } else {
      console.log('\n⚠️  Some compliance issues found - check mcp-compliance-results.json for details');
    }
    
  } catch (error) {
    console.error(`❌ Compliance test execution failed: ${error.message}`);
    process.exit(1);
  }
}

main();
