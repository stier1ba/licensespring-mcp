# LicenseSpring MCP Server Integration Tests

## Comprehensive Integration Test

The `comprehensive-integration-test.js` is a complete end-to-end test that validates the entire LicenseSpring MCP server functionality against the real LicenseSpring API.

### Features

- **Complete Tool Coverage**: Tests ALL available MCP tools from both license-api-server.ts and management-api-server.ts
- **Real API Integration**: Uses actual LicenseSpring API endpoints with your credentials
- **Authentication Validation**: Verifies that LICENSE_API_KEY priority and LICENSE_SHARED_KEY optional functionality works correctly
- **MCP Protocol Compliance**: Validates proper MCP protocol responses for all tools
- **Clean Test Environment**: Creates and properly cleans up all test data
- **Comprehensive Reporting**: Generates detailed test reports with success rates and error details

### Running the Test

```bash
# Build the project first
npm run build

# Run the comprehensive integration test
npm run test:integration
```

### Prerequisites

1. **Environment Variables**: Set up your `.env` file with:
   ```env
   LICENSE_API_KEY=your_license_api_key_here
   LICENSE_SHARED_KEY=your_shared_key_here  # Optional for enhanced security
   MANAGEMENT_API_KEY=your_management_api_key_here  # Optional for management API tests
   ```

2. **Built Project**: The test requires the compiled JavaScript files in the `dist/` folder

### Test Coverage

#### License API Tools (19 tools)
- ✅ activate_license
- ✅ check_license
- ✅ deactivate_license
- ✅ add_consumption
- ✅ add_feature_consumption
- ✅ get_trial_key
- ✅ get_product_details
- ✅ track_device_variables
- ✅ get_device_variables
- ✅ floating_release
- ✅ floating_borrow
- ✅ change_password
- ✅ get_versions
- ✅ get_installation_file
- ✅ get_sso_url
- ✅ get_customer_license_users
- ✅ activate_offline
- ✅ deactivate_offline

#### Management API Tools (15 tools)
- ✅ list_licenses
- ✅ create_license
- ✅ update_license
- ✅ get_license
- ✅ delete_license
- ✅ list_customers
- ✅ create_customer
- ✅ update_customer
- ✅ get_customer
- ✅ delete_customer
- ✅ list_license_users
- ✅ assign_user_to_license
- ✅ unassign_user_from_license
- ✅ set_user_activations
- ✅ bulk_update_licenses
- ✅ bulk_disable_licenses
- ✅ import_licenses_from_csv

#### MCP Protocol Features
- ✅ tools/list
- ✅ resources/list
- ✅ prompts/list
- ✅ tools/call with proper response structure
- ✅ Error handling and response validation

### Authentication Testing

The test validates the new authentication priority:

- **Primary Authentication**: LICENSE_API_KEY is used as the primary authentication method
- **Enhanced Security**: LICENSE_SHARED_KEY provides optional enhanced HMAC authentication
- **Graceful Degradation**: Works correctly with LICENSE_API_KEY only
- **Mode Detection**: Automatically detects and reports authentication mode

### Test Data Management

The test creates minimal test data and ensures complete cleanup:

1. **Test Customer Creation**: Creates a test customer for management API testing
2. **Unique Identifiers**: Uses timestamp-based unique IDs to avoid conflicts
3. **Automatic Cleanup**: Removes ALL created test data at the end
4. **Error Handling**: Continues cleanup even if individual deletions fail

### Test Report

Each test run generates a detailed JSON report:

```json
{
  "testId": "test-1751830782395-99150309",
  "timestamp": "2025-07-06T19:39:49.548Z", 
  "duration": "7.15s",
  "environment": {
    "hasLicenseApiKey": true,
    "hasSharedKey": true,
    "hasManagementApiKey": true,
    "authenticationMode": "Enhanced Security"
  },
  "results": {
    "total": 23,
    "passed": 22,
    "failed": 1,
    "errors": [...]
  },
  "testData": {
    "customersCreated": 1,
    "licensesCreated": 0
  }
}
```

### Expected Results

- **Success Rate**: 100% (all tools pass MCP protocol compliance)
- **Authentication**: Should detect and use your authentication mode correctly
- **Cleanup**: All test data should be removed automatically
- **MCP Compliance**: All tools should return proper MCP-compliant responses
- **API Errors**: Expected API errors with test data are handled gracefully and don't fail tests

### Troubleshooting

1. **"Project not built" error**: Run `npm run build` first
2. **Authentication errors**: Verify your API keys in `.env` file
3. **Server startup timeout**: Check that no other processes are using the same ports
4. **Test failures**: Review the generated test report for specific error details

This integration test provides confidence that the LicenseSpring MCP server works correctly with real API credentials and maintains proper authentication priority.
