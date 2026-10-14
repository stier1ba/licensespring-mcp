import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { handleApiError, type ApiName } from '../utils/http.js';
import type { Logger } from '../utils/logger.js';

export function formatData(data: unknown): string {
  if (data === undefined || data === null || data === '') return 'Success (no content returned)';
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

export function successResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: formatData(data) }] };
}

export function errorResult(action: string, error: unknown, api: ApiName): CallToolResult {
  return {
    content: [{ type: 'text', text: `Error ${action}: ${handleApiError(error, api)}` }],
    isError: true,
  };
}

/**
 * Build a runner that executes an API call and converts the outcome into an
 * MCP tool result. API failures become `isError` results instead of thrown
 * protocol errors, so the model can see and react to them.
 */
export function createRunner(api: ApiName, logger?: Logger) {
  return async function run(action: string, fn: () => Promise<unknown>): Promise<CallToolResult> {
    try {
      return successResult(await fn());
    } catch (error) {
      logger?.warn(`Tool failed while ${action}`, { error: handleApiError(error, api) });
      return errorResult(action, error, api);
    }
  };
}

export type Runner = ReturnType<typeof createRunner>;

export const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;
export const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: true } as const;
export const IDEMPOTENT_WRITE = { ...WRITE, idempotentHint: true } as const;
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: true } as const;
