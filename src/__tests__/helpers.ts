import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface RecordedCall {
  method: string;
  url: string;
  baseURL?: string;
  params: Record<string, string>;
  headers: Record<string, string>;
  /** Parsed JSON body when possible, otherwise the raw body. */
  body: unknown;
  rawBody: unknown;
}

export interface MockReply {
  status?: number;
  data?: unknown;
}

export type MockHandler = (call: RecordedCall) => MockReply | Promise<MockReply>;

/**
 * Axios adapter that records requests and replies from a handler queue.
 * Error statuses reject with a real AxiosError, exactly like the HTTP adapter.
 */
export function createMockAdapter(defaultReply: MockReply = { status: 200, data: { ok: true } }) {
  const calls: RecordedCall[] = [];
  const queue: Array<MockHandler | MockReply> = [];

  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const params = config.params instanceof URLSearchParams
      ? Object.fromEntries(config.params.entries())
      : { ...(config.params ?? {}) };
    const headers = Object.fromEntries(
      Object.entries(AxiosHeaders.from(config.headers).toJSON()).map(([k, v]) => [k, String(v)]),
    );
    let body: unknown = config.data;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { /* keep raw text */ }
    }
    const call: RecordedCall = {
      method: (config.method ?? 'get').toUpperCase(),
      url: config.url ?? '',
      baseURL: config.baseURL,
      params,
      headers,
      body,
      rawBody: config.data,
    };
    calls.push(call);

    const next = queue.shift() ?? defaultReply;
    if (next instanceof Error) throw next;
    const reply = typeof next === 'function' ? await next(call) : next;
    const status = reply.status ?? 200;
    const response: AxiosResponse = {
      data: reply.data,
      status,
      statusText: String(status),
      headers: {},
      config,
    };
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_RESPONSE, config, {}, response);
    }
    return response;
  };

  return {
    adapter,
    calls,
    /** Queue replies (or handlers / Errors) for the next requests, in order. */
    reply(...replies: Array<MockHandler | MockReply | Error>) {
      queue.push(...(replies as Array<MockHandler | MockReply>));
    },
    last(): RecordedCall {
      const call = calls[calls.length - 1];
      if (!call) throw new Error('No requests recorded');
      return call;
    },
  };
}

/** A network-level failure (request sent, no response). */
export function networkError(code = 'ECONNRESET'): AxiosError {
  const error = new AxiosError('socket hang up', code);
  error.request = {};
  return error;
}

export async function connect(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

export async function callTool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
  return (await client.callTool({ name, arguments: args })) as CallToolResult;
}

export function text(result: CallToolResult): string {
  const [first] = result.content;
  if (!first || first.type !== 'text') throw new Error('Expected text content');
  return first.text;
}

export const FIXED_DATE = new Date('2026-10-14T09:00:00.000Z');
export const FIXED_HTTP_DATE = 'Wed, 14 Oct 2026 09:00:00 GMT';
