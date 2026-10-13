import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LicenseApiConfig } from '../../src/config.js';
import { createLicenseApiServer } from '../../src/license-api/server.js';
import { createLicenseApiTools } from '../../src/license-api/tools.js';
import { LicenseApiClient } from '../../src/utils/http.js';
import { callTool, connect, decodeOffline, mockAxios, resultText, type MockResponder, type RecordedRequest } from './helpers.js';

const config: LicenseApiConfig = {
  baseUrl: 'https://api.test',
  auth: { type: 'api-key', apiKey: 'ak', sharedKey: 'sk' },
  timeoutMs: 1000,
  maxRetries: 0,
};

let respond: MockResponder;
const { http, requests } = mockAxios((request) => respond(request));
const apiClient = new LicenseApiClient(config, { http });
let client: Client;

beforeAll(async () => {
  client = await connect(createLicenseApiServer(apiClient, { baseUrl: config.baseUrl }));
});
afterAll(async () => client.close());
beforeEach(() => {
  requests.length = 0;
  respond = () => ({ data: { ok: true } });
});

function split(request: RecordedRequest) {
  const [path, qs = ''] = request.url.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs)) };
}

const key = { hardware_id: 'HW', product: 'P', license_key: 'KEY' };

type Case = [tool: string, args: Record<string, unknown>, method: string, path: string, expected: Record<string, unknown>];

const getCases: Case[] = [
  ['check_license', { ...key, include_expired_features: true, env: 'win64', hostname: 'host' }, 'GET', '/api/v4/check_license',
    { hardware_id: 'HW', product: 'P', license_key: 'KEY', include_expired_features: 'true', env: 'win64', hostname: 'host' }],
  ['check_bundle', { hardware_id: 'HW', product: 'B', username: 'u@x.io', license_id: 7 }, 'GET', '/api/v4/check_bundle',
    { hardware_id: 'HW', product: 'B', username: 'u@x.io', license_id: '7' }],
  ['check_license_feature', { ...key, feature: 'F' }, 'GET', '/api/v4/check_license_feature', { ...key, feature: 'F' }],
  ['get_trial_key', { hardware_id: 'HW', product: 'P', email: 'a@b.io', license_policy: 'pol' }, 'GET', '/api/v4/trial_key',
    { hardware_id: 'HW', product: 'P', email: 'a@b.io', license_policy: 'pol' }],
  ['get_user_licenses', { product: 'P', username: 'u@x.io', password: 'pw' }, 'GET', '/api/v4/user_licenses',
    { product: 'P', username: 'u@x.io', password: 'pw' }],
  ['get_user_licenses', { product: 'P', code: 'c', customer_account_code: 'acc' }, 'GET', '/api/v4/user_licenses',
    { product: 'P', code: 'c', customer_account_code: 'acc' }],
  ['get_device_licenses', { hardware_id: 'HW' }, 'GET', '/api/v4/device_licenses', { hardware_id: 'HW' }],
  ['get_customer_license_users', { product: 'P', customer: 'c@x.io' }, 'GET', '/api/v4/customer_license_users', { product: 'P', customer: 'c@x.io' }],
  ['list_products', {}, 'GET', '/api/v4/products', {}],
  ['get_product_details', { product: 'P', include_latest_version: true }, 'GET', '/api/v4/product_details', { product: 'P', include_latest_version: 'true' }],
  ['get_versions', { ...key, channel: 'prod' }, 'GET', '/api/v4/versions', { ...key, channel: 'prod' }],
  ['get_installation_file', { ...key, version: '1.2.3', env: 'mac' }, 'GET', '/api/v4/installation_file', { ...key, version: '1.2.3', env: 'mac' }],
  ['get_device_variables', key, 'GET', '/api/v4/get_device_variables', key],
  ['get_sso_url', { product: 'P', customer_account_code: 'acc', response_type: 'token' }, 'GET', '/api/v4/sso_url',
    { product: 'P', customer_account_code: 'acc', response_type: 'token' }],
  ['get_api_metadata', {}, 'GET', '/api/v4/.well-known', {}],
];

const postCases: Case[] = [
  ['activate_license', { ...key, app_ver: '1.0', variables: { os: 'linux' } }, 'POST', '/api/v4/activate_license',
    { ...key, app_ver: '1.0', variables: { os: 'linux' } }],
  ['activate_license', { hardware_id: 'HW', product: 'P', username: 'u@x.io', password: 'pw' }, 'POST', '/api/v4/activate_license',
    { hardware_id: 'HW', product: 'P', username: 'u@x.io', password: 'pw' }],
  ['activate_license', { hardware_id: 'HW', product: 'P', id_token: 't', customer_account_code: 'acc' }, 'POST', '/api/v4/activate_license',
    { hardware_id: 'HW', product: 'P', id_token: 't', customer_account_code: 'acc' }],
  ['deactivate_license', { ...key, consumptions: 3 }, 'POST', '/api/v4/deactivate_license', { ...key, consumptions: 3 }],
  ['activate_bundle', { ...key, product: 'B', is_vm: false }, 'POST', '/api/v4/activate_bundle', { ...key, product: 'B', is_vm: false }],
  ['deactivate_bundle', { ...key, product: 'B' }, 'POST', '/api/v4/deactivate_bundle', { ...key, product: 'B' }],
  ['add_consumption', { ...key, consumptions: -2, allow_overages: true, max_overages: 5 }, 'POST', '/api/v4/add_consumption',
    { ...key, consumptions: -2, allow_overages: true, max_overages: 5 }],
  ['add_feature_consumption', { ...key, feature: 'F', consumptions: 4 }, 'POST', '/api/v4/add_feature_consumption', { ...key, feature: 'F', consumptions: 4 }],
  ['floating_borrow', { ...key, borrowed_until: '2026-01-01T00:00:00Z' }, 'POST', '/api/v4/floating/borrow', { ...key, borrowed_until: '2026-01-01T00:00:00Z' }],
  ['floating_borrow', { ...key, borrowed_until: null }, 'POST', '/api/v4/floating/borrow', { ...key, borrowed_until: null }],
  ['floating_release', key, 'POST', '/api/v4/floating/release', key],
  ['floating_feature_borrow', { ...key, feature: 'F', borrowed_until: null }, 'POST', '/api/v4/floating/feature_borrow', { ...key, feature: 'F', borrowed_until: null }],
  ['floating_feature_release', { ...key, feature: 'F' }, 'POST', '/api/v4/floating/feature_release', { ...key, feature: 'F' }],
  ['track_device_variables', { ...key, variables: { a: 'x', b: 1, c: true } }, 'POST', '/api/v4/track_device_variables',
    { ...key, variables: { a: 'x', b: 1, c: true } }],
  ['change_password', { username: 'u@x.io', password: 'old', new_password: 'new' }, 'POST', '/api/v4/change_password',
    { username: 'u@x.io', password: 'old', new_password: 'new' }],
];

describe('License API tools', () => {
  it('registers every documented License API endpoint', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(createLicenseApiTools(apiClient).map((tool) => tool.name).sort());
    expect(tools).toHaveLength(30);
    const check = tools.find((tool) => tool.name === 'check_license');
    expect(check?.annotations).toMatchObject({ readOnlyHint: true, title: 'Check License' });
  });

  it.each(getCases)('%s sends GET with query parameters (%#)', async (tool, args, method, path, expected) => {
    const result = await callTool(client, tool, args);
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(resultText(result))).toEqual({ ok: true });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe(method);
    expect(split(requests[0])).toEqual({ path, query: expected });
    expect(requests[0].headers.Authorization).toMatch(/^algorithm="hmac-sha256",headers="date",signature="[^"]+",apikey="ak"$/);
  });

  it.each(postCases)('%s sends POST with a JSON body (%#)', async (tool, args, method, path, expected) => {
    const result = await callTool(client, tool, args);
    expect(result.isError).toBeFalsy();
    expect(requests[0]).toMatchObject({ method, url: path });
    expect(requests[0].data).toEqual(expected);
  });

  it.each([
    ['activate_offline', '/api/v4/activate_offline', { ...key, variables: { a: 'b' } }, undefined],
    ['deactivate_offline', '/api/v4/deactivate_offline', { hardware_id: 'HW', product: 'P', username: 'u@x.io', password: 'pw', consumptions: 1 }, 'deactivation'],
    ['activate_bundle_offline', '/api/v4/activate_bundle_offline', { ...key, product: 'B', request_id: 'req-1' }, undefined],
    ['deactivate_bundle_offline', '/api/v4/deactivate_bundle_offline', { ...key, product: 'B' }, 'deactivation'],
  ])('%s posts a signed base64 payload', async (tool, path, args, request) => {
    const result = await callTool(client, tool, args);
    expect(result.isError).toBeFalsy();
    expect(requests[0]).toMatchObject({ method: 'POST', url: path });
    expect(requests[0].headers['Content-Type']).toBe('text/plain');
    const payload = decodeOffline(requests[0].data);
    expect(payload).toMatchObject({ ...args, api_key: 'ak', signature: expect.any(String), date: expect.stringMatching(/GMT$/) });
    expect(payload.request).toBe(request);
  });

  it.each([
    ['activate_license', { hardware_id: 'HW', product: 'P' }, 'license_key, username + password, or id_token/code'],
    ['activate_license', { hardware_id: 'HW', product: 'P', username: 'u@x.io' }, 'license_key, username + password'],
    ['activate_license', { hardware_id: 'HW', product: 'P', id_token: 't' }, 'license_key, username + password'],
    ['deactivate_license', { hardware_id: 'HW', product: 'P' }, 'license_key'],
    ['activate_bundle', { hardware_id: 'HW', product: 'P' }, 'license_key'],
    ['deactivate_bundle', { hardware_id: 'HW', product: 'P' }, 'license_key'],
    ['floating_borrow', { hardware_id: 'HW', product: 'P', borrowed_until: null }, 'license_key'],
    ['floating_feature_borrow', { hardware_id: 'HW', product: 'P', feature: 'F', borrowed_until: null }, 'license_key'],
    ['check_license', { hardware_id: 'HW', product: 'P' }, 'Provide license_key (key-based products) or username'],
    ['check_bundle', { hardware_id: 'HW', product: 'P' }, 'Provide license_key'],
    ['check_license_feature', { hardware_id: 'HW', product: 'P', feature: 'F' }, 'Provide license_key'],
    ['add_consumption', { hardware_id: 'HW', product: 'P' }, 'Provide license_key'],
    ['add_feature_consumption', { hardware_id: 'HW', product: 'P', feature: 'F' }, 'Provide license_key'],
    ['floating_release', { hardware_id: 'HW', product: 'P' }, 'Provide license_key'],
    ['floating_feature_release', { hardware_id: 'HW', product: 'P', feature: 'F' }, 'Provide license_key'],
    ['get_versions', { hardware_id: 'HW', product: 'P' }, 'Provide license_key'],
    ['get_installation_file', { hardware_id: 'HW', product: 'P' }, 'Provide license_key'],
    ['get_device_variables', { hardware_id: 'HW', product: 'P' }, 'Provide license_key'],
    ['track_device_variables', { hardware_id: 'HW', product: 'P', variables: { a: 'b' } }, 'Provide license_key'],
    ['activate_offline', { hardware_id: 'HW', product: 'P', username: 'u@x.io' }, 'Offline requests require license_key, or username + password'],
    ['deactivate_offline', { hardware_id: 'HW', product: 'P' }, 'Offline requests require'],
    ['activate_bundle_offline', { hardware_id: 'HW', product: 'B' }, 'Offline requests require'],
    ['deactivate_bundle_offline', { hardware_id: 'HW', product: 'B' }, 'Offline requests require'],
    ['get_user_licenses', { product: 'P', username: 'u@x.io' }, 'username + password, or id_token/code'],
    ['get_user_licenses', { product: 'P', id_token: 't' }, 'username + password, or id_token/code'],
  ])('%s validates identity combinations (%#)', async (tool, args, message) => {
    const result = await callTool(client, tool, args);
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain(message);
    expect(requests).toHaveLength(0);
  });

  it('rejects schema violations before calling the API', async () => {
    const result = await callTool(client, 'track_device_variables', { ...key, variables: {} });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain('At least one variable is required');
    expect(requests).toHaveLength(0);
  });

  it('returns API errors as tool errors', async () => {
    respond = () => ({ status: 400, data: { status: 400, code: 'license_activated_max_times', message: 'Too many activations' } });
    const result = await callTool(client, 'activate_license', key);
    expect(result.isError).toBe(true);
    expect(resultText(result)).toBe('Activate License failed: HTTP 400: Too many activations [license_activated_max_times]');
  });

  it('reports success for empty responses', async () => {
    respond = () => ({ data: '' });
    expect(resultText(await callTool(client, 'floating_release', key))).toBe(JSON.stringify({ success: true }, null, 2));
  });
});
