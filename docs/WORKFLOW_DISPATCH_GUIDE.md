# GitHub Actions Workflow Dispatch Guide

## 🚀 How to Trigger Manual Release

### Step-by-Step Instructions

1. **Navigate to Repository**
   - Go to: https://github.com/stier1ba/licensespring-mcp

2. **Access GitHub Actions**
   - Click the **"Actions"** tab

3. **Select Release Workflow**
   - In the left sidebar, click **"Release and Publish"**

4. **Run Workflow**
   - Click the **"Run workflow"** button (blue button)
   - Select branch: **main**
   - Choose release type: **patch** (for 1.1.0 → 1.1.1)
   - Click **"Run workflow"**

### What You'll See

```
┌─────────────────────────────────────────┐
│ Run workflow                            │
├─────────────────────────────────────────┤
│ Use workflow from: [main ▼]             │
│                                         │
│ Release type                            │
│ [patch ▼]                              │
│ ├─ patch                               │
│ ├─ minor                               │
│ ├─ major                               │
│ └─ prerelease                          │
│                                         │
│ [Run workflow]                          │
└─────────────────────────────────────────┘
```

## 📊 Workflow Execution Stages

### Stage 1: Check Release Trigger ✅
- Validates workflow dispatch input
- Determines release type (patch)
- Sets up workflow variables

### Stage 2: Test Suite 🧪
- **Node.js 18.x Testing**
  - Install dependencies
  - Run linter
  - Execute unit tests
  - Build project
  - Run comprehensive tests

- **Node.js 24.x Testing**
  - Same test suite on different Node version
  - Ensures compatibility

### Stage 3: Release Process 🚀
- **Version Management**
  - Bump version: 1.1.0 → 1.1.1
  - Update package.json and package-lock.json
  - Generate changelog entry

- **Git Operations**
  - Create commit: "chore: bump version to 1.1.1 [skip ci]"
  - Create git tag: v1.1.1
  - Push changes to repository

- **GitHub Release**
  - Generate release notes from commits
  - Create GitHub release with assets
  - Attach changelog and package files

- **NPM Publishing**
  - Validate package contents
  - Publish to NPM registry
  - Update distribution documentation

## ⚠️ NPM Token Requirements

### If NPM_TOKEN is Configured ✅
- Full automation will complete
- Package will be published to NPM
- Release will be fully successful

### If NPM_TOKEN is Missing ❌
- All steps will complete except NPM publishing
- Workflow will fail at the "Publish to NPM" step
- GitHub release will still be created
- Git tag and version bump will be successful

### Error Message Without NPM_TOKEN
```
Error: npm ERR! need auth This command requires you to be logged in.
npm ERR! need auth You need to authorize this machine using `npm adduser`
```

## 🔧 Setting Up NPM_TOKEN

### Quick Setup
1. **Create Token**: `npm token create --type=automation`
2. **Add to Secrets**: https://github.com/stier1ba/licensespring-mcp/settings/secrets/actions
3. **Name**: `NPM_TOKEN`
4. **Value**: Your npm token (starts with `npm_`)

## 📈 Monitoring Progress

### Real-time Monitoring
- Watch the workflow progress in the Actions tab
- Each stage shows live logs and status
- Estimated completion time: 3-5 minutes

### Success Indicators
- ✅ All test stages pass
- ✅ Version bump successful
- ✅ Git tag created
- ✅ GitHub release published
- ✅ NPM package published (if token configured)

### Failure Handling
- Workflow stops at first failure
- Detailed error logs available
- No partial releases (all-or-nothing approach)
- Safe to retry after fixing issues

## 🎯 Expected Results

### Successful Release Will Create:
1. **New Version**: 1.1.1 in package.json
2. **Git Tag**: v1.1.1 in repository
3. **GitHub Release**: https://github.com/stier1ba/licensespring-mcp/releases/tag/v1.1.1
4. **NPM Package**: @tfedorko/licensespring-mcp-server@1.1.1
5. **Updated Changelog**: CHANGELOG.md with new entry

### Package Installation After Release:
```bash
npm install @tfedorko/licensespring-mcp-server@1.1.1
# or
npm install @tfedorko/licensespring-mcp-server@latest
```

## 🔄 Alternative Trigger Methods

### Commit Message Trigger
```bash
git commit -m "fix: resolve authentication issue [release]"
git push origin main
```

### Semantic Release (Conventional Commits)
```bash
git commit -m "fix: resolve license validation bug"
git push origin main
```

This guide ensures you can successfully trigger and monitor your automated release process!
