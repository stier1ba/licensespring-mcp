import {
  buildHmacAuthorization,
  generateLicenseApiAuthHeader,
  generateLicenseApiSignature,
  generateManagementApiAuthHeader,
  generateOfflineSignature,
  hmacBase64,
  httpDate,
  signingString,
} from '../auth.js';
import { FIXED_DATE, FIXED_HTTP_DATE } from '../../__tests__/helpers.js';

// Expected values computed independently with:
//   printf 'licenseSpring\ndate: <date>' | openssl dgst -sha256 -hmac 'shared-secret' -binary | base64
const REQUEST_SIGNATURE = '5RqVbgZ6s145T0Jtpfc4V9voocbZ4ulIH9WWTzLg9ww=';
const OFFLINE_SIGNATURE = 'NET2zkzUAwolzrHfXBuYBGWAY9DnI2o8wF0mCUQKTkc=';

describe('auth', () => {
  it('builds the documented signing string', () => {
    expect(signingString(FIXED_HTTP_DATE)).toBe(`licenseSpring\ndate: ${FIXED_HTTP_DATE}`);
  });

  it('formats dates as RFC 7231 GMT', () => {
    expect(httpDate(FIXED_DATE)).toBe(FIXED_HTTP_DATE);
    expect(httpDate()).toMatch(/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/);
  });

  it('matches an independently computed request signature', () => {
    expect(generateLicenseApiSignature('shared-secret', FIXED_HTTP_DATE)).toBe(REQUEST_SIGNATURE);
    expect(hmacBase64('shared-secret', signingString(FIXED_HTTP_DATE))).toBe(REQUEST_SIGNATURE);
  });

  it('builds the Authorization header in the documented format', () => {
    expect(buildHmacAuthorization('api-key-1', 'sig=')).toBe(
      'algorithm="hmac-sha256",headers="date",signature="sig=",apikey="api-key-1"',
    );
  });

  it('generates Date + Authorization headers', () => {
    const { date, authorization } = generateLicenseApiAuthHeader('shared-secret', 'api-key-1', FIXED_DATE);
    expect(date).toBe(FIXED_HTTP_DATE);
    expect(authorization).toBe(
      `algorithm="hmac-sha256",headers="date",signature="${REQUEST_SIGNATURE}",apikey="api-key-1"`,
    );
    expect(generateLicenseApiAuthHeader('k', 'a').date).toMatch(/GMT$/);
  });

  it('matches an independently computed offline payload signature', () => {
    expect(generateOfflineSignature({
      signingKey: 'shared-secret',
      date: FIXED_HTTP_DATE,
      licenseKeyOrUsername: 'AAAA-BBBB-CCCC',
      hardwareId: 'hw-123',
      apiKeyOrClientId: 'api-key-1',
    })).toBe(OFFLINE_SIGNATURE);
  });

  it('builds the Management API header', () => {
    expect(generateManagementApiAuthHeader('mgmt')).toBe('Api-Key mgmt');
  });
});
