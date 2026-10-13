import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import { DEFAULT_OAUTH_TOKEN_URL, type LicenseApiAuth } from '../../config.js';
import { VERSION } from '../../version.js';
import { createMockAdapter, FIXED_DATE, FIXED_HTTP_DATE, networkError } from '../../__tests__/helpers.js';
import {
  buildQuery,
  compact,
  handleApiError,
  LicenseApiClient,
  ManagementApiClient,
  ValidationError,
} from '../http.js';
import { Logger, LogLevel } from '../logger.js';

const HMAC: LicenseApiAuth = { type: 'hmac', apiKey: 'api-key-1', sharedKey: 'shared-secret' };
const OAUTH: LicenseApiAuth = { type: 'oauth', clientId: 'auth-company-1', clientSecret: 'secret', tokenUrl: 'https://auth.example/token' };
const noSleep = { sleep: () => Promise.resolve(), initialDelay: 0 };

describe('buildQuery', () => {
  it('drops nullish values and stringifies the rest', () => {
    const q = buildQuery({ a: 'x', b: 1, c: true, d: false, e: undefined, f: null, g: [1, 2, 3] });
    expect(Object.fromEntries(q)).toEqual({ a: 'x', b: '1', c: 'true', d: 'false', g: '1,2,3' });
  });
  it('accepts undefined', () => {
    expect(buildQuery(undefined).toString()).toBe('');
  });
});

describe('compact', () => {
  it('removes undefined keys only', () => {
    expect(compact({ a: 1, b: undefined, c: null, d: 0, e: '' })).toEqual({ a: 1, c: null, d: 0, e: '' });
  });
});

describe('LicenseApiClient (HMAC)', () => {
  it('signs every request with Date + HMAC Authorization', async () => {
    const mock = createMockAdapter();
    const client = new LicenseApiClient('https://api.example', HMAC, { adapter: mock.adapter, now: () => FIXED_DATE });
    await client.get('/api/v4/check_license', { product: 'p', flag: true });
    const call = mock.last();
    expect(call.baseURL).toBe('https://api.example');
    expect(call.params).toEqual({ product: 'p', flag: 'true' });
    expect(call.headers.Date).toBe(FIXED_HTTP_DATE);
    expect(call.headers.Authorization).toBe(
      'algorithm="hmac-sha256",headers="date",signature="5RqVbgZ6s145T0Jtpfc4V9voocbZ4ulIH9WWTzLg9ww=",apikey="api-key-1"',
    );
    expect(call.headers['User-Agent']).toBe(`licensespring-mcp-server/${VERSION}`);
    expect(client.baseURL).toBe('https://api.example');
  });

  it('sends JSON bodies for POST and query params when given', async () => {
    const mock = createMockAdapter();
    const client = new LicenseApiClient('https://api.example', HMAC, { adapter: mock.adapter });
    await client.post('/x', { a: 1 }, { q: 'v' });
    expect(mock.last()).toMatchObject({ method: 'POST', body: { a: 1 }, params: { q: 'v' } });
    await client.post('/y');
    expect(mock.last()).toMatchObject({ method: 'POST', params: {} });
  });

  it('sends raw text with text/plain for offline endpoints', async () => {
    const mock = createMockAdapter();
    const client = new LicenseApiClient('https://api.example', HMAC, { adapter: mock.adapter });
    await client.postText('/api/v4/activate_offline', 'YmFzZTY0');
    expect(mock.last().rawBody).toBe('YmFzZTY0');
    expect(mock.last().headers['Content-Type']).toBe('text/plain');
  });

  it('exposes offline credentials and the current date', () => {
    const client = new LicenseApiClient('https://api.example', HMAC, { now: () => FIXED_DATE });
    expect(client.offlineCredentials()).toEqual({ field: 'api_key', value: 'api-key-1', signingKey: 'shared-secret' });
    expect(client.currentDate()).toBe(FIXED_HTTP_DATE);
    expect(new LicenseApiClient('https://api.example', HMAC).currentDate()).toMatch(/GMT$/);
  });

  it('refuses to fetch OAuth tokens when using HMAC', async () => {
    await expect(new LicenseApiClient('https://x', HMAC).getAccessToken()).rejects.toThrow('OAuth is not configured');
  });

  it('retries GET requests on 5xx and logs the retry', async () => {
    const mock = createMockAdapter();
    const lines: string[] = [];
    const logger = new Logger('t', { level: LogLevel.DEBUG, sink: (l) => lines.push(l) });
    const onRetry = jest.fn();
    const client = new LicenseApiClient('https://x', HMAC, { adapter: mock.adapter, retry: { ...noSleep, onRetry }, logger });
    mock.reply({ status: 503, data: {} }, networkError(), { status: 200, data: { ok: 1 } });
    await expect(client.get('/r')).resolves.toEqual({ ok: 1 });
    expect(mock.calls).toHaveLength(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(lines.some((l) => l.includes('Retrying API request') && l.includes('HTTP 503'))).toBe(true);
    expect(lines.some((l) => l.includes('socket hang up'))).toBe(true);
    expect(lines.some((l) => l.includes('"API request"'))).toBe(true);
  });

  it('retries without a logger or onRetry callback', async () => {
    const mock = createMockAdapter();
    const client = new LicenseApiClient('https://x', HMAC, { adapter: mock.adapter, retry: noSleep });
    mock.reply({ status: 500, data: {} }, { status: 200, data: 'ok' });
    await expect(client.get('/r')).resolves.toBe('ok');
  });

  it('does not retry a GET when retry: false (side-effecting GETs)', async () => {
    const mock = createMockAdapter();
    const client = new LicenseApiClient('https://x', HMAC, { adapter: mock.adapter, retry: noSleep });
    mock.reply({ status: 503, data: {} });
    await expect(client.get('/api/v4/trial_key', {}, { retry: false })).rejects.toBeInstanceOf(AxiosError);
    expect(mock.calls).toHaveLength(1);
  });

  it('never retries non-GET requests', async () => {
    const mock = createMockAdapter();
    const client = new LicenseApiClient('https://x', HMAC, { adapter: mock.adapter, retry: noSleep });
    mock.reply({ status: 503, data: {} });
    await expect(client.post('/add_consumption', {})).rejects.toBeInstanceOf(AxiosError);
    expect(mock.calls).toHaveLength(1);
  });

  it('supports PATCH and DELETE', async () => {
    const mock = createMockAdapter();
    const client = new LicenseApiClient('https://x', HMAC, { adapter: mock.adapter });
    await client.patch('/p', { a: 1 });
    expect(mock.last()).toMatchObject({ method: 'PATCH', body: { a: 1 } });
    await client.delete('/d');
    expect(mock.last().method).toBe('DELETE');
  });

  it('uses default timeout/options when none given', () => {
    expect(new LicenseApiClient('https://x', HMAC).baseURL).toBe('https://x');
  });
});

describe('LicenseApiClient (OAuth)', () => {
  function setup(start = FIXED_DATE.getTime()) {
    let now = start;
    const mock = createMockAdapter();
    const client = new LicenseApiClient('https://api.example', OAUTH, { adapter: mock.adapter, now: () => new Date(now) });
    return { mock, client, advance: (ms: number) => { now += ms; } };
  }

  it('fetches a client-credentials token and sends it as a Bearer token with Date', async () => {
    const { mock, client } = setup();
    mock.reply({ data: { access_token: 'tok-1', expires_in: 480 } }, { data: { ok: true } });
    await client.get('/api/v4/products');

    const [tokenCall, apiCall] = mock.calls;
    expect(tokenCall.url).toBe('https://auth.example/token');
    expect(tokenCall.method).toBe('POST');
    expect(tokenCall.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(Object.fromEntries(new URLSearchParams(tokenCall.rawBody as string))).toEqual({
      grant_type: 'client_credentials', client_id: 'auth-company-1', client_secret: 'secret',
    });
    expect(apiCall.headers.Authorization).toBe('Bearer tok-1');
    expect(apiCall.headers.Date).toBe(FIXED_HTTP_DATE);
  });

  it('caches the token until shortly before expiry, then refreshes', async () => {
    const { mock, client, advance } = setup();
    mock.reply({ data: { access_token: 'tok-1', expires_in: 480 } }, {}, {});
    await client.get('/a');
    advance(400_000); // still inside 480s - 30s
    await client.get('/b');
    expect(mock.calls.filter((c) => c.url.includes('token'))).toHaveLength(1);

    advance(60_000); // past 450s
    mock.reply({ data: { access_token: 'tok-2' } }, {});
    await client.get('/c');
    expect(mock.last().headers.Authorization).toBe('Bearer tok-2');
  });

  it('shares a single in-flight token request between concurrent calls', async () => {
    const { mock, client } = setup();
    mock.reply({ data: { access_token: 'tok-1', expires_in: 480 } });
    await Promise.all([client.get('/a'), client.get('/b')]);
    expect(mock.calls.filter((c) => c.url.includes('token'))).toHaveLength(1);
  });

  it('refreshes the token and retries once on oauth_token_expired', async () => {
    const { mock, client } = setup();
    mock.reply(
      { data: { access_token: 'old', expires_in: 480 } },
      { status: 401, data: { status: 401, code: 'oauth_token_expired', message: 'Token expired' } },
      { data: { access_token: 'new', expires_in: 480 } },
      { data: { ok: true } },
    );
    await expect(client.post('/api/v4/activate_license', {})).resolves.toEqual({ ok: true });
    expect(mock.last().headers.Authorization).toBe('Bearer new');
  });

  it('does not retry other OAuth errors', async () => {
    const { mock, client } = setup();
    mock.reply(
      { data: { access_token: 'tok', expires_in: 480 } },
      { status: 400, data: { code: 'license_not_found', message: 'nope' } },
    );
    await expect(client.post('/x', {})).rejects.toBeInstanceOf(AxiosError);
  });

  it('rejects a token response without access_token', async () => {
    const { mock, client } = setup();
    mock.reply({ data: {} });
    await expect(client.get('/x')).rejects.toThrow('did not include access_token');
  });

  it('exposes client_id credentials for offline payloads', () => {
    const { client } = setup();
    expect(client.offlineCredentials()).toEqual({ field: 'client_id', value: 'auth-company-1', signingKey: 'secret' });
  });

  it('uses the documented default token URL from config', () => {
    expect(DEFAULT_OAUTH_TOKEN_URL).toBe('https://auth.licensespring.com/realms/user-portal/protocol/openid-connect/token');
  });

  it('builds a token client with default options', async () => {
    const client = new LicenseApiClient('https://api.example', OAUTH);
    expect(client.auth.type).toBe('oauth');
  });
});

describe('ManagementApiClient', () => {
  it('sends Api-Key authorization and no Date signature', async () => {
    const mock = createMockAdapter();
    const client = new ManagementApiClient('https://saas.example', 'mgmt-key', { adapter: mock.adapter });
    await client.get('/api/v1/licenses/', { limit: 10 });
    expect(mock.last().headers.Authorization).toBe('Api-Key mgmt-key');
    expect(mock.last().headers.Date).toBeUndefined();
    expect(mock.last().params).toEqual({ limit: '10' });
  });

  it('posts multipart form data', async () => {
    const mock = createMockAdapter();
    const client = new ManagementApiClient('https://saas.example', 'k', { adapter: mock.adapter });
    const form = new FormData();
    form.append('file', new Blob(['a,b']), 'x.csv');
    await client.postMultipart('/api/v1/licenses/import_from_csv/', form);
    expect(mock.last().rawBody).toBe(form);
  });

  it('works with default options', () => {
    expect(new ManagementApiClient('https://s', 'k').baseURL).toBe('https://s');
  });
});

describe('handleApiError', () => {
  const response = (status: number, data?: unknown, statusText = 'Status') => ({ response: { status, statusText, data } });

  it('returns validation messages verbatim', () => {
    expect(handleApiError(new ValidationError('bad input'))).toBe('bad input');
    expect(new ValidationError('x').name).toBe('ValidationError');
  });

  it('handles non-object errors', () => {
    expect(handleApiError(undefined)).toMatch(/Unknown error/);
    expect(handleApiError('boom')).toMatch(/Unknown error/);
  });

  it('formats LicenseSpring error bodies with their code', () => {
    expect(handleApiError(response(400, { status: 400, code: 'license_not_found', message: 'License not found' })))
      .toBe('HTTP 400 (license_not_found): License not found');
  });

  it('uses detail/error/plain-text/field-error bodies', () => {
    expect(handleApiError(response(404, { detail: 'Not found.' }))).toBe('HTTP 404: Not found.');
    expect(handleApiError(response(500, { error: 'Server error' }))).toBe('HTTP 500: Server error');
    expect(handleApiError(response(400, 'license_deactivated'))).toBe('HTTP 400: license_deactivated');
    expect(handleApiError(response(400, { email: ['Enter a valid email.'] }))).toBe('HTTP 400: {"email":["Enter a valid email."]}');
    expect(handleApiError(response(400, { message: '', code: 7 }))).toBe('HTTP 400: {"message":"","code":7}');
  });

  it('falls back to statusText or a generic message', () => {
    expect(handleApiError(response(502, undefined, 'Bad Gateway'))).toBe('HTTP 502: Bad Gateway');
    expect(handleApiError(response(502, '   ', 'Bad Gateway'))).toBe('HTTP 502: Bad Gateway');
    expect(handleApiError({ response: { status: 502 } })).toBe('HTTP 502: Request failed');
    expect(handleApiError(response(502, 42))).toBe('HTTP 502: Status');
  });

  it('adds API-specific auth guidance on 401/403', () => {
    expect(handleApiError(response(401, { code: 'signature_mismatch', message: 'Bad signature' }), 'license'))
      .toMatch(/^HTTP 401 \(signature_mismatch\): Bad signature\. Check LICENSE_API_KEY \+ LICENSE_SHARED_KEY/);
    expect(handleApiError(response(403, { detail: 'Invalid key' }), 'management'))
      .toMatch(/Check MANAGEMENT_API_KEY/);
  });

  it('explains rate limiting', () => {
    expect(handleApiError(response(429, { detail: 'Throttled' }))).toMatch(/rate limit/);
  });

  it('reports network errors', () => {
    expect(handleApiError(networkError('ETIMEDOUT'))).toBe('No response received from LicenseSpring API (ETIMEDOUT). Check network connectivity.');
    expect(handleApiError({ request: {} })).toBe('No response received from LicenseSpring API. Check network connectivity.');
  });

  it('falls back to the error message', () => {
    expect(handleApiError(new Error('custom'))).toBe('custom');
    expect(handleApiError({})).toMatch(/Unknown error/);
  });
});
