# LicenseSpring MCP Server

Model Context Protocol (MCP) servers for seamless integration with LicenseSpring's License API and Management API. This project provides two separate MCP servers that expose LicenseSpring's functionality through standardized MCP tools.

## Features

### License API Server
- **License Operations**: Activate, check, and deactivate licenses
- **Consumption Tracking**: Add consumption units and feature-specific consumption
- **Trial Management**: Generate trial license keys
- **Product Information**: Get product details and available versions
- **Device Management**: Track and retrieve device variables
- **Floating Licenses**: Release and borrow floating licenses
- **User Management**: Change passwords for user-based licenses
- **Installation Files**: Get download information for software installations
- **SSO Integration**: Generate Single Sign-On URLs for customer portals

### Management API Server
- **License Management**: Full CRUD operations for licenses
- **Customer Management**: Create, update, and manage customers
- **Product Management**: Manage products and their configurations
- **Advanced Filtering**: Search and filter across all entities
- **Bulk Operations**: Efficient handling of multiple records

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/stier1ba/licensespring-mcp.git
   cd licensespring-mcp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your LicenseSpring API credentials
   ```

4. **Build the project**:
   ```bash
   npm run build
   ```

## Configuration

Create a `.env` file with your LicenseSpring API credentials:

```env
# License API Configuration
LICENSE_API_URL=https://api.licensespring.com
LICENSE_API_KEY=your_license_api_key_here
LICENSE_SHARED_KEY=your_license_shared_key_here

# Management API Configuration  
MANAGEMENT_API_URL=https://saas.licensespring.com
MANAGEMENT_API_KEY=your_management_api_key_here

# Optional Configuration
DEFAULT_PRODUCT_CODE=your_default_product_code
DEBUG=false
```

### Getting API Credentials

1. **License API Credentials**:
   - Log into your LicenseSpring dashboard
   - Go to Settings > Keys
   - Copy your API Key and Shared Key

2. **Management API Credentials**:
   - In the same Settings > Keys section
   - Copy your Management API Key

## Usage

### Running the Servers

**License API Server**:
```bash
npm run license-api
```

**Management API Server**:
```bash
npm run management-api
```

**Development Mode**:
```bash
npm run dev  # Shows usage information
```

### MCP Client Configuration

Add the servers to your MCP client configuration:

```json
{
  "mcpServers": {
    "licensespring-license-api": {
      "command": "node",
      "args": ["path/to/licensespring-mcp/dist/license-api-server.js"],
      "env": {
        "LICENSE_API_KEY": "your_api_key",
        "LICENSE_SHARED_KEY": "your_shared_key"
      }
    },
    "licensespring-management-api": {
      "command": "node", 
      "args": ["path/to/licensespring-mcp/dist/management-api-server.js"],
      "env": {
        "MANAGEMENT_API_KEY": "your_management_api_key"
      }
    }
  }
}
```

## Available Tools

### License API Tools

| Tool | Description |
|------|-------------|
| `activate_license` | Activate a license with hardware ID |
| `check_license` | Check license status and validity |
| `deactivate_license` | Deactivate a license |
| `add_consumption` | Add consumption units to a license |
| `add_feature_consumption` | Add consumption to specific features |
| `get_trial_key` | Generate trial license keys |
| `get_product_details` | Get product information |
| `track_device_variables` | Track custom device variables |
| `get_device_variables` | Retrieve tracked device variables |
| `floating_release` | Release floating licenses |
| `floating_borrow` | Borrow floating licenses for offline use |
| `change_password` | Change user passwords |
| `get_versions` | Get available software versions |
| `get_installation_file` | Get installation file information |
| `get_sso_url` | Generate SSO URLs |

### Management API Tools

| Tool | Description |
|------|-------------|
| `list_licenses` | List licenses with filtering |
| `create_license` | Create new licenses |
| `update_license` | Update existing licenses |
| `get_license` | Get license details |
| `delete_license` | Delete licenses |
| `list_customers` | List customers with filtering |
| `create_customer` | Create new customers |
| `update_customer` | Update customer information |
| `get_customer` | Get customer details |
| `delete_customer` | Delete customers |
| `list_products` | List products with filtering |
| `create_product` | Create new products |
| `update_product` | Update product information |
| `get_product` | Get product details |
| `delete_product` | Delete products |

## Examples

### License Activation
```typescript
// Activate a license
{
  "tool": "activate_license",
  "arguments": {
    "license_key": "XXXX-XXXX-XXXX-XXXX",
    "hardware_id": "unique-hardware-id",
    "product": "your-product-code"
  }
}
```

### Customer Creation
```typescript
// Create a new customer
{
  "tool": "create_customer",
  "arguments": {
    "email": "customer@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "company_name": "Example Corp"
  }
}
```

## Authentication

### License API Authentication
Uses HMAC-SHA256 signature authentication:
- Requires API Key and Shared Key
- Automatically generates signatures for each request
- Includes proper date headers

### Management API Authentication  
Uses API Key authentication:
- Requires Management API Key
- Sent as `Authorization: Api-Key {key}` header

## Error Handling

The servers provide comprehensive error handling:
- API errors are properly formatted and returned
- Network errors are caught and reported
- Invalid parameters are validated before requests
- Detailed error messages help with debugging

## Development

### Building
```bash
npm run build
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Testing
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [LicenseSpring API Docs](https://docs.licensespring.com/)
- **Issues**: [GitHub Issues](https://github.com/stier1ba/licensespring-mcp/issues)
- **MCP Protocol**: [Model Context Protocol](https://modelcontextprotocol.io/)

## Changelog

### v1.0.0
- Initial release
- License API MCP server with full endpoint coverage
- Management API MCP server with CRUD operations
- Comprehensive authentication handling
- TypeScript implementation with full type safety
