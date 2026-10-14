// Live integration tests against the real LicenseSpring APIs (run `npm run build` first).
//
//   License API:    LICENSE_API_KEY + LICENSE_SHARED_KEY  (or LICENSE_CLIENT_ID + LICENSE_CLIENT_SECRET)
//   Management API: MANAGEMENT_API_KEY
//   Optional:       LS_TEST_PRODUCT=<product short code>  (defaults to the first product found)
//                   LS_INTEGRATION_WRITE=1                (also run create/update/delete round-trips)
//
// Read-only by default. Write tests create clearly-labelled test records and
// delete them afterwards. Suites without credentials are skipped, not faked.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

dotenv.config({ quiet: true });

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = process.env;
const hasLicenseCreds = Boolean((env.LICENSE_API_KEY && env.LICENSE_SHARED_KEY) || (env.LICENSE_CLIENT_ID && env.LICENSE_CLIENT_SECRET));
const hasManagementCreds = Boolean(env.MANAGEMENT_API_KEY);
const writeEnabled = env.LS_INTEGRATION_WRITE === '1';
const runId = `mcp-it-${Date.now()}`;

async function connect(binary) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'dist', binary)], env: { ...env, LOG_LEVEL: 'error' } });
  const client = new Client({ name: 'live-integration', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const body = result.content?.[0]?.text ?? '';
  assert.ok(!result.isError, `${name} failed: ${body}`);
  try { return JSON.parse(body); } catch { return body; }
}

describe('License API (live)', { skip: !hasLicenseCreds && 'License API credentials not set' }, () => {
  let client;
  let product;
  before(async () => {
    client = await connect('license-api-server.js');
  });
  after(() => client?.close());

  test('list_products authenticates and returns products', async () => {
    const products = await call(client, 'list_products');
    assert.ok(Array.isArray(products), 'expected an array of products');
    product = env.LS_TEST_PRODUCT ?? products[0]?.code ?? products[0]?.short_code;
  });

  test('get_product_details returns the product configuration', async (t) => {
    if (!product) return t.skip('no product available');
    const details = await call(client, 'get_product_details', { product });
    assert.equal(typeof details, 'object');
  });

  test('check_license reports a clear error for an unknown key', async () => {
    const result = await client.callTool({
      name: 'check_license',
      arguments: { hardware_id: runId, product: product ?? 'unknown', license_key: `${runId}-missing` },
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /HTTP 4\d\d/);
  });
});

describe('Management API (live)', { skip: !hasManagementCreds && 'MANAGEMENT_API_KEY not set' }, () => {
  let client;
  before(async () => {
    client = await connect('management-api-server.js');
  });
  after(() => client?.close());

  for (const tool of ['list_licenses', 'list_customers', 'list_products', 'list_orders', 'list_license_users', 'list_devices']) {
    test(`${tool} returns a paginated response`, async () => {
      const page = await call(client, tool, { limit: 1 });
      assert.ok('results' in page && 'count' in page, `unexpected shape: ${JSON.stringify(page).slice(0, 200)}`);
    });
  }

  test('customer create → get → update → delete', { skip: !writeEnabled && 'set LS_INTEGRATION_WRITE=1' }, async () => {
    const customer = await call(client, 'create_customer', { email: `${runId}@example.com`, reference: runId, first_name: 'MCP' });
    try {
      assert.equal((await call(client, 'get_customer', { id: customer.id })).email, `${runId}@example.com`);
      assert.equal((await call(client, 'update_customer', { id: customer.id, last_name: 'Integration' })).last_name, 'Integration');
    } finally {
      await call(client, 'delete_customer', { id: customer.id });
    }
  });

  test('test order creates a license that can be disabled and deleted', { skip: !(writeEnabled && env.LS_TEST_PRODUCT) && 'set LS_INTEGRATION_WRITE=1 and LS_TEST_PRODUCT' }, async () => {
    const order = await call(client, 'create_order', {
      id: runId,
      is_test: true,
      customer: { email: `${runId}@example.com` },
      items: [{ product_code: env.LS_TEST_PRODUCT, licenses: [{}] }],
    });
    const licenses = await call(client, 'list_licenses', { order__store_id: runId });
    assert.ok(licenses.count >= 1, `order ${JSON.stringify(order)} produced no licenses`);
    for (const license of licenses.results) {
      await call(client, 'disable_license', { id: license.id });
      await call(client, 'delete_license', { id: license.id });
    }
  });
});
