import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Logger, LogLevel } from '../../src/utils/logger.js';

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  data: unknown;
}

export type MockResponder = (request: RecordedRequest) => { status?: number; data?: unknown } | Promise<{ status?: number; data?: unknown }>;

/**
 * Axios instance whose adapter records every request (after interceptors) and answers with
 * `responder`. Non-2xx statuses reject with a real AxiosError, like the HTTP adapter would.
 */
export function mockAxios(responder: MockResponder = () => ({ data: { ok: true } })): {
  http: AxiosInstance;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const http = axios.create({
    baseURL: 'https://api.test',
    adapter: async (config: InternalAxiosRequestConfig) => {
      const recorded: RecordedRequest = {
        method: (config.method ?? 'get').toUpperCase(),
        url: config.url ?? '',
        headers: Object.fromEntries(Object.entries(config.headers.toJSON()).map(([k, v]) => [k, String(v)])),
        data: typeof config.data === 'string' && config.headers['Content-Type'] === 'application/json'
          ? JSON.parse(config.data)
          : config.data,
      };
      requests.push(recorded);
      const { status = 200, data } = await responder(recorded);
      const response = { data, status, statusText: String(status), headers: {}, config, request: {} };
      if (status >= 400) {
        throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, {}, response);
      }
      return response;
    },
  });
  return { http, requests };
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

export function resultText(result: CallToolResult): string {
  const [first] = result.content;
  return first.type === 'text' ? first.text : '';
}

export function silentLogger(): Logger {
  return new Logger('test', LogLevel.ERROR, false, () => {});
}

export function decodeOffline(body: unknown): Record<string, unknown> {
  return JSON.parse(Buffer.from(String(body), 'base64').toString('utf8')) as Record<string, unknown>;
}
