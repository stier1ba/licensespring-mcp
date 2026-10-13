import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { LicenseApiAuth } from '../../config.js';
import { generateOfflineSignature } from '../../utils/auth.js';
import { LicenseApiClient } from '../../utils/http.js';
import { createLicenseApiServer } from '../server.js';
import { callTool, connect, createMockAdapter, FIXED_DATE, FIXED_HTTP_DATE, text } from '../../__tests__/helpers.js';

const HMAC: LicenseApiAuth = { type: 'hmac', apiKey: 'api-key-1', sharedKey: 'shared-secret' };
const base = { hardware_id: 'hw-1', product: 'prod' };

async function setup(auth: LicenseApiAuth = HMAC, retry: { maxRetries?: number; sleep?: () => Promise<void> } = { maxRetries: 0 }) {
  const mock = createMockAdapter();
  const apiClient = new LicenseApiClient('https://api.example', auth, {
    adapter: mock.adapter,
    now: () => FIXED_DATE,
    retry,
  });
  const server = createLicenseApiServer(apiClient, { randomId: () => 'req-1' });
  const client = await connect(server);
  return { mock, client };
}

let mock: ReturnType<typeof createMockAdapter>;
let client: Client;

beforeEach(async () => {
  ({ mock, client } = await setup());
});

const ALL_TOOLS = [
  'activate_license', 'check_license', 'deactivate_license', 'activate_offline', 'deactivate_offline',
  'activate_bundle', 'check_bundle', 'deactivate_bundle', 'check_license_feature', 'add_consumption',
  'add_feature_consumption', 'get_trial_key', 'get_product_details', 'list_products', 'get_user_licenses',
  'get_device_licenses', 'get_customer_license_users', 'track_device_variables', 'get_device_variables',
  'floating_borrow', 'floating_release', 'floating_feature_borrow', 'floating_feature_release',
  'change_password', 'get_versions', 'get_installation_file', 'get_sso_url',
];

describe('License API server metadata', () => {
  it('registers every documented tool with annotations', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...ALL_TOOLS].sort());
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBeDefined();
      expect(tool.description).toBeTruthy();
    }
    const readOnly = tools.filter((t) => t.annotations?.readOnlyHint).map((t) => t.name);
    expect(readOnly).toContain('check_license');
    expect(readOnly).not.toContain('add_consumption');
  });

  it('identifies itself', () => {
    expect(client.getServerVersion()?.name).toBe('licensespring-license-api');
  });

  it('marks deactivation tools as destructive and trial_key as a write', async () => {
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));
    for (const name of ['deactivate_license', 'deactivate_offline', 'deactivate_bundle']) {
      expect(byName[name]?.destructiveHint).toBe(true);
    }
    expect(byName.get_trial_key?.readOnlyHint).toBe(false);
  });
});

type Case = {
  tool: string;
  args: Record<string, unknown>;
  method: 'GET' | 'POST';
  url: string;
  params?: Record<string, string>;
  body?: unknown;
};

const cases: Case[] = [
  {
    tool: 'activate_license',
    args: { ...base, license_key: 'K', app_ver: '1.2', variables: { a: 'b' }, include_metadata_string: true },
    method: 'POST', url: '/api/v4/activate_license',
    body: { ...base, license_key: 'K', app_ver: '1.2', variables: { a: 'b' }, include_metadata_string: true },
  },
  {
    tool: 'activate_license',
    args: { ...base, username: 'u@x.com', password: 'pw', license_id: 5 },
    method: 'POST', url: '/api/v4/activate_license',
    body: { ...base, username: 'u@x.com', password: 'pw', license_id: 5 },
  },
  {
    tool: 'activate_license',
    args: { ...base, code: 'c0de', customer_account_code: 'acme', redirect_uri: 'https://r' },
    method: 'POST', url: '/api/v4/activate_license',
    body: { ...base, code: 'c0de', customer_account_code: 'acme', redirect_uri: 'https://r' },
  },
  {
    tool: 'check_license',
    args: { ...base, license_key: 'K', include_expired_features: true, os_ver: '14', include_scheduled_changes: false },
    method: 'GET', url: '/api/v4/check_license',
    params: { ...base, license_key: 'K', include_expired_features: 'true', os_ver: '14', include_scheduled_changes: 'false' },
  },
  {
    tool: 'check_license',
    args: { ...base, username: 'u@x.com', license_id: 7 },
    method: 'GET', url: '/api/v4/check_license',
    params: { ...base, username: 'u@x.com', license_id: '7' },
  },
  {
    tool: 'deactivate_license',
    args: { ...base, license_key: 'K', consumptions: 3, product_features: [{ feature: 'f1', consumptions: 2 }] },
    method: 'POST', url: '/api/v4/deactivate_license',
    body: { ...base, license_key: 'K', consumptions: 3, product_features: [{ feature: 'f1', consumptions: 2 }] },
  },
  {
    tool: 'activate_bundle',
    args: { ...base, license_key: 'K', hostname: 'pc-1' },
    method: 'POST', url: '/api/v4/activate_bundle',
    body: { ...base, license_key: 'K', hostname: 'pc-1' },
  },
  {
    tool: 'check_bundle',
    args: { ...base, license_key: 'K', env: 'win64' },
    method: 'GET', url: '/api/v4/check_bundle',
    params: { ...base, license_key: 'K', env: 'win64' },
  },
  {
    tool: 'deactivate_bundle',
    args: { ...base, username: 'u', password: 'p', sdk_ver: '2' },
    method: 'POST', url: '/api/v4/deactivate_bundle',
    body: { ...base, username: 'u', password: 'p', sdk_ver: '2' },
  },
  {
    tool: 'check_license_feature',
    args: { ...base, feature: 'f1', license_key: 'K' },
    method: 'GET', url: '/api/v4/check_license_feature',
    params: { ...base, feature: 'f1', license_key: 'K' },
  },
  {
    tool: 'add_consumption',
    args: { ...base, license_key: 'K', consumptions: -2, allow_overages: true, max_overages: 10 },
    method: 'POST', url: '/api/v4/add_consumption',
    body: { ...base, license_key: 'K', consumptions: -2, allow_overages: true, max_overages: 10 },
  },
  {
    tool: 'add_feature_consumption',
    args: { ...base, feature: 'f1', username: 'u' },
    method: 'POST', url: '/api/v4/add_feature_consumption',
    body: { ...base, feature: 'f1', username: 'u' },
  },
  {
    tool: 'get_trial_key',
    args: { ...base, email: 'eval@x.com', license_policy: 'trial-30', first_name: 'Eve' },
    method: 'GET', url: '/api/v4/trial_key',
    params: { ...base, email: 'eval@x.com', license_policy: 'trial-30', first_name: 'Eve' },
  },
  {
    tool: 'get_product_details',
    args: { product: 'prod', include_latest_version: true, env: 'mac' },
    method: 'GET', url: '/api/v4/product_details',
    params: { product: 'prod', include_latest_version: 'true', env: 'mac' },
  },
  { tool: 'list_products', args: {}, method: 'GET', url: '/api/v4/products', params: {} },
  {
    tool: 'get_user_licenses',
    args: { product: 'prod', username: 'u', password: 'p' },
    method: 'GET', url: '/api/v4/user_licenses',
    params: { product: 'prod', username: 'u', password: 'p' },
  },
  {
    tool: 'get_user_licenses',
    args: { product: 'prod', id_token: 'tok', customer_account_code: 'acme', redirect_uri: 'https://r' },
    method: 'GET', url: '/api/v4/user_licenses',
    params: { product: 'prod', id_token: 'tok', customer_account_code: 'acme', redirect_uri: 'https://r' },
  },
  {
    tool: 'get_device_licenses', args: { hardware_id: 'hw-1' },
    method: 'GET', url: '/api/v4/device_licenses', params: { hardware_id: 'hw-1' },
  },
  {
    tool: 'get_customer_license_users', args: { product: 'prod', customer: 'c@x.com' },
    method: 'GET', url: '/api/v4/customer_license_users', params: { product: 'prod', customer: 'c@x.com' },
  },
  {
    tool: 'track_device_variables',
    args: { ...base, license_key: 'K', variables: { seats: 3, on: true, name: 'x' } },
    method: 'POST', url: '/api/v4/track_device_variables',
    body: { ...base, license_key: 'K', variables: { seats: 3, on: true, name: 'x' } },
  },
  {
    tool: 'get_device_variables', args: { ...base, license_key: 'K' },
    method: 'GET', url: '/api/v4/get_device_variables', params: { ...base, license_key: 'K' },
  },
  {
    tool: 'floating_borrow',
    args: { ...base, license_key: 'K', borrowed_until: '2026-12-31T23:59:00Z' },
    method: 'POST', url: '/api/v4/floating/borrow',
    body: { ...base, license_key: 'K', borrowed_until: '2026-12-31T23:59:00Z' },
  },
  {
    tool: 'floating_borrow',
    args: { ...base, license_key: 'K' },
    method: 'POST', url: '/api/v4/floating/borrow',
    body: { ...base, license_key: 'K', borrowed_until: null },
  },
  {
    tool: 'floating_release', args: { ...base, license_key: 'K' },
    method: 'POST', url: '/api/v4/floating/release', body: { ...base, license_key: 'K' },
  },
  {
    tool: 'floating_feature_borrow',
    args: { ...base, feature: 'f1', license_key: 'K', borrowed_until: null },
    method: 'POST', url: '/api/v4/floating/feature_borrow',
    body: { ...base, feature: 'f1', license_key: 'K', borrowed_until: null },
  },
  {
    tool: 'floating_feature_release', args: { ...base, feature: 'f1', username: 'u' },
    method: 'POST', url: '/api/v4/floating/feature_release', body: { ...base, feature: 'f1', username: 'u' },
  },
  {
    tool: 'change_password', args: { username: 'u', password: 'old', new_password: 'new' },
    method: 'POST', url: '/api/v4/change_password', body: { username: 'u', password: 'old', new_password: 'new' },
  },
  {
    tool: 'get_versions', args: { ...base, license_key: 'K', env: 'linux64', channel: 'prod' },
    method: 'GET', url: '/api/v4/versions', params: { ...base, license_key: 'K', env: 'linux64', channel: 'prod' },
  },
  {
    tool: 'get_installation_file', args: { ...base, license_key: 'K', version: '1.0.0' },
    method: 'GET', url: '/api/v4/installation_file', params: { ...base, license_key: 'K', version: '1.0.0' },
  },
  {
    tool: 'get_sso_url', args: { product: 'prod', customer_account_code: 'acme', response_type: 'code' },
    method: 'GET', url: '/api/v4/sso_url', params: { product: 'prod', customer_account_code: 'acme', response_type: 'code' },
  },
];

describe('License API tools → HTTP requests', () => {
  it.each(cases.map((c) => [c.tool, c] as const))('%s sends the documented request', async (_name, c) => {
    mock.reply({ data: { tool: c.tool } });
    const result = await callTool(client, c.tool, c.args);
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(text(result))).toEqual({ tool: c.tool });

    const call = mock.last();
    expect(call.method).toBe(c.method);
    expect(call.url).toBe(c.url);
    expect(call.headers.Date).toBe(FIXED_HTTP_DATE);
    expect(call.headers.Authorization).toMatch(/^algorithm="hmac-sha256"/);
    if (c.params) expect(call.params).toEqual(c.params);
    if (c.body) expect(call.body).toEqual(c.body);
  });

  it('covers every tool', () => {
    const covered = new Set([...cases.map((c) => c.tool), 'activate_offline', 'deactivate_offline']);
    expect([...covered].sort()).toEqual([...ALL_TOOLS].sort());
  });

  it('renders plain-text responses such as license_deactivated', async () => {
    mock.reply({ data: 'license_deactivated' });
    const result = await callTool(client, 'deactivate_license', { ...base, license_key: 'K' });
    expect(text(result)).toBe('license_deactivated');
  });
});

describe('identity validation', () => {
  it.each([
    ['check_license', { ...base }],
    ['check_license', { ...base, license_key: 'K', username: 'u' }],
    ['activate_license', { ...base, username: 'u' }],
    ['activate_license', { ...base, id_token: 't' }],
    ['deactivate_license', { ...base }],
    ['floating_borrow', { ...base }],
    ['get_user_licenses', { product: 'p' }],
    ['add_consumption', { ...base }],
    ['activate_offline', { ...base }],
  ])('%s rejects %p without calling the API', async (tool, args) => {
    const result = await callTool(client, tool, args);
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/^Error .*(exactly one|required)/);
    expect(mock.calls).toHaveLength(0);
  });

  it('rejects schema violations (missing hardware_id)', async () => {
    const result = await callTool(client, 'check_license', { product: 'p', license_key: 'K' });
    expect(result.isError).toBe(true);
    expect(mock.calls).toHaveLength(0);
  });

  it('rejects empty variables', async () => {
    const result = await callTool(client, 'track_device_variables', { ...base, license_key: 'K', variables: {} });
    expect(result.isError).toBe(true);
  });
});

describe('retries', () => {
  const retrying = () => setup(HMAC, { maxRetries: 2, sleep: () => Promise.resolve() });

  it('retries read-only GETs such as check_license on 503', async () => {
    const r = await retrying();
    r.mock.reply({ status: 503, data: {} }, { data: { license_active: true } });
    const result = await callTool(r.client, 'check_license', { ...base, license_key: 'K' });
    expect(result.isError).toBeFalsy();
    expect(r.mock.calls).toHaveLength(2);
  });

  it('never retries get_trial_key, which creates a license', async () => {
    const r = await retrying();
    r.mock.reply({ status: 503, data: {} });
    const result = await callTool(r.client, 'get_trial_key', { ...base });
    expect(result.isError).toBe(true);
    expect(r.mock.calls).toHaveLength(1);
  });
});

describe('API errors', () => {
  it('surfaces LicenseSpring error codes as tool errors', async () => {
    mock.reply({ status: 400, data: { status: 400, code: 'license_not_found', message: 'License not found' } });
    const result = await callTool(client, 'check_license', { ...base, license_key: 'K' });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Error checking license: HTTP 400 (license_not_found): License not found');
  });
});

function decodeOffline(raw: unknown): Record<string, unknown> {
  return JSON.parse(Buffer.from(String(raw), 'base64').toString('utf8'));
}

describe('offline activation', () => {
  it('activate_offline posts a signed base64 payload as text/plain', async () => {
    mock.reply({ data: { license_signature: 'sig' } });
    const result = await callTool(client, 'activate_offline', { ...base, license_key: 'AAAA-BBBB-CCCC', os_ver: '14', variables: { a: 'b' } });
    expect(result.isError).toBeFalsy();

    const call = mock.last();
    expect(call.url).toBe('/api/v4/activate_offline');
    expect(call.headers['Content-Type']).toBe('text/plain');
    expect(call.headers.Authorization).toMatch(/^algorithm="hmac-sha256"/);
    expect(decodeOffline(call.rawBody)).toEqual({
      request: 'activation',
      request_id: 'req-1',
      hardware_id: 'hw-1',
      product: 'prod',
      license_key: 'AAAA-BBBB-CCCC',
      api_key: 'api-key-1',
      date: FIXED_HTTP_DATE,
      signature: generateOfflineSignature({
        signingKey: 'shared-secret', date: FIXED_HTTP_DATE, licenseKeyOrUsername: 'AAAA-BBBB-CCCC', hardwareId: 'hw-1', apiKeyOrClientId: 'api-key-1',
      }),
      os_ver: '14',
      variables: { a: 'b' },
    });
  });

  it('deactivate_offline signs user-based requests and includes consumptions', async () => {
    mock.reply({ data: 'license_deactivated' });
    await callTool(client, 'deactivate_offline', { ...base, username: 'u@x.com', password: 'pw', license_id: 4, consumptions: 2 });
    const payload = decodeOffline(mock.last().rawBody);
    expect(mock.last().url).toBe('/api/v4/deactivate_offline');
    expect(payload).toMatchObject({
      request: 'deactivation', request_id: 'req-1', username: 'u@x.com', password: 'pw', license_id: 4, consumptions: 2, api_key: 'api-key-1',
    });
    expect(payload.signature).toBe(generateOfflineSignature({
      signingKey: 'shared-secret', date: FIXED_HTTP_DATE, licenseKeyOrUsername: 'u@x.com', hardwareId: 'hw-1', apiKeyOrClientId: 'api-key-1',
    }));
  });

  it('uses client_id and the client secret when authenticated with OAuth', async () => {
    const oauth = await setup({ type: 'oauth', clientId: 'cid', clientSecret: 'csecret', tokenUrl: 'https://t' });
    oauth.mock.reply({ data: { access_token: 'tok', expires_in: 480 } }, { data: {} });
    await callTool(oauth.client, 'activate_offline', { ...base, license_key: 'K' });
    const call = oauth.mock.last();
    expect(call.headers.Authorization).toBe('Bearer tok');
    const payload = decodeOffline(call.rawBody);
    expect(payload.client_id).toBe('cid');
    expect(payload.api_key).toBeUndefined();
    expect(payload.signature).toBe(generateOfflineSignature({
      signingKey: 'csecret', date: FIXED_HTTP_DATE, licenseKeyOrUsername: 'K', hardwareId: 'hw-1', apiKeyOrClientId: 'cid',
    }));
  });

  it('generates a random request_id by default', async () => {
    const m = createMockAdapter();
    const server = createLicenseApiServer(new LicenseApiClient('https://x', HMAC, { adapter: m.adapter }));
    const c = await connect(server);
    await callTool(c, 'activate_offline', { ...base, license_key: 'K' });
    expect(decodeOffline(m.last().rawBody).request_id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('resources', () => {
  it('reads product details through the resource template', async () => {
    mock.reply({ data: { product_name: 'Prod' } });
    const result = await client.readResource({ uri: 'licensespring://product/prod/details' });
    expect(JSON.parse(result.contents[0].text as string)).toEqual({ product_name: 'Prod' });
    expect(mock.last()).toMatchObject({ url: '/api/v4/product_details', params: { product: 'prod' } });
  });

  it('reports product detail failures', async () => {
    mock.reply({ status: 400, data: { code: 'product_not_found', message: 'Product not found' } });
    await expect(client.readResource({ uri: 'licensespring://product/nope/details' }))
      .rejects.toThrow(/Failed to get product details: HTTP 400 \(product_not_found\)/);
  });

  it('exposes the health resource', async () => {
    const result = await client.readResource({ uri: 'licensespring://health' });
    expect(JSON.parse(result.contents[0].text as string)).toMatchObject({
      service: 'licensespring-license-api',
      environment: { api_url: 'https://api.example', auth_method: 'hmac' },
    });
  });
});

describe('prompts', () => {
  it('lists both prompts', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(['license-troubleshooting', 'trial-onboarding']);
  });

  it('renders license-troubleshooting with and without optional args', async () => {
    const full = await client.getPrompt({ name: 'license-troubleshooting', arguments: { license_key: 'K', issue_description: 'fails', product: 'p', hardware_id: 'hw' } });
    const fullText = (full.messages[0].content as { text: string }).text;
    expect(fullText).toContain('Product: p');
    expect(fullText).toContain('Hardware ID: hw');
    const minimal = await client.getPrompt({ name: 'license-troubleshooting', arguments: { license_key: 'K', issue_description: 'fails' } });
    expect((minimal.messages[0].content as { text: string }).text).not.toContain('Product:');
  });

  it('renders trial-onboarding with and without email', async () => {
    const withEmail = await client.getPrompt({ name: 'trial-onboarding', arguments: { product_code: 'p', hardware_id: 'hw', email: 'e@x.com' } });
    expect((withEmail.messages[0].content as { text: string }).text).toContain('Email: e@x.com');
    const without = await client.getPrompt({ name: 'trial-onboarding', arguments: { product_code: 'p', hardware_id: 'hw' } });
    expect((without.messages[0].content as { text: string }).text).not.toContain('Email:');
  });
});
