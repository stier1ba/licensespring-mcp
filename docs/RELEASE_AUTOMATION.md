# Release Automation Guide

This document explains the automated release versioning and NPM distribution system for the LicenseSpring MCP Server.

## 🚀 Overview

The project includes multiple automated release strategies:

1. **Manual Release Scripts** - For local development and manual releases
2. **GitHub Actions Workflows** - For automated CI/CD releases
3. **Semantic Release** - For conventional commit-based releases

## 📦 Release Methods

### Method 1: Manual Release Scripts

#### Quick Release Commands
```bash
# Patch release (1.0.0 -> 1.0.1)
npm run release

# Minor release (1.0.0 -> 1.1.0)
npm run release:minor

# Major release (1.0.0 -> 2.0.0)
npm run release:major
```

#### Individual Commands
```bash
# Version management
npm run version:patch      # Bump patch version
npm run version:minor      # Bump minor version
npm run version:major      # Bump major version
npm run version:prerelease # Bump prerelease version
npm run version:dry        # Preview version changes

# Publishing
npm run publish:stable     # Publish stable release
npm run publish:beta       # Publish beta release
npm run publish:dry        # Preview publish

# Advanced version management
node scripts/version.js patch --dry-run    # Preview patch bump
node scripts/version.js minor --no-test    # Skip tests
node scripts/version.js major --no-git     # Skip git operations
```

### Method 2: GitHub Actions (Automated)

#### Trigger Methods

**A. Commit Message Triggers**
```bash
# Patch release
git commit -m "fix: resolve license validation issue [release]"

# Minor release  
git commit -m "feat: add new bulk operations [release] [minor]"

# Major release
git commit -m "feat!: breaking API changes [release] [major]"
```

**B. Manual Workflow Dispatch**
1. Go to GitHub Actions tab
2. Select "Release and Publish" workflow
3. Click "Run workflow"
4. Choose release type (patch/minor/major/prerelease)

#### Workflow Features
- ✅ Automated testing on multiple Node.js versions
- ✅ Version bumping with changelog generation
- ✅ Git tagging and commit creation
- ✅ GitHub release creation with release notes
- ✅ NPM package publishing
- ✅ Comprehensive test suite execution

### Method 3: Semantic Release (Conventional Commits)

#### Commit Message Format
```bash
# Features (minor release)
git commit -m "feat: add license user management tools"

# Bug fixes (patch release)
git commit -m "fix: resolve authentication timeout issue"

# Breaking changes (major release)
git commit -m "feat!: redesign API authentication system"

# Documentation (patch release)
git commit -m "docs: update installation instructions"

# No release
git commit -m "chore: update dependencies"
git commit -m "ci: improve workflow performance"
```

#### Supported Commit Types
- `feat:` - New features (minor release)
- `fix:` - Bug fixes (patch release)
- `perf:` - Performance improvements (patch release)
- `docs:` - Documentation changes (patch release)
- `refactor:` - Code refactoring (patch release)
- `build:` - Build system changes (patch release)
- `test:` - Test additions/changes (no release)
- `ci:` - CI/CD changes (no release)
- `chore:` - Maintenance tasks (no release)

#### Breaking Changes
Add `!` after the type or include `BREAKING CHANGE:` in the commit body:
```bash
git commit -m "feat!: remove deprecated API endpoints"
# OR
git commit -m "feat: add new authentication system

BREAKING CHANGE: Old API keys are no longer supported"
```

## 🔧 Configuration Files

### GitHub Actions Workflows

**`.github/workflows/release.yml`**
- Manual and commit-triggered releases
- Comprehensive testing and validation
- GitHub release creation
- NPM publishing

**`.github/workflows/semantic-release.yml`**
- Conventional commit-based releases
- Automatic version determination
- Changelog generation
- Multi-branch support (main, develop)

### Semantic Release Configuration

**`.releaserc.json`**
- Conventional commit parsing
- Release note generation
- Changelog management
- NPM and GitHub publishing

## 📋 Release Checklist

### Before Release
- [ ] All tests passing
- [ ] Code linted and formatted
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Version bump appropriate

### Automated Checks
- [ ] Unit tests (Jest)
- [ ] Integration tests (Comprehensive test suite)
- [ ] Build verification
- [ ] Package contents validation
- [ ] NPM authentication

### After Release
- [ ] GitHub release created
- [ ] NPM package published
- [ ] Changelog updated
- [ ] Git tags created
- [ ] Distribution documentation updated

## 🏷️ Version Strategy

### Semantic Versioning (SemVer)
- **MAJOR** (X.0.0) - Breaking changes
- **MINOR** (0.X.0) - New features (backward compatible)
- **PATCH** (0.0.X) - Bug fixes (backward compatible)
- **PRERELEASE** (0.0.0-X) - Pre-release versions

### Branch Strategy
- **main** - Stable releases (latest tag)
- **develop** - Beta releases (beta tag)
- **release/*** - Release candidates (rc tag)

## 🔐 Required Secrets

### GitHub Repository Secrets
```bash
GITHUB_TOKEN    # Automatically provided by GitHub
NPM_TOKEN       # NPM authentication token
```

### Setting Up NPM Token
1. Login to NPM: `npm login`
2. Create token: `npm token create --read-only`
3. Add to GitHub Secrets as `NPM_TOKEN`

## 📊 Release Monitoring

### NPM Package Information
- **Package Name**: `@tfedorko/licensespring-mcp-server`
- **Registry**: https://www.npmjs.com/package/@tfedorko/licensespring-mcp-server
- **Installation**: `npm install @tfedorko/licensespring-mcp-server`

### GitHub Releases
- **Releases**: https://github.com/stier1ba/licensespring-mcp/releases
- **Tags**: https://github.com/stier1ba/licensespring-mcp/tags

## 🚨 Troubleshooting

### Common Issues

**1. NPM Authentication Failed**
```bash
# Solution: Re-authenticate
npm login
# Or set token manually
npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN
```

**2. Git Authentication Failed**
```bash
# Solution: Check GitHub token permissions
# Ensure GITHUB_TOKEN has write access to repository
```

**3. Tests Failing**
```bash
# Solution: Run tests locally first
npm test
npm run lint
```

**4. Build Errors**
```bash
# Solution: Clean and rebuild
rm -rf dist/
npm run build
```

### Manual Recovery

**If Automated Release Fails:**
1. Check workflow logs in GitHub Actions
2. Fix any issues locally
3. Run manual release:
   ```bash
   npm run version:patch
   npm run publish:stable
   ```

**If Version is Wrong:**
1. Manually edit package.json
2. Commit changes
3. Create git tag:
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

## 📈 Best Practices

### Commit Messages
- Use conventional commit format
- Be descriptive and clear
- Include issue references when applicable
- Use imperative mood ("add" not "added")

### Release Timing
- Release patches frequently for bug fixes
- Bundle features into minor releases
- Plan major releases carefully
- Use prerelease versions for testing

### Testing
- Always run full test suite before release
- Test in multiple environments
- Verify package installation works
- Check Claude Desktop integration

## 🎯 Quick Reference

### Emergency Release
```bash
# Quick patch release
npm run release

# Quick beta release
npm run version:patch
npm run publish:beta
```

### Preview Changes
```bash
# Preview version bump
npm run version:dry

# Preview publish
npm run publish:dry
```

### Manual Override
```bash
# Skip tests (not recommended)
node scripts/version.js patch --no-test

# Skip git operations
node scripts/version.js patch --no-git
```

This automation system ensures reliable, consistent releases while providing flexibility for different development workflows and emergency situations.
