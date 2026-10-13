#!/usr/bin/env node
/**
 * Live integration check against the real LicenseSpring APIs.
 *
 * Spawns the built servers (run `npm run build` first) over stdio with the MCP SDK client and
 * calls read-only tools only. Servers whose credentials are missing are skipped.
 *
 *   LICENSE_API_KEY + LICENSE_SHARED_KEY (or LICENSE_CLIENT_ID + LICENSE_CLIENT_SECRET)
 *   MANAGEMENT_API_KEY
 */
import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

const dist = (file) => fileURLToPath(new URL(`../dist/${file}`, import.meta.url));

const suites = [
  {
    name: 'License API',
    entry: 'license-api-server.js',
    enabled: Boolean(
      (process.env.LICENSE_API_KEY && process.env.LICENSE_SHARED_KEY) ||
      (process.env.LICENSE_CLIENT_ID && process.env.LICENSE_CLIENT_SECRET),
    ),
    calls: [
      ['get_api_metadata', {}],
      ['list_products', {}],
    ],
  },
  {
    name: 'Management API',
    entry: 'management-api-server.js',
    enabled: Boolean(process.env.MANAGEMENT_API_KEY),
    calls: [
      ['list_products', { limit: 1 }],
      ['list_licenses', { limit: 1 }],
      ['list_customers', { limit: 1 }],
      ['list_orders', { limit: 1 }],
      ['list_license_users', { limit: 1 }],
      ['list_devices', { limit: 1 }],
      ['list_customer_accounts', { limit: 1 }],
      ['list_license_policies', { limit: 1 }],
      ['list_product_features', { limit: 1 }],
      ['list_activities', { limit: 1 }],
    ],
  },
];

let failures = 0;
for (const suite of suites) {
  if (!suite.enabled) {
    console.log(`- ${suite.name}: skipped (credentials not configured)`);
    continue;
  }
  const transport = new StdioClientTransport({ command: process.execPath, args: [dist(suite.entry)], env: process.env, stderr: 'inherit' });
  const client = new Client({ name: 'licensespring-integration', version: '1.0.0' });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    console.log(`- ${suite.name}: ${tools.length} tools`);
    for (const [name, args] of suite.calls) {
      const result = await client.callTool({ name, arguments: args });
      const text = result.content?.[0]?.text ?? '';
      if (result.isError) {
        failures++;
        console.log(`  ✗ ${name}: ${text}`);
      } else {
        console.log(`  ✓ ${name}`);
      }
    }
  } finally {
    await client.close();
  }
}

if (failures > 0) {
  console.error(`${failures} integration call(s) failed`);
  process.exit(1);
}
console.log('Integration checks passed');
