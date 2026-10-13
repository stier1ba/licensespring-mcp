import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { z, ZodRawShape } from 'zod';
import { handleApiError } from './utils/http.js';

/** Raised for input combinations a JSON schema cannot express (e.g. "one of these fields"). */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

export interface ToolDefinition<S extends ZodRawShape = ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: S;
  annotations: ToolAnnotations;
  run: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>;
}

/** Type-erase a tool definition so tools with different schemas can share one array. */
export function defineTool<S extends ZodRawShape>(definition: ToolDefinition<S>): ToolDefinition {
  return definition as unknown as ToolDefinition;
}

export const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: true };
export const WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
export const IDEMPOTENT_WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true };
export const DESTRUCTIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true };

export function successResult(data: unknown): CallToolResult {
  const payload = data === undefined || data === null || data === '' ? { success: true } : data;
  return { content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) }] };
}

export function errorResult(title: string, error: unknown): CallToolResult {
  const message = error instanceof ToolInputError ? error.message : handleApiError(error);
  return { content: [{ type: 'text', text: `${title} failed: ${message}` }], isError: true };
}

/** Keep only tools annotated as read-only when `readOnly` is set. */
export function selectTools(tools: ToolDefinition[], readOnly = false): ToolDefinition[] {
  return readOnly ? tools.filter((tool) => tool.annotations.readOnlyHint === true) : tools;
}

export function registerTools(server: McpServer, tools: ToolDefinition[]): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { title: tool.title, ...tool.annotations },
      },
      async (args: Record<string, unknown>) => {
        try {
          return successResult(await tool.run(args));
        } catch (error) {
          return errorResult(tool.title, error);
        }
      },
    );
  }
}

/** Substitute `{name}` placeholders in a path with URL-encoded values. */
export function pathWith(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => encodeURIComponent(String(params[key])));
}
