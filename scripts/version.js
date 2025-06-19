#!/usr/bin/env node

/**
 * Version Management Script for LicenseSpring MCP Server
 * 
 * Usage:
 *   node scripts/version.js patch    # 1.0.0 -> 1.0.1
 *   node scripts/version.js minor    # 1.0.0 -> 1.1.0
 *   node scripts/version.js major    # 1.0.0 -> 2.0.0
 *   node scripts/version.js prerelease # 1.0.0 -> 1.0.1-0
 *   node scripts/version.js --dry-run patch # Preview changes
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const VALID_TYPES = ['patch', 'minor', 'major', 'prerelease'];

class VersionManager {
  constructor() {
    this.packagePath = join(process.cwd(), 'package.json');
    this.changelogPath = join(process.cwd(), 'CHANGELOG.md');
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

  getCurrentVersion() {
    const packageJson = JSON.parse(readFileSync(this.packagePath, 'utf8'));
    return packageJson.version;
  }

  bumpVersion(type, dryRun = false) {
    const currentVersion = this.getCurrentVersion();
    
    this.log(`Current version: ${currentVersion}`);
    
    if (dryRun) {
      this.log('🔍 DRY RUN MODE - No changes will be made', 'warning');
    }

    try {
      // Use npm version to bump version
      const command = `npm version ${type} --no-git-tag-version${dryRun ? ' --dry-run' : ''}`;
      const result = execSync(command, { encoding: 'utf8' }).trim();
      const newVersion = result.replace('v', '');
      
      if (dryRun) {
        this.log(`Would bump to: ${newVersion}`, 'info');
        return { currentVersion, newVersion, dryRun: true };
      }

      this.log(`Version bumped to: ${newVersion}`, 'success');
      return { currentVersion, newVersion, dryRun: false };
    } catch (error) {
      this.log(`Failed to bump version: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  updateChangelog(oldVersion, newVersion, dryRun = false) {
    const date = new Date().toISOString().split('T')[0];
    const changelogEntry = `
## [${newVersion}] - ${date}

### Added
- Version bump from ${oldVersion} to ${newVersion}

### Changed
- Updated package version

`;

    if (dryRun) {
      this.log('Would update CHANGELOG.md with new entry', 'info');
      return;
    }

    try {
      let changelog = '';
      try {
        changelog = readFileSync(this.changelogPath, 'utf8');
      } catch (error) {
        // Create new changelog if it doesn't exist
        changelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
      }

      // Insert new entry after the header
      const lines = changelog.split('\n');
      const headerIndex = lines.findIndex(line => line.startsWith('# Changelog'));
      
      if (headerIndex !== -1) {
        lines.splice(headerIndex + 3, 0, changelogEntry);
      } else {
        lines.unshift('# Changelog\n', changelogEntry);
      }

      writeFileSync(this.changelogPath, lines.join('\n'));
      this.log('Updated CHANGELOG.md', 'success');
    } catch (error) {
      this.log(`Failed to update changelog: ${error.message}`, 'warning');
    }
  }

  runTests(dryRun = false) {
    if (dryRun) {
      this.log('Would run tests before version bump', 'info');
      return;
    }

    this.log('Running tests...', 'info');
    
    try {
      execSync('npm test', { stdio: 'inherit' });
      this.log('All tests passed!', 'success');
    } catch (error) {
      this.log('Tests failed! Aborting version bump.', 'error');
      process.exit(1);
    }
  }

  buildProject(dryRun = false) {
    if (dryRun) {
      this.log('Would build project', 'info');
      return;
    }

    this.log('Building project...', 'info');
    
    try {
      execSync('npm run build', { stdio: 'inherit' });
      this.log('Build completed successfully!', 'success');
    } catch (error) {
      this.log('Build failed! Aborting version bump.', 'error');
      process.exit(1);
    }
  }

  createGitCommit(version, dryRun = false) {
    if (dryRun) {
      this.log(`Would create git commit for version ${version}`, 'info');
      return;
    }

    try {
      execSync('git add package.json package-lock.json CHANGELOG.md', { stdio: 'inherit' });
      execSync(`git commit -m "chore: bump version to ${version}"`, { stdio: 'inherit' });
      execSync(`git tag v${version}`, { stdio: 'inherit' });
      this.log(`Created git commit and tag for version ${version}`, 'success');
    } catch (error) {
      this.log(`Failed to create git commit: ${error.message}`, 'warning');
    }
  }

  showUsage() {
    console.log(`
📦 LicenseSpring MCP Server Version Manager

Usage:
  node scripts/version.js <type> [options]

Types:
  patch      Increment patch version (1.0.0 -> 1.0.1)
  minor      Increment minor version (1.0.0 -> 1.1.0)
  major      Increment major version (1.0.0 -> 2.0.0)
  prerelease Increment prerelease version (1.0.0 -> 1.0.1-0)

Options:
  --dry-run  Preview changes without making them
  --no-test  Skip running tests
  --no-build Skip building project
  --no-git   Skip git commit and tag

Examples:
  node scripts/version.js patch
  node scripts/version.js minor --dry-run
  node scripts/version.js major --no-test
`);
  }

  run() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      this.showUsage();
      return;
    }

    const type = args[0];
    const dryRun = args.includes('--dry-run');
    const skipTests = args.includes('--no-test');
    const skipBuild = args.includes('--no-build');
    const skipGit = args.includes('--no-git');

    if (!VALID_TYPES.includes(type)) {
      this.log(`Invalid version type: ${type}`, 'error');
      this.log(`Valid types: ${VALID_TYPES.join(', ')}`, 'info');
      process.exit(1);
    }

    this.log(`🚀 Starting version bump: ${type}`, 'info');

    // Run tests
    if (!skipTests) {
      this.runTests(dryRun);
    }

    // Build project
    if (!skipBuild) {
      this.buildProject(dryRun);
    }

    // Bump version
    const { currentVersion, newVersion } = this.bumpVersion(type, dryRun);

    // Update changelog
    this.updateChangelog(currentVersion, newVersion, dryRun);

    // Create git commit
    if (!skipGit && !dryRun) {
      this.createGitCommit(newVersion, dryRun);
    }

    if (dryRun) {
      this.log('🔍 Dry run completed - no changes made', 'info');
    } else {
      this.log(`🎉 Version bump completed: ${currentVersion} -> ${newVersion}`, 'success');
      this.log('📦 Ready for NPM publish!', 'info');
      this.log(`Run: npm publish`, 'info');
    }
  }
}

// Run the version manager
const versionManager = new VersionManager();
versionManager.run();
