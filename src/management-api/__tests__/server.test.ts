import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ManagementApiClient, ValidationError } from '../../utils/http.js';
import { createManagementApiServer, validateLicenseUpdate } from '../server.js';
import { callTool, connect, createMockAdapter, text } from '../../__tests__/helpers.js';

let mock: ReturnType<typeof createMockAdapter>;
let client: Client;

beforeEach(async () => {
  mock = createMockAdapter();
  const apiClient = new ManagementApiClient('https://saas.example', 'mgmt-key', { adapter: mock.adapter, retry: { maxRetries: 0 } });
  client = await connect(createManagementApiServer(apiClient));
});

const ALL_TOOLS = [
  'list_licenses', 'get_license', 'update_license', 'enable_license', 'disable_license', 'reset_license',
  'delete_license', 'bulk_update_licenses', 'bulk_disable_licenses', 'update_license_features',
  'apply_license_policy', 'assign_user_to_license', 'unassign_user_from_license', 'set_user_activations',
  'import_licenses_from_csv', 'get_license_import_result', 'list_license_activation_history',
  'create_order', 'list_orders', 'get_order', 'generate_license_keys',
  'list_customers', 'get_customer', 'create_customer', 'update_customer', 'delete_customer',
  'list_license_users', 'get_license_user', 'create_license_user', 'update_license_user', 'delete_license_user',
  'set_license_user_password',
  'list_devices', 'get_device', 'reset_device', 'blacklist_device', 'whitelist_device',
  'list_products', 'get_product', 'list_product_features', 'list_license_policies',
];

const page = { limit: '100', offset: '0' };

type Case = {
  tool: string;
  args: Record<string, unknown>;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  params?: Record<string, string>;
  body?: unknown;
};

const cases: Case[] = [
  // Licenses
  {
    tool: 'list_licenses',
    args: { customer_email: 'c@x.com', enabled: true, product_id: 4, order_by: '-created_at', extra_filters: { metadata__plan: 'pro' } },
    method: 'GET', url: '/api/v1/licenses/',
    params: { ...page, metadata__plan: 'pro', customer_email: 'c@x.com', enabled: 'true', product_id: '4', order_by: '-created_at' },
  },
  { tool: 'list_licenses', args: { limit: 5, offset: 10 }, method: 'GET', url: '/api/v1/licenses/', params: { limit: '5', offset: '10' } },
  { tool: 'get_license', args: { id: 12 }, method: 'GET', url: '/api/v1/licenses/12/' },
  {
    tool: 'update_license', args: { id: 12, max_activations: 5, note: 'n' },
    method: 'PATCH', url: '/api/v1/licenses/12/', body: { max_activations: 5, note: 'n' },
  },
  {
    tool: 'update_license', args: { id: 12, validity_period: '2027-01-31', is_trial: false },
    method: 'PATCH', url: '/api/v1/licenses/12/', body: { validity_period: '2027-01-31', is_trial: false },
  },
  { tool: 'enable_license', args: { id: 12 }, method: 'POST', url: '/api/v1/licenses/12/enable/' },
  { tool: 'disable_license', args: { id: 12 }, method: 'POST', url: '/api/v1/licenses/12/disable/' },
  {
    tool: 'reset_license', args: { id: 12, reset_consumptions: false, reset_metadata: true },
    method: 'POST', url: '/api/v1/licenses/12/reset/', body: { reset_consumptions: false, reset_metadata: true },
  },
  {
    tool: 'bulk_update_licenses',
    args: { licenses: [{ id: 1, max_activations: 3 }, { id: 2, valid_duration: '1y', is_trial: false, metadata: { a: 1 } }] },
    method: 'PATCH', url: '/api/v1/licenses/bulk_update/',
    body: [{ id: 1, max_activations: 3 }, { id: 2, valid_duration: '1y', is_trial: false, metadata: { a: 1 } }],
  },
  { tool: 'bulk_disable_licenses', args: { license_ids: [1, 2, 3] }, method: 'POST', url: '/api/v1/licenses/disable_bulk/', body: [1, 2, 3] },
  {
    tool: 'update_license_features',
    args: { id: 12, product_features: [{ product_feature: 'f5', max_consumption: 100, expiry_date: '2027-01-01' }] },
    method: 'POST', url: '/api/v1/licenses/12/update_features/',
    body: { product_features: [{ product_feature: 'f5', max_consumption: 100, expiry_date: '2027-01-01' }] },
  },
  {
    tool: 'apply_license_policy', args: { id: 12, policy_code: 'pro' },
    method: 'POST', url: '/api/v1/licenses/12/apply_policy/', body: { policy_code: 'pro' },
  },
  {
    tool: 'assign_user_to_license', args: { license_id: 12, email: 'u@x.com', first_name: 'U', max_activations: 2 },
    method: 'POST', url: '/api/v1/licenses/12/assign_user/',
    body: { email: 'u@x.com', first_name: 'U', max_activations: 2, is_manager: false },
  },
  {
    tool: 'unassign_user_from_license', args: { license_id: 12, license_user_id: 99 },
    method: 'POST', url: '/api/v1/licenses/12/unassign_user/', body: { license_user_id: 99 },
  },
  {
    tool: 'unassign_user_from_license', args: { license_id: 12, license_user_email: 'u@x.com' },
    method: 'POST', url: '/api/v1/licenses/12/unassign_user/', body: { license_user_email: 'u@x.com' },
  },
  {
    tool: 'set_user_activations',
    args: { license_id: 12, user_activations: { '2449': { max_activations: 100 }, '2452': { reset_total_activations: true } } },
    method: 'POST', url: '/api/v1/licenses/12/set_users_activations/',
    body: { '2449': { max_activations: 100 }, '2452': { reset_total_activations: true } },
  },
  { tool: 'get_license_import_result', args: { job_id: 77 }, method: 'GET', url: '/api/v1/licenses-import-results/77/' },
  {
    tool: 'list_license_activation_history', args: { license: 12, ts__gte: '2026-01-01T00:00:00Z' },
    method: 'GET', url: '/api/v1/license-activation-histories/', params: { ...page, license: '12', ts__gte: '2026-01-01T00:00:00Z' },
  },
  // Orders
  {
    tool: 'create_order',
    args: {
      id: 'ORD-1',
      customer: { email: 'c@x.com', company_name: 'Acme' },
      items: [{ product_code: 'prod', licenses: [{ key: 'AAAA-BBBB', policy_code: 'pro' }, { users: [{ email: 'u@x.com', is_manager: true }] }] }],
      is_test: true,
    },
    method: 'POST', url: '/api/v1/orders/create_order/',
    body: {
      id: 'ORD-1',
      customer: { email: 'c@x.com', company_name: 'Acme' },
      items: [{ product_code: 'prod', licenses: [{ key: 'AAAA-BBBB', policy_code: 'pro' }, { users: [{ email: 'u@x.com', is_manager: true }] }] }],
      is_test: true,
    },
  },
  {
    tool: 'create_order',
    args: {
      id: 'ORD-2',
      items: [{ product_code: 'meter', licenses: [{ license_type: 'consumption', max_consumptions: 1000, consumption_period: 'annually', reset_consumption: true, can_borrow: true, max_borrow_time: 72 }] }],
    },
    method: 'POST', url: '/api/v1/orders/create_order/',
    body: {
      id: 'ORD-2',
      items: [{ product_code: 'meter', licenses: [{ license_type: 'consumption', max_consumptions: 1000, consumption_period: 'annually', reset_consumption: true, can_borrow: true, max_borrow_time: 72 }] }],
    },
  },
  {
    tool: 'list_orders', args: { customer__email: 'c@x.com', store_id__icontains: 'ORD' },
    method: 'GET', url: '/api/v1/orders/', params: { ...page, customer__email: 'c@x.com', store_id__icontains: 'ORD' },
  },
  { tool: 'get_order', args: { id: 5 }, method: 'GET', url: '/api/v1/orders/5/' },
  {
    tool: 'generate_license_keys', args: { product: 'prod', quantity: 3, key_length: 20 },
    method: 'GET', url: '/api/v1/orders/generate_license/', params: { product: 'prod', quantity: '3', key_length: '20' },
  },
  // Customers
  {
    tool: 'list_customers', args: { email__icontains: 'acme', company_name__icontains: 'Acme' },
    method: 'GET', url: '/api/v1/customers/', params: { ...page, email__icontains: 'acme', company_name__icontains: 'Acme' },
  },
  { tool: 'get_customer', args: { id: 3 }, method: 'GET', url: '/api/v1/customers/3/' },
  {
    tool: 'create_customer', args: { email: 'c@x.com', company_name: 'Acme', metadata: { tier: 'gold' } },
    method: 'POST', url: '/api/v1/customers/', body: { email: 'c@x.com', company_name: 'Acme', metadata: { tier: 'gold' } },
  },
  { tool: 'update_customer', args: { id: 3, phone: '123' }, method: 'PATCH', url: '/api/v1/customers/3/', body: { phone: '123' } },
  // License users
  {
    tool: 'list_license_users', args: { true_email__icontains: 'acme', is_license_manager: true },
    method: 'GET', url: '/api/v1/license-users/', params: { ...page, true_email__icontains: 'acme', is_license_manager: 'true' },
  },
  { tool: 'get_license_user', args: { id: 8 }, method: 'GET', url: '/api/v1/license-users/8/' },
  {
    tool: 'create_license_user', args: { email: 'u@x.com', password: 'pw' },
    method: 'POST', url: '/api/v1/license-users/', body: { email: 'u@x.com', password: 'pw' },
  },
  {
    tool: 'update_license_user', args: { id: 8, last_name: 'L' },
    method: 'PATCH', url: '/api/v1/license-users/8/', body: { last_name: 'L' },
  },
  {
    tool: 'set_license_user_password', args: { id: 8, password: 'pw' },
    method: 'POST', url: '/api/v1/license-users/8/set_password/', body: { password: 'pw' },
  },
  {
    tool: 'set_license_user_password', args: { email: 'u@x.com', password: 'pw' },
    method: 'POST', url: '/api/v1/license-users/set_password/', params: { email: 'u@x.com' }, body: { password: 'pw' },
  },
  // Devices
  {
    tool: 'list_devices', args: { license: 12, blacklisted: false },
    method: 'GET', url: '/api/v1/devices/', params: { ...page, license: '12', blacklisted: 'false' },
  },
  { tool: 'get_device', args: { id: 30 }, method: 'GET', url: '/api/v1/devices/30/' },
  { tool: 'reset_device', args: { id: 30 }, method: 'POST', url: '/api/v1/devices/30/reset/' },
  { tool: 'blacklist_device', args: { id: 30 }, method: 'POST', url: '/api/v1/devices/30/blacklist/' },
  { tool: 'whitelist_device', args: { id: 30 }, method: 'POST', url: '/api/v1/devices/30/whitelist/' },
  // Products
  {
    tool: 'list_products', args: { short_code: 'prod', is_archived: false },
    method: 'GET', url: '/api/v1/products/', params: { ...page, short_code: 'prod', is_archived: 'false' },
  },
  { tool: 'get_product', args: { id: 4 }, method: 'GET', url: '/api/v1/products/4/' },
  { tool: 'list_product_features', args: { product: 4 }, method: 'GET', url: '/api/v1/product-features/', params: { ...page, product: '4' } },
  {
    tool: 'list_license_policies', args: { product: 4, is_default: true },
    method: 'GET', url: '/api/v1/license-templates/', params: { ...page, product: '4', is_default: 'true' },
  },
];

describe('Management API server metadata', () => {
  it('registers every tool with annotations and descriptions', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...ALL_TOOLS].sort());
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBeDefined();
      expect(tool.description).toBeTruthy();
    }
    const destructive = tools.filter((t) => t.annotations?.destructiveHint).map((t) => t.name);
    expect(destructive).toEqual(expect.arrayContaining(['delete_license', 'delete_customer', 'reset_license', 'blacklist_device']));
    expect(destructive).toEqual(expect.arrayContaining(['apply_license_policy', 'set_license_user_password', 'update_license_features']));
    expect(tools.find((t) => t.name === 'whitelist_device')?.annotations?.destructiveHint).toBe(false);
    const orderBy = tools.filter((t) => 'order_by' in (t.inputSchema.properties ?? {})).map((t) => t.name).sort();
    expect(orderBy).toEqual(['list_devices', 'list_licenses', 'list_orders', 'list_products']);
  });

  it('identifies itself', () => {
    expect(client.getServerVersion()?.name).toBe('licensespring-management-api');
  });
});

describe('Management API tools → HTTP requests', () => {
  it.each(cases.map((c) => [c.tool, c] as const))('%s sends the documented request', async (_name, c) => {
    mock.reply({ data: { tool: c.tool } });
    const result = await callTool(client, c.tool, c.args);
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(text(result))).toEqual({ tool: c.tool });

    const call = mock.last();
    expect(call.method).toBe(c.method);
    expect(call.url).toBe(c.url);
    expect(call.headers.Authorization).toBe('Api-Key mgmt-key');
    if (c.params) expect(call.params).toEqual(c.params);
    if (c.body !== undefined) expect(call.body).toEqual(c.body);
  });

  it.each([
    ['delete_license', '/api/v1/licenses/9/', 'License 9 deleted'],
    ['delete_customer', '/api/v1/customers/9/', 'Customer 9 deleted'],
    ['delete_license_user', '/api/v1/license-users/9/', 'License user 9 deleted'],
  ])('%s sends DELETE and confirms', async (tool, url, message) => {
    mock.reply({ status: 204, data: '' });
    const result = await callTool(client, tool, { id: 9 });
    expect(text(result)).toBe(message);
    expect(mock.last()).toMatchObject({ method: 'DELETE', url });
  });

  it('import_licenses_from_csv uploads a multipart "file" field', async () => {
    mock.reply({ data: { job_id: 77 } });
    const csv = 'license__license_key,product__short_code\nAAAA-BBBB,prod\n';
    const result = await callTool(client, 'import_licenses_from_csv', { csv_content: csv, file_name: 'batch.csv' });
    expect(JSON.parse(text(result))).toEqual({ job_id: 77 });

    const call = mock.last();
    expect(call.url).toBe('/api/v1/licenses/import_from_csv/');
    const form = call.rawBody as FormData;
    expect(form).toBeInstanceOf(FormData);
    const file = form.get('file') as File;
    expect(file.name).toBe('batch.csv');
    expect(file.type).toBe('text/csv');
    expect(await file.text()).toBe(csv);
  });

  it('import_licenses_from_csv defaults the file name', async () => {
    await callTool(client, 'import_licenses_from_csv', { csv_content: 'a,b\n' });
    expect(((mock.last().rawBody as FormData).get('file') as File).name).toBe('licenses.csv');
  });

  it('covers every tool', () => {
    const covered = new Set([...cases.map((c) => c.tool), 'delete_license', 'delete_customer', 'delete_license_user', 'import_licenses_from_csv']);
    expect([...covered].sort()).toEqual([...ALL_TOOLS].sort());
  });
});

describe('validation', () => {
  it.each([
    ['update_license', { id: 1 }, /at least one field/],
    ['update_license', { id: 1, validity_period: '2027-01-01' }, /is_trial must be sent/],
    ['update_license', { id: 1, trial_days: 14 }, /is_trial must be sent/],
    ['update_license', { id: 1, maintenance_duration: '1y' }, /enable_maintenance_period must be sent/],
    ['update_license', { id: 1, validity_period: '2027-01-01', valid_duration: '1y', is_trial: false }, /cannot be sent together/],
    ['bulk_update_licenses', { licenses: [{ id: 3, valid_duration: '1y' }] }, /License 3: is_trial must be sent/],
    ['update_customer', { id: 1 }, /at least one field/],
    ['update_license_user', { id: 1 }, /at least one field/],
    ['unassign_user_from_license', { license_id: 1 }, /exactly one of license_user_id or license_user_email/],
    ['unassign_user_from_license', { license_id: 1, license_user_id: 2, license_user_email: 'a@b.co' }, /exactly one/],
    ['set_license_user_password', { password: 'x' }, /exactly one of id or email/],
    [
      'create_order',
      { id: 'o', items: [{ product_code: 'p', licenses: [{ validity_period: '2027-01-01', valid_duration: '1y' }] }] },
      /items\[0\]\.licenses\[0\]: validity_period and valid_duration/,
    ],
  ])('%s rejects %p', async (tool, args, message) => {
    const result = await callTool(client, tool, args);
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(message);
    expect(mock.calls).toHaveLength(0);
  });

  it.each([
    ['update_license', { id: 1, validity_period: '31/01/2027', is_trial: false }],
    ['update_license', { id: 1, valid_duration: 'one year', is_trial: false }],
    ['set_user_activations', { license_id: 1, user_activations: {} }],
    ['update_license_features', { id: 1, product_features: [] }],
    ['create_order', { id: 'o', items: [{ product_code: 'p', licenses: [{ consumption_period: 'annualy' }] }] }],
    ['update_license', { id: 1, consumption_period: 'annually' }],
    ['set_user_activations', { license_id: 1, user_activations: { alice: { max_activations: 1 } } }],
    ['bulk_disable_licenses', { license_ids: [] }],
    ['list_licenses', { limit: 5000 }],
    ['create_customer', { email: 'not-an-email' }],
  ])('%s rejects schema-invalid input %p', async (tool, args) => {
    const result = await callTool(client, tool, args);
    expect(result.isError).toBe(true);
    expect(mock.calls).toHaveLength(0);
  });

  it('validateLicenseUpdate accepts valid combinations', () => {
    expect(() => validateLicenseUpdate({ valid_duration: '1y', is_trial: false })).not.toThrow();
    expect(() => validateLicenseUpdate({ maintenance_duration: '1y', enable_maintenance_period: true })).not.toThrow();
    expect(() => validateLicenseUpdate({ note: 'x' })).not.toThrow();
    expect(() => validateLicenseUpdate({ validity_period: '2027-01-01', valid_duration: '1y' })).toThrow(ValidationError);
  });
});

describe('API errors', () => {
  it('surfaces Django REST field errors', async () => {
    mock.reply({ status: 400, data: { email: ['Enter a valid email address.'] } });
    const result = await callTool(client, 'create_order', { id: 'o', items: [{ product_code: 'p', licenses: [{}] }] });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Error creating order: HTTP 400: {"email":["Enter a valid email address."]}');
  });

  it('adds Management API auth guidance', async () => {
    mock.reply({ status: 401, data: { detail: 'Invalid API key.' } });
    const result = await callTool(client, 'get_license', { id: 1 });
    expect(text(result)).toMatch(/Check MANAGEMENT_API_KEY/);
  });
});

describe('resources', () => {
  it.each([
    ['licensespring://management/licenses', '/api/v1/licenses/'],
    ['licensespring://management/customers', '/api/v1/customers/'],
    ['licensespring://management/products', '/api/v1/products/'],
  ])('%s lists the first 100 items', async (uri, url) => {
    mock.reply({ data: { count: 1, results: [{ id: 1 }] } });
    const result = await client.readResource({ uri });
    expect(JSON.parse(result.contents[0].text as string)).toEqual({ count: 1, results: [{ id: 1 }] });
    expect(mock.last()).toMatchObject({ url, params: { limit: '100' } });
  });

  it('reports resource failures', async () => {
    mock.reply({ status: 500, data: { detail: 'down' } });
    await expect(client.readResource({ uri: 'licensespring://management/licenses' }))
      .rejects.toThrow(/Failed to get licenses: HTTP 500: down/);
  });

  it('lists resources including health', async () => {
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual([
      'licensespring://health',
      'licensespring://management/customers',
      'licensespring://management/licenses',
      'licensespring://management/products',
    ]);
  });
});

describe('prompts', () => {
  const promptText = async (name: string, args: Record<string, string>) =>
    ((await client.getPrompt({ name, arguments: args })).messages[0].content as { text: string }).text;

  it.each(['create', 'update', 'audit', 'cleanup'])('license-management-workflow renders %s', async (action) => {
    const body = await promptText('license-management-workflow', { action, customer_email: 'c@x.com', product_code: 'p', notes: 'n' });
    expect(body).toContain(`"${action}"`);
    expect(body).toContain('Customer: c@x.com');
    expect(body).toMatch(/1\. /);
  });

  it('license-management-workflow omits empty optional lines', async () => {
    const body = await promptText('license-management-workflow', { action: 'create' });
    expect(body).not.toContain('Customer:');
    expect(body).toContain('create_order');
  });

  it.each([
    ['usage', /most and least used/],
    ['compliance', /over-activation/],
    ['renewal', /expiring soon/],
  ])('customer-analysis renders %s', async (analysis_type, expected) => {
    const body = await promptText('customer-analysis', { analysis_type, customer_id: '3', customer_email: 'c@x.com' });
    expect(body).toMatch(expected);
    expect(body).toContain('Customer ID: 3');
  });

  it('customer-analysis defaults to usage', async () => {
    const body = await promptText('customer-analysis', {});
    expect(body).toContain('usage analysis');
    expect(body).not.toContain('Customer ID');
  });
});
