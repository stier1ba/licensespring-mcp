#!/usr/bin/env node

/**
 * GitHub Actions Workflow Diagnostic Script
 * 
 * This script helps diagnose common issues with the automated release workflows
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

class WorkflowDiagnostic {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.suggestions = [];
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

  checkWorkflowFiles() {
    this.log('Checking workflow files...', 'info');
    
    const workflowFiles = [
      '.github/workflows/release.yml',
      '.github/workflows/semantic-release.yml',
      '.github/workflows/ci.yml'
    ];

    workflowFiles.forEach(file => {
      if (existsSync(file)) {
        this.log(`Found: ${file}`, 'success');
        this.validateWorkflowSyntax(file);
      } else {
        this.log(`Missing: ${file}`, 'error');
        this.issues.push(`Workflow file missing: ${file}`);
      }
    });
  }

  validateWorkflowSyntax(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      
      // Check for common issues
      if (!content.includes('on:')) {
        this.issues.push(`${filePath}: Missing 'on:' trigger section`);
      }
      
      if (!content.includes('jobs:')) {
        this.issues.push(`${filePath}: Missing 'jobs:' section`);
      }
      
      // Check branch configuration
      if (content.includes('branches: [ main ]') && !content.includes('master')) {
        this.warnings.push(`${filePath}: Only configured for 'main' branch, consider adding 'master'`);
      }
      
      // Check for secrets usage
      if (content.includes('NPM_TOKEN') && !content.includes('secrets.NPM_TOKEN')) {
        this.issues.push(`${filePath}: NPM_TOKEN referenced but not using secrets.NPM_TOKEN`);
      }
      
      this.log(`Syntax check passed: ${filePath}`, 'success');
    } catch (error) {
      this.log(`Syntax error in ${filePath}: ${error.message}`, 'error');
      this.issues.push(`Workflow syntax error: ${filePath}`);
    }
  }

  checkGitConfiguration() {
    this.log('Checking Git configuration...', 'info');
    
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      this.log(`Current branch: ${branch}`, 'info');
      
      if (branch !== 'main' && branch !== 'master') {
        this.warnings.push(`Current branch '${branch}' may not trigger workflows`);
      }
      
      const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
      this.log(`Remote URL: ${remote}`, 'info');
      
      if (!remote.includes('github.com')) {
        this.issues.push('Repository is not hosted on GitHub - GitHub Actions won\'t work');
      }
      
      // Check for recent commits with [release] trigger
      try {
        const recentCommits = execSync('git log --oneline -5', { encoding: 'utf8' });
        const hasReleaseTrigger = recentCommits.includes('[release]');
        
        if (hasReleaseTrigger) {
          this.log('Found recent commit with [release] trigger', 'success');
        } else {
          this.warnings.push('No recent commits with [release] trigger found');
        }
      } catch (error) {
        this.warnings.push('Could not check recent commits');
      }
      
    } catch (error) {
      this.log(`Git configuration check failed: ${error.message}`, 'error');
      this.issues.push('Git repository not properly configured');
    }
  }

  checkPackageConfiguration() {
    this.log('Checking package configuration...', 'info');
    
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      
      // Check required fields
      const requiredFields = ['name', 'version', 'scripts'];
      requiredFields.forEach(field => {
        if (!packageJson[field]) {
          this.issues.push(`package.json missing required field: ${field}`);
        }
      });
      
      // Check scripts
      const requiredScripts = ['build', 'test', 'lint'];
      requiredScripts.forEach(script => {
        if (!packageJson.scripts[script]) {
          this.issues.push(`package.json missing required script: ${script}`);
        }
      });
      
      // Check if package is publishable
      if (packageJson.private === true) {
        this.warnings.push('Package is marked as private - NPM publishing will fail');
      }
      
      this.log(`Package name: ${packageJson.name}`, 'info');
      this.log(`Current version: ${packageJson.version}`, 'info');
      
    } catch (error) {
      this.log(`Package configuration check failed: ${error.message}`, 'error');
      this.issues.push('package.json is not readable or invalid');
    }
  }

  checkLocalBuild() {
    this.log('Testing local build process...', 'info');
    
    try {
      // Test build
      execSync('npm run build', { stdio: 'pipe' });
      this.log('Build successful', 'success');
    } catch (error) {
      this.log('Build failed', 'error');
      this.issues.push('Local build fails - workflow will fail at build step');
    }
    
    try {
      // Test linting
      execSync('npm run lint', { stdio: 'pipe' });
      this.log('Linting passed', 'success');
    } catch (error) {
      this.log('Linting failed', 'error');
      this.issues.push('Linting fails - workflow will fail at lint step');
    }
  }

  checkNPMAuthentication() {
    this.log('Checking NPM authentication...', 'info');
    
    try {
      const whoami = execSync('npm whoami', { encoding: 'utf8' }).trim();
      this.log(`NPM user: ${whoami}`, 'success');
      
      // Test package access
      try {
        execSync('npm pack --dry-run', { stdio: 'pipe' });
        this.log('Package can be packed', 'success');
      } catch (error) {
        this.warnings.push('Package packing failed - check package.json configuration');
      }
      
    } catch (error) {
      this.log('Not authenticated with NPM', 'warning');
      this.warnings.push('NPM authentication required for publishing');
      this.suggestions.push('Run: npm login');
      this.suggestions.push('Create automation token: npm token create --type=automation');
      this.suggestions.push('Add NPM_TOKEN to GitHub repository secrets');
    }
  }

  generateReport() {
    this.log('\n📊 Diagnostic Report', 'info');
    
    if (this.issues.length === 0) {
      this.log('✅ No critical issues found!', 'success');
    } else {
      this.log('❌ Critical Issues Found:', 'error');
      this.issues.forEach(issue => this.log(`   • ${issue}`, 'error'));
    }
    
    if (this.warnings.length > 0) {
      this.log('\n⚠️  Warnings:', 'warning');
      this.warnings.forEach(warning => this.log(`   • ${warning}`, 'warning'));
    }
    
    if (this.suggestions.length > 0) {
      this.log('\n💡 Suggestions:', 'info');
      this.suggestions.forEach(suggestion => this.log(`   • ${suggestion}`, 'info'));
    }
    
    this.generateActionPlan();
  }

  generateActionPlan() {
    this.log('\n🎯 Action Plan:', 'info');
    
    if (this.issues.length > 0) {
      this.log('\n1. Fix Critical Issues:', 'error');
      
      if (this.issues.some(i => i.includes('NPM_TOKEN'))) {
        this.log('   • Set up NPM_TOKEN in GitHub repository secrets', 'info');
        this.log('     https://github.com/stier1ba/licensespring-mcp/settings/secrets/actions', 'info');
      }
      
      if (this.issues.some(i => i.includes('workflow'))) {
        this.log('   • Fix workflow file syntax errors', 'info');
        this.log('   • Ensure proper branch configuration', 'info');
      }
      
      if (this.issues.some(i => i.includes('build') || i.includes('lint'))) {
        this.log('   • Fix local build/lint issues first', 'info');
        this.log('   • Run: npm run build && npm run lint && npm test', 'info');
      }
    }
    
    this.log('\n2. Test Workflow Trigger:', 'info');
    this.log('   • Manual dispatch: https://github.com/stier1ba/licensespring-mcp/actions', 'info');
    this.log('   • Or commit with [release]: git commit -m "test: trigger release [release]"', 'info');
    
    this.log('\n3. Monitor Progress:', 'info');
    this.log('   • Watch workflow logs in GitHub Actions', 'info');
    this.log('   • Check for specific error messages', 'info');
    this.log('   • Re-run failed jobs if needed', 'info');
  }

  run() {
    this.log('🔍 GitHub Actions Workflow Diagnostic\n', 'info');
    
    this.checkWorkflowFiles();
    this.checkGitConfiguration();
    this.checkPackageConfiguration();
    this.checkLocalBuild();
    this.checkNPMAuthentication();
    
    this.generateReport();
  }
}

// Run the diagnostic
const diagnostic = new WorkflowDiagnostic();
diagnostic.run();
