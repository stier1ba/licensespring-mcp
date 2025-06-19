#!/usr/bin/env node

/**
 * Quick setup script for LicenseSpring MCP servers
 * This script helps users get started quickly with Claude Desktop integration
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';

class LicenseSpringSetup {
  constructor() {
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  async setup() {
    console.log('🚀 LicenseSpring MCP Setup for Claude Desktop');
    console.log('==============================================\n');

    console.log('This setup will help you configure LicenseSpring MCP servers for Claude Desktop.\n');

    // Get user credentials
    const licenseApiKey = await this.prompt('📝 Enter your LicenseSpring License API Key: ');
    
    console.log('\n💡 LICENSE_SHARED_KEY is optional and depends on your subscription tier:');
    console.log('   - Basic/Standard: Leave empty (press Enter)');
    console.log('   - Premium/Enterprise: Enter your shared key');
    
    const sharedKey = await this.prompt('🔑 Enter your License Shared Key (optional): ');
    
    const managementApiKey = await this.prompt('📋 Enter your LicenseSpring Management API Key: ');

    // Determine subscription tier
    const tier = sharedKey ? 'Premium/Enterprise' : 'Basic/Standard';
    console.log(`\n✅ Detected subscription tier: ${tier}`);

    // Create configuration
    const config = {
      mcpServers: {
        'licensespring-license-api': {
          command: 'node',
          args: [process.cwd() + '/dist/license-api-server.js'],
          env: {
            LICENSE_API_URL: 'https://api.licensespring.com',
            LICENSE_API_KEY: licenseApiKey,
            LICENSE_SHARED_KEY: sharedKey || ''
          }
        },
        'licensespring-management-api': {
          command: 'node',
          args: [process.cwd() + '/dist/management-api-server.js'],
          env: {
            MANAGEMENT_API_URL: 'https://saas.licensespring.com',
            MANAGEMENT_API_KEY: managementApiKey
          }
        }
      }
    };

    // Save configuration
    const configFile = 'claude_desktop_config.json';
    writeFileSync(configFile, JSON.stringify(config, null, 2));
    
    console.log(`\n✅ Configuration saved to: ${configFile}`);
    console.log('\n📋 Next Steps:');
    console.log('==============');
    console.log('1. Build the project: npm run build');
    console.log('2. Copy the configuration to your Claude Desktop config file');
    console.log('3. Restart Claude Desktop');
    console.log('\n📍 Claude Desktop config locations:');
    console.log('   Windows: %APPDATA%\\Claude\\claude_desktop_config.json');
    console.log('   macOS: ~/Library/Application Support/Claude/claude_desktop_config.json');
    console.log('   Linux: ~/.config/Claude/claude_desktop_config.json');

    console.log('\n🎯 Test in Claude Desktop:');
    console.log('   Ask: "What LicenseSpring tools are available?"');

    this.rl.close();
  }

  async quickStart() {
    console.log('⚡ LicenseSpring MCP Quick Start');
    console.log('===============================\n');

    // Check if project is built
    if (!existsSync('dist/license-api-server.js')) {
      console.log('📦 Building project...');
      const { spawn } = await import('child_process');
      
      return new Promise((resolve) => {
        const build = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
        build.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Build successful!\n');
            this.setup().then(resolve);
          } else {
            console.error('❌ Build failed. Please run "npm run build" manually.');
            resolve();
          }
        });
      });
    } else {
      await this.setup();
    }
  }

  showHelp() {
    console.log('LicenseSpring MCP Setup');
    console.log('=======================\n');
    console.log('Usage:');
    console.log('  node setup.js              - Interactive setup');
    console.log('  node setup.js quick        - Quick start (build + setup)');
    console.log('  node setup.js help         - Show this help');
    console.log('\nFor more information, see DISTRIBUTION_GUIDE.md');
  }
}

async function main() {
  const setup = new LicenseSpringSetup();
  const command = process.argv[2];

  switch (command) {
    case 'quick':
      await setup.quickStart();
      break;
    case 'help':
      setup.showHelp();
      break;
    default:
      await setup.setup();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
