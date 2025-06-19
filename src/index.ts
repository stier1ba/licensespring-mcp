#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function showUsage() {
  console.log(`
LicenseSpring MCP Server

Usage:
  npm run license-api     - Start License API MCP server
  npm run management-api  - Start Management API MCP server
  npm run dev            - Start in development mode (shows this help)

Environment Variables:
  License API:
    LICENSE_API_URL      - LicenseSpring License API URL (default: https://api.licensespring.com)
    LICENSE_API_KEY      - Your License API key
    LICENSE_SHARED_KEY   - Your License API shared key

  Management API:
    MANAGEMENT_API_URL   - LicenseSpring Management API URL (default: https://saas.licensespring.com)
    MANAGEMENT_API_KEY   - Your Management API key

Configuration:
  1. Copy .env.example to .env
  2. Fill in your API credentials
  3. Run the appropriate server

Examples:
  # Start License API server
  npm run license-api

  # Start Management API server  
  npm run management-api

For more information, see README.md
`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showUsage();
    return;
  }

  const serverType = args[0];

  switch (serverType) {
    case 'license-api':
      console.log('Starting LicenseSpring License API MCP server...');
      const licenseProcess = spawn('node', [join(__dirname, 'license-api-server.js')], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      licenseProcess.on('error', (error) => {
        console.error('Failed to start License API server:', error.message);
        process.exit(1);
      });

      licenseProcess.on('exit', (code) => {
        if (code !== 0) {
          console.error(`License API server exited with code ${code}`);
          process.exit(code || 1);
        }
      });
      break;

    case 'management-api':
      console.log('Starting LicenseSpring Management API MCP server...');
      const managementProcess = spawn('node', [join(__dirname, 'management-api-server.js')], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      managementProcess.on('error', (error) => {
        console.error('Failed to start Management API server:', error.message);
        process.exit(1);
      });

      managementProcess.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Management API server exited with code ${code}`);
          process.exit(code || 1);
        }
      });
      break;

    default:
      console.error(`Unknown server type: ${serverType}`);
      console.error('Valid options are: license-api, management-api');
      showUsage();
      process.exit(1);
  }
}

// Run main function when this file is executed directly
main();
