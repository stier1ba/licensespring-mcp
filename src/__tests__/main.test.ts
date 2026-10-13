import { EventEmitter } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { runLicenseApiServer, runManagementApiServer } from '../main.js';
import type { ProcessLike } from '../runtime.js';
import { Logger, LogLevel } from '../utils/logger.js';
import { createMockAdapter } from './helpers.js';

class FakeProcess extends EventEmitter implements ProcessLike {
  exitCodes: number[] = [];
  errOutput = '';
  stderr = { write: (chunk: string) => { this.errOutput += chunk; return true; } };
  constructor(public env: Record<string, string | undefined>) { super(); }
  exit(code = 0): void { this.exitCodes.push(code); }
}

const quiet = new Logger('t', { level: LogLevel.ERROR, sink: () => {} });

async function connected(run: typeof runLicenseApiServer, env: Record<string, string>) {
  const proc = new FakeProcess(env);
  const mock = createMockAdapter();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const running = await run({ proc, transport: serverTransport, logger: quiet, adapter: mock.adapter });
  const client = new Client({ name: 'c', version: '1' });
  await client.connect(clientTransport);
  return { proc, mock, client, running };
}

describe('runLicenseApiServer', () => {
  it('exits 1 with guidance when credentials are incomplete', async () => {
    const proc = new FakeProcess({ LICENSE_API_KEY: 'k' });
    await expect(runLicenseApiServer({ proc })).resolves.toBeUndefined();
    expect(proc.exitCodes).toEqual([1]);
    expect(proc.errOutput).toMatch(/LICENSE_SHARED_KEY is required/);
    expect(proc.errOutput).toMatch(/LICENSE_CLIENT_ID \+ LICENSE_CLIENT_SECRET/);
  });

  it('serves tools that call the configured API with HMAC auth', async () => {
    const { client, mock, running } = await connected(runLicenseApiServer, {
      LICENSE_API_KEY: 'k', LICENSE_SHARED_KEY: 's', LICENSE_API_URL: 'https://api.example',
    });
    expect(running).toBeDefined();
    await client.callTool({ name: 'list_products', arguments: {} });
    expect(mock.last()).toMatchObject({ baseURL: 'https://api.example', url: '/api/v4/products' });
    expect(mock.last().headers.Authorization).toContain('apikey="k"');
  });

  it('uses the default logger when none is injected', async () => {
    const proc = new FakeProcess({ LICENSE_CLIENT_ID: 'id', LICENSE_CLIENT_SECRET: 'sec' });
    const [, serverTransport] = InMemoryTransport.createLinkedPair();
    await expect(runLicenseApiServer({ proc, transport: serverTransport })).resolves.toBeDefined();
  });
});

describe('runManagementApiServer', () => {
  it('exits 1 without MANAGEMENT_API_KEY', async () => {
    const proc = new FakeProcess({});
    await expect(runManagementApiServer({ proc })).resolves.toBeUndefined();
    expect(proc.exitCodes).toEqual([1]);
    expect(proc.errOutput).toMatch(/MANAGEMENT_API_KEY is required/);
  });

  it('serves tools that call the Management API', async () => {
    const { client, mock } = await connected(runManagementApiServer, { MANAGEMENT_API_KEY: 'm' });
    await client.callTool({ name: 'get_license', arguments: { id: 1 } });
    expect(mock.last()).toMatchObject({ baseURL: 'https://saas.licensespring.com', url: '/api/v1/licenses/1/' });
    expect(mock.last().headers.Authorization).toBe('Api-Key m');
  });

  it('uses the default logger when none is injected', async () => {
    const proc = new FakeProcess({ MANAGEMENT_API_KEY: 'm' });
    const [, serverTransport] = InMemoryTransport.createLinkedPair();
    await expect(runManagementApiServer({ proc, transport: serverTransport })).resolves.toBeDefined();
  });
});
