#!/usr/bin/env node

/**
 * Installation script for LicenseSpring MCP servers with Claude Desktop
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { platform } from 'process';

class ClaudeInstaller {
  constructor() {
    this.configPath = this.getClaudeConfigPath();
    this.projectPath = process.cwd();
  }

  getClaudeConfigPath() {
    switch (platform) {
      case 'win32':
        return join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
      case 'darwin':
        return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      default:
        return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');
    }
  }

  loadExistingConfig() {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        console.warn('⚠️  Could not parse existing Claude config, creating new one');
        return { mcpServers: {} };
      }
    }
    return { mcpServers: {} };
  }

  createConfig() {
    const config = this.loadExistingConfig();
    
    // Ensure mcpServers exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    // Add LicenseSpring servers
    config.mcpServers['licensespring-license-api'] = {
      command: 'node',
      args: [join(this.projectPath, 'dist', 'license-api-server.js')],
      env: {
        LICENSE_API_URL: 'https://api.licensespring.com',
        LICENSE_API_KEY: process.env.LICENSE_API_KEY || 'your_license_api_key_here',
        LICENSE_SHARED_KEY: process.env.LICENSE_SHARED_KEY || ''
      }
    };

    config.mcpServers['licensespring-management-api'] = {
      command: 'node',
      args: [join(this.projectPath, 'dist', 'management-api-server.js')],
      env: {
        MANAGEMENT_API_URL: 'https://saas.licensespring.com',
        MANAGEMENT_API_KEY: process.env.MANAGEMENT_API_KEY || 'your_management_api_key_here'
      }
    };

    return config;
  }

  install() {
    console.log('🚀 Installing LicenseSpring MCP servers for Claude Desktop\n');

    // Check if project is built
    const distPath = join(this.projectPath, 'dist');
    if (!existsSync(distPath)) {
      console.error('❌ Project not built. Run "npm run build" first.');
      process.exit(1);
    }

    // Create config directory if it doesn't exist
    const configDir = dirname(this.configPath);
    if (!existsSync(configDir)) {
      console.log(`📁 Creating Claude config directory: ${configDir}`);
      mkdirSync(configDir, { recursive: true });
    }

    // Create configuration
    const config = this.createConfig();

    // Write configuration
    try {
      writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log('✅ Claude Desktop configuration updated successfully!');
      console.log(`📍 Config file: ${this.configPath}`);
    } catch (error) {
      console.error('❌ Failed to write Claude config:', error.message);
      process.exit(1);
    }

    // Show next steps
    this.showNextSteps();
  }

  showNextSteps() {
    console.log('\n📋 NEXT STEPS:');
    console.log('==============');
    
    console.log('\n1. 🔑 Configure your API credentials:');
    console.log('   Edit the config file and replace placeholder values:');
    console.log(`   ${this.configPath}`);
    
    console.log('\n2. 🔄 Restart Claude Desktop');
    console.log('   Close and reopen Claude Desktop to load the new servers');
    
    console.log('\n3. ✅ Verify installation:');
    console.log('   In Claude Desktop, you should see LicenseSpring tools available');
    console.log('   Try asking: "What LicenseSpring tools are available?"');
    
    console.log('\n4. 🎯 Example usage:');
    console.log('   "Check the status of license key ABC-123-DEF"');
    console.log('   "List all customers in my LicenseSpring account"');
    console.log('   "Create a new license for customer john@example.com"');

    console.log('\n📚 For subscription tier support:');
    console.log('   - Leave LICENSE_SHARED_KEY empty for Basic/Standard tiers');
    console.log('   - Provide LICENSE_SHARED_KEY for Premium/Enterprise tiers');
    console.log('   - See SUBSCRIPTION_TIERS.md for detailed information');
  }

  showCurrentConfig() {
    console.log('📄 Current Claude Desktop Configuration:');
    console.log('========================================');
    
    if (existsSync(this.configPath)) {
      try {
        const config = JSON.parse(readFileSync(this.configPath, 'utf8'));
        console.log(JSON.stringify(config, null, 2));
      } catch (error) {
        console.error('❌ Could not read config file:', error.message);
      }
    } else {
      console.log('No configuration file found.');
    }
  }

  uninstall() {
    console.log('🗑️  Removing LicenseSpring MCP servers from Claude Desktop\n');

    if (!existsSync(this.configPath)) {
      console.log('No Claude Desktop config found. Nothing to remove.');
      return;
    }

    try {
      const config = JSON.parse(readFileSync(this.configPath, 'utf8'));
      
      if (config.mcpServers) {
        delete config.mcpServers['licensespring-license-api'];
        delete config.mcpServers['licensespring-management-api'];
        
        writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        console.log('✅ LicenseSpring MCP servers removed from Claude Desktop');
        console.log('🔄 Restart Claude Desktop to apply changes');
      } else {
        console.log('No MCP servers found in config.');
      }
    } catch (error) {
      console.error('❌ Failed to update config:', error.message);
    }
  }
}

// CLI interface
function main() {
  const installer = new ClaudeInstaller();
  const command = process.argv[2];

  switch (command) {
    case 'install':
      installer.install();
      break;
    case 'uninstall':
      installer.uninstall();
      break;
    case 'config':
      installer.showCurrentConfig();
      break;
    default:
      console.log('LicenseSpring MCP Claude Desktop Installer');
      console.log('==========================================');
      console.log('');
      console.log('Usage:');
      console.log('  node install-for-claude.js install    - Install MCP servers');
      console.log('  node install-for-claude.js uninstall  - Remove MCP servers');
      console.log('  node install-for-claude.js config     - Show current config');
      console.log('');
      console.log('Make sure to run "npm run build" before installing.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
