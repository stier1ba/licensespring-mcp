import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createManagementApiServer } from '../../src/management-api/server.js';
import { createManagementApiTools } from '../../src/management-api/tools.js';
import { ManagementApiClient } from '../../src/utils/http.js';
import { callTool, connect, mockAxios, resultText, type MockResponder, type RecordedRequest } from './helpers.js';

let respond: MockResponder;
const { http, requests } = mockAxios((request) => respond(request));
const apiClient = new ManagementApiClient({ baseUrl: 'https://saas.test', apiKey: 'mk', timeoutMs: 1000, maxRetries: 0 }, { http });
let client: Client;

beforeAll(async () => {
  client = await connect(createManagementApiServer(apiClient, { baseUrl: 'https://saas.test' }));
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

type Case = [tool: string, args: Record<string, unknown>, method: string, path: string, query: Record<string, string>, body?: unknown];

const cases: Case[] = [
  // Licenses
  ['list_licenses', { limit: 10, offset: 20, order_by: '-created_at', customer_email: 'a@b.io', enabled: false, filters: { license_key__icontains: 'AB', is_trial: true } },
    'GET', '/api/v1/licenses/', { limit: '10', offset: '20', order_by: '-created_at', customer_email: 'a@b.io', enabled: 'false', license_key__icontains: 'AB', is_trial: 'true' }],
  ['list_licenses', {}, 'GET', '/api/v1/licenses/', {}],
  ['get_license', { id: 1593781720493289 }, 'GET', '/api/v1/licenses/1593781720493289/', {}],
  ['update_license', { id: 5, max_activations: 3, is_trial: true, validity_period: '2030-01-02', consumption_pool: null }, 'PATCH', '/api/v1/licenses/5/', {},
    { max_activations: 3, is_trial: true, validity_period: '2030-01-02', consumption_pool: null }],
  ['delete_license', { id: 5 }, 'DELETE', '/api/v1/licenses/5/', {}],
  ['enable_license', { id: 5 }, 'POST', '/api/v1/licenses/5/enable/', {}],
  ['disable_license', { id: 5 }, 'POST', '/api/v1/licenses/5/disable/', {}],
  ['reset_license', { id: 5, reset_metadata: true }, 'POST', '/api/v1/licenses/5/reset/', {}, { reset_metadata: true }],
  ['reset_license_consumption', { id: 5 }, 'POST', '/api/v1/licenses/5/reset_consumption', {}],
  ['apply_license_policy', { id: 5, policy_code: 'gold', overrides: { max_activations: 9, policy_code: 'ignored' } }, 'POST', '/api/v1/licenses/5/apply_policy/', {},
    { max_activations: 9, policy_code: 'gold' }],
  ['apply_license_policy', { id: 5, policy_code: 'gold' }, 'POST', '/api/v1/licenses/5/apply_policy/', {}, { policy_code: 'gold' }],
  ['update_license_features', { id: 5, product_features: [{ product_feature: 'f2', max_consumption: 88 }] }, 'POST', '/api/v1/licenses/5/update_features/', {},
    { product_features: [{ product_feature: 'f2', max_consumption: 88 }] }],
  ['bulk_update_licenses', { licenses: [{ id: 1, is_trial: true }, { id: 2, enable_maintenance_period: true, maintenance_duration: '4m' }] },
    'PATCH', '/api/v1/licenses/bulk_update/', {}, [{ id: 1, is_trial: true }, { id: 2, enable_maintenance_period: true, maintenance_duration: '4m' }]],
  ['bulk_disable_licenses', { license_ids: [1, 2, 3] }, 'POST', '/api/v1/licenses/disable_bulk/', {}, [1, 2, 3]],
  ['check_license_status', { hardware_id: 'HW', product: 'P', license_key: 'K' }, 'GET', '/api/v1/licenses/check_license/', { hardware_id: 'HW', product: 'P', license_key: 'K' }],
  ['list_license_import_results', { limit: 5 }, 'GET', '/api/v1/licenses-import-results/', { limit: '5' }],
  // License users
  ['assign_user_to_license', { license_id: 5, email: 'u@x.io', is_manager: false, max_activations: 2 }, 'POST', '/api/v1/licenses/5/assign_user/', {},
    { email: 'u@x.io', is_manager: false, max_activations: 2 }],
  ['assign_users_to_license', { license_id: 5, emails: [{ email: 'a@x.io', is_manager: true }] }, 'POST', '/api/v1/licenses/5/assign_users/', {},
    { emails: [{ email: 'a@x.io', is_manager: true }] }],
  ['unassign_user_from_license', { license_id: 5, license_user_id: 9 }, 'POST', '/api/v1/licenses/5/unassign_user/', {}, { license_user_id: 9 }],
  ['unassign_user_from_license', { license_id: 5, license_user_email: 'u@x.io' }, 'POST', '/api/v1/licenses/5/unassign_user/', {}, { license_user_email: 'u@x.io' }],
  ['set_user_activations', { license_id: 5, user_activations: { 2449: { max_activations: 100 } } }, 'POST', '/api/v1/licenses/5/set_users_activations/', {},
    { 2449: { max_activations: 100 } }],
  ['list_license_users', { filters: { true_email__icontains: 'acme' } }, 'GET', '/api/v1/license-users/', { true_email__icontains: 'acme' }],
  ['get_license_user', { id: 9 }, 'GET', '/api/v1/license-users/9/', {}],
  ['create_license_user', { email: 'u@x.io', metadata: { a: 1 } }, 'POST', '/api/v1/license-users/', {}, { email: 'u@x.io', metadata: { a: 1 } }],
  ['update_license_user', { id: 9, first_name: 'Harry' }, 'PATCH', '/api/v1/license-users/9/', {}, { first_name: 'Harry' }],
  ['delete_license_user', { id: 9 }, 'DELETE', '/api/v1/license-users/9/', {}],
  ['set_license_user_password', { id: 9, password: 'pw' }, 'POST', '/api/v1/license-users/9/set_password/', {}, { password: 'pw' }],
  ['set_license_user_password', { email: 'u+1@x.io', password: 'pw' }, 'POST', '/api/v1/license-users/set_password/', { email: 'u+1@x.io' }, { password: 'pw' }],
  // License features
  ['list_license_features', { license: 5 }, 'GET', '/api/v1/license-product-features/', { license: '5' }],
  ['update_license_feature', { id: 3, max_consumption: 20, consumption_period: 'annualy' }, 'PATCH', '/api/v1/license-product-features/3/', {},
    { max_consumption: 20, consumption_period: 'annualy' }],
  // Orders
  ['list_orders', { order_by: 'created_at', filters: { store_id: 'S1' } }, 'GET', '/api/v1/orders/', { order_by: 'created_at', store_id: 'S1' }],
  ['get_order', { id: 4 }, 'GET', '/api/v1/orders/4/', {}],
  ['create_order', { id: 'order-1', items: [{ product_code: 'P', licenses: [{ key: 'AAAA', max_activations: 2 }] }], customer: { email: 'c@x.io' }, metadata: { crm: 7 } },
    'POST', '/api/v1/orders/create_order/', {},
    { id: 'order-1', items: [{ product_code: 'P', licenses: [{ key: 'AAAA', max_activations: 2 }] }], customer: { email: 'c@x.io' }, metadata: '{"crm":7}' }],
  ['create_order', { id: 'order-2', items: [{ product_code: 'P', licenses: [{ users: [{ email: 'u@x.io' }] }] }] }, 'POST', '/api/v1/orders/create_order/', {},
    { id: 'order-2', items: [{ product_code: 'P', licenses: [{ users: [{ email: 'u@x.io' }] }] }] }],
  ['update_order', { id: 4, store_id: 'new' }, 'PATCH', '/api/v1/orders/4/', {}, { store_id: 'new' }],
  ['delete_order', { id: 4 }, 'DELETE', '/api/v1/orders/4/safe_delete/', {}],
  ['generate_license_keys', { product: 'P', quantity: 3, key_length: 20 }, 'GET', '/api/v1/orders/generate_license/', { product: 'P', quantity: '3', key_length: '20' }],
  ['generate_license_keys', { product: 'P' }, 'GET', '/api/v1/orders/generate_license/', { product: 'P', quantity: '1' }],
  // Customers
  ['list_customers', { email: 'c@x.io' }, 'GET', '/api/v1/customers/', { email: 'c@x.io' }],
  ['get_customer', { id: 2 }, 'GET', '/api/v1/customers/2/', {}],
  ['create_customer', { email: 'c@x.io', first_name: 'Harry', customer_account: 1 }, 'POST', '/api/v1/customers/', {}, { email: 'c@x.io', first_name: 'Harry', customer_account: 1 }],
  ['update_customer', { id: 2, first_name: 'Toni' }, 'PATCH', '/api/v1/customers/2/', {}, { first_name: 'Toni' }],
  ['delete_customer', { id: 2 }, 'DELETE', '/api/v1/customers/2/', {}],
  ['list_customer_accounts', { filters: { code: 'acme' } }, 'GET', '/api/v1/customer-accounts/', { code: 'acme' }],
  ['get_customer_account', { id: 8 }, 'GET', '/api/v1/customer-accounts/8/', {}],
  ['create_customer_account', { code: 'tc6', name: 'Test' }, 'POST', '/api/v1/customer-accounts/', {}, { code: 'tc6', name: 'Test' }],
  // Products
  ['list_products', { filters: { is_bundle: true } }, 'GET', '/api/v1/products/', { is_bundle: 'true' }],
  ['get_product', { id: 11 }, 'GET', '/api/v1/products/11/', {}],
  ['list_product_features', { product: 11 }, 'GET', '/api/v1/product-features/', { product: '11' }],
  ['list_license_policies', { product: 11 }, 'GET', '/api/v1/license-templates/', { product: '11' }],
  ['list_installation_files', { product: 11 }, 'GET', '/api/v1/installation-files/', { product: '11' }],
  // Devices
  ['list_devices', { license: 5, hardware_id: 'HW', order_by: '-id' }, 'GET', '/api/v1/devices/', { license: '5', hardware_id: 'HW', order_by: '-id' }],
  ['get_device', { id: 12 }, 'GET', '/api/v1/devices/12/', {}],
  ['reset_device', { id: 12 }, 'POST', '/api/v1/devices/12/reset/', {}],
  ['blacklist_device', { id: 12 }, 'POST', '/api/v1/devices/12/blacklist/', {}],
  ['whitelist_device', { id: 12 }, 'POST', '/api/v1/devices/12/whitelist/', {}],
  ['borrow_device', { id: 12, borrowed_until: '2026-04-14T12:30:50' }, 'POST', '/api/v1/devices/12/borrow/', {}, { borrowed_until: '2026-04-14T12:30:50' }],
  ['release_borrowed_device', { id: 12 }, 'POST', '/api/v1/devices/12/borrow_release/', {}],
  ['list_device_variables', { device: 12 }, 'GET', '/api/v1/device-variables/', { device: '12' }],
  // History & analytics
  ['list_license_activation_histories', { license: 5, filters: { action: 'activation' } }, 'GET', '/api/v1/license-activation-histories/', { license: '5', action: 'activation' }],
  ['list_license_usage_histories', { license: 5 }, 'GET', '/api/v1/license-histories/', { license: '5' }],
  ['list_activities', { filters: { action__in: 'check,activation' } }, 'GET', '/api/v1/activities/', { action__in: 'check,activation' }],
];

describe('Management API tools', () => {
  it('registers all tools with annotations', async () => {
    const { tools } = await client.listTools();
    const names = createManagementApiTools(apiClient).map((tool) => tool.name);
    expect(tools.map((tool) => tool.name).sort()).toEqual([...names].sort());
    expect(new Set(names).size).toBe(names.length);
    expect(tools.find((tool) => tool.name === 'delete_license')?.annotations).toMatchObject({ destructiveHint: true });
    expect(tools.find((tool) => tool.name === 'list_licenses')?.annotations).toMatchObject({ readOnlyHint: true });
  });

  it('covers every tool in the request table', () => {
    const tested = new Set(cases.map(([tool]) => tool).concat('import_licenses_from_csv'));
    const untested = createManagementApiTools(apiClient).map((tool) => tool.name).filter((name) => !tested.has(name));
    expect(untested).toEqual([]);
  });

  it.each(cases)('%s → %s %s (%#)', async (tool, args, method, path, query, body) => {
    const result = await callTool(client, tool, args);
    expect(result.isError, resultText(result)).toBeFalsy();
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe(method);
    expect(split(requests[0])).toEqual({ path, query });
    if (body !== undefined) expect(requests[0].data).toEqual(body);
  });

  it('uploads CSV imports as multipart form data', async () => {
    const result = await callTool(client, 'import_licenses_from_csv', { csv_content: 'license__license_key,product__short_code\nA,p\n' });
    expect(result.isError).toBeFalsy();
    expect(requests[0]).toMatchObject({ method: 'POST', url: '/api/v1/licenses/import_from_csv/' });
    const form = requests[0].data as FormData;
    const file = form.get('file') as File;
    expect(file.name).toBe('licenses.csv');
    expect(file.type).toBe('text/csv');
    await expect(file.text()).resolves.toContain('A,p');

    await callTool(client, 'import_licenses_from_csv', { csv_content: 'x', file_name: 'batch.csv' });
    expect(((requests[1].data as FormData).get('file') as File).name).toBe('batch.csv');
  });

  it.each([
    ['update_license', { id: 1, valid_duration: '1y', validity_period: '2030-01-01' }, 'valid_duration and validity_period cannot be sent'],
    ['bulk_update_licenses', { licenses: [{ id: 1, valid_duration: '1y', validity_period: '2030-01-01' }] }, 'valid_duration and validity_period cannot be sent'],
    ['unassign_user_from_license', { license_id: 1 }, 'Provide license_user_id or license_user_email'],
    ['set_license_user_password', { password: 'pw' }, 'Provide id or email'],
    ['check_license_status', { hardware_id: 'HW', product: 'P' }, 'Provide license_key or username'],
  ])('%s validates input combinations', async (tool, args, message) => {
    const result = await callTool(client, tool, args);
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain(message);
    expect(requests).toHaveLength(0);
  });

  it.each([
    ['update_license', { id: 1, validity_period: '01/02/2030' }],
    ['update_license', { id: 1, valid_duration: '2 years' }],
    ['set_user_activations', { license_id: 1, user_activations: {} }],
    ['set_user_activations', { license_id: 1, user_activations: { abc: { max_activations: 1 } } }],
    ['bulk_disable_licenses', { license_ids: [] }],
    ['get_license', { id: -1 }],
  ])('%s rejects invalid schema input', async (tool, args) => {
    const result = await callTool(client, tool, args);
    expect(result.isError).toBe(true);
    expect(requests).toHaveLength(0);
  });

  it('returns API validation errors as tool errors', async () => {
    respond = () => ({ status: 400, data: { email: ['Enter a valid email address.'] } });
    const result = await callTool(client, 'create_customer', { email: 'c@x.io' });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toBe('Create Customer failed: HTTP 400: email: Enter a valid email address.');
  });

  it('reports success for 204 responses', async () => {
    respond = () => ({ status: 204, data: '' });
    expect(JSON.parse(resultText(await callTool(client, 'delete_order', { id: 1 })))).toEqual({ success: true });
  });
});
