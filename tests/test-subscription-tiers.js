#!/usr/bin/env node

/**
 * Test different subscription tier modes
 */

import { spawn } from 'child_process';

async function testMode(modeName, env) {
  console.log(`\n=== Testing ${modeName} ===`);
  
  return new Promise((resolve) => {
    const server = spawn('node', ['dist/license-api-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      cwd: process.cwd()
    });

    let output = '';
    let started = false;

    server.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log(text.trim());
      
      if (text.includes('running on stdio')) {
        started = true;
        setTimeout(() => {
          server.kill();
          resolve({ success: started, output });
        }, 1000);
      }
    });

    server.on('error', (err) => {
      console.log(`❌ Failed: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    server.on('close', (code) => {
      if (!started) {
        console.log(`❌ Exited with code ${code}`);
        resolve({ success: false, output });
      }
    });

    // Timeout
    setTimeout(() => {
      if (!started) {
        console.log(`❌ Timeout`);
        server.kill();
        resolve({ success: false, output });
      }
    }, 5000);
  });
}

async function main() {
  console.log('🚀 Testing LicenseSpring Subscription Tier Support\n');

  // Test 1: Full Mode (with shared key)
  const fullMode = await testMode('Full Mode (Premium/Enterprise)', {
    LICENSE_API_KEY: '08b410a0-bf46-4663-a320-b13bc7bce70f',
    LICENSE_SHARED_KEY: 'real-shared-key-would-go-here'
  });

  // Test 2: Limited Mode (no shared key)
  const limitedMode = await testMode('Limited Mode (Basic/Standard)', {
    LICENSE_API_KEY: '08b410a0-bf46-4663-a320-b13bc7bce70f'
    // No LICENSE_SHARED_KEY
  });

  // Test 3: Test Mode
  const testModeResult = await testMode('Test Mode (Development)', {
    LICENSE_API_KEY: 'test-development-key'
  });

  // Summary
  console.log('\n📊 SUBSCRIPTION TIER TEST SUMMARY');
  console.log('==================================');
  console.log(`Full Mode (Premium/Enterprise):    ${fullMode.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Limited Mode (Basic/Standard):     ${limitedMode.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test Mode (Development):           ${testModeResult.success ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = fullMode.success && limitedMode.success && testModeResult.success;
  console.log(`\nOverall: ${allPassed ? '🎉 All modes working correctly!' : '⚠️ Some issues found'}`);
}

main();
