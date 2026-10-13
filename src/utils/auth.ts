import crypto from 'node:crypto';

/**
 * Request signing helpers for the LicenseSpring License API.
 *
 * @see https://docs.licensespring.com/license-api/license-api-authorization/api-key-authorization
 * @see https://docs.licensespring.com/license-api/license-api-authorization/request-signature
 */

/** RFC 7231 (HTTP-date) formatted timestamp, always in GMT. */
export function httpDate(date: Date = new Date()): string {
  return date.toUTCString();
}

/**
 * Signature for the `Authorization` header: base64(HMAC-SHA256(sharedKey, "licenseSpring\ndate: <Date>")).
 */
export function generateRequestSignature(sharedKey: string, date: string): string {
  return crypto
    .createHmac('sha256', sharedKey)
    .update(`licenseSpring\ndate: ${date}`)
    .digest('base64');
}

/**
 * Build the API-key `Authorization` header value used by the License API.
 */
export function generateApiKeyAuthorization(apiKey: string, sharedKey: string, date: string): string {
  const signature = generateRequestSignature(sharedKey, date);
  return `algorithm="hmac-sha256",headers="date",signature="${signature}",apikey="${apiKey}"`;
}

/**
 * Signature embedded in offline activation/deactivation payloads.
 *
 * Signing string: "date: <date>\n<license_key or username>\n<hardware_id>\n<api_key or client_id>",
 * hashed with the shared key (API key auth) or client secret (OAuth).
 *
 * @see https://docs.licensespring.com/license-api/license-activation-and-deactivation/activate-license-offline-method
 */
export function generateOfflineSignature(params: {
  secret: string;
  date: string;
  licenseKeyOrUsername: string;
  hardwareId: string;
  keyId: string;
}): string {
  const signingString = `date: ${params.date}\n${params.licenseKeyOrUsername}\n${params.hardwareId}\n${params.keyId}`;
  return crypto.createHmac('sha256', params.secret).update(signingString).digest('base64');
}

/**
 * Management API `Authorization` header value.
 *
 * @see https://docs.licensespring.com/management-api/management-api-authorization
 */
export function generateManagementApiAuthHeader(apiKey: string): string {
  return `Api-Key ${apiKey}`;
}
