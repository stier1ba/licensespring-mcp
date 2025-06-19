---
name: Release Request
about: Request a new release of the LicenseSpring MCP Server
title: 'Release v[VERSION] - [BRIEF_DESCRIPTION]'
labels: ['release', 'enhancement']
assignees: []
---

## Release Information

**Release Type:** 
- [ ] Patch (bug fixes, minor improvements)
- [ ] Minor (new features, backward compatible)
- [ ] Major (breaking changes)
- [ ] Prerelease (beta/rc version)

**Target Version:** `v[X.Y.Z]`

**Current Version:** `v[CURRENT]`

## Changes Included

### 🚀 New Features
- [ ] Feature 1
- [ ] Feature 2

### 🐛 Bug Fixes
- [ ] Fix 1
- [ ] Fix 2

### 💥 Breaking Changes
- [ ] Breaking change 1
- [ ] Breaking change 2

### 📚 Documentation
- [ ] Documentation update 1
- [ ] Documentation update 2

### 🔧 Internal Changes
- [ ] Dependency updates
- [ ] Build improvements
- [ ] Test enhancements

## Pre-Release Checklist

### Code Quality
- [ ] All tests passing
- [ ] Code linted and formatted
- [ ] No security vulnerabilities
- [ ] Build successful

### Documentation
- [ ] README updated
- [ ] CHANGELOG prepared
- [ ] API documentation current
- [ ] Migration guide (if breaking changes)

### Testing
- [ ] Unit tests updated
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Claude Desktop integration verified

### Dependencies
- [ ] Dependencies updated
- [ ] Security audit clean
- [ ] License compliance verified

## Release Strategy

**Deployment Method:**
- [ ] Automated GitHub Actions
- [ ] Manual release script
- [ ] Semantic release

**Distribution:**
- [ ] NPM package
- [ ] GitHub release
- [ ] Documentation update

## Post-Release Tasks

- [ ] Verify NPM package published
- [ ] Test installation from NPM
- [ ] Update distribution documentation
- [ ] Announce release (if major)
- [ ] Close related issues

## Additional Notes

<!-- Add any additional context, concerns, or special instructions for this release -->

## Related Issues

<!-- Link any issues that will be closed by this release -->
Closes #
Fixes #
Resolves #

---

**Release Automation:** This release can be triggered automatically using:
- Commit message: `[release]` (patch), `[release] [minor]` (minor), `[release] [major]` (major)
- GitHub Actions: Manual workflow dispatch
- Semantic release: Conventional commit messages

**Documentation:** See [Release Automation Guide](../docs/RELEASE_AUTOMATION.md) for detailed instructions.
