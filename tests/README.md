# Tests

## Unit tests (`tests/unit`)

```bash
npm test               # run once
npm run test:coverage  # with the 100% coverage threshold enforced in CI
```

- **Tools**: `license-tools.test.ts` and `management-tools.test.ts` call every tool through a real MCP client connected over an in-memory transport. HTTP is mocked at the axios adapter (`helpers.ts` → `mockAxios`), so each test asserts the exact method, path, query string, body, signing headers and error handling. A guard test fails if a Management API tool has no request test.
- **Servers**: `servers.test.ts` covers resources, prompts and the start-up paths, including configuration and transport errors.
- **Utilities**: `auth.test.ts` (includes the signature example from the LicenseSpring docs), `oauth.test.ts`, `http.test.ts`, `retry.test.ts`, `config.test.ts`, `logger.test.ts`, `runtime.test.ts`, `tools.test.ts`, `cli.test.ts`.

No network access or credentials are needed.

## Live integration check (`tests/integration.mjs`)

```bash
npm run test:integration
```

Builds the project, spawns each server over stdio and calls read-only tools (`get_api_metadata`, `list_products`, `list_licenses`, …) against the real APIs. A server is skipped when its credentials are missing:

- License API: `LICENSE_API_KEY` + `LICENSE_SHARED_KEY`, or `LICENSE_CLIENT_ID` + `LICENSE_CLIENT_SECRET`
- Management API: `MANAGEMENT_API_KEY`

The script never creates, modifies or deletes data.
