# 🚀 LicenseSpring MCP Server v{{version}}

{{#if breaking}}
## ⚠️ BREAKING CHANGES
{{#each breaking}}
- {{this}}
{{/each}}
{{/if}}

{{#if features}}
## 🚀 New Features
{{#each features}}
- {{this}}
{{/each}}
{{/if}}

{{#if fixes}}
## 🐛 Bug Fixes
{{#each fixes}}
- {{this}}
{{/each}}
{{/if}}

{{#if performance}}
## ⚡ Performance Improvements
{{#each performance}}
- {{this}}
{{/each}}
{{/if}}

{{#if documentation}}
## 📚 Documentation
{{#each documentation}}
- {{this}}
{{/each}}
{{/if}}

{{#if refactor}}
## ♻️ Code Refactoring
{{#each refactor}}
- {{this}}
{{/each}}
{{/if}}

{{#if tests}}
## ✅ Tests
{{#each tests}}
- {{this}}
{{/each}}
{{/if}}

{{#if build}}
## 🔧 Build System
{{#each build}}
- {{this}}
{{/each}}
{{/if}}

{{#if ci}}
## 👷 CI/CD
{{#each ci}}
- {{this}}
{{/each}}
{{/if}}

## 📦 Installation

### NPM Package
```bash
npm install @tfedorko/licensespring-mcp-server@{{version}}
```

### Claude Desktop Configuration
```json
{
  "mcpServers": {
    "licensespring": {
      "command": "npx",
      "args": ["-y", "@tfedorko/licensespring-mcp-server@{{version}}"],
      "env": {
        "LICENSE_API_KEY": "YOUR_LICENSE_API_KEY",
        "LICENSE_SHARED_KEY": "YOUR_SHARED_KEY_OR_LEAVE_EMPTY",
        "MANAGEMENT_API_KEY": "YOUR_MANAGEMENT_API_KEY"
      }
    }
  }
}
```

## 🔗 Links

- **📦 NPM Package**: [@tfedorko/licensespring-mcp-server@{{version}}](https://www.npmjs.com/package/@tfedorko/licensespring-mcp-server/v/{{version}})
- **📋 Documentation**: [README.md](https://github.com/stier1ba/licensespring-mcp/blob/master/README.md)
- **🐛 Issues**: [GitHub Issues](https://github.com/stier1ba/licensespring-mcp/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/stier1ba/licensespring-mcp/discussions)

## 🧪 Testing

This release includes:
- ✅ **Unit Tests**: Jest test suite (100% pass rate)
- ✅ **Integration Tests**: Real LicenseSpring API validation (31/31 tests)
- ✅ **Build Verification**: TypeScript compilation and linting
- ✅ **CI/CD Pipeline**: GitHub Actions workflow validation

## 🔄 Upgrade Guide

### From Previous Versions
```bash
# Update to latest version
npm update @tfedorko/licensespring-mcp-server

# Or install specific version
npm install @tfedorko/licensespring-mcp-server@{{version}}
```

### Breaking Changes
{{#if breaking}}
{{#each breaking}}
- {{this}}
{{/each}}
{{else}}
No breaking changes in this release.
{{/if}}

---

**Full Changelog**: [{{previousTag}}...{{currentTag}}](https://github.com/stier1ba/licensespring-mcp/compare/{{previousTag}}...{{currentTag}})
