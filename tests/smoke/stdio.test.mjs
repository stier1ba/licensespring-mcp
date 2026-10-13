// End-to-end smoke test for the built executables (run `npm run build` first).
//
// Spawns each binary over stdio with a real MCP client, points it at a local
// mock HTTP server, and checks the exact bytes that go over the wire. No real
// LicenseSpring credentials or network access are needed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dist = (file) => join(root, 'dist', file);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const requests = [];
let server;
let baseUrl;

before(async () => {
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString('utf8') });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, path: req.url }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

/** Isolated env: no inherited LicenseSpring variables, no .env from cwd. */
function env(extra) {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(LICENSE|MANAGEMENT)_/.test(k)));
  return { ...clean, LOG_LEVEL: 'error', ...extra };
}

async function connect(args, extraEnv) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args,
    env: env(extraEnv),
    cwd: dirname(fileURLToPath(import.meta.url)),
    stderr: 'pipe',
  });
  const protocolErrors = [];
  transport.onerror = (error) => protocolErrors.push(error);
  const client = new Client({ name: 'smoke', version: '1.0.0' });
  await client.connect(transport);
  return { client, protocolErrors };
}

function lastRequest(path) {
  const match = [...requests].reverse().find((r) => r.url.startsWith(path));
  assert.ok(match, `expected a request to ${path}`);
  return match;
}

test('license-api via index.js: HMAC-signed requests and base64 offline payloads', async () => {
  const { client, protocolErrors } = await connect([dist('index.js'), 'license-api'], {
    LICENSE_API_URL: baseUrl, LICENSE_API_KEY: 'smoke-key', LICENSE_SHARED_KEY: 'smoke-shared',
  });
  try {
    assert.equal(client.getServerVersion().name, 'licensespring-license-api');
    assert.equal(client.getServerVersion().version, pkg.version);
    const { tools } = await client.listTools();
    assert.equal(tools.length, 27);

    const check = await client.callTool({ name: 'check_license', arguments: { hardware_id: 'hw', product: 'p', license_key: 'K' } });
    assert.ok(!check.isError, JSON.stringify(check));
    const req = lastRequest('/api/v4/check_license');
    assert.equal(req.method, 'GET');
    assert.match(req.url, /hardware_id=hw/);
    assert.match(req.headers.date, /GMT$/);
    assert.match(req.headers.authorization, /^algorithm="hmac-sha256",headers="date",signature="[A-Za-z0-9+/=]+",apikey="smoke-key"$/);

    await client.callTool({ name: 'activate_offline', arguments: { hardware_id: 'hw', product: 'p', license_key: 'K' } });
    const offline = lastRequest('/api/v4/activate_offline');
    assert.equal(offline.headers['content-type'], 'text/plain');
    const payload = JSON.parse(Buffer.from(offline.body, 'base64').toString('utf8'));
    assert.equal(payload.request, 'activation');
    assert.equal(payload.api_key, 'smoke-key');
    assert.ok(payload.signature);

    await client.callTool({ name: 'add_consumption', arguments: { hardware_id: 'hw', product: 'p', license_key: 'K', consumptions: 2 } });
    const consumption = lastRequest('/api/v4/add_consumption');
    assert.match(consumption.headers['content-type'], /^application\/json/);
    assert.deepEqual(JSON.parse(consumption.body), { hardware_id: 'hw', product: 'p', license_key: 'K', consumptions: 2 });
  } finally {
    await client.close();
  }
  assert.deepEqual(protocolErrors, [], 'stdout must contain only JSON-RPC messages');
});

test('management-api binary: multipart CSV upload and PATCH bulk update', async () => {
  const { client, protocolErrors } = await connect([dist('management-api-server.js')], {
    MANAGEMENT_API_URL: baseUrl, MANAGEMENT_API_KEY: 'smoke-mgmt',
  });
  try {
    assert.equal((await client.listTools()).tools.length, 41);

    await client.callTool({ name: 'import_licenses_from_csv', arguments: { csv_content: 'license__license_key,product__short_code\nK,p\n' } });
    const upload = lastRequest('/api/v1/licenses/import_from_csv/');
    assert.equal(upload.headers.authorization, 'Api-Key smoke-mgmt');
    assert.match(upload.headers['content-type'], /^multipart\/form-data; boundary=/);
    assert.match(upload.body, /name="file"; filename="licenses.csv"/);
    assert.match(upload.body, /license__license_key,product__short_code/);

    await client.callTool({ name: 'bulk_update_licenses', arguments: { licenses: [{ id: 1, max_activations: 2 }] } });
    const bulk = lastRequest('/api/v1/licenses/bulk_update/');
    assert.equal(bulk.method, 'PATCH');
    assert.deepEqual(JSON.parse(bulk.body), [{ id: 1, max_activations: 2 }]);
  } finally {
    await client.close();
  }
  assert.deepEqual(protocolErrors, []);
});

test('license-api binary refuses to start without a shared key, writing nothing to stdout', async () => {
  const child = spawn(process.execPath, [dist('license-api-server.js')], { env: env({ LICENSE_API_KEY: 'only-key' }), stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  const code = await new Promise((resolve) => child.on('exit', resolve));
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /LICENSE_SHARED_KEY is required/);
});

test('index.js --version and --help', async () => {
  const run = (arg) => new Promise((resolve) => {
    const child = spawn(process.execPath, [dist('index.js'), arg], { env: env({}) });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('exit', (code) => resolve({ code, out }));
  });
  assert.deepEqual(await run('--version'), { code: 0, out: `${pkg.version}\n` });
  const help = await run('--help');
  assert.equal(help.code, 0);
  assert.match(help.out, /LICENSE_CLIENT_ID/);
});
