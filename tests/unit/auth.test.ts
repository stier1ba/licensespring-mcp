import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  generateApiKeyAuthorization,
  generateManagementApiAuthHeader,
  generateOfflineSignature,
  generateRequestSignature,
  httpDate,
} from '../../src/utils/auth.js';

describe('auth', () => {
  it('formats dates as RFC 7231 GMT strings', () => {
    expect(httpDate(new Date(Date.UTC(2011, 5, 7, 20, 51, 35)))).toBe('Tue, 07 Jun 2011 20:51:35 GMT');
    expect(httpDate()).toMatch(/GMT$/);
  });

  it('matches the request signature example from the LicenseSpring docs', () => {
    expect(generateRequestSignature('kw4qSnpSwXzgiv5yxYpZZmFEd9QAeiKTQ6OuyMja', 'Tue, 07 Jun 2011 20:51:35 GMT'))
      .toBe('UDysfR6MndUZReo07Y9r+vErn8vSxrnQ5ulit18iJ/Q=');
  });

  it('builds the API key Authorization header', () => {
    const date = 'Tue, 07 Jun 2011 20:51:35 GMT';
    expect(generateApiKeyAuthorization('my-key', 'kw4qSnpSwXzgiv5yxYpZZmFEd9QAeiKTQ6OuyMja', date)).toBe(
      'algorithm="hmac-sha256",headers="date",signature="UDysfR6MndUZReo07Y9r+vErn8vSxrnQ5ulit18iJ/Q=",apikey="my-key"',
    );
  });

  it('signs offline payloads with date, identity, hardware ID and key ID', () => {
    const expected = crypto
      .createHmac('sha256', 'secret')
      .update('date: D\nKEY-1\nHW\napi-key')
      .digest('base64');
    expect(generateOfflineSignature({ secret: 'secret', date: 'D', licenseKeyOrUsername: 'KEY-1', hardwareId: 'HW', keyId: 'api-key' }))
      .toBe(expected);
  });

  it('builds the Management API Authorization header', () => {
    expect(generateManagementApiAuthHeader('abc.def')).toBe('Api-Key abc.def');
  });
});
