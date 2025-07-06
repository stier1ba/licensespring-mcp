# CI/CD Setup Guide for LicenseSpring MCP Server

## Overview

This guide explains how to configure GitHub Actions workflows for the LicenseSpring MCP server to achieve the same 100% test pass rate as the local environment.

## Current Workflow Status

### ✅ Fixed Issues
- **Node.js Version**: Updated to match local environment (20.x, 22.x)
- **Test Commands**: Fixed to use correct npm scripts
- **File Paths**: Updated to use `tests/comprehensive-integration-test.js`
- **Build Process**: Proper TypeScript compilation before testing

### ⚠️ Pending Configuration
- **Environment Variables**: LicenseSpring API secrets need to be configured
- **Integration Tests**: Currently skipped due to missing secrets

## Required GitHub Secrets

To enable full integration testing in CI/CD, configure these repository secrets:

### 1. LICENSE_API_KEY (Required)
- **Purpose**: Primary authentication for LicenseSpring License API
- **Value**: Your LicenseSpring API key (e.g., `08b410a0-bf46-4663-a320-b13bc7bce70f`)
- **Usage**: Used for all License API operations

### 2. MANAGEMENT_API_KEY (Required)
- **Purpose**: Authentication for LicenseSpring Management API
- **Value**: Your LicenseSpring Management API key
- **Usage**: Used for customer and license management operations

### 3. LICENSE_SHARED_KEY (Optional)
- **Purpose**: Enhanced HMAC security for organizations with shared API settings
- **Value**: Your LicenseSpring shared key for HMAC authentication
- **Usage**: Provides enhanced security when available

## How to Configure Secrets

1. **Navigate to Repository Settings**:
   - Go to `https://github.com/stier1ba/licensespring-mcp/settings/secrets/actions`

2. **Add New Repository Secret**:
   - Click "New repository secret"
   - Enter the secret name (e.g., `LICENSE_API_KEY`)
   - Enter the secret value
   - Click "Add secret"

3. **Repeat for All Required Secrets**:
   - `LICENSE_API_KEY`
   - `MANAGEMENT_API_KEY`
   - `LICENSE_SHARED_KEY` (optional)

## Workflow Behavior

### With Secrets Configured
- ✅ Unit tests run (Jest)
- ✅ Build process completes
- ✅ Integration tests run with real LicenseSpring API
- ✅ 100% test pass rate (31/31 tests)
- ✅ Proper test data cleanup

### Without Secrets Configured
- ✅ Unit tests run (Jest)
- ✅ Build process completes
- ⚠️ Integration tests skipped with informative message
- ✅ Workflow continues successfully

## Local vs CI Environment Comparison

| Aspect | Local Environment | CI Environment |
|--------|------------------|----------------|
| Node.js Version | v22.14.0 | 20.x, 22.x |
| npm Version | 10.9.2 | Latest for Node version |
| Test Command | `npm run test:integration` | `npm run test:integration` |
| Environment Variables | `.env` file | GitHub Secrets |
| Test File | `tests/comprehensive-integration-test.js` | Same |
| Expected Pass Rate | 100% (31/31) | 100% (31/31) |

## Troubleshooting

### Integration Tests Skipped
**Symptom**: "Integration tests skipped - LicenseSpring API secrets not configured"
**Solution**: Configure the required GitHub secrets as described above

### Test Failures
**Symptom**: Integration tests fail in CI but pass locally
**Possible Causes**:
1. **Wrong API Keys**: Verify secrets are correctly configured
2. **Rate Limiting**: LicenseSpring API may have different rate limits for CI
3. **Network Issues**: Temporary connectivity problems

### Build Failures
**Symptom**: TypeScript compilation fails
**Solution**: Ensure all dependencies are properly installed with `npm ci`

## Verification Steps

After configuring secrets:

1. **Push a commit** to trigger the workflow
2. **Check workflow run** at `https://github.com/stier1ba/licensespring-mcp/actions`
3. **Verify integration tests run** and achieve 100% pass rate
4. **Check test output** for proper cleanup confirmation

## Expected Results

With proper configuration, the CI/CD pipeline should achieve:
- ✅ **100% Test Pass Rate**: All 31 tests pass
- ✅ **Complete API Coverage**: Both License API (18 tools) and Management API (15 tools)
- ✅ **Authentication Validation**: LICENSE_API_KEY priority confirmed
- ✅ **Clean Environment**: Test data properly created and cleaned up
- ✅ **MCP Compliance**: All tools return proper MCP-compliant responses

## Security Notes

- **API Keys**: Never commit API keys to the repository
- **Secrets**: Use GitHub Secrets for all sensitive information
- **Test Data**: Integration tests create and clean up test data automatically
- **Rate Limits**: Be aware of LicenseSpring API rate limits in CI environment

## Support

If you encounter issues:
1. Check the workflow logs for specific error messages
2. Verify all secrets are correctly configured
3. Ensure the local environment works with the same credentials
4. Review the comprehensive integration test output for details
