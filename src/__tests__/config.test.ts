import {
  ConfigError,
  DEFAULT_LICENSE_API_URL,
  DEFAULT_MANAGEMENT_API_URL,
  DEFAULT_OAUTH_TOKEN_URL,
  loadLicenseApiConfig,
  loadManagementApiConfig,
} from '../config.js';

describe('loadLicenseApiConfig', () => {
  it('uses HMAC with API key + shared key', () => {
    expect(loadLicenseApiConfig({ LICENSE_API_KEY: 'k', LICENSE_SHARED_KEY: 's' })).toEqual({
      baseURL: DEFAULT_LICENSE_API_URL,
      auth: { type: 'hmac', apiKey: 'k', sharedKey: 's' },
    });
  });

  it('trims values and honours LICENSE_API_URL', () => {
    expect(loadLicenseApiConfig({ LICENSE_API_KEY: ' k ', LICENSE_SHARED_KEY: 's', LICENSE_API_URL: 'https://eu.example' }))
      .toMatchObject({ baseURL: 'https://eu.example', auth: { apiKey: 'k' } });
  });

  it('prefers OAuth when client credentials are set', () => {
    expect(loadLicenseApiConfig({ LICENSE_CLIENT_ID: 'id', LICENSE_CLIENT_SECRET: 'sec', LICENSE_API_KEY: 'k', LICENSE_SHARED_KEY: 's' }))
      .toEqual({ baseURL: DEFAULT_LICENSE_API_URL, auth: { type: 'oauth', clientId: 'id', clientSecret: 'sec', tokenUrl: DEFAULT_OAUTH_TOKEN_URL } });
  });

  it('honours a custom token URL', () => {
    expect(loadLicenseApiConfig({ LICENSE_CLIENT_ID: 'id', LICENSE_CLIENT_SECRET: 'sec', LICENSE_OAUTH_TOKEN_URL: 'https://t' }).auth)
      .toMatchObject({ tokenUrl: 'https://t' });
  });

  it.each([
    [{ LICENSE_CLIENT_ID: 'id' }, /both LICENSE_CLIENT_ID and LICENSE_CLIENT_SECRET/],
    [{ LICENSE_CLIENT_SECRET: 'sec' }, /both LICENSE_CLIENT_ID and LICENSE_CLIENT_SECRET/],
    [{ LICENSE_API_KEY: 'k' }, /LICENSE_SHARED_KEY is required/],
    [{ LICENSE_API_KEY: 'k', LICENSE_SHARED_KEY: '   ' }, /LICENSE_SHARED_KEY is required/],
    [{}, /No License API credentials/],
  ])('rejects %p', (env, message) => {
    expect(() => loadLicenseApiConfig(env)).toThrow(ConfigError);
    expect(() => loadLicenseApiConfig(env)).toThrow(message);
  });
});

describe('loadManagementApiConfig', () => {
  it('reads key and default URL', () => {
    expect(loadManagementApiConfig({ MANAGEMENT_API_KEY: 'm' })).toEqual({ baseURL: DEFAULT_MANAGEMENT_API_URL, apiKey: 'm' });
  });
  it('honours MANAGEMENT_API_URL', () => {
    expect(loadManagementApiConfig({ MANAGEMENT_API_KEY: 'm', MANAGEMENT_API_URL: 'https://m' }).baseURL).toBe('https://m');
  });
  it('requires the key', () => {
    expect(() => loadManagementApiConfig({})).toThrow(/MANAGEMENT_API_KEY is required/);
    const error = (() => { try { loadManagementApiConfig({}); } catch (e) { return e; } })() as Error;
    expect(error.name).toBe('ConfigError');
  });
});
