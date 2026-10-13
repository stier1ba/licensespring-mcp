import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jest } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ConfigError } from '../config.js';
import { loadEnv, reportConfigError, startServer, type ProcessLike } from '../runtime.js';
import { createHealthState } from '../tools/health.js';
import { Logger, LogLevel } from '../utils/logger.js';

class FakeProcess extends EventEmitter implements ProcessLike {
  env: Record<string, string | undefined> = {};
  exitCodes: number[] = [];
  errOutput = '';
  stderr = { write: (chunk: string) => { this.errOutput += chunk; return true; } };
  // Declared before `exited` so class-field initialization doesn't reset it.
  private resolveExit!: (code: number) => void;
  exited = new Promise<number>((resolve) => { this.resolveExit = resolve; });
  exit(code = 0): void {
    this.exitCodes.push(code);
    this.resolveExit(code);
  }
}

function logger() {
  const lines: string[] = [];
  return { lines, logger: new Logger('test', { level: LogLevel.DEBUG, sink: (l) => lines.push(l) }) };
}

async function start(serverOverride?: McpServer) {
  const server = serverOverride ?? new McpServer({ name: 's', version: '1' });
  const proc = new FakeProcess();
  const { lines, logger: log } = logger();
  const health = createHealthState();
  health.healthy = false;
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const running = await startServer({ server, name: 'svc', logger: log, health, proc, transport: serverTransport, shutdownTimeoutMs: 50 });
  const client = new Client({ name: 'c', version: '1' });
  await client.connect(clientTransport);
  return { server, proc, lines, health, running, client };
}

describe('loadEnv', () => {
  it('loads .env without writing to stdout', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ls-env-'));
    const file = join(dir, '.env');
    writeFileSync(file, 'LS_TEST_LOADENV=loaded\n');
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      loadEnv({ path: file });
      expect(process.env.LS_TEST_LOADENV).toBe('loaded');
      expect(stdout).not.toHaveBeenCalled();
    } finally {
      stdout.mockRestore();
      delete process.env.LS_TEST_LOADENV;
    }
  });

  it('defaults to the working directory .env', () => {
    expect(() => loadEnv()).not.toThrow();
  });
});

describe('reportConfigError', () => {
  it('prints the message and setup hint for ConfigError', () => {
    const proc = new FakeProcess();
    reportConfigError(proc, new ConfigError('missing key'), 'Set X.');
    expect(proc.errOutput).toBe('Configuration error: missing key\nSet X.\nSee README.md for setup instructions.\n');
  });

  it('prints only the message for other errors', () => {
    const proc = new FakeProcess();
    reportConfigError(proc, 'weird', 'Set X.');
    expect(proc.errOutput).toBe('Configuration error: weird\n');
  });
});

describe('startServer', () => {
  it('connects, marks healthy and logs startup', async () => {
    const { health, lines, client } = await start();
    expect(health.healthy).toBe(true);
    expect(lines.some((l) => l.includes('svc v') && l.includes('running on stdio'))).toBe(true);
    expect(client.getServerVersion()?.name).toBe('s');
  });

  it.each(['SIGTERM', 'SIGINT', 'SIGHUP'])('shuts down gracefully on %s', async (signal) => {
    const { proc, health, server } = await start();
    const close = jest.spyOn(server, 'close');
    proc.emit(signal);
    expect(await proc.exited).toBe(0);
    expect(close).toHaveBeenCalledTimes(1);
    expect(health.healthy).toBe(false);
  });

  it('exits 1 on uncaught exceptions and unhandled rejections', async () => {
    const a = await start();
    a.proc.emit('uncaughtException', new Error('kaboom'));
    expect(await a.proc.exited).toBe(1);
    expect(a.lines.some((l) => l.includes('Uncaught exception') && l.includes('kaboom'))).toBe(true);

    const b = await start();
    b.proc.emit('unhandledRejection', 'nope');
    expect(await b.proc.exited).toBe(1);
    expect(b.lines.some((l) => l.includes('Unhandled rejection'))).toBe(true);
  });

  it('only shuts down once', async () => {
    const { proc, running } = await start();
    await Promise.all([running.shutdown('a'), running.shutdown('b')]);
    expect(proc.exitCodes).toEqual([0]);
  });

  it('exits 1 when closing fails', async () => {
    const { proc, server, running, lines } = await start();
    jest.spyOn(server, 'close').mockRejectedValue(new Error('close failed'));
    await running.shutdown('test');
    expect(proc.exitCodes).toEqual([1]);
    expect(lines.some((l) => l.includes('Error during shutdown'))).toBe(true);
  });

  it('forces exit when shutdown hangs', async () => {
    const { proc, server, running, lines } = await start();
    jest.spyOn(server, 'close').mockImplementation(() => new Promise(() => {}));
    void running.shutdown('hang');
    expect(await proc.exited).toBe(1);
    expect(lines.some((l) => l.includes('Forcing exit'))).toBe(true);
  });

  it('defaults to the stdio transport and shutdown timeout', async () => {
    const server = new McpServer({ name: 's', version: '1' });
    const connect = jest.spyOn(server, 'connect').mockResolvedValue(undefined);
    const proc = new FakeProcess();
    const running = await startServer({ server, name: 'svc', logger: logger().logger, health: createHealthState(), proc });
    expect(connect.mock.calls[0][0].constructor.name).toBe('StdioServerTransport');
    jest.spyOn(server, 'close').mockResolvedValue(undefined);
    await running.shutdown('done');
    expect(proc.exitCodes).toEqual([0]);
  });
});
