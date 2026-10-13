import dotenv from 'dotenv';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { ConfigError } from './config.js';
import type { HealthState } from './tools/health.js';
import type { Logger } from './utils/logger.js';
import { VERSION } from './version.js';

/** Minimal process surface, injectable for tests. */
export interface ProcessLike {
  env: Record<string, string | undefined>;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  exit(code?: number): void;
  stderr: { write(chunk: string): unknown };
}

/**
 * Load .env into the environment. `quiet` is essential: dotenv >= 17 prints
 * "injected env" to stdout by default, which corrupts the stdio JSON-RPC stream.
 */
export function loadEnv(options: { path?: string } = {}): void {
  dotenv.config({ quiet: true, ...options });
}

export function reportConfigError(proc: ProcessLike, error: unknown, envHint: string): void {
  const message = error instanceof Error ? error.message : String(error);
  proc.stderr.write(`Configuration error: ${message}\n`);
  if (error instanceof ConfigError) {
    proc.stderr.write(`${envHint}\nSee README.md for setup instructions.\n`);
  }
}

export interface StartOptions {
  server: McpServer;
  name: string;
  logger: Logger;
  health: HealthState;
  proc: ProcessLike;
  transport?: Transport;
  /** Force exit if graceful shutdown hangs (ms). */
  shutdownTimeoutMs?: number;
}

export interface RunningServer {
  shutdown(reason: string, code?: number): Promise<void>;
}

export async function startServer(options: StartOptions): Promise<RunningServer> {
  const { server, name, logger, health, proc } = options;
  const transport = options.transport ?? new StdioServerTransport();
  let shuttingDown = false;

  const shutdown = async (reason: string, code = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    health.healthy = false;
    logger.info(`Shutting down (${reason})`);
    const timer = setTimeout(() => {
      logger.warn('Forcing exit after shutdown timeout');
      proc.exit(1);
    }, options.shutdownTimeoutMs ?? 5000);
    timer.unref?.();
    try {
      await server.close();
    } catch (error) {
      logger.error('Error during shutdown', error);
      code = 1;
    }
    clearTimeout(timer);
    proc.exit(code);
  };

  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    proc.on(signal, () => void shutdown(signal));
  }
  proc.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    void shutdown('uncaughtException', 1);
  });
  proc.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason);
    void shutdown('unhandledRejection', 1);
  });

  await server.connect(transport);
  health.healthy = true;
  logger.info(`${name} v${VERSION} running on stdio`);
  return { shutdown };
}
