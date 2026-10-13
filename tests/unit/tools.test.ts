import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineTool, errorResult, pathWith, READ_ONLY, registerTools, successResult, ToolInputError } from '../../src/tools.js';
import { callTool, connect, resultText } from './helpers.js';

describe('tool helpers', () => {
  it('formats success results', () => {
    expect(successResult({ a: 1 })).toEqual({ content: [{ type: 'text', text: '{\n  "a": 1\n}' }] });
    expect(successResult('plain')).toEqual({ content: [{ type: 'text', text: 'plain' }] });
    for (const empty of [undefined, null, '']) {
      expect(JSON.parse(resultText(successResult(empty)))).toEqual({ success: true });
    }
  });

  it('formats error results', () => {
    expect(errorResult('Do Thing', new ToolInputError('bad input'))).toEqual({
      content: [{ type: 'text', text: 'Do Thing failed: bad input' }],
      isError: true,
    });
    expect(resultText(errorResult('Do Thing', { response: { status: 404, data: { detail: 'Not found.' } } }))).toBe('Do Thing failed: HTTP 404: Not found.');
  });

  it('substitutes and encodes path parameters', () => {
    expect(pathWith('/a/{id}/b/{name}/', { id: 5, name: 'x y/z' })).toBe('/a/5/b/x%20y%2Fz/');
  });

  it('registers tools that run and catch errors', async () => {
    const server = new McpServer({ name: 't', version: '1' });
    registerTools(server, [
      defineTool({ name: 'echo', title: 'Echo', description: 'Echo', inputSchema: { value: z.string() }, annotations: READ_ONLY, run: async ({ value }) => ({ value }) }),
      defineTool({ name: 'fail', title: 'Fail', description: 'Fail', inputSchema: {}, annotations: READ_ONLY, run: async () => { throw new ToolInputError('nope'); } }),
    ]);
    const client = await connect(server);
    expect(JSON.parse(resultText(await callTool(client, 'echo', { value: 'hi' })))).toEqual({ value: 'hi' });
    const failed = await callTool(client, 'fail');
    expect(failed).toMatchObject({ isError: true });
    expect(resultText(failed)).toBe('Fail failed: nope');
    const { tools } = await client.listTools();
    expect(tools[0].annotations).toEqual({ title: 'Echo', readOnlyHint: true, openWorldHint: true });
  });
});
