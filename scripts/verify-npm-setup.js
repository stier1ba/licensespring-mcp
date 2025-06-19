#!/usr/bin/env node

/**
 * NPM Setup Verification Script
 * 
 * This script verifies that NPM authentication is properly configured
 * for automated publishing.
 */

import { execSync } from 'child_process';

class NPMSetupVerifier {
  constructor() {
    this.errors = [];
    this.warnings = [];
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

  checkNPMAuth() {
    this.log('Checking NPM authentication...', 'info');
    
    try {
      const whoami = execSync('npm whoami', { encoding: 'utf8' }).trim();
      this.log(`Authenticated as: ${whoami}`, 'success');
      return whoami;
    } catch (error) {
      this.log('Not authenticated with NPM', 'error');
      this.errors.push('NPM authentication required. Run: npm login');
      return null;
    }
  }

  checkPackageAccess() {
    this.log('Checking package publish permissions...', 'info');
    
    try {
      // Check if we can publish to the package
      const result = execSync('npm access list packages', { encoding: 'utf8' });
      const packages = JSON.parse(result);
      
      const packageName = '@tfedorko/licensespring-mcp-server';
      if (packages[packageName]) {
        this.log(`Have access to publish ${packageName}`, 'success');
        return true;
      } else {
        this.log(`No access to ${packageName} - this may be normal for first publish`, 'warning');
        this.warnings.push('Package access not confirmed - may need to publish manually first');
        return false;
      }
    } catch (error) {
      this.log('Could not check package access', 'warning');
      this.warnings.push('Package access check failed - this is normal for new packages');
      return false;
    }
  }

  checkNPMRegistry() {
    this.log('Checking NPM registry configuration...', 'info');
    
    try {
      const registry = execSync('npm config get registry', { encoding: 'utf8' }).trim();
      if (registry === 'https://registry.npmjs.org/') {
        this.log('NPM registry correctly configured', 'success');
        return true;
      } else {
        this.log(`NPM registry is set to: ${registry}`, 'warning');
        this.warnings.push('NPM registry is not set to the default npmjs.org');
        return false;
      }
    } catch (error) {
      this.log('Could not check NPM registry', 'error');
      this.errors.push('NPM registry check failed');
      return false;
    }
  }

  checkPackageInfo() {
    this.log('Checking package.json configuration...', 'info');
    
    try {
      const packageJson = JSON.parse(execSync('cat package.json', { encoding: 'utf8' }));
      
      // Check required fields
      const requiredFields = ['name', 'version', 'description', 'main', 'files'];
      const missingFields = requiredFields.filter(field => !packageJson[field]);
      
      if (missingFields.length === 0) {
        this.log('Package.json has all required fields', 'success');
      } else {
        this.log(`Missing required fields: ${missingFields.join(', ')}`, 'error');
        this.errors.push('Package.json missing required fields');
      }

      // Check if package is scoped correctly
      if (packageJson.name.startsWith('@')) {
        this.log('Package is correctly scoped', 'success');
      } else {
        this.log('Package is not scoped - consider using @username/package-name', 'warning');
        this.warnings.push('Unscoped packages may have naming conflicts');
      }

      return packageJson;
    } catch (error) {
      this.log('Could not read package.json', 'error');
      this.errors.push('Package.json is not readable');
      return null;
    }
  }

  checkGitHubSecrets() {
    this.log('Checking GitHub repository setup...', 'info');
    
    try {
      // Check if we're in a git repository
      const gitRemote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
      this.log(`Git remote: ${gitRemote}`, 'info');
      
      if (gitRemote.includes('github.com')) {
        this.log('Repository is hosted on GitHub', 'success');
        
        // Extract repository info
        const repoMatch = gitRemote.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
        if (repoMatch) {
          const [, owner, repo] = repoMatch;
          this.log(`Repository: ${owner}/${repo}`, 'info');
          this.log('⚠️  Remember to add NPM_TOKEN to GitHub repository secrets:', 'warning');
          this.log(`   https://github.com/${owner}/${repo}/settings/secrets/actions`, 'info');
        }
      } else {
        this.log('Repository is not on GitHub - GitHub Actions won\'t work', 'warning');
        this.warnings.push('GitHub Actions require GitHub-hosted repository');
      }
    } catch (error) {
      this.log('Not in a git repository or no remote configured', 'warning');
      this.warnings.push('Git repository setup may be incomplete');
    }
  }

  testPublishDryRun() {
    this.log('Testing publish dry-run...', 'info');
    
    try {
      execSync('npm publish --dry-run', { stdio: 'pipe' });
      this.log('Publish dry-run successful', 'success');
      return true;
    } catch (error) {
      this.log('Publish dry-run failed', 'error');
      this.errors.push('Package cannot be published - check package.json and build');
      return false;
    }
  }

  generateSetupInstructions() {
    this.log('\n📋 Setup Instructions:', 'info');
    
    console.log(`
🔐 NPM Token Setup:
1. Create NPM automation token:
   npm token create --type=automation

2. Add to GitHub repository secrets:
   - Go to: https://github.com/stier1ba/licensespring-mcp/settings/secrets/actions
   - Click "New repository secret"
   - Name: NPM_TOKEN
   - Value: [your npm token starting with npm_]

🚀 Test Automated Release:
   npm run version:dry    # Preview version bump
   npm run publish:dry    # Preview publish
   npm run release        # Execute release

📚 Documentation:
   See docs/RELEASE_AUTOMATION.md for complete guide
`);
  }

  run() {
    this.log('🔍 NPM Setup Verification\n', 'info');

    // Run all checks
    const username = this.checkNPMAuth();
    this.checkNPMRegistry();
    const packageInfo = this.checkPackageInfo();
    this.checkPackageAccess();
    this.checkGitHubSecrets();
    this.testPublishDryRun();

    // Summary
    this.log('\n📊 Verification Summary:', 'info');
    
    if (this.errors.length === 0) {
      this.log('✅ All critical checks passed!', 'success');
      
      if (username && packageInfo) {
        this.log(`Ready to publish ${packageInfo.name} as ${username}`, 'success');
      }
      
      if (this.warnings.length > 0) {
        this.log('\n⚠️  Warnings (non-critical):', 'warning');
        this.warnings.forEach(warning => this.log(`   • ${warning}`, 'warning'));
      }
      
      this.log('\n🎉 NPM automation is ready!', 'success');
      this.log('You can now use: npm run release', 'info');
      
    } else {
      this.log('❌ Critical issues found:', 'error');
      this.errors.forEach(error => this.log(`   • ${error}`, 'error'));
      
      if (this.warnings.length > 0) {
        this.log('\n⚠️  Additional warnings:', 'warning');
        this.warnings.forEach(warning => this.log(`   • ${warning}`, 'warning'));
      }
      
      this.log('\n🔧 Please fix the errors above before proceeding', 'error');
    }

    this.generateSetupInstructions();
  }
}

// Run the verification
const verifier = new NPMSetupVerifier();
verifier.run();
