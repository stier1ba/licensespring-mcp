# GitHub Actions Workflow Troubleshooting Guide

## 🔍 **Quick Diagnosis Checklist**

### Step 1: Identify Failed Workflows
Go to: https://github.com/stier1ba/licensespring-mcp/actions

Look for these workflows:
- ❌ **"Release and Publish"** - Our main release automation
- ❌ **"Semantic Release"** - Conventional commit releases  
- ❌ **"CI"** - Existing continuous integration

### Step 2: Check Workflow Status Icons
- 🟢 **Green checkmark** = Success
- 🔴 **Red X** = Failed
- 🟡 **Yellow circle** = In progress
- ⚪ **Gray circle** = Skipped/Not triggered

## 🚨 **Common Failure Scenarios**

### Scenario A: Workflow Not Triggering
**Symptoms**: No workflow runs appear after push with `[release]`

**Causes**:
- Branch mismatch (workflow expects `main`, repo uses `master`)
- Workflow file syntax errors
- Missing workflow permissions

**Solutions**:
```yaml
# Fix in .github/workflows/release.yml
on:
  push:
    branches: [ main, master ]  # Support both branches
```

### Scenario B: Test Stage Failures
**Symptoms**: Red X on "test" job

**Common Causes**:
1. **Linting errors**
2. **Unit test failures** 
3. **Build compilation errors**
4. **Comprehensive test failures**

**Check logs for**:
```
npm run lint     # ESLint errors
npm test         # Jest test failures
npm run build    # TypeScript compilation
node tests/comprehensive-test.js  # Integration tests
```

### Scenario C: Release Stage Failures
**Symptoms**: Tests pass, but release job fails

**Common Causes**:
1. **Missing NPM_TOKEN**
2. **Git authentication issues**
3. **Version bump conflicts**
4. **GitHub release creation errors**

### Scenario D: NPM Publishing Failures
**Symptoms**: Everything works except NPM publish step

**Error Messages**:
```
npm ERR! need auth This command requires you to be logged in
npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/@tfedorko%2flicensespring-mcp-server
```

## 🔧 **Specific Solutions**

### Fix 1: NPM Authentication Setup

**Create NPM Token**:
```bash
npm login
npm token create --type=automation
```

**Add to GitHub Secrets**:
1. Go to: https://github.com/stier1ba/licensespring-mcp/settings/secrets/actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: Your npm token (starts with `npm_`)

### Fix 2: Workflow Permissions
Add to workflow file if missing:
```yaml
permissions:
  contents: write
  packages: write
  id-token: write
```

### Fix 3: Branch Reference Issues
Update push commands:
```yaml
- name: Push changes
  run: |
    git push origin ${{ github.ref_name }}
    git push origin ${{ steps.version.outputs.tag }}
```

### Fix 4: Git Configuration
Ensure proper git setup:
```yaml
- name: Configure Git
  run: |
    git config --local user.email "action@github.com"
    git config --local user.name "GitHub Action"
```

## 📊 **Diagnostic Commands**

### Check Local Setup
```bash
# Verify package can be built and tested
npm run build
npm test
npm run lint
node tests/comprehensive-test.js

# Check NPM authentication
npm whoami
npm run verify:npm

# Validate workflow syntax
# (Use GitHub's workflow validator or yamllint)
```

### Check Repository Status
```bash
git status
git log --oneline -5
git remote -v
```

## 🔄 **Re-triggering Workflows**

### Method 1: New Commit Trigger
```bash
git commit --allow-empty -m "fix: trigger release workflow [release]"
git push origin master
```

### Method 2: Manual Workflow Dispatch
1. Go to: https://github.com/stier1ba/licensespring-mcp/actions
2. Select "Release and Publish"
3. Click "Run workflow"
4. Choose "patch" and run

### Method 3: Re-run Failed Jobs
1. Click on failed workflow run
2. Click "Re-run failed jobs"
3. Or "Re-run all jobs"

## 🛡️ **Prevention Strategies**

### 1. Enhanced Error Handling
```yaml
- name: Build project
  run: |
    npm run build || {
      echo "Build failed. Checking for common issues..."
      npm ls
      exit 1
    }
```

### 2. Conditional NPM Publishing
```yaml
- name: Publish to NPM
  if: env.NPM_TOKEN != ''
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
  run: npm publish
```

### 3. Workflow Status Checks
```yaml
- name: Verify Prerequisites
  run: |
    echo "Checking NPM authentication..."
    if [ -z "$NPM_TOKEN" ]; then
      echo "⚠️ NPM_TOKEN not set - NPM publishing will be skipped"
    else
      echo "✅ NPM_TOKEN configured"
    fi
```

## 📋 **Troubleshooting Checklist**

### Before Release
- [ ] All tests pass locally: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Linting passes: `npm run lint`
- [ ] NPM auth works: `npm whoami`
- [ ] Package validates: `npm pack --dry-run`

### Repository Setup
- [ ] NPM_TOKEN secret configured
- [ ] Workflow files have correct branch names
- [ ] Repository permissions allow Actions
- [ ] Git configuration is correct

### After Failure
- [ ] Check workflow logs for specific errors
- [ ] Verify all secrets are set
- [ ] Test locally with same Node.js version
- [ ] Check for recent dependency changes

## 🎯 **Quick Fixes for Common Errors**

### Error: "npm ERR! need auth"
**Solution**: Set up NPM_TOKEN in repository secrets

### Error: "fatal: could not read Username"
**Solution**: Use GITHUB_TOKEN for git operations
```yaml
with:
  token: ${{ secrets.GITHUB_TOKEN }}
```

### Error: "No such file or directory: package.json"
**Solution**: Add checkout step
```yaml
- uses: actions/checkout@v4
```

### Error: "npm ERR! workspace not found"
**Solution**: Ensure correct working directory
```yaml
- run: npm ci
  working-directory: .
```

### Error: "Permission denied"
**Solution**: Add proper permissions to workflow
```yaml
permissions:
  contents: write
  packages: write
```

This guide should help you identify and resolve most workflow issues quickly!
