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

/**
 * Describe a credential's shape without revealing it, to diagnose misconfigured secrets.
 * Management API keys look like the documented example `h8ZTleS1.OyCHhCST5c8K9A6gjV9wA1HLxWpUVSFv`.
 */
function describeKey(name, raw = '') {
  const trimmed = raw.trim();
  const quoted = /^(['"]).*\1$/.test(trimmed);
  const unquoted = quoted ? trimmed.slice(1, -1).trim() : trimmed;
  const prefixed = /^api-key\s+/i.test(unquoted);
  const key = unquoted.replace(/^api-key\s+/i, '');
  const notes = [`${key.length} chars after normalization`];
  notes.push(/^[A-Za-z0-9]{8}\.[A-Za-z0-9]{32}$/.test(key) ? 'matches the <8>.<32> key format' : 'does NOT match the <8>.<32> key format');
  if (prefixed) notes.push('had an "Api-Key " prefix (stripped by the server)');
  if (quoted) notes.push('was wrapped in quotes (stripped by the server)');
  if (/\s/.test(key)) notes.push('contains whitespace');
  return `${name}: ${notes.join(', ')}`;
}

let failures = 0;
let rejected = 0;
for (const suite of suites) {
  if (!suite.enabled) {
    console.log(`- ${suite.name}: skipped (credentials not configured)`);
    continue;
  }
  if (suite.name === 'Management API') console.log(`  ${describeKey('MANAGEMENT_API_KEY', process.env.MANAGEMENT_API_KEY)}`);
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
        if (text.includes('HTTP 403')) rejected++;
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
  if (rejected > 0) console.error(
    'A 403 "Authentication credentials were not provided." on every Management API call means the key was rejected: ' +
    'LicenseSpring returns it for invalid, revoked or mistyped keys as well as missing ones. Check the key under Settings > Keys.',
  );
  process.exit(1);
}
console.log('Integration checks passed');
