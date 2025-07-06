# LicenseSpring Authentication Methods

The LicenseSpring MCP Server uses LICENSE_API_KEY as the primary authentication method for all operations, with optional LICENSE_SHARED_KEY for enhanced security.

## Authentication Overview

### Standard Authentication (All Organizations)
- **Primary Method:** `LICENSE_API_KEY` (required for all operations)
- **MCP Server Behavior:** Runs with **Standard Authentication**

### Enhanced Security Authentication (Organizations with Shared API Settings)
- **Primary Method:** `LICENSE_API_KEY` (required)
- **Enhanced Security:** `LICENSE_SHARED_KEY` (optional, provides HMAC authentication)
- **MCP Server Behavior:** Runs with **Enhanced Security Authentication**

## Authentication Modes

### ✅ Standard Authentication (All Organizations)
**When:** `LICENSE_API_KEY` is provided (primary authentication method)

**Features:**
- ✅ LICENSE_API_KEY as primary authentication
- ✅ All License API operations work
- ✅ MCP server starts successfully
- ✅ Production-ready authentication
- ✅ Compatible with all LicenseSpring organizations

**Configuration:**
```env
LICENSE_API_KEY=your_actual_api_key
# LICENSE_SHARED_KEY=  # Optional - leave empty if not using shared API settings
```

### 🔒 Enhanced Security Authentication (Organizations with Shared API Settings)
**When:** Both `LICENSE_API_KEY` and `LICENSE_SHARED_KEY` are provided

**Features:**
- ✅ LICENSE_API_KEY as primary authentication
- ✅ LICENSE_SHARED_KEY for enhanced HMAC-SHA256 security
- ✅ All License API operations work
- ✅ Secure request signing
- ✅ Enhanced security for shared API configurations

**Configuration:**
```env
LICENSE_API_KEY=your_actual_api_key
LICENSE_SHARED_KEY=your_actual_shared_key
```

### 🧪 Test Mode (Development)
**When:** `LICENSE_API_KEY` starts with "test-" or `NODE_ENV=test`

**Features:**
- ✅ Safe development environment
- ✅ Mock authentication headers with LICENSE_API_KEY
- ✅ No real API calls made
- ✅ Full MCP protocol testing

**Configuration:**
```env
LICENSE_API_KEY=test-development-key
NODE_ENV=test
```

## Error Messages by Authentication Mode

### Enhanced Security Authentication Errors
```
Authentication failed: Invalid signature
```
*Indicates a problem with the shared key or API configuration*

### Standard Authentication Errors
```
Authentication failed: Unauthorized. Verify your LICENSE_API_KEY is correct.
If your organization uses shared API settings, you may also need to provide
LICENSE_SHARED_KEY for enhanced security.
```
*Guides users to verify their primary authentication and consider enhanced security if needed*

### Test Mode Errors
```
Error: Mock API call in test mode - check your test configuration
```
*Indicates development/testing issues*

## Startup Messages

### Enhanced Security Authentication Startup
```
✅ License API authentication configured with LICENSE_API_KEY (primary) and LICENSE_SHARED_KEY (enhanced security)
LicenseSpring License API MCP server v2.0.0 running on stdio
```

### Standard Authentication Startup
```
✅ License API authentication configured with LICENSE_API_KEY (primary authentication method)
ℹ️  LICENSE_SHARED_KEY not provided - this is optional for organizations using shared API settings
   The MCP server will use LICENSE_API_KEY as the primary authentication method
   If your organization requires shared key authentication, please provide LICENSE_SHARED_KEY
LicenseSpring License API MCP server v2.0.0 running on stdio
```

### Test Mode Startup
```
⚠️  Running in TEST MODE - API calls will use mock authentication
   Using LICENSE_API_KEY for test authentication
LicenseSpring License API MCP server v2.0.0 running on stdio
```

## Implementation Details

### Authentication Flow

1. **Server Startup:**
   - Check for `LICENSE_API_KEY` (required as primary authentication)
   - Check for `LICENSE_SHARED_KEY` (optional for enhanced security)
   - Determine authentication mode
   - Display appropriate information messages

2. **API Request Authentication:**
   - **Enhanced Security Mode:** Generate HMAC-SHA256 signature with shared key and API key
   - **Standard Mode:** Use API key as primary authentication method
   - **Test Mode:** Use mock authentication headers with API key

3. **Error Handling:**
   - Parse authentication errors
   - Provide authentication-method-aware error messages
   - Guide users toward verifying API key and considering enhanced security

### Code Structure

```typescript
// Authentication validation (LICENSE_API_KEY required, LICENSE_SHARED_KEY optional)
validateLicenseApiAuth(apiKey, sharedKey); // Requires apiKey, sharedKey optional for enhanced security

// HTTP client handles different authentication modes
const client = new LicenseApiClient(url, apiKey, sharedKey); // apiKey required, sharedKey optional

// Error handling provides authentication-method-aware guidance
handleApiError(error); // Returns authentication-aware messages
```

## Best Practices

### For All Organizations (Standard Authentication)
1. **Secure API Key:** Keep your LICENSE_API_KEY secure and private
2. **Primary Authentication:** LICENSE_API_KEY provides full License API access
3. **Monitor Usage:** Standard authentication enables production monitoring
4. **Backup Configuration:** Ensure API key is backed up securely

### For Organizations with Shared API Settings (Enhanced Security)
1. **Secure Both Keys:** Keep both LICENSE_API_KEY and LICENSE_SHARED_KEY secure
2. **Enhanced Security:** Shared key provides additional HMAC authentication layer
3. **Use All Features:** Take advantage of enhanced security features
4. **Backup Configuration:** Ensure both keys are backed up securely

### For Developers
1. **Use Test Mode:** Develop safely with test credentials using LICENSE_API_KEY
2. **Handle Gracefully:** Expect and handle authentication errors appropriately
3. **Document Authentication:** Clearly document LICENSE_API_KEY as primary and LICENSE_SHARED_KEY as optional
4. **Test All Modes:** Verify functionality across all authentication modes

## Troubleshooting

### "Server won't start"
- Check that `LICENSE_API_KEY` is provided (required)
- `LICENSE_SHARED_KEY` is optional and won't prevent startup

### "API calls fail with authentication errors"
- Verify your `LICENSE_API_KEY` is correct
- Check if your organization uses shared API settings
- If using shared API settings, provide `LICENSE_SHARED_KEY` for enhanced security

### "Getting authentication errors"
- Check error message for authentication guidance
- Verify LICENSE_API_KEY is correct (primary authentication method)
- If your organization requires shared key authentication, verify LICENSE_SHARED_KEY is correct

### "Want enhanced security"
- Contact LicenseSpring to set up shared API settings for your organization
- Provide both LICENSE_API_KEY and LICENSE_SHARED_KEY for enhanced HMAC authentication

## Support

- **LicenseSpring Documentation:** Check your organization's API settings and authentication requirements
- **Enhanced Security Setup:** Contact LicenseSpring support to configure shared API settings
- **Technical Support:** Contact LicenseSpring support for API authentication issues
- **MCP Server Issues:** Check GitHub repository for technical problems
