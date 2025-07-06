# LicenseSpring® MCP Server

An MCP server implementation that integrates with LicenseSpring APIs, providing comprehensive license management and customer operations capabilities.

## Features

- **License Operations**: Activate, check, deactivate licenses with hardware binding
- **Customer Management**: Create, list, and manage customers
- **Usage Tracking**: Monitor license consumption and feature usage
- **Trial Management**: Generate and manage trial licenses
- **Floating Licenses**: Handle floating license operations
- **Authentication Priority**: LICENSE_API_KEY as primary method, LICENSE_SHARED_KEY optional for enhanced security
- **Comprehensive Testing**: Full integration test suite with real API validation

## Tools

### License API Tools
- **activate_license** - Activate a license with hardware ID binding
- **check_license** - Check license status and validity
- **deactivate_license** - Deactivate a license for specific hardware
- **add_consumption** - Add consumption units to a license
- **get_trial_key** - Generate trial license keys
- **get_product_details** - Retrieve product information
- **floating_release** - Release floating licenses
- **floating_borrow** - Borrow floating licenses for offline use
- **change_password** - Change user passwords for user-based licenses
- **get_versions** - Get available software versions
- **get_installation_file** - Get installation file information
- **get_sso_url** - Generate Single Sign-On URLs

### Management API Tools
- **list_licenses** - List licenses with optional filtering
- **create_license** - Create new licenses
- **update_license** - Update existing licenses
- **get_license** - Get detailed license information
- **delete_license** - Delete licenses
- **list_customers** - List customers with filtering options
- **create_customer** - Create new customers

## Configuration

### Getting API Credentials

1. **License API Key**: Log into your LicenseSpring dashboard → Settings → Keys (PRIMARY authentication method)
2. **Management API Key**: Same location, copy your Management API Key
3. **Shared Key**: Optional for organizations using shared API settings (provides enhanced security)

### Testing

Run the comprehensive integration test to validate functionality:

```bash
# Build the project
npm run build

# Run integration tests against real LicenseSpring API
npm run test:integration

# Run unit tests
npm test
```

The integration test validates all 34 MCP tools against the real LicenseSpring API and verifies authentication priority works correctly. The implementation provides 100% feature parity with the LicenseSpring Postman collection.

🔧 **CI/CD Integration**: GitHub Actions workflows now support full integration testing with proper secret configuration.

### Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

#### License API Server
```json
{
  "mcpServers": {
    "licensespring": {
      "command": "npx",
      "args": [
        "-y",
        "@tfedorko/licensespring-mcp-server",
        "license-api"
      ],
      "env": {
        "LICENSE_API_KEY": "YOUR_LICENSE_API_KEY",
        "LICENSE_SHARED_KEY": "YOUR_SHARED_KEY_IF_USING_SHARED_API_SETTINGS"
      }
    }
  }
}
```

#### Management API Server
```json
{
  "mcpServers": {
    "licensespring-management": {
      "command": "npx",
      "args": [
        "-y",
        "@tfedorko/licensespring-mcp-server",
        "management-api"
      ],
      "env": {
        "MANAGEMENT_API_KEY": "YOUR_MANAGEMENT_API_KEY"
      }
    }
  }
}
```

#### Docker
```json
{
  "mcpServers": {
    "licensespring": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "LICENSE_API_KEY",
        "-e",
        "LICENSE_SHARED_KEY",
        "stiertfedorko/licensespring-mcp:latest"
      ],
      "env": {
        "LICENSE_API_KEY": "YOUR_LICENSE_API_KEY",
        "LICENSE_SHARED_KEY": "YOUR_SHARED_KEY_OR_LEAVE_EMPTY"
      }
    },
    "licensespring-management": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "MANAGEMENT_API_KEY",
        "stiertfedorko/licensespring-mcp-management:latest"
      ],
      "env": {
        "MANAGEMENT_API_KEY": "YOUR_MANAGEMENT_API_KEY"
      }
    }
  }
}
```

## Subscription Tier Support

The server automatically adapts to your LicenseSpring subscription tier:

- **Premium/Enterprise**: Full functionality with HMAC authentication
- **Basic/Standard**: Limited mode with helpful upgrade guidance
- **Development**: Test mode for safe development

> **Note**: `LICENSE_SHARED_KEY` is optional. The server will start regardless of your subscription tier and provide appropriate guidance for API limitations.

## Usage with VS Code

For quick installation, use the one-click installation buttons below:

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-NPM-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=licensespring&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22apiKey%22%7D%5D&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40modelcontextprotocol%2Fserver-licensespring%22%5D%2C%22env%22%3A%7B%22LICENSE_API_KEY%22%3A%22%24%7Binput%3Alicense_api_key%7D%22%7D%7D)

[![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-NPM-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=licensespring&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22apiKey%22%7D%5D&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40modelcontextprotocol%2Fserver-licensespring%22%5D%2C%22env%22%3A%7B%22LICENSE_API_KEY%22%3A%22%24%7Binput%3Alicense_api_key%7D%22%7D%7D&quality=insiders)

For manual installation, add the following JSON block to your User Settings (JSON) file in VS Code:

#### NPX
```json
{
  "mcp": {
    "inputs": [
      {
        "type": "promptString",
        "id": "license_api_key",
        "description": "LicenseSpring License API Key",
        "password": true
      },
      {
        "type": "promptString",
        "id": "license_shared_key",
        "description": "LicenseSpring Shared Key (optional for Basic/Standard tiers)",
        "password": true
      }
    ],
    "servers": {
      "licensespring": {
        "command": "npx",
        "args": ["-y", "@tfedorko/licensespring-mcp-server", "license-api"],
        "env": {
          "LICENSE_API_KEY": "${input:license_api_key}",
          "LICENSE_SHARED_KEY": "${input:license_shared_key}"
        }
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

**Error: "npm error could not determine executable to run"**
- **Solution**: Update to version 1.0.1 or later: `npx @tfedorko/licensespring-mcp-server@latest`
- **Cause**: Fixed in v1.0.1 - improved binary configuration and startup process

**Error: "MCP error -1: Connection closed"**
- **Solution**: Update to version 1.0.2 or later: `npx @tfedorko/licensespring-mcp-server@latest`
- **Cause**: Fixed in v1.0.2 - server now defaults to license-api mode for Claude Desktop compatibility

**Error: "LICENSE_API_KEY is required"**
- **Solution**: Set your environment variables in `.env` file or Claude Desktop config
- **Check**: Copy `.env.example` to `.env` and fill in your API credentials

**Error: "Authentication failed"**
- **Solution**: Verify your API keys in the LicenseSpring dashboard
- **Note**: `LICENSE_SHARED_KEY` is optional for Basic/Standard subscription tiers

**Server starts but API calls fail**
- **Check**: Your LicenseSpring subscription tier and available API features
- **Solution**: The server provides helpful guidance for subscription limitations

### Getting Help

1. Check the error messages - they provide specific guidance
2. Verify your LicenseSpring subscription tier and API access
3. Review the [Advanced Documentation](#advanced-documentation) below
4. Open an issue on GitHub with error details

## Release Automation

This project includes comprehensive automated release versioning and NPM distribution:

### Quick Release Commands
```bash
npm run release          # Patch release (1.0.0 -> 1.0.1)
npm run release:minor    # Minor release (1.0.0 -> 1.1.0)
npm run release:major    # Major release (1.0.0 -> 2.0.0)
```

### Preview Changes
```bash
npm run version:dry      # Preview version bump
npm run publish:dry      # Preview NPM publish
```

### Automated GitHub Releases
- **Commit triggers**: Use `[release]` in commit messages
- **Manual dispatch**: GitHub Actions workflow
- **Semantic release**: Conventional commit messages

For complete automation documentation, see **[Release Automation Guide](docs/RELEASE_AUTOMATION.md)**.

## Advanced Documentation

For comprehensive guides and advanced configuration:

- **[Release Automation Guide](docs/RELEASE_AUTOMATION.md)** - Complete automated release and distribution system
- **[Subscription Tier Support](docs/SUBSCRIPTION_TIERS.md)** - Detailed guide for different LicenseSpring subscription tiers
- **[Distribution Guide](docs/DISTRIBUTION_GUIDE.md)** - Complete setup and sharing instructions
- **[Test Report](docs/TEST_REPORT.md)** - Comprehensive testing results and validation
- **[Migration Guide](docs/MIGRATION_TO_OFFICIAL_PATTERN.md)** - Technical implementation details

## Installation

### NPM Package
```bash
npm install -g @tfedorko/licensespring-mcp-server
```

> **Note**: Requires Node.js 20.x or higher for optimal compatibility.

### Docker Images
```bash
# License API Server
docker pull stiertfedorko/licensespring-mcp:latest

# Management API Server
docker pull stiertfedorko/licensespring-mcp-management:latest
```

## Build

Docker build:
```bash
docker build -t licensespring-mcp:latest -f Dockerfile .
docker build -t licensespring-mcp-management:latest -f Dockerfile.management .
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.

## Trademark Notice

This project uses the LicenseSpring® name under permission from Cense Data Inc. See the [TRADEMARK](TRADEMARK) file for details.
