import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import { createLicenseApiServer, startLicenseApiServer } from '../../src/license-api/server.js';
import { createManagementApiServer, startManagementApiServer } from '../../src/management-api/server.js';
import { createServerState } from '../../src/runtime.js';
import { LicenseApiClient, ManagementApiClient, PACKAGE_VERSION } from '../../src/utils/http.js';
import { connect, mockAxios, silentLogger, type MockResponder } from './helpers.js';

function licenseServer(responder: MockResponder = () => ({ data: [{ short_code: 'P' }] })) {
  const { http, requests } = mockAxios(responder);
  const client = new LicenseApiClient(
    { baseUrl: 'https://api.test', auth: { type: 'api-key', apiKey: 'ak', sharedKey: 'sk' }, timeoutMs: 1000, maxRetries: 0 },
    { http },
  );
  return { server: createLicenseApiServer(client, { baseUrl: 'https://api.test' }), requests };
}

function managementServer(responder: MockResponder = () => ({ data: { count: 0, results: [] } })) {
  const { http, requests } = mockAxios(responder);
  const client = new ManagementApiClient({ baseUrl: 'https://saas.test', apiKey: 'mk', timeoutMs: 1000, maxRetries: 0 }, { http });
  return { server: createManagementApiServer(client, { baseUrl: 'https://saas.test', state: createServerState() }), requests };
}

const text = (contents: Array<object>) => String((contents[0] as { text?: unknown }).text);

describe('License API server', () => {
  it('advertises its name and version', async () => {
    const client = await connect(licenseServer().server);
    expect(client.getServerVersion()).toEqual({ name: 'licensespring-license-api', version: PACKAGE_VERSION });
  });

  it('serves health, products and product details resources', async () => {
    const { server, requests } = licenseServer();
    const client = await connect(server);
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual(['licensespring://health', 'licensespring://products']);

    const health = JSON.parse(text((await client.readResource({ uri: 'licensespring://health' })).contents));
    expect(health).toMatchObject({ status: 'healthy', service: 'licensespring-license-api', environment: { api_url: 'https://api.test', auth: 'api-key' } });

    const products = JSON.parse(text((await client.readResource({ uri: 'licensespring://products' })).contents));
    expect(products).toEqual([{ short_code: 'P' }]);

    await client.readResource({ uri: 'licensespring://product/MY%20P/details' });
    expect(requests.map((r) => r.url)).toEqual(['/api/v4/products', '/api/v4/product_details?product=MY+P']);
  });

  it('wraps resource API failures', async () => {
    const client = await connect(licenseServer(() => ({ status: 500, data: { message: 'down' } })).server);
    await expect(client.readResource({ uri: 'licensespring://products' })).rejects.toThrow('Failed to list products: HTTP 500: down');
    await expect(client.readResource({ uri: 'licensespring://product/P/details' })).rejects.toThrow('Failed to get product details: HTTP 500: down');
  });

  it('renders prompts', async () => {
    const client = await connect(licenseServer().server);
    expect((await client.listPrompts()).prompts.map((p) => p.name)).toEqual(['license-troubleshooting', 'customer-onboarding']);

    const full = await client.getPrompt({ name: 'license-troubleshooting', arguments: { license_key: 'K', issue_description: 'fails', product: 'P', hardware_id: 'HW' } });
    expect(full.messages[0].content).toMatchObject({ type: 'text', text: expect.stringContaining('Hardware ID: HW') });
    const minimal = await client.getPrompt({ name: 'license-troubleshooting', arguments: { license_key: 'K', issue_description: 'fails' } });
    expect(minimal.messages[0].content).toMatchObject({ text: expect.stringContaining('Product: (unknown') });

    const trial = await client.getPrompt({ name: 'customer-onboarding', arguments: { customer_email: 'a@b.io', product_code: 'P' } });
    expect(trial.messages[0].content).toMatchObject({ text: expect.stringContaining('get_trial_key') });
    const full2 = await client.getPrompt({ name: 'customer-onboarding', arguments: { customer_email: 'a@b.io', product_code: 'P', license_type: 'full' } });
    expect(full2.messages[0].content).toMatchObject({ text: expect.stringContaining('create_order') });
  });
});

describe('Management API server', () => {
  it('serves health and list resources', async () => {
    const { server, requests } = managementServer();
    const client = await connect(server);
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual([
      'licensespring://health',
      'licensespring://management/licenses',
      'licensespring://management/customers',
      'licensespring://management/products',
      'licensespring://management/orders',
    ]);
    expect(JSON.parse(text((await client.readResource({ uri: 'licensespring://health' })).contents))).toMatchObject({
      service: 'licensespring-management-api',
      environment: { api_url: 'https://saas.test' },
    });
    for (const resource of resources.slice(1)) {
      expect(JSON.parse(text((await client.readResource({ uri: resource.uri })).contents))).toEqual({ count: 0, results: [] });
    }
    expect(requests.map((r) => r.url)).toEqual([
      '/api/v1/licenses/?limit=100',
      '/api/v1/customers/?limit=100',
      '/api/v1/products/?limit=100',
      '/api/v1/orders/?limit=100',
    ]);
  });

  it('wraps resource API failures', async () => {
    const client = await connect(managementServer(() => ({ status: 403, data: { detail: 'Nope' } })).server);
    await expect(client.readResource({ uri: 'licensespring://management/customers' })).rejects.toThrow('Failed to list customers: HTTP 403: Nope');
  });

  it('creates its own state when none is supplied', async () => {
    const { http } = mockAxios();
    const server = createManagementApiServer(new ManagementApiClient({ baseUrl: 'b', apiKey: 'k', timeoutMs: 1, maxRetries: 0 }, { http }), { baseUrl: 'b' });
    const client = await connect(server);
    expect(JSON.parse(text((await client.readResource({ uri: 'licensespring://health' })).contents)).status).toBe('healthy');
  });

  it.each([
    [{ action: 'create', customer_email: 'a@b.io', product_code: 'P', notes: 'rush' }, ['Customer: a@b.io', 'Product: P', 'Notes: rush', 'create_order']],
    [{ action: 'update' }, ['update_license']],
    [{ action: 'audit' }, ['list_license_activation_histories']],
    [{ action: 'cleanup' }, ['bulk_disable_licenses']],
  ])('renders the license-management-workflow prompt %#', async (args, snippets) => {
    const client = await connect(managementServer().server);
    const prompt = await client.getPrompt({ name: 'license-management-workflow', arguments: args as Record<string, string> });
    const body = (prompt.messages[0].content as { text: string }).text;
    for (const snippet of snippets) expect(body).toContain(snippet);
    if (args.action !== 'create') expect(body).not.toContain('Customer:');
  });

  it.each([
    [{ customer_id: '7', customer_email: 'a@b.io', analysis_type: 'renewal' }, ['Customer ID: 7', 'Customer email: a@b.io', 'upcoming expirations']],
    [{ analysis_type: 'compliance' }, ['activation limits']],
    [{}, ['usage analysis', 'consumption trends']],
  ])('renders the customer-analysis prompt %#', async (args, snippets) => {
    const client = await connect(managementServer().server);
    const prompt = await client.getPrompt({ name: 'customer-analysis', arguments: args as Record<string, string> });
    const body = (prompt.messages[0].content as { text: string }).text;
    for (const snippet of snippets) expect(body).toContain(snippet);
  });
});

describe('start functions', () => {
  const fakeProc = () => ({ on: vi.fn(), exit: vi.fn() });

  it.each([
    ['license', startLicenseApiServer, { LICENSE_API_KEY: 'ak', LICENSE_SHARED_KEY: 'sk' }],
    ['management', startManagementApiServer, { MANAGEMENT_API_KEY: 'mk' }],
  ] as const)('starts the %s server over the given transport', async (_name, start, env) => {
    const proc = fakeProc();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await start({ env, proc, logger: silentLogger(), transport: serverTransport });
    expect(proc.exit).not.toHaveBeenCalled();
    expect(proc.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    await clientTransport.close();
  });

  it.each([
    ['license', startLicenseApiServer, 'LICENSE_SHARED_KEY is required'],
    ['management', startManagementApiServer, 'MANAGEMENT_API_KEY is required'],
  ] as const)('exits with a configuration error for the %s server', async (_name, start, message) => {
    const proc = fakeProc();
    const logger = silentLogger();
    const error = vi.spyOn(logger, 'error');
    await start({ env: { LICENSE_API_KEY: 'only-key' }, proc, logger });
    expect(error).toHaveBeenCalledWith(expect.stringContaining(message));
    expect(proc.exit).toHaveBeenCalledWith(1);
  });

  it.each([
    ['license', startLicenseApiServer, { LICENSE_API_KEY: 'ak', LICENSE_SHARED_KEY: 'sk' }, 'Failed to start License API MCP server'],
    ['management', startManagementApiServer, { MANAGEMENT_API_KEY: 'mk' }, 'Failed to start Management API MCP server'],
  ] as const)('exits when the %s transport fails to start', async (_name, start, env, message) => {
    const proc = fakeProc();
    const logger = silentLogger();
    const error = vi.spyOn(logger, 'error');
    const transport = { start: vi.fn().mockRejectedValue(new Error('no stdio')), send: vi.fn(), close: vi.fn() };
    await start({ env, proc, logger, transport });
    expect(error).toHaveBeenCalledWith(message, expect.any(Error));
    expect(proc.exit).toHaveBeenCalledWith(1);
  });

  it.each([
    ['license', startLicenseApiServer, 'LICENSE_'],
    ['management', startManagementApiServer, 'MANAGEMENT_'],
  ] as const)('loads .env quietly and reads process.env for the %s server', async (_name, start, prefix) => {
    for (const key of Object.keys(process.env)) if (key.startsWith(prefix)) vi.stubEnv(key, '');
    const proc = fakeProc();
    await start({ proc, logger: silentLogger() });
    expect(proc.exit).toHaveBeenCalledWith(1);
  });
});
