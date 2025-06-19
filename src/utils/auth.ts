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
 * LICENSE_SHARED_KEY is optional to support different LicenseSpring subscription tiers
 */
export function validateLicenseApiAuth(apiKey?: string, sharedKey?: string): void {
  if (!apiKey) {
    throw new Error('LICENSE_API_KEY is required for License API operations');
  }

  // Determine operation mode based on available credentials
  const isTestMode = apiKey.startsWith('test-') || process.env.NODE_ENV === 'test';
  const isLimitedMode = !sharedKey && !isTestMode;

  if (isTestMode) {
    console.warn('⚠️  Running in TEST MODE - API calls will use mock authentication');
  } else if (isLimitedMode) {
    console.warn('⚠️  Running in LIMITED MODE - LICENSE_SHARED_KEY not provided');
    console.warn('   This is normal for basic LicenseSpring subscription tiers');
    console.warn('   MCP server will start but License API calls may fail with authentication errors');
    console.warn('   Upgrade your LicenseSpring subscription to get the shared key for full functionality');
  } else {
    console.log('✅ License API authentication configured with shared key');
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
