# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

MCP servers for the LicenseSpring **License API** (`/api/v4`, 27 tools) and **Management API** (`/api/v1`, 41 tools). TypeScript, ESM, `@modelcontextprotocol/sdk` 1.32, zod 4, axios. Node ≥ 22.14.

## Commands

```bash
npm run build            # tsc → dist/
npm run lint             # eslint (no-console is an error: stdout is the MCP channel)
npm test                 # Jest (ESM via --experimental-vm-modules)
npm run test:coverage    # enforces 100% statements/branches/functions/lines
npm run test:smoke       # node --test: spawns dist binaries over stdio + local mock HTTP server
npm run test:integration # live API; skips without credentials
npm run test:all         # lint + coverage + build + smoke — run before pushing
```

## Architecture

- `src/config.ts` — env → `LicenseApiConfig` (HMAC `apiKey+sharedKey`, or OAuth `clientId+clientSecret`) / `ManagementApiConfig`.
- `src/utils/http.ts` — `LicenseApiClient` (Date + HMAC or Bearer; OAuth token cache/refresh; `postText` for offline) and `ManagementApiClient` (`Api-Key`; `postMultipart`). GETs retry on 429/5xx/network; writes never retry. `handleApiError` formats `HTTP <status> (<code>): <message>`.
- `src/utils/auth.ts` — request signature and offline payload signature.
- `src/license-api/server.ts`, `src/management-api/server.ts` — `create*Server(client, options)` factories registering tools/resources/prompts. Tools call `run(label, fn)` from `src/tools/result.ts`, which turns thrown errors into `isError` results. Input rules the API documents are enforced with `ValidationError` before any request.
- `src/license-api/identity.ts` — `license_key` | `username(+password)` | SSO identity validation.
- `src/runtime.ts` / `src/main.ts` — stdio transport, signal handling, startup; injectable `ProcessLike` for tests.
- `src/index.ts`, `src/*-server.ts` — 2-line bin wrappers (excluded from Jest coverage, covered by smoke tests).

## Rules

- Never write to stdout from server code. Use the `Logger` (stderr). Load dotenv only via `loadEnv()` (`quiet: true`).
- Every new tool needs: annotations, a request-mapping test case in the matching `server.test.ts` table, and an entry in `docs/API_COVERAGE.md` and the README.
- Verify endpoint contracts against https://docs.licensespring.com (append `.md` to a page URL for raw markdown) before changing them.
- Tests mock HTTP with `createMockAdapter()` (`src/__tests__/helpers.ts`) and connect with the SDK's `InMemoryTransport`; don't hit the network in unit tests.
- Conventional commits drive semantic-release (`feat!:`/`BREAKING CHANGE:` → major).
