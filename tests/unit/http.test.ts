import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LicenseApiConfig, ManagementApiConfig } from '../../src/config.js';
import { generateOfflineSignature, generateRequestSignature } from '../../src/utils/auth.js';
import {
  buildQueryString,
  compact,
  handleApiError,
  LicenseApiClient,
  ManagementApiClient,
  PACKAGE_VERSION,
  USER_AGENT,
} from '../../src/utils/http.js';
import { OAuthTokenProvider } from '../../src/utils/oauth.js';
import { decodeOffline, mockAxios, silentLogger } from './helpers.js';

const apiKeyConfig: LicenseApiConfig = {
  baseUrl: 'https://api.test',
  auth: { type: 'api-key', apiKey: 'ak', sharedKey: 'sk' },
  timeoutMs: 1000,
  maxRetries: 2,
};

const oauthConfig: LicenseApiConfig = {
  baseUrl: 'https://api.test',
  auth: { type: 'oauth', clientId: 'cid', clientSecret: 'csecret', tokenUrl: 'https://auth.test' },
  timeoutMs: 1000,
  maxRetries: 0,
};

const managementConfig: ManagementApiConfig = { baseUrl: 'https://saas.test', apiKey: 'mk', timeoutMs: 1000, maxRetries: 0 };

const noSleep = { sleep: async () => {} };

describe('buildQueryString', () => {
  it('serializes scalars, arrays and objects and skips empty values', () => {
    expect(buildQueryString({ a: 'x y', b: 1, c: true, d: undefined, e: null, f: [1, 2], g: { k: 'v' } }))
      .toBe('a=x+y&b=1&c=true&f=1%2C2&g=%7B%22k%22%3A%22v%22%7D');
    expect(buildQueryString()).toBe('');
  });
});

describe('compact', () => {
  it('drops undefined values only', () => {
    expect(compact({ a: 1, b: undefined, c: null, d: false })).toEqual({ a: 1, c: null, d: false });
  });
});

describe('package metadata', () => {
  it('exposes the package version in the user agent', () => {
    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(USER_AGENT).toBe(`licensespring-mcp-server/${PACKAGE_VERSION}`);
  });

  it('falls back to 0.0.0 when package.json cannot be read or has no version', async () => {
    vi.resetModules();
    vi.doMock('node:fs', () => ({ readFileSync: () => { throw new Error('missing'); } }));
    expect((await import('../../src/utils/http.js')).PACKAGE_VERSION).toBe('0.0.0');
    vi.resetModules();
    vi.doMock('node:fs', () => ({ readFileSync: () => '{}' }));
    expect((await import('../../src/utils/http.js')).PACKAGE_VERSION).toBe('0.0.0');
    vi.doUnmock('node:fs');
    vi.resetModules();
  });
});

describe('LicenseApiClient', () => {
  afterEach(() => vi.useRealTimers());

  it('signs requests with the API key and shared key', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-02T03:04:05Z'), toFake: ['Date'] });
    const { http, requests } = mockAxios(() => ({ data: { license_active: true } }));
    const client = new LicenseApiClient(apiKeyConfig, { http });
    expect(client.authType).toBe('api-key');

    await expect(client.request({ method: 'GET', path: '/api/v4/check_license', query: { product: 'P', missing: undefined } }))
      .resolves.toEqual({ license_active: true });

    const [request] = requests;
    const date = 'Fri, 02 Jan 2026 03:04:05 GMT';
    expect(request.url).toBe('/api/v4/check_license?product=P');
    expect(request.headers.Date).toBe(date);
    expect(request.headers.Authorization).toBe(
      `algorithm="hmac-sha256",headers="date",signature="${generateRequestSignature('sk', date)}",apikey="ak"`,
    );
  });

  it('uses a bearer token with OAuth and invalidates it after a 401', async () => {
    const tokenProvider = new OAuthTokenProvider({ tokenUrl: 't', clientId: 'cid', clientSecret: 's', http: { post: vi.fn() } as never });
    vi.spyOn(tokenProvider, 'getToken').mockResolvedValue('tok');
    const invalidate = vi.spyOn(tokenProvider, 'invalidate');
    let status = 200;
    const { http, requests } = mockAxios(() => ({ status, data: {} }));
    const client = new LicenseApiClient(oauthConfig, { http, tokenProvider });
    expect(client.authType).toBe('oauth');

    await client.request({ method: 'POST', path: '/api/v4/activate_license', body: { a: 1 } });
    expect(requests[0].headers.Authorization).toBe('Bearer tok');
    expect(requests[0].data).toEqual({ a: 1 });

    status = 401;
    await expect(client.request({ method: 'GET', path: '/x' })).rejects.toMatchObject({ response: { status: 401 } });
    expect(invalidate).toHaveBeenCalledTimes(1);

    status = 400;
    await expect(client.request({ method: 'GET', path: '/x' })).rejects.toMatchObject({ response: { status: 400 } });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('creates an OAuth token provider and axios instance by default', () => {
    expect(new LicenseApiClient(oauthConfig).authType).toBe('oauth');
    expect(new LicenseApiClient(apiKeyConfig).authType).toBe('api-key');
  });

  it('does not invalidate tokens for API key auth errors', async () => {
    const { http } = mockAxios(() => ({ status: 401, data: { code: 'invalid_api_key', message: 'bad' } }));
    const client = new LicenseApiClient(apiKeyConfig, { http });
    await expect(client.request({ method: 'GET', path: '/x' })).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('retries idempotent requests on 5xx and logs each retry', async () => {
    const logger = silentLogger();
    const warn = vi.spyOn(logger, 'warn');
    let calls = 0;
    const { http } = mockAxios(() => (++calls < 3 ? { status: 503, data: 'down' } : { data: 'ok' }));
    const client = new LicenseApiClient(apiKeyConfig, { http, logger, retry: noSleep });
    await expect(client.request({ method: 'GET', path: '/x' })).resolves.toBe('ok');
    expect(calls).toBe(3);
    expect(warn).toHaveBeenCalledWith('Retrying LicenseSpring API request', expect.objectContaining({ attempt: 1, status: 503 }));
  });

  it('retries without a logger configured', async () => {
    let calls = 0;
    const { http } = mockAxios(() => (++calls < 2 ? { status: 429 } : { data: 'ok' }));
    const client = new LicenseApiClient(apiKeyConfig, { http, retry: noSleep });
    await expect(client.request({ method: 'POST', path: '/x' })).resolves.toBe('ok');
    expect(calls).toBe(2);
  });

  it('does not retry non-idempotent requests on 5xx', async () => {
    let calls = 0;
    const { http } = mockAxios(() => { calls++; return { status: 500 }; });
    const client = new LicenseApiClient(apiKeyConfig, { http, retry: noSleep });
    await expect(client.request({ method: 'POST', path: '/api/v4/add_consumption' })).rejects.toBeDefined();
    expect(calls).toBe(1);
  });

  it('builds signed offline payloads for API key auth', () => {
    vi.useFakeTimers({ now: new Date('2026-01-02T03:04:05Z'), toFake: ['Date'] });
    const client = new LicenseApiClient(apiKeyConfig, { http: mockAxios().http });
    const payload = decodeOffline(client.buildOfflinePayload({ hardware_id: 'HW', product: 'P', license_key: 'KEY', skip: undefined }));
    const date = 'Fri, 02 Jan 2026 03:04:05 GMT';
    expect(payload).toEqual({
      hardware_id: 'HW',
      product: 'P',
      license_key: 'KEY',
      request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      date,
      api_key: 'ak',
      signature: generateOfflineSignature({ secret: 'sk', date, licenseKeyOrUsername: 'KEY', hardwareId: 'HW', keyId: 'ak' }),
    });
  });

  it('builds signed offline payloads for OAuth with the username and a fixed request ID', () => {
    const client = new LicenseApiClient(oauthConfig, { http: mockAxios().http });
    const payload = decodeOffline(client.buildOfflinePayload({ hardware_id: 'HW', product: 'P', username: 'u@x.io', password: 'pw', request_id: 'r1' }));
    expect(payload).toMatchObject({ client_id: 'cid', request_id: 'r1', username: 'u@x.io' });
    expect(payload).not.toHaveProperty('api_key');
    expect(payload.signature).toBe(
      generateOfflineSignature({ secret: 'csecret', date: payload.date as string, licenseKeyOrUsername: 'u@x.io', hardwareId: 'HW', keyId: 'cid' }),
    );
  });

  it('requires a license key or username for offline payloads', () => {
    const client = new LicenseApiClient(apiKeyConfig, { http: mockAxios().http });
    expect(() => client.buildOfflinePayload({ hardware_id: 'HW' })).toThrow('license_key or username');
  });
});

describe('ManagementApiClient', () => {
  it('sends JSON bodies through the provided HTTP client', async () => {
    const { http, requests } = mockAxios(() => ({ data: { id: 1 } }));
    const client = new ManagementApiClient(managementConfig, { http });
    await expect(client.request({ method: 'PATCH', path: '/api/v1/licenses/1/', body: { note: 'x' } })).resolves.toEqual({ id: 1 });
    expect(requests[0]).toMatchObject({ method: 'PATCH', url: '/api/v1/licenses/1/', data: { note: 'x' } });
  });

  it('configures the default axios instance with auth and user agent headers', () => {
    const client = new ManagementApiClient(managementConfig) as unknown as { http: { defaults: { baseURL: string; headers: Record<string, unknown> } } };
    expect(client.http.defaults.baseURL).toBe('https://saas.test');
    expect(client.http.defaults.headers.Authorization).toBe('Api-Key mk');
    expect(client.http.defaults.headers['User-Agent']).toBe(USER_AGENT);
  });
});

describe('handleApiError', () => {
  const response = (status: number, data?: unknown, statusText?: string) => ({ response: { status, data, statusText } });

  it.each([
    [undefined, 'Unknown error occurred while communicating with the LicenseSpring API'],
    ['boom', 'Unknown error occurred while communicating with the LicenseSpring API'],
    [{}, 'Unknown error occurred while communicating with the LicenseSpring API'],
    [new Error('socket hang up'), 'socket hang up'],
    [{ request: {} }, 'LicenseSpring API unreachable (no response received). Check network connectivity and the API URL.'],
    [{ request: {}, code: 'ECONNABORTED' }, 'LicenseSpring API unreachable (request timed out). Check network connectivity and the API URL.'],
    [response(400, { status: 400, code: 'license_activated_max_times', message: 'Max activations reached' }), 'HTTP 400: Max activations reached [license_activated_max_times]'],
    [response(400, { status: 400, code: 'hmac_required', message: 'HMAC required' }), 'HTTP 400: HMAC required [hmac_required] The request was not signed. Set LICENSE_SHARED_KEY alongside LICENSE_API_KEY.'],
    [response(400, { message: 'Just a message' }), 'HTTP 400: Just a message'],
    [response(404, { detail: 'Not found.' }), 'HTTP 404: Not found.'],
    [response(400, { error: 'invalid_client', error_description: 'Invalid client' }), 'HTTP 400: invalid_client: Invalid client'],
    [response(400, { error_description: 'Only description' }), 'HTTP 400: Only description'],
    [response(400, { error: 'Only error' }), 'HTTP 400: Only error'],
    [response(400, { email: ['Enter a valid email.'], items: { 0: 'bad' } }), 'HTTP 400: email: Enter a valid email.; items: {"0":"bad"}'],
    [response(400, ['first', 'second']), 'HTTP 400: first; second'],
    [response(502, 'Bad gateway'), 'HTTP 502: Bad gateway'],
    [response(502, 'x'.repeat(600)), `HTTP 502: ${'x'.repeat(500)}…`],
    [response(500, 42), 'HTTP 500: 42'],
    [response(500, {}, 'Internal Server Error'), 'HTTP 500: Internal Server Error'],
    [response(500, ''), 'HTTP 500: Request failed'],
    [response(500, null, 'Oops'), 'HTTP 500: Oops'],
    [response(401, { detail: 'Invalid API key.' }), 'HTTP 401: Invalid API key.. Verify the configured LicenseSpring credentials and their permissions.'],
    [response(403, { detail: 'Forbidden' }), 'HTTP 403: Forbidden. Verify the configured LicenseSpring credentials and their permissions.'],
    [response(429, undefined, 'Too Many Requests'), 'HTTP 429: rate limit exceeded (Too Many Requests). LicenseSpring limits requests per company per 60-second window; retry shortly.'],
  ])('describes %j', (error, message) => {
    expect(handleApiError(error)).toBe(message);
  });
});
