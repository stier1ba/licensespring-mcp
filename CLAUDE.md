# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LicenseSpring MCP Server - An MCP (Model Context Protocol) server implementation that integrates with LicenseSpring APIs for license management and customer operations. The project provides two separate MCP servers: License API server and Management API server.

## Development Commands

### Build and Development
```bash
npm run build          # Compile TypeScript to JavaScript
npm run dev           # Start in development mode (shows usage help)
npm run lint          # Run ESLint on TypeScript files
npm run lint:fix      # Auto-fix ESLint issues
npm test              # Run unit tests with Jest
npm run test:integration  # Run comprehensive integration tests against real API
```

### Running Servers
```bash
npm run license-api    # Start License API MCP server
npm run management-api # Start Management API MCP server
```

### Release Commands
```bash
npm run release       # Patch release (1.0.0 -> 1.0.1)
npm run release:minor # Minor release (1.0.0 -> 1.1.0)  
npm run release:major # Major release (1.0.0 -> 2.0.0)
npm run version:dry   # Preview version bump without changes
npm run publish:dry   # Preview NPM publish without publishing
```

## Architecture

### Project Structure
- **src/index.ts**: Main entry point that routes to appropriate server
- **src/license-api-server.ts**: License API MCP server implementation with 19 tools
- **src/management-api-server.ts**: Management API MCP server with 15 tools
- **src/utils/auth.ts**: Authentication validation and HMAC signature generation
- **src/utils/http.ts**: HTTP client implementations for both APIs with error handling
- **src/types/index.ts**: TypeScript type definitions for API responses

### Authentication Flow
1. **Primary**: LICENSE_API_KEY for License API, MANAGEMENT_API_KEY for Management API
2. **Optional**: LICENSE_SHARED_KEY for enhanced HMAC authentication (License API only)
3. The server validates credentials on startup and provides tier-appropriate functionality

### MCP Server Implementation
- Built on `@modelcontextprotocol/sdk` for MCP protocol compliance
- Uses StdioServerTransport for communication with Claude Desktop
- Implements tools with Zod schema validation for parameters
- Provides resources for data exposure (product details, licenses list, etc.)

## Environment Configuration

Required environment variables (set in .env file):
- **LICENSE_API_KEY**: Primary authentication for License API
- **LICENSE_SHARED_KEY**: Optional, for enhanced security with shared API settings
- **MANAGEMENT_API_KEY**: Authentication for Management API
- **LICENSE_API_URL**: Default: https://api.licensespring.com
- **MANAGEMENT_API_URL**: Default: https://saas.licensespring.com

## Testing Strategy

### Unit Tests
- Located in `src/utils/__tests__/`
- Test authentication logic and utility functions
- Run with `npm test`

### Integration Tests
- Located in `tests/comprehensive-integration-test.js`
- Validates all 34 MCP tools against real LicenseSpring API
- Requires valid API credentials in environment
- Run with `npm run test:integration`

## CI/CD Pipeline

### GitHub Actions Workflows
1. **ci.yml**: Runs on push/PR - linting, unit tests, build, integration tests (if secrets available)
2. **semantic-release.yml**: Automated release based on conventional commits

### Release Automation
- Conventional commits trigger automatic versioning
- Use `[release]` in commit messages to trigger releases
- Semantic release handles version bumps, changelog, GitHub releases, and NPM publishing

## TypeScript Configuration

- Target: ES2022
- Module: ESNext  
- Strict mode enabled
- Source maps and declarations generated
- Excludes test files from compilation

## Key Dependencies

- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **axios**: HTTP client for API requests
- **zod**: Runtime type validation for tool parameters
- **dotenv**: Environment variable management
- **semantic-release**: Automated versioning and publishing