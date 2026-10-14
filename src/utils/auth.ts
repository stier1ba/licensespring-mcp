import crypto from 'node:crypto';

/**
 * LicenseSpring License API request signing.
 * Docs: https://docs.licensespring.com/license-api/license-api-authorization/request-signature
 *
 * Signing string: "licenseSpring\ndate: <Date header>"
 * Signature:      base64(HMAC-SHA256(sharedKey, signingString))
 */
export function signingString(date: string): string {
  return `licenseSpring\ndate: ${date}`;
}

export function hmacBase64(key: string, message: string): string {
  return crypto.createHmac('sha256', key).update(message).digest('base64');
}

export function generateLicenseApiSignature(sharedKey: string, date: string): string {
  return hmacBase64(sharedKey, signingString(date));
}

export function buildHmacAuthorization(apiKey: string, signature: string): string {
  return `algorithm="hmac-sha256",headers="date",signature="${signature}",apikey="${apiKey}"`;
}

/** RFC 7231 HTTP date, always GMT, e.g. "Tue, 14 Oct 2026 09:00:00 GMT". */
export function httpDate(now: Date = new Date()): string {
  return now.toUTCString();
}

export function generateLicenseApiAuthHeader(
  sharedKey: string,
  apiKey: string,
  now: Date = new Date(),
): { date: string; authorization: string } {
  const date = httpDate(now);
  return { date, authorization: buildHmacAuthorization(apiKey, generateLicenseApiSignature(sharedKey, date)) };
}

/**
 * Signature embedded in offline activation/deactivation payloads.
 * Docs: https://docs.licensespring.com/license-api/license-activation-and-deactivation/activate-license-offline-method
 *
 * "licenseSpring\ndate: <date>\n<license_key or username>\n<hardware_id>\n<api_key or client_id>"
 * keyed with the shared key (API-key auth) or the client secret (OAuth).
 */
export function generateOfflineSignature(params: {
  signingKey: string;
  date: string;
  licenseKeyOrUsername: string;
  hardwareId: string;
  apiKeyOrClientId: string;
}): string {
  const message = `${signingString(params.date)}\n${params.licenseKeyOrUsername}\n${params.hardwareId}\n${params.apiKeyOrClientId}`;
  return hmacBase64(params.signingKey, message);
}

/** Management API: "Authorization: Api-Key <key>". */
export function generateManagementApiAuthHeader(apiKey: string): string {
  return `Api-Key ${apiKey}`;
}
