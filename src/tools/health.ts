import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { VERSION } from '../version.js';

export interface HealthState {
  startedAt: number;
  healthy: boolean;
}

export function createHealthState(now: () => number = Date.now): HealthState {
  return { startedAt: now(), healthy: true };
}

export function registerHealthResource(
  server: McpServer,
  service: string,
  state: HealthState,
  details: Record<string, unknown>,
  now: () => number = Date.now,
): void {
  server.registerResource(
    'health',
    'licensespring://health',
    { title: 'Health Check', description: 'Service health status and metrics', mimeType: 'application/json' },
    async (uri) => {
      const memory = process.memoryUsage();
      const body = {
        status: state.healthy ? 'healthy' : 'unhealthy',
        service,
        version: VERSION,
        uptime: Math.floor((now() - state.startedAt) / 1000),
        timestamp: new Date(now()).toISOString(),
        environment: { node_version: process.version, platform: process.platform, ...details },
        memory_mb: {
          rss: Math.round(memory.rss / 1024 / 1024),
          heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        },
      };
      return { contents: [{ uri: uri.toString(), mimeType: 'application/json', text: JSON.stringify(body, null, 2) }] };
    },
  );
}
