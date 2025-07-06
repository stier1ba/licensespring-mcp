import crypto from 'crypto';

/**
 * Generate HMAC-SHA256 signature for LicenseSpring License API
 */
export function generateLicenseApiSignature(
  sharedKey: string,
  apiKey: string,
  date: string,
  licenseKey?: string,
  hardwareId?: string
): string {
  let signingString = `licenseSpring\ndate: ${date}`;
  
  // For offline operations, include license key and hardware ID
  if (licenseKey && hardwareId) {
    signingString += `\n${licenseKey}\n${hardwareId}\n${apiKey}`;
  }
  
  const hmac = crypto.createHmac('sha256', sharedKey);
  hmac.update(signingString);
  return hmac.digest('base64');
}

/**
 * Generate Authorization header for LicenseSpring License API
 */
export function generateLicenseApiAuthHeader(
  sharedKey: string,
  apiKey: string,
  licenseKey?: string,
  hardwareId?: string
): { date: string; authorization: string } {
  const date = new Date().toUTCString();
  const signature = generateLicenseApiSignature(sharedKey, apiKey, date, licenseKey, hardwareId);
  
  const authorization = `algorithm="hmac-sha256",headers="date",signature="${signature}",apikey="${apiKey}"`;
  
  return { date, authorization };
}

/**
 * Generate Authorization header for LicenseSpring Management API
 */
export function generateManagementApiAuthHeader(apiKey: string): string {
  return `Api-Key ${apiKey}`;
}

/**
 * Validate required authentication parameters for License API
 * LICENSE_API_KEY is the primary authentication method for all LicenseSpring operations
 * LICENSE_SHARED_KEY is optional and provides enhanced security for organizations with shared API settings
 */
export function validateLicenseApiAuth(apiKey?: string, sharedKey?: string): void {
  if (!apiKey) {
    throw new Error('LICENSE_API_KEY is required as the primary authentication method for License API operations');
  }

  // Determine operation mode based on available credentials
  const isTestMode = apiKey.startsWith('test-') || process.env.NODE_ENV === 'test';
  const hasSharedKey = !!sharedKey && !isTestMode;

  if (isTestMode) {
    console.warn('⚠️  Running in TEST MODE - API calls will use mock authentication');
    console.warn('   Using LICENSE_API_KEY for test authentication');
  } else if (hasSharedKey) {
    console.log('✅ License API authentication configured with LICENSE_API_KEY (primary) and LICENSE_SHARED_KEY (enhanced security)');
  } else {
    console.log('✅ License API authentication configured with LICENSE_API_KEY (primary authentication method)');
    console.warn('ℹ️  LICENSE_SHARED_KEY not provided - this is optional for organizations using shared API settings');
    console.warn('   The MCP server will use LICENSE_API_KEY as the primary authentication method');
    console.warn('   If your organization requires shared key authentication, please provide LICENSE_SHARED_KEY');
  }
}

/**
 * Validate required authentication parameters for Management API
 */
export function validateManagementApiAuth(apiKey?: string): void {
  // Allow test mode with mock credentials
  const isTestMode = apiKey?.startsWith('test-') || process.env.NODE_ENV === 'test';

  if (!apiKey) {
    throw new Error('MANAGEMENT_API_KEY is required for Management API operations');
  }

  if (isTestMode) {
    console.warn('⚠️  Running in test mode - API calls will fail but server will start');
  }
}
