# LicenseSpring MCP Distribution Guide

This guide explains how to use the LicenseSpring MCP servers with Claude Desktop and how to share them with other users.

## 🖥️ Using with Claude Desktop

### Quick Installation

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Install for Claude Desktop:**
   ```bash
   npm run install-claude
   ```

3. **Configure your credentials:**
   Edit the Claude Desktop config file with your LicenseSpring API keys

4. **Restart Claude Desktop**

### Manual Installation

If you prefer manual setup:

1. **Locate Claude Desktop config file:**
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux:** `~/.config/Claude/claude_desktop_config.json`

2. **Add server configuration:**
   ```json
   {
     "mcpServers": {
       "licensespring-license-api": {
         "command": "node",
         "args": ["path/to/licensespring-mcp/dist/license-api-server.js"],
         "env": {
           "LICENSE_API_URL": "https://api.licensespring.com",
           "LICENSE_API_KEY": "your_license_api_key_here",
           "LICENSE_SHARED_KEY": "your_license_shared_key_here"
         }
       },
       "licensespring-management-api": {
         "command": "node",
         "args": ["path/to/licensespring-mcp/dist/management-api-server.js"],
         "env": {
           "MANAGEMENT_API_URL": "https://saas.licensespring.com",
           "MANAGEMENT_API_KEY": "your_management_api_key_here"
         }
       }
     }
   }
   ```

### Subscription Tier Configuration

**For Basic/Standard LicenseSpring tiers:**
```json
"env": {
  "LICENSE_API_KEY": "your_api_key",
  "LICENSE_SHARED_KEY": ""
}
```

**For Premium/Enterprise LicenseSpring tiers:**
```json
"env": {
  "LICENSE_API_KEY": "your_api_key", 
  "LICENSE_SHARED_KEY": "your_shared_key"
}
```

## 📦 Sharing with Other Users

### Option 1: NPM Package (Recommended)

**For package maintainers:**

1. **Publish to NPM:**
   ```bash
   npm publish
   ```

**For end users:**

1. **Install globally:**
   ```bash
   npm install -g licensespring-mcp
   ```

2. **Configure Claude Desktop:**
   ```json
   {
     "mcpServers": {
       "licensespring-license-api": {
         "command": "licensespring-license-api",
         "env": {
           "LICENSE_API_KEY": "your_key_here"
         }
       },
       "licensespring-management-api": {
         "command": "licensespring-management-api", 
         "env": {
           "MANAGEMENT_API_KEY": "your_key_here"
         }
       }
     }
   }
   ```

### Option 2: GitHub Repository

**Share the repository:**

1. **Clone the repository:**
   ```bash
   git clone https://github.com/stier1ba/licensespring-mcp.git
   cd licensespring-mcp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Install for Claude:**
   ```bash
   npm run install-claude
   ```

### Option 3: Pre-built Releases

**Create releases with pre-built binaries:**

1. **Build for distribution:**
   ```bash
   npm run build
   ```

2. **Package for release:**
   ```bash
   # Create release archive
   tar -czf licensespring-mcp-v1.0.0.tar.gz dist/ *.md *.js *.json
   ```

3. **Users download and extract:**
   ```bash
   tar -xzf licensespring-mcp-v1.0.0.tar.gz
   node install-for-claude.js install
   ```

## 🎯 Usage Examples in Claude Desktop

Once installed, users can interact with LicenseSpring through Claude Desktop:

### License Management
- *"Check the status of license key ABC-123-DEF"*
- *"Activate license XYZ-789 for hardware ID 12345"*
- *"Get product details for my software"*
- *"Generate a trial license for product ABC"*

### Customer Management
- *"List all customers in my LicenseSpring account"*
- *"Create a new customer with email john@example.com"*
- *"Show me licenses for customer timothy@company.com"*

### License Operations
- *"Create a new license for customer ID 123 and product ID 456"*
- *"Update license 789 to disable it"*
- *"Show me all active licenses"*

## 🔧 Troubleshooting

### Common Issues

**"Server not found" error:**
- Ensure the path in Claude config points to the correct location
- Verify the project is built (`npm run build`)
- Check that Node.js is installed and accessible

**"Authentication failed" errors:**
- Verify your LicenseSpring API keys are correct
- Check your subscription tier and shared key requirements
- See `SUBSCRIPTION_TIERS.md` for detailed guidance

**"No tools available" in Claude:**
- Restart Claude Desktop after configuration changes
- Check the Claude Desktop logs for startup errors
- Verify the MCP server configuration syntax

### Getting Help

1. **Check the logs:** Claude Desktop shows MCP server logs in its developer console
2. **Test manually:** Run the servers directly to test functionality
3. **Verify credentials:** Use the LicenseSpring web interface to confirm API access
4. **Review documentation:** See `README.md` and `SUBSCRIPTION_TIERS.md`

## 🚀 Advanced Configuration

### Environment Variables

You can also use environment variables instead of hardcoding in the config:

```json
{
  "mcpServers": {
    "licensespring-license-api": {
      "command": "node",
      "args": ["path/to/dist/license-api-server.js"],
      "env": {
        "LICENSE_API_KEY": "${LICENSE_API_KEY}",
        "LICENSE_SHARED_KEY": "${LICENSE_SHARED_KEY}"
      }
    }
  }
}
```

### Multiple Environments

Configure different servers for different environments:

```json
{
  "mcpServers": {
    "licensespring-prod": {
      "command": "node",
      "args": ["path/to/dist/license-api-server.js"],
      "env": {
        "LICENSE_API_KEY": "prod_key_here"
      }
    },
    "licensespring-test": {
      "command": "node", 
      "args": ["path/to/dist/license-api-server.js"],
      "env": {
        "LICENSE_API_KEY": "test-key-here"
      }
    }
  }
}
```

## 📋 Distribution Checklist

Before sharing with users:

- [ ] ✅ Project builds successfully (`npm run build`)
- [ ] ✅ All tests pass (`npm test`)
- [ ] ✅ Documentation is up to date
- [ ] ✅ API credentials are not hardcoded
- [ ] ✅ Subscription tier support is documented
- [ ] ✅ Installation script works correctly
- [ ] ✅ Example configurations are provided
- [ ] ✅ Troubleshooting guide is complete

## 🔐 Security Considerations

**For users:**
- Never commit API keys to version control
- Use environment variables or secure config files
- Regularly rotate API keys
- Limit API key permissions to minimum required

**For distributors:**
- Provide clear security guidelines
- Document subscription tier limitations
- Include examples with placeholder credentials only
- Recommend secure credential management practices
