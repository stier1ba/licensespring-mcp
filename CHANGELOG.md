# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0](https://github.com/stier1ba/licensespring-mcp/compare/v1.1.6...v1.2.0) (2025-07-06)


### 🚀 Features

* achieve 100% Postman collection parity and authentication priority updates ([33da146](https://github.com/stier1ba/licensespring-mcp/commit/33da146ab755a2a75361d2d766711bd354a554cf))


### 🐛 Bug Fixes

* resolve GitHub Actions workflow failures and enable integration testing ([6883005](https://github.com/stier1ba/licensespring-mcp/commit/688300567cce9f969cf21b92de129e0068a3a431))
* resolve GitHub Actions workflow syntax errors and improve secret handling ([3b78ad1](https://github.com/stier1ba/licensespring-mcp/commit/3b78ad1b96d16c893316291ecacdbbbaf3a664d4))

## [1.1.6](https://github.com/stier1ba/licensespring-mcp/compare/v1.1.5...v1.1.6) (2025-06-19)


### 📚 Documentation

* add Node.js version requirement note to installation section ([a58ca79](https://github.com/stier1ba/licensespring-mcp/commit/a58ca792f155361c4ba6042e5606159c9955e875))

## [1.1.5](https://github.com/stier1ba/licensespring-mcp/compare/v1.1.4...v1.1.5) (2025-06-19)


### 🐛 Bug Fixes

* remove conflicting Release and Publish workflow file ([08795f2](https://github.com/stier1ba/licensespring-mcp/commit/08795f21c80b8b068acb54a8130460c75eff73b0))


### 👷 CI/CD

* disable conflicting Release and Publish workflow ([c4875d0](https://github.com/stier1ba/licensespring-mcp/commit/c4875d05d3f1a6986559fb90c3bc5343a20b18f6))

# Changelog

## [1.1.4] - 2025-06-19

### Added
- Automated release and versioning system
- Enhanced MCP server functionality

### Changed
- Improved API coverage and feature parity

### Fixed
- Various bug fixes and improvements


All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Automated release versioning and NPM distribution system
- Comprehensive GitHub Actions workflows for CI/CD
- Semantic release configuration with conventional commits
- Manual release scripts for local development
- Version management and publishing automation

### Changed
- Enhanced package.json with new release scripts
- Improved project structure with scripts directory
- Updated documentation with release automation guide

### Fixed
- Authentication test compatibility with graceful degradation

## [1.1.0] - 2025-06-19

### Added
- Complete License API coverage (18/18 endpoints)
- License user management tools (4 new endpoints)
- Bulk operations for enterprise license management (3 new endpoints)
- Missing License API endpoints: get_customer_license_users, activate_offline, deactivate_offline
- Enhanced TypeScript interfaces for all new functionality
- Comprehensive test coverage for new tools

### Changed
- Improved Management API coverage from 13% to 25%
- Enhanced parameter validation with advanced schemas
- Better error handling and subscription tier support

### Fixed
- Authentication validation test for graceful degradation
- Type definitions for new API endpoints

## [1.0.0] - 2025-06-18

### Added
- Initial release of LicenseSpring MCP Server
- License API server with 15 core endpoints
- Management API server with 8 essential endpoints
- Comprehensive authentication system with subscription tier support
- TypeScript implementation with full type safety
- Zod validation for all tool parameters
- MCP 2024-11-05 protocol compliance
- Docker support for containerized deployment
- Comprehensive test suite with 399-line test framework
- Claude Desktop integration support

### Features
- License activation, deactivation, and status checking
- Consumption tracking (general and feature-specific)
- Trial key generation
- Product information retrieval
- Device variable tracking
- Floating license management
- User password management
- Software version and installation file access
- SSO URL generation
- Basic license and customer CRUD operations

### Documentation
- Complete setup and installation guide
- API documentation and examples
- Docker deployment instructions
- Claude Desktop configuration guide
- Subscription tier compatibility information

---

## Release Types

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

## Version Strategy

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backward-compatible functionality additions
- **PATCH** version for backward-compatible bug fixes

## Links

- [NPM Package](https://www.npmjs.com/package/@tfedorko/licensespring-mcp-server)
- [GitHub Repository](https://github.com/stier1ba/licensespring-mcp)
- [Release Automation Guide](docs/RELEASE_AUTOMATION.md)
