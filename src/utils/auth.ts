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
 * Validate required authentication parameters
 */
export function validateLicenseApiAuth(apiKey?: string, sharedKey?: string): void {
  if (!apiKey) {
    throw new Error('LICENSE_API_KEY is required for License API operations');
  }
  if (!sharedKey) {
    throw new Error('LICENSE_SHARED_KEY is required for License API operations');
  }
}

/**
 * Validate required authentication parameters for Management API
 */
export function validateManagementApiAuth(apiKey?: string): void {
  if (!apiKey) {
    throw new Error('MANAGEMENT_API_KEY is required for Management API operations');
  }
}
