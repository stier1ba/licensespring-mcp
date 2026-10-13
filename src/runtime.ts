import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Logger } from './utils/logger.js';

export interface ProcessLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  exit(code?: number): void;
}

export interface ServerState {
  startedAt: number;
  healthy: boolean;
}

export function createServerState(now: () => number = Date.now): ServerState {
  return { startedAt: now(), healthy: true };
}

export interface RunOptions {
  server: McpServer;
  logger: Logger;
  name: string;
  state: ServerState;
  transport?: Transport;
  proc?: ProcessLike;
  shutdownTimeoutMs?: number;
}

/**
 * Connect the server to stdio and install signal/error handlers for a graceful shutdown.
 * Returns the shutdown function (useful for tests).
 */
export async function runStdioServer(options: RunOptions): Promise<(reason: string) => Promise<void>> {
  const {
    server,
    logger,
    name,
    state,
    transport = new StdioServerTransport(),
    proc = process,
    shutdownTimeoutMs = 5000,
  } = options;

  let shuttingDown = false;
  const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    state.healthy = false;
    logger.info(`Shutting down ${name} (${reason})`);

    const timer = setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      proc.exit(1);
    }, shutdownTimeoutMs);
    timer.unref?.();

    try {
      await server.close();
      proc.exit(exitCode);
    } catch (error) {
      logger.error('Error during shutdown', error);
      proc.exit(1);
    } finally {
      clearTimeout(timer);
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    proc.on(signal, () => void shutdown(signal));
  }
  proc.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    void shutdown('uncaughtException', 1);
  });
  proc.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason);
  });

  await server.connect(transport);
  state.startedAt = Date.now();
  state.healthy = true;
  logger.info(`${name} running on stdio`);
  return (reason: string) => shutdown(reason);
}

/** Shared health resource payload. */
export function healthPayload(service: string, version: string, state: ServerState, extra: Record<string, unknown>) {
  const memory = process.memoryUsage();
  return {
    status: state.healthy ? 'healthy' : 'unhealthy',
    service,
    version,
    uptime_seconds: Math.floor((Date.now() - state.startedAt) / 1000),
    timestamp: new Date().toISOString(),
    environment: { node_version: process.version, platform: process.platform, ...extra },
    memory_mb: {
      rss: Math.round(memory.rss / 1024 / 1024),
      heap_used: Math.round(memory.heapUsed / 1024 / 1024),
    },
  };
}
