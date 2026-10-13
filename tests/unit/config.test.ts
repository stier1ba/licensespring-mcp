import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  DEFAULT_LICENSE_API_URL,
  DEFAULT_MANAGEMENT_API_URL,
  DEFAULT_OAUTH_TOKEN_URL,
  loadLicenseApiConfig,
  loadManagementApiConfig,
} from '../../src/config.js';

describe('loadLicenseApiConfig', () => {
  it('uses API key + shared key auth with defaults', () => {
    expect(loadLicenseApiConfig({ LICENSE_API_KEY: ' key ', LICENSE_SHARED_KEY: 'shared' })).toEqual({
      baseUrl: DEFAULT_LICENSE_API_URL,
      auth: { type: 'api-key', apiKey: 'key', sharedKey: 'shared' },
      timeoutMs: 25000,
      maxRetries: 2,
    });
  });

  it('prefers OAuth when client credentials are set', () => {
    const config = loadLicenseApiConfig({
      LICENSE_CLIENT_ID: 'auth-company-1',
      LICENSE_CLIENT_SECRET: 'secret',
      LICENSE_API_KEY: 'ignored',
      LICENSE_API_URL: 'https://example.test',
      LICENSESPRING_TIMEOUT_MS: '1000',
      LICENSESPRING_MAX_RETRIES: '0',
    });
    expect(config).toEqual({
      baseUrl: 'https://example.test',
      auth: { type: 'oauth', clientId: 'auth-company-1', clientSecret: 'secret', tokenUrl: DEFAULT_OAUTH_TOKEN_URL },
      timeoutMs: 1000,
      maxRetries: 0,
    });
  });

  it('honours a custom OAuth token URL', () => {
    const config = loadLicenseApiConfig({ LICENSE_CLIENT_ID: 'id', LICENSE_CLIENT_SECRET: 's', LICENSE_OAUTH_TOKEN_URL: 'https://t' });
    expect(config.auth).toMatchObject({ tokenUrl: 'https://t' });
  });

  it.each([
    [{ LICENSE_CLIENT_ID: 'id' }, /both LICENSE_CLIENT_ID and LICENSE_CLIENT_SECRET/],
    [{ LICENSE_CLIENT_SECRET: 's' }, /both LICENSE_CLIENT_ID and LICENSE_CLIENT_SECRET/],
    [{}, /credentials missing/],
    [{ LICENSE_API_KEY: '  ' }, /credentials missing/],
    [{ LICENSE_API_KEY: 'key' }, /LICENSE_SHARED_KEY is required/],
    [{ LICENSE_API_KEY: 'k', LICENSE_SHARED_KEY: 's', LICENSESPRING_TIMEOUT_MS: 'abc' }, /LICENSESPRING_TIMEOUT_MS/],
    [{ LICENSE_API_KEY: 'k', LICENSE_SHARED_KEY: 's', LICENSESPRING_MAX_RETRIES: '-1' }, /LICENSESPRING_MAX_RETRIES/],
  ])('rejects invalid configuration %#', (env, message) => {
    expect(() => loadLicenseApiConfig(env)).toThrow(ConfigError);
    expect(() => loadLicenseApiConfig(env)).toThrow(message);
  });

  it('reads process.env by default', () => {
    process.env.LICENSE_API_KEY = 'env-key';
    process.env.LICENSE_SHARED_KEY = 'env-shared';
    try {
      expect(loadLicenseApiConfig().auth).toMatchObject({ apiKey: 'env-key' });
    } finally {
      delete process.env.LICENSE_API_KEY;
      delete process.env.LICENSE_SHARED_KEY;
    }
  });
});

describe('loadManagementApiConfig', () => {
  it('loads the API key and defaults', () => {
    expect(loadManagementApiConfig({ MANAGEMENT_API_KEY: 'mk' })).toEqual({
      baseUrl: DEFAULT_MANAGEMENT_API_URL,
      apiKey: 'mk',
      timeoutMs: 25000,
      maxRetries: 2,
    });
    expect(loadManagementApiConfig({ MANAGEMENT_API_KEY: 'mk', MANAGEMENT_API_URL: 'https://m' }).baseUrl).toBe('https://m');
  });

  it('requires MANAGEMENT_API_KEY', () => {
    expect(() => loadManagementApiConfig({})).toThrow(/MANAGEMENT_API_KEY is required/);
  });

  it('reads process.env by default', () => {
    process.env.MANAGEMENT_API_KEY = 'env-mk';
    try {
      expect(loadManagementApiConfig().apiKey).toBe('env-mk');
    } finally {
      delete process.env.MANAGEMENT_API_KEY;
    }
  });
});
