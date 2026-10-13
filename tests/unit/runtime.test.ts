import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServerState, healthPayload, runStdioServer } from '../../src/runtime.js';
import { silentLogger } from './helpers.js';

type Listener = (...args: unknown[]) => void;

function fakeProc() {
  const listeners = new Map<string, Listener>();
  return {
    listeners,
    on: vi.fn((event: string, listener: Listener) => listeners.set(event, listener)),
    exit: vi.fn(),
  };
}

async function start(overrides: Partial<Parameters<typeof runStdioServer>[0]> = {}) {
  const proc = fakeProc();
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  const [, serverTransport] = InMemoryTransport.createLinkedPair();
  const state = createServerState();
  const logger = silentLogger();
  const shutdown = await runStdioServer({ server, logger, name: 'test server', state, transport: serverTransport, proc, ...overrides });
  return { proc, server, state, logger, shutdown };
}

describe('runStdioServer', () => {
  afterEach(() => vi.useRealTimers());

  it('connects and registers process handlers', async () => {
    const { proc, server, state } = await start();
    expect(server.isConnected()).toBe(true);
    expect(state.healthy).toBe(true);
    expect([...proc.listeners.keys()]).toEqual(['SIGINT', 'SIGTERM', 'SIGHUP', 'uncaughtException', 'unhandledRejection']);
  });

  it('shuts down gracefully once on a signal', async () => {
    const { proc, server, state } = await start();
    const close = vi.spyOn(server, 'close');
    proc.listeners.get('SIGTERM')?.();
    proc.listeners.get('SIGINT')?.();
    await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(0));
    expect(close).toHaveBeenCalledTimes(1);
    expect(state.healthy).toBe(false);
  });

  it('exits with code 1 after an uncaught exception', async () => {
    const { proc, logger } = await start();
    const error = vi.spyOn(logger, 'error');
    proc.listeners.get('uncaughtException')?.(new Error('boom'));
    await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(1));
    expect(error).toHaveBeenCalledWith('Uncaught exception', expect.any(Error));
  });

  it('logs unhandled rejections without exiting', async () => {
    const { proc, logger } = await start();
    const error = vi.spyOn(logger, 'error');
    proc.listeners.get('unhandledRejection')?.('reason');
    expect(error).toHaveBeenCalledWith('Unhandled promise rejection', 'reason');
    expect(proc.exit).not.toHaveBeenCalled();
  });

  it('exits with code 1 when closing fails', async () => {
    const { proc, server, logger, shutdown } = await start();
    vi.spyOn(server, 'close').mockRejectedValue(new Error('stuck'));
    const error = vi.spyOn(logger, 'error');
    await shutdown('test');
    expect(error).toHaveBeenCalledWith('Error during shutdown', expect.any(Error));
    expect(proc.exit).toHaveBeenCalledWith(1);
  });

  it('forces exit when shutdown takes too long', async () => {
    vi.useFakeTimers();
    const { proc, server, shutdown } = await start({ shutdownTimeoutMs: 100 });
    vi.spyOn(server, 'close').mockReturnValue(new Promise(() => {}));
    void shutdown('slow');
    await vi.advanceTimersByTimeAsync(100);
    expect(proc.exit).toHaveBeenCalledWith(1);
  });

  it('defaults to a stdio transport and the real process', async () => {
    const server = new McpServer({ name: 'test', version: '1.0.0' });
    const connect = vi.spyOn(server, 'connect').mockResolvedValue();
    const on = vi.spyOn(process, 'on').mockReturnValue(process);
    await runStdioServer({ server, logger: silentLogger(), name: 'x', state: createServerState() });
    expect(connect.mock.calls[0][0].constructor.name).toBe('StdioServerTransport');
    expect(on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });
});

describe('healthPayload', () => {
  it('reports status, uptime and environment', () => {
    const state = { startedAt: Date.now() - 5_000, healthy: false };
    expect(healthPayload('svc', '1.2.3', state, { extra: 1 })).toMatchObject({
      status: 'unhealthy',
      service: 'svc',
      version: '1.2.3',
      uptime_seconds: 5,
      environment: { node_version: process.version, extra: 1 },
    });
  });

  it('creates a healthy state using the given clock', () => {
    expect(createServerState(() => 42)).toEqual({ startedAt: 42, healthy: true });
    expect(createServerState().healthy).toBe(true);
  });
});
