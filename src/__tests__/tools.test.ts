import { readFileSync } from 'node:fs';
import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createHealthState, registerHealthResource } from '../tools/health.js';
import { createRunner, errorResult, formatData, successResult } from '../tools/result.js';
import { PACKAGE_NAME, VERSION } from '../version.js';
import { Logger, LogLevel } from '../utils/logger.js';
import { connect, text } from './helpers.js';

describe('version', () => {
  it('matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(VERSION).toBe(pkg.version);
    expect(PACKAGE_NAME).toBe(pkg.name);
  });
});

describe('result helpers', () => {
  it('formats data', () => {
    expect(formatData(undefined)).toBe('Success (no content returned)');
    expect(formatData(null)).toBe('Success (no content returned)');
    expect(formatData('')).toBe('Success (no content returned)');
    expect(formatData('license_deactivated')).toBe('license_deactivated');
    expect(formatData({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it('builds success and error results', () => {
    expect(successResult({ a: 1 })).toEqual({ content: [{ type: 'text', text: '{\n  "a": 1\n}' }] });
    expect(errorResult('doing x', new Error('nope'), 'license')).toEqual({
      content: [{ type: 'text', text: 'Error doing x: nope' }],
      isError: true,
    });
  });

  it('runner converts thrown errors into isError results and logs them', async () => {
    const lines: string[] = [];
    const run = createRunner('management', new Logger('t', { level: LogLevel.WARN, sink: (l) => lines.push(l) }));
    expect(await run('ok', async () => 'fine')).toEqual(successResult('fine'));
    const failed = await run('failing', async () => { throw new Error('bad'); });
    expect(failed.isError).toBe(true);
    expect(lines[0]).toContain('Tool failed while failing');
  });

  it('runner works without a logger', async () => {
    const run = createRunner('license');
    expect((await run('x', async () => { throw new Error('e'); })).isError).toBe(true);
  });
});

describe('health resource', () => {
  it('reports status, version, uptime and details', async () => {
    const server = new McpServer({ name: 't', version: '1' });
    let now = 1_000_000;
    const state = createHealthState(() => now);
    registerHealthResource(server, 'svc', state, { api_url: 'https://x' }, () => now);
    const client = await connect(server);
    now += 65_000;

    const read = async () => JSON.parse((await client.readResource({ uri: 'licensespring://health' })).contents[0].text as string);
    expect(await read()).toMatchObject({
      status: 'healthy', service: 'svc', version: VERSION, uptime: 65,
      environment: { api_url: 'https://x', node_version: process.version },
    });
    state.healthy = false;
    expect((await read()).status).toBe('unhealthy');
  });

  it('defaults to Date.now', () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(42);
    try {
      expect(createHealthState()).toEqual({ startedAt: 42, healthy: true });
    } finally {
      spy.mockRestore();
    }
  });

  it('uses Date.now for uptime by default', async () => {
    const server = new McpServer({ name: 't', version: '1' });
    registerHealthResource(server, 'svc', createHealthState(), {});
    const client = await connect(server);
    const result = await client.readResource({ uri: 'licensespring://health' });
    expect(JSON.parse(result.contents[0].text as string).uptime).toBeGreaterThanOrEqual(0);
    expect(text({ content: [{ type: 'text', text: 'x' }] })).toBe('x');
  });
});
