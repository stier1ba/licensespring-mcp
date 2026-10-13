import { z, type ZodRawShape } from 'zod';
import type { ApiClient } from '../../utils/http.js';
import { compact } from '../../utils/http.js';
import {
  defineTool,
  DESTRUCTIVE,
  IDEMPOTENT_WRITE,
  pathWith,
  READ_ONLY,
  ToolInputError,
  WRITE,
  type ToolDefinition,
} from '../../tools.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

export type Args = Record<string, unknown>;
export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export const id = (what: string) => z.number().int().positive().describe(`${what} ID`);
export const ids = (what: string) => z.array(id(what)).min(1);
export const optionalString = (description: string) => z.string().optional().describe(description);
export const optionalInt = (description: string) => z.number().int().optional().describe(description);
export const optionalBool = (description: string) => z.boolean().optional().describe(description);
export const date = (description: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected yyyy-mm-dd').optional().describe(description);
export const duration = (description: string) =>
  z.string().regex(/^\d+[dmy]$/, 'Expected a duration such as 35d, 4m or 2y').optional().describe(description);
/** License-level consumption period; LicenseSpring spells the yearly value "annualy" on these endpoints. */
export const licenseConsumptionPeriod = z
  .enum(['daily', 'weekly', 'monthly', 'annualy'])
  .optional()
  .describe('Consumption reset period (license endpoints spell the yearly value "annualy")');
/** Product feature and consumption pool endpoints document the yearly value as "annually". */
export const consumptionPeriod = z
  .enum(['daily', 'weekly', 'monthly', 'annually'])
  .optional()
  .describe('Consumption reset period');
export const metadata = z.record(z.string(), z.unknown()).optional().describe('Custom metadata (JSON object)');
export const hexColor = (description: string) =>
  z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB color').optional().describe(description);

export const filters = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .optional()
  .describe(
    'Additional filters passed as query parameters, using LicenseSpring filter syntax ' +
    '(e.g. {"customer_email__icontains": "acme", "metadata__plan": "\\"pro\\""}).',
  );

export interface ListOptions {
  orderBy?: boolean;
  paginated?: boolean;
  extra?: ZodRawShape;
}

function listShape({ orderBy, paginated = true, extra }: ListOptions): ZodRawShape {
  return {
    ...(paginated
      ? {
          limit: z.number().int().min(1).max(1000).optional().describe('Results per page (API default 20, max 1000)'),
          offset: z.number().int().min(0).optional().describe('Index of the first result'),
        }
      : {}),
    ...(orderBy ? { order_by: optionalString('Attribute to order by; prefix with "-" for descending (e.g. "-created_at")') } : {}),
    ...extra,
    filters,
  };
}

/** Flatten `filters` into the query alongside the explicit list parameters. */
export function listQuery(args: Args): Args {
  const { filters: extra, ...rest } = args;
  return { ...((extra as Args | undefined) ?? {}), ...rest };
}

export function requireOneOf(args: Args, keys: string[]): void {
  if (!keys.some((key) => args[key] !== undefined)) {
    throw new ToolInputError(`Provide ${keys.join(' or ')}`);
  }
}

interface Base {
  name: string;
  title: string;
  description: string;
}

/** Builders for the common Management API endpoint shapes. */
export function builders(client: ApiClient) {
  const call = (method: Method, path: string, extra: { query?: Args; body?: unknown; headers?: Record<string, string> } = {}) =>
    client.request({ method, path: `/api/v1${path}`, ...extra });

  const at = (path: string, value: unknown) => pathWith(path, { id: value as number });

  return {
    call,

    /** GET a collection with pagination and filters. Paths may contain `{id}` (taken from `parent`). */
    list: (base: Base & { path: string; parent?: string } & ListOptions): ToolDefinition =>
      defineTool({
        ...base,
        inputSchema: { ...(base.parent ? { id: id(base.parent) } : {}), ...listShape(base) },
        annotations: READ_ONLY,
        run: async ({ id: value, ...args }) =>
          call('GET', base.parent ? at(base.path, value) : base.path, { query: listQuery(args) }),
      }),

    /** GET a single resource by ID. */
    retrieve: (base: Base & { path: string; what: string }): ToolDefinition =>
      defineTool({
        ...base,
        inputSchema: { id: id(base.what) },
        annotations: READ_ONLY,
        run: async ({ id: value }) => call('GET', at(base.path, value)),
      }),

    /** GET with an explicit query schema (exports, aggregates). */
    query: (base: Base & { path: string; shape: ZodRawShape; validate?: (args: Args) => void }): ToolDefinition =>
      defineTool({
        ...base,
        inputSchema: base.shape,
        annotations: READ_ONLY,
        run: async (query) => {
          base.validate?.(query);
          return call('GET', base.path, { query });
        },
      }),

    /** POST a JSON body built from the arguments. */
    create: (base: Base & { path: string; shape: ZodRawShape; annotations?: ToolAnnotations }): ToolDefinition =>
      defineTool({
        ...base,
        inputSchema: base.shape,
        annotations: base.annotations ?? WRITE,
        run: async (args) => call('POST', base.path, { body: compact(args) }),
      }),

    /** PATCH a resource by ID with the remaining arguments. */
    update: (base: Base & { path: string; what: string; shape: ZodRawShape; validate?: (args: Args) => void }): ToolDefinition =>
      defineTool({
        ...base,
        inputSchema: { id: id(base.what), ...base.shape },
        annotations: IDEMPOTENT_WRITE,
        run: async ({ id: value, ...update }) => {
          base.validate?.(update);
          return call('PATCH', at(base.path, value), { body: compact(update) });
        },
      }),

    /** POST/DELETE/GET on a resource by ID, optionally with a JSON body from the remaining arguments. */
    action: (
      base: Base & {
        path: string;
        what: string;
        /** Argument holding the path ID (default `id`). */
        idKey?: string;
        method?: 'POST' | 'DELETE' | 'GET';
        shape?: ZodRawShape;
        annotations?: ToolAnnotations;
        body?: (args: Args) => unknown;
        validate?: (args: Args) => void;
      },
    ): ToolDefinition => {
      const idKey = base.idKey ?? 'id';
      return defineTool({
        ...base,
        inputSchema: { [idKey]: id(base.what), ...base.shape },
        annotations: base.annotations ?? (base.method === 'GET' ? READ_ONLY : DESTRUCTIVE),
        run: async ({ [idKey]: value, ...args }) => {
          base.validate?.(args);
          const body = base.body ? base.body(args) : base.shape ? compact(args) : undefined;
          return call(base.method ?? 'POST', at(base.path, value), body === undefined ? {} : { body });
        },
      });
    },

    /** DELETE a resource by ID. */
    remove: (base: Base & { path: string; what: string }): ToolDefinition =>
      defineTool({
        ...base,
        inputSchema: { id: id(base.what) },
        annotations: DESTRUCTIVE,
        run: async ({ id: value }) => call('DELETE', at(base.path, value)),
      }),

    /** POST a CSV document as a multipart/form-data `file` field. */
    upload: (base: Base & { path: string; defaultFileName: string }): ToolDefinition =>
      defineTool({
        ...base,
        inputSchema: {
          csv_content: z.string().min(1).describe('Raw CSV text including the header row'),
          file_name: z.string().optional().describe(`File name reported to LicenseSpring (default ${base.defaultFileName})`),
        },
        annotations: WRITE,
        run: async ({ csv_content, file_name }) => {
          const form = new FormData();
          form.append('file', new Blob([csv_content as string], { type: 'text/csv' }), (file_name as string | undefined) ?? base.defaultFileName);
          return call('POST', base.path, { body: form, headers: { 'Content-Type': 'multipart/form-data' } });
        },
      }),
  };
}

export type Builders = ReturnType<typeof builders>;
