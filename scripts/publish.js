#!/usr/bin/env node

/**
 * NPM Publish Script for LicenseSpring MCP Server
 * 
 * Usage:
 *   node scripts/publish.js           # Publish stable release
 *   node scripts/publish.js --beta    # Publish beta release
 *   node scripts/publish.js --dry-run # Preview publish
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

class PublishManager {
  constructor() {
    this.packagePath = join(process.cwd(), 'package.json');
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',    // cyan
      success: '\x1b[32m', // green
      warning: '\x1b[33m', // yellow
      error: '\x1b[31m',   // red
      reset: '\x1b[0m'
    };
    
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${colors[type]}${prefix} ${message}${colors.reset}`);
  }

  getPackageInfo() {
    const packageJson = JSON.parse(readFileSync(this.packagePath, 'utf8'));
    return {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description
    };
  }

  checkNpmAuth() {
    try {
      const result = execSync('npm whoami', { encoding: 'utf8' }).trim();
      this.log(`Authenticated as: ${result}`, 'success');
      return true;
    } catch (error) {
      this.log('Not authenticated with NPM. Run: npm login', 'error');
      return false;
    }
  }

  runPrePublishChecks(dryRun = false) {
    this.log('Running pre-publish checks...', 'info');

    // Check if we're on main branch
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      if (branch !== 'main' && !dryRun) {
        this.log(`Warning: Publishing from branch '${branch}' instead of 'main'`, 'warning');
      }
    } catch (error) {
      this.log('Could not determine git branch', 'warning');
    }

    // Check for uncommitted changes
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
      if (status && !dryRun) {
        this.log('Warning: You have uncommitted changes', 'warning');
        console.log(status);
      }
    } catch (error) {
      this.log('Could not check git status', 'warning');
    }

    // Run tests
    if (!dryRun) {
      this.log('Running tests...', 'info');
      try {
        execSync('npm test', { stdio: 'inherit' });
        this.log('All tests passed!', 'success');
      } catch (error) {
        this.log('Tests failed! Aborting publish.', 'error');
        process.exit(1);
      }
    }

    // Build project
    if (!dryRun) {
      this.log('Building project...', 'info');
      try {
        execSync('npm run build', { stdio: 'inherit' });
        this.log('Build completed successfully!', 'success');
      } catch (error) {
        this.log('Build failed! Aborting publish.', 'error');
        process.exit(1);
      }
    }
  }

  checkPackageContents(dryRun = false) {
    this.log('Checking package contents...', 'info');

    try {
      // Check if essential files exist in the file system
      const essentialFiles = [
        { path: 'dist', type: 'directory' },
        { path: 'package.json', type: 'file' },
        { path: 'README.md', type: 'file' }
      ];

      const missingFiles = essentialFiles.filter(item => {
        try {
          const stats = statSync(item.path);
          if (item.type === 'directory') {
            return !stats.isDirectory();
          } else {
            return !stats.isFile();
          }
        } catch (error) {
          return true; // File doesn't exist
        }
      });

      if (missingFiles.length > 0) {
        this.log(`Missing essential files: ${missingFiles.map(f => f.path).join(', ')}`, 'error');
        process.exit(1);
      }

      // Show npm pack output for verification
      if (dryRun) {
        this.log('NPM pack preview:', 'info');
        const result = execSync('npm pack --dry-run', { encoding: 'utf8' });
        console.log(result);
      }

      this.log('Package contents verified!', 'success');
    } catch (error) {
      this.log(`Failed to check package contents: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  publishToNpm(tag = 'latest', dryRun = false) {
    const { name, version } = this.getPackageInfo();
    
    this.log(`Publishing ${name}@${version} with tag '${tag}'...`, 'info');
    
    if (dryRun) {
      this.log('🔍 DRY RUN - Would publish to NPM', 'warning');
      return;
    }

    try {
      const publishCommand = tag === 'latest' 
        ? 'npm publish' 
        : `npm publish --tag ${tag}`;
        
      execSync(publishCommand, { stdio: 'inherit' });
      
      this.log(`Successfully published ${name}@${version}!`, 'success');
      this.log(`📦 NPM: https://www.npmjs.com/package/${name}`, 'info');
      this.log(`📋 Install: npm install ${name}@${version}`, 'info');
      
      if (tag !== 'latest') {
        this.log(`🏷️ Tagged as: ${tag}`, 'info');
        this.log(`📋 Install tagged: npm install ${name}@${tag}`, 'info');
      }
      
    } catch (error) {
      this.log(`Failed to publish: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  updateDistributionDocs() {
    const { name, version } = this.getPackageInfo();
    
    this.log('Updating distribution documentation...', 'info');
    
    const distributionInfo = `
# Distribution Information

## Latest Release
- **Package**: ${name}
- **Version**: ${version}
- **Published**: ${new Date().toISOString()}

## Installation
\`\`\`bash
npm install ${name}
\`\`\`

## Usage
\`\`\`bash
# Run License API server
npx licensespring-mcp-license

# Run Management API server  
npx licensespring-mcp-management

# Run both servers
npx licensespring-mcp-server
\`\`\`

## Links
- [NPM Package](https://www.npmjs.com/package/${name})
- [GitHub Repository](https://github.com/stier1ba/licensespring-mcp)
- [Documentation](https://github.com/stier1ba/licensespring-mcp#readme)
`;

    try {
      writeFileSync('DISTRIBUTION.md', distributionInfo);
      this.log('Updated DISTRIBUTION.md', 'success');
    } catch (error) {
      this.log(`Failed to update distribution docs: ${error.message}`, 'warning');
    }
  }

  showUsage() {
    console.log(`
📦 LicenseSpring MCP Server Publish Manager

Usage:
  node scripts/publish.js [options]

Options:
  --beta     Publish as beta release (npm install package@beta)
  --dry-run  Preview publish without actually publishing
  --skip-checks  Skip pre-publish checks (not recommended)

Examples:
  node scripts/publish.js                # Publish stable release
  node scripts/publish.js --beta         # Publish beta release
  node scripts/publish.js --dry-run      # Preview publish
`);
  }

  run() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
      this.showUsage();
      return;
    }

    const dryRun = args.includes('--dry-run');
    const beta = args.includes('--beta');
    const skipChecks = args.includes('--skip-checks');
    
    const tag = beta ? 'beta' : 'latest';
    const { name, version } = this.getPackageInfo();

    this.log(`🚀 Starting publish process for ${name}@${version}`, 'info');
    
    if (dryRun) {
      this.log('🔍 DRY RUN MODE - No actual publishing will occur', 'warning');
    }

    // Check NPM authentication
    if (!dryRun && !this.checkNpmAuth()) {
      process.exit(1);
    }

    // Run pre-publish checks
    if (!skipChecks) {
      this.runPrePublishChecks(dryRun);
    }

    // Check package contents
    this.checkPackageContents(dryRun);

    // Publish to NPM
    this.publishToNpm(tag, dryRun);

    // Update distribution documentation
    if (!dryRun) {
      this.updateDistributionDocs();
    }

    if (dryRun) {
      this.log('🔍 Dry run completed - no changes made', 'info');
    } else {
      this.log('🎉 Publish completed successfully!', 'success');
      this.log('📦 Package is now available on NPM', 'info');
    }
  }
}

// Run the publish manager
const publishManager = new PublishManager();
publishManager.run();
