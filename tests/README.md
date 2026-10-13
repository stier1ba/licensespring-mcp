# Tests

| Suite | Command | What it covers | Needs |
|---|---|---|---|
| Unit | `npm test` / `npm run test:coverage` | Every tool, resource, prompt, client, config and runtime path, with mocked HTTP and an in-memory MCP client. 100% coverage is enforced. | Nothing |
| Smoke | `npm run test:smoke` | Spawns the built binaries over stdio and points them at a local mock HTTP server: checks stdout is pure JSON-RPC and the real wire format (HMAC headers, base64 offline body, multipart CSV, PATCH bulk body). | `npm run build` |
| Live integration | `npm run test:integration` | Calls the real LicenseSpring APIs and asserts success. Read-only unless `LS_INTEGRATION_WRITE=1`. | Credentials |

## Live integration environment

```bash
# License API (either pair)
LICENSE_API_KEY=...        LICENSE_SHARED_KEY=...
LICENSE_CLIENT_ID=...      LICENSE_CLIENT_SECRET=...
# Management API
MANAGEMENT_API_KEY=...
# Optional
LS_TEST_PRODUCT=my-product   # product short code (defaults to the first product)
LS_INTEGRATION_WRITE=1       # create → update → delete a test customer; create/disable/delete a test-order license
```

Suites without credentials are reported as skipped. Write tests label records with `mcp-it-<timestamp>` and delete them afterwards; test orders are created with `is_test: true`.
