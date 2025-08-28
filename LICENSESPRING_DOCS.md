# LicenseSpring Documentation Guide

This guide provides a comprehensive overview of the LicenseSpring platform documentation for developers working on the LicenseSpring MCP Server project.

## 📚 Official Documentation
- **Main Documentation**: https://docs.licensespring.com/
- **API Reference**: https://docs.licensespring.com/docs/license-api
- **Management API**: https://docs.licensespring.com/docs/management-api

## 🏗️ Platform Architecture

### Core Components

1. **Vendor Platform** - Web-based management interface
   - License management
   - Customer management
   - Product configuration
   - Analytics and reporting
   - Settings and API keys

2. **License API** - Client-facing API
   - Base URL: `https://api.licensespring.com`
   - Used by SDKs and client applications
   - Handles license activation, validation, and management
   - RESTful architecture with SSL

3. **Management API** - Administrative API
   - Base URL: `https://saas.licensespring.com`
   - Backend administrative operations
   - Has destructive capabilities (create, update, delete)
   - Not intended for client-facing use

## 🔐 Authentication

### License API Authentication

**Methods:**
1. **API Key Authorization**
   - Requires API key from vendor platform
   - Found in Settings → Keys
   - Used as primary authentication method

2. **Shared Key (HMAC Signature)**
   - Optional enhanced security
   - Used for request signing
   - Provides additional layer of authentication

3. **OAuth Authorization**
   - Alternative authentication method
   - Suitable for web applications

**Implementation:**
```javascript
// API Key in header
headers: {
  'Authorization': 'Api-Key YOUR_LICENSE_API_KEY'
}

// With HMAC signature (optional)
// Signature = HMAC-SHA256(request_data, shared_key)
```

### Management API Authentication

**Format:**
```javascript
headers: {
  'Authorization': 'Api-Key YOUR_MANAGEMENT_API_KEY'
}
```

**Example:**
```python
API_URL = 'https://saas.licensespring.com'
API_KEY = 'your_management_api_key'

response = requests.get(
  url=f'{API_URL}/api/v1/orders/generate_license/',
  params={'product': product_short_code, 'quantity': quantity},
  headers={'Authorization': f'Api-Key {API_KEY}'}
)
```

## 📡 API Endpoints

### License API Endpoints

**Core Operations:**
- `/activate` - Activate a license
- `/check` - Validate license status
- `/deactivate` - Deactivate a license
- `/add_consumption` - Track usage/consumption
- `/floating/borrow` - Borrow floating license
- `/floating/release` - Release floating license
- `/trial` - Generate trial licenses
- `/versions` - Get available versions
- `/installation_file` - Get installation files

**Important Notes:**
- Use product code (not product name) in requests
- Encode special characters in emails (e.g., `+` → `%2b`, `@` → `%40`)
- All requests must be signed with API key

### Management API Endpoints

**Customer Management:**
- `GET/POST /api/v1/customers/` - List/create customers
- `GET/PUT/DELETE /api/v1/customers/{id}/` - Manage specific customer
- `POST /api/v1/customers/import/` - Bulk import

**License Management:**
- `GET/POST /api/v1/licenses/` - List/create licenses
- `GET/PUT/DELETE /api/v1/licenses/{id}/` - Manage specific license
- `POST /api/v1/licenses/bulk/` - Bulk operations
- `POST /api/v1/licenses/export/` - Export licenses

**Product Management:**
- `GET /api/v1/products/` - List products
- `GET /api/v1/products/{id}/` - Get product details
- `GET /api/v1/products/{id}/features/` - Product features

**Order Management:**
- `GET/POST /api/v1/orders/` - List/create orders
- `GET /api/v1/orders/generate_license/` - Generate license from order

## 🛠️ SDKs

### Supported Platforms
- **.NET/C#** - Full feature support
- **C++** - Cross-platform support
- **Python** - Native Python integration
- **Java** - JVM-based applications
- **Go** - Modern backend services
- **Swift/Objective-C** - iOS/macOS applications
- **Android** - Native Android apps
- **Unity** - Game development
- **Delphi** - Legacy application support

### SDK Features
- Simplified integration process
- Built-in license validation
- Offline activation support
- Hardware binding
- Consumption tracking
- Floating license management
- Air-gapped activation support

## 📋 License Types & Policies

### License Types
1. **Perpetual** - One-time purchase, lifetime usage
2. **Subscription** - Time-based licensing
3. **Trial** - Time-limited evaluation
4. **Floating** - Concurrent user licensing
5. **Node-locked** - Hardware-bound licenses
6. **User-based** - Tied to specific users

### License Features
- **Feature-level licensing** - Enable/disable specific features
- **Consumption tracking** - Usage-based licensing
- **Custom fields** - Metadata and custom attributes
- **License policies** - Validation rules and restrictions
- **Offline grace period** - Temporary offline usage
- **Hardware fingerprinting** - Device identification

## 🔧 Implementation Best Practices

### Security
1. **Never expose API keys in client code**
2. **Use HTTPS for all API calls**
3. **Implement proper error handling**
4. **Validate input parameters**
5. **Store keys securely (environment variables)**
6. **Use shared key for enhanced security**

### Error Handling
```javascript
try {
  const response = await apiClient.post('/activate', data);
  // Handle success
} catch (error) {
  if (error.response) {
    // API returned error
    switch(error.response.status) {
      case 400: // Bad request
      case 401: // Unauthorized
      case 404: // Not found
      case 429: // Rate limited
    }
  }
}
```

### Rate Limiting
- Be aware of API rate limits
- Implement exponential backoff
- Cache responses when appropriate
- Batch operations where possible

## 🚀 Common Use Cases

### 1. License Activation Flow
```
1. Collect license key from user
2. Generate hardware ID
3. Call /activate endpoint
4. Store activation response
5. Periodically call /check for validation
```

### 2. Trial License Generation
```
1. Collect user information
2. Call /trial endpoint
3. Provide trial key to user
4. Track trial expiration
```

### 3. Floating License Management
```
1. Request license with /floating/borrow
2. Use license for session
3. Release with /floating/release
4. Handle maximum concurrent users
```

### 4. Consumption Tracking
```
1. Track feature usage
2. Call /add_consumption periodically
3. Handle consumption limits
4. Alert on approaching limits
```

## 📊 Analytics & Reporting

### Available Metrics
- License activation trends
- Feature usage statistics
- Customer activity
- Revenue tracking
- Geographic distribution
- Version adoption rates

### Webhook Events
- License activated
- License deactivated
- License expired
- Consumption threshold reached
- Customer created/updated

## 🔍 Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify API key is correct
   - Check key permissions
   - Ensure proper header format

2. **License Activation Issues**
   - Validate license key format
   - Check hardware ID generation
   - Verify product configuration

3. **API Response Errors**
   - Check request encoding
   - Validate required parameters
   - Review API response codes

### Debug Tips
- Use API testing tools (Postman, cURL)
- Enable verbose logging
- Check server status page
- Review audit logs in vendor platform

## 📖 Additional Resources

### Support Channels
- Documentation: https://docs.licensespring.com
- API Status: Check vendor platform
- Support: Through vendor platform

### Development Tools
- Postman Collection: Available for API testing
- SDK Examples: Included with each SDK
- Code Samples: In documentation

### Migration & Integration
- Supports migration from other licensing systems
- REST API for custom integrations
- Webhook support for event-driven architectures
- White-label options available

## 🎯 Key Takeaways for MCP Server Development

1. **Two Distinct APIs**: License API (client-facing) and Management API (admin)
2. **Authentication Priority**: API key is primary, shared key is optional enhancement
3. **Product Codes**: Always use product short codes, not names
4. **Encoding**: Special characters in parameters must be URL encoded
5. **Security**: Management API has destructive capabilities - handle with care
6. **Testing**: Use real API endpoints for integration testing
7. **Error Handling**: Implement comprehensive error handling for API responses
8. **SDK Pattern**: Follow SDK patterns for consistent implementation

This guide should be used alongside the official LicenseSpring documentation for the most up-to-date information and API specifications.