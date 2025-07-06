#!/usr/bin/env node

/**
 * Release Automation Script for LicenseSpring MCP Server
 * 
 * This script provides utilities for managing automated releases:
 * - Pre-release validation
 * - Release preparation
 * - Post-release verification
 * - Release rollback capabilities
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options });
  } catch (error) {
    log(`❌ Command failed: ${command}`, 'red');
    log(`Error: ${error.message}`, 'red');
    throw error;
  }
}

class ReleaseAutomation {
  constructor() {
    this.packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    this.currentVersion = this.packageJson.version;
  }

  async validatePreRelease() {
    log('🔍 Running pre-release validation...', 'blue');
    
    // Check if we're on the correct branch
    const currentBranch = exec('git branch --show-current').trim();
    if (!['main', 'master', 'develop'].includes(currentBranch)) {
      throw new Error(`❌ Invalid branch for release: ${currentBranch}. Must be main, master, or develop.`);
    }
    log(`✅ Branch check passed: ${currentBranch}`, 'green');

    // Check for uncommitted changes
    const gitStatus = exec('git status --porcelain').trim();
    if (gitStatus) {
      throw new Error('❌ Uncommitted changes detected. Please commit or stash changes before release.');
    }
    log('✅ Git status clean', 'green');

    // Run tests
    log('🧪 Running test suite...', 'yellow');
    exec('npm test');
    log('✅ Unit tests passed', 'green');

    // Run linting
    log('🔍 Running linter...', 'yellow');
    exec('npm run lint');
    log('✅ Linting passed', 'green');

    // Build project
    log('🔨 Building project...', 'yellow');
    exec('npm run build');
    log('✅ Build successful', 'green');

    // Check NPM authentication
    try {
      exec('npm whoami');
      log('✅ NPM authentication verified', 'green');
    } catch (error) {
      log('⚠️ NPM authentication not configured (will use CI token)', 'yellow');
    }

    log('🎉 Pre-release validation completed successfully!', 'green');
  }

  async prepareRelease(releaseType = 'auto') {
    log(`🚀 Preparing ${releaseType} release...`, 'blue');

    if (releaseType !== 'auto') {
      // Manual version bump
      const newVersion = exec(`npm version ${releaseType} --no-git-tag-version`).trim();
      log(`📈 Version bumped to ${newVersion}`, 'green');
      
      // Update package.json
      exec('git add package.json package-lock.json');
      exec(`git commit -m "chore(release): prepare ${newVersion}"`);
    }

    // Push to trigger semantic release
    log('📤 Pushing to trigger automated release...', 'yellow');
    exec('git push origin HEAD');

    log('✅ Release preparation completed!', 'green');
    log('🔄 Automated release workflow will now take over', 'cyan');
  }

  async verifyRelease(version) {
    log(`🔍 Verifying release ${version}...`, 'blue');

    // Check NPM package
    try {
      const npmInfo = exec(`npm view @tfedorko/licensespring-mcp-server@${version} version`).trim();
      if (npmInfo === version) {
        log('✅ NPM package published successfully', 'green');
      } else {
        throw new Error('NPM package version mismatch');
      }
    } catch (error) {
      log('❌ NPM package verification failed', 'red');
      throw error;
    }

    // Check GitHub release
    try {
      exec(`gh release view v${version}`);
      log('✅ GitHub release created successfully', 'green');
    } catch (error) {
      log('⚠️ GitHub CLI not available or release not found', 'yellow');
    }

    log('🎉 Release verification completed!', 'green');
  }

  async rollbackRelease(version) {
    log(`🔄 Rolling back release ${version}...`, 'red');

    try {
      // Deprecate NPM package
      exec(`npm deprecate @tfedorko/licensespring-mcp-server@${version} "Release rolled back due to issues"`);
      log('✅ NPM package deprecated', 'yellow');

      // Delete GitHub release
      try {
        exec(`gh release delete v${version} --yes`);
        log('✅ GitHub release deleted', 'yellow');
      } catch (error) {
        log('⚠️ Could not delete GitHub release (may not exist)', 'yellow');
      }

      log('🎉 Rollback completed successfully!', 'green');
    } catch (error) {
      log('❌ Rollback failed', 'red');
      throw error;
    }
  }

  async showReleaseStatus() {
    log('📊 Release Status Dashboard', 'cyan');
    log('=' * 50, 'cyan');

    // Current version
    log(`📦 Current Version: ${this.currentVersion}`, 'blue');

    // Latest NPM version
    try {
      const latestNpm = exec('npm view @tfedorko/licensespring-mcp-server version').trim();
      log(`🌐 Latest NPM: ${latestNpm}`, 'blue');
    } catch (error) {
      log('❌ Could not fetch NPM version', 'red');
    }

    // Recent releases
    try {
      const releases = exec('gh release list --limit 5').trim();
      log('📋 Recent GitHub Releases:', 'blue');
      console.log(releases);
    } catch (error) {
      log('⚠️ Could not fetch GitHub releases', 'yellow');
    }

    // Workflow status
    try {
      const workflows = exec('gh run list --limit 3').trim();
      log('🔄 Recent Workflow Runs:', 'blue');
      console.log(workflows);
    } catch (error) {
      log('⚠️ Could not fetch workflow status', 'yellow');
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const automation = new ReleaseAutomation();

  try {
    switch (command) {
      case 'validate':
        await automation.validatePreRelease();
        break;
      
      case 'prepare':
        const releaseType = args[1] || 'auto';
        await automation.prepareRelease(releaseType);
        break;
      
      case 'verify':
        const version = args[1] || automation.currentVersion;
        await automation.verifyRelease(version);
        break;
      
      case 'rollback':
        const rollbackVersion = args[1];
        if (!rollbackVersion) {
          throw new Error('❌ Version required for rollback');
        }
        await automation.rollbackRelease(rollbackVersion);
        break;
      
      case 'status':
        await automation.showReleaseStatus();
        break;
      
      default:
        log('🚀 LicenseSpring MCP Server Release Automation', 'cyan');
        log('', 'reset');
        log('Usage:', 'yellow');
        log('  npm run release:validate     - Run pre-release validation', 'reset');
        log('  npm run release:prepare      - Prepare automated release', 'reset');
        log('  npm run release:verify <ver> - Verify release deployment', 'reset');
        log('  npm run release:rollback <v> - Rollback a release', 'reset');
        log('  npm run release:status       - Show release status', 'reset');
        log('', 'reset');
        log('Examples:', 'yellow');
        log('  npm run release:prepare patch', 'reset');
        log('  npm run release:verify 1.2.3', 'reset');
        log('  npm run release:rollback 1.2.3', 'reset');
    }
  } catch (error) {
    log(`❌ ${error.message}`, 'red');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ReleaseAutomation;
