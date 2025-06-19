# LicenseSpring Subscription Tier Support

The LicenseSpring MCP Server is designed to work across all LicenseSpring subscription tiers, with graceful degradation based on available credentials.

## Subscription Tier Overview

### Basic/Standard Tiers
- **Available:** `LICENSE_API_KEY` only
- **Missing:** `LICENSE_SHARED_KEY` (not included in these tiers)
- **MCP Server Behavior:** Runs in **Limited Mode**

### Premium/Enterprise Tiers  
- **Available:** Both `LICENSE_API_KEY` and `LICENSE_SHARED_KEY`
- **MCP Server Behavior:** Runs in **Full Mode** with HMAC authentication

## Operation Modes

### 🔒 Full Mode (Premium/Enterprise)
**When:** Both `LICENSE_API_KEY` and `LICENSE_SHARED_KEY` are provided

**Features:**
- ✅ Full HMAC-SHA256 authentication
- ✅ All License API operations work
- ✅ Secure request signing
- ✅ Production-ready authentication

**Configuration:**
```env
LICENSE_API_KEY=your_actual_api_key
LICENSE_SHARED_KEY=your_actual_shared_key
```

### ⚠️ Limited Mode (Basic/Standard)
**When:** Only `LICENSE_API_KEY` is provided (no `LICENSE_SHARED_KEY`)

**Features:**
- ✅ MCP server starts successfully
- ✅ Tool schemas and MCP protocol work
- ✅ Clear warnings about limited functionality
- ❌ License API calls may fail with authentication errors
- ℹ️ Appropriate error messages guide users to upgrade

**Configuration:**
```env
LICENSE_API_KEY=your_actual_api_key
# LICENSE_SHARED_KEY=  # Leave empty or comment out
```

### 🧪 Test Mode (Development)
**When:** `LICENSE_API_KEY` starts with "test-" or `NODE_ENV=test`

**Features:**
- ✅ Safe development environment
- ✅ Mock authentication headers
- ✅ No real API calls made
- ✅ Full MCP protocol testing

**Configuration:**
```env
LICENSE_API_KEY=test-development-key
NODE_ENV=test
```

## Error Messages by Tier

### Full Mode Errors
```
Authentication failed: Invalid signature
```
*Indicates a problem with the shared key or API configuration*

### Limited Mode Errors
```
Authentication failed: Unauthorized. This may indicate that LICENSE_SHARED_KEY 
is required for your LicenseSpring subscription tier. Contact LicenseSpring 
support to upgrade your plan for full API access.
```
*Guides users to understand subscription limitations*

### Test Mode Errors
```
Error: Mock API call in test mode - check your test configuration
```
*Indicates development/testing issues*

## Startup Messages

### Full Mode Startup
```
✅ License API authentication configured with shared key
LicenseSpring License API MCP server v2.0.0 running on stdio
```

### Limited Mode Startup
```
⚠️  Running in LIMITED MODE - LICENSE_SHARED_KEY not provided
   This is normal for basic LicenseSpring subscription tiers
   MCP server will start but License API calls may fail with authentication errors
   Upgrade your LicenseSpring subscription to get the shared key for full functionality
LicenseSpring License API MCP server v2.0.0 running on stdio
```

### Test Mode Startup
```
⚠️  Running in TEST MODE - API calls will use mock authentication
LicenseSpring License API MCP server v2.0.0 running on stdio
```

## Implementation Details

### Authentication Flow

1. **Server Startup:**
   - Check for `LICENSE_API_KEY` (required)
   - Check for `LICENSE_SHARED_KEY` (optional)
   - Determine operation mode
   - Display appropriate warnings

2. **API Request Authentication:**
   - **Full Mode:** Generate HMAC-SHA256 signature with shared key
   - **Limited Mode:** Send API key only (may fail)
   - **Test Mode:** Use mock authentication headers

3. **Error Handling:**
   - Parse authentication errors
   - Provide subscription-tier-aware error messages
   - Guide users toward appropriate solutions

### Code Structure

```typescript
// Authentication validation (allows missing shared key)
validateLicenseApiAuth(apiKey, sharedKey); // Won't throw for missing shared key

// HTTP client handles different modes
const client = new LicenseApiClient(url, apiKey, sharedKey); // sharedKey optional

// Error handling provides tier-specific guidance
handleApiError(error); // Returns subscription-aware messages
```

## Best Practices

### For Basic/Standard Tier Users
1. **Expect Limited Functionality:** Understand that some API calls may fail
2. **Use MCP Features:** Tool schemas, prompts, and MCP protocol work fully
3. **Consider Upgrading:** For production use, consider upgrading to Premium/Enterprise
4. **Test Thoroughly:** Verify which operations work with your tier

### For Premium/Enterprise Tier Users
1. **Secure Credentials:** Keep your shared key secure and private
2. **Monitor Usage:** Full authentication enables production monitoring
3. **Use All Features:** Take advantage of complete License API access
4. **Backup Configuration:** Ensure shared key is backed up securely

### For Developers
1. **Use Test Mode:** Develop safely with test credentials
2. **Handle Gracefully:** Expect and handle authentication errors appropriately
3. **Document Tiers:** Clearly document which features require which tiers
4. **Test All Modes:** Verify functionality across all operation modes

## Troubleshooting

### "Server won't start"
- Check that `LICENSE_API_KEY` is provided
- `LICENSE_SHARED_KEY` is optional and won't prevent startup

### "All API calls fail"
- Verify your LicenseSpring subscription tier
- Check if `LICENSE_SHARED_KEY` is available for your tier
- Consider upgrading subscription for full API access

### "Some API calls work, others don't"
- This is expected behavior for Basic/Standard tiers
- Upgrade to Premium/Enterprise for consistent API access

### "Getting authentication errors"
- Check error message for subscription tier guidance
- Verify API key is correct
- For Premium/Enterprise: verify shared key is correct

## Support

- **LicenseSpring Documentation:** Check your subscription tier details
- **Upgrade Information:** Contact LicenseSpring sales for tier upgrades
- **Technical Support:** Contact LicenseSpring support for API issues
- **MCP Server Issues:** Check GitHub repository for technical problems
