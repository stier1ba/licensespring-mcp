# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LicenseSpring MCP Server: two stdio MCP servers for the LicenseSpring APIs.
- **License API server** (`/api/v4`, 30 tools): activation, checks, consumption, floating, offline activation, trials.
- **Management API server** (`/api/v1`, 173 tools): every documented endpoint, grouped into toolsets (`MANAGEMENT_TOOLSETS`).

`docs/API_COVERAGE.md` maps every tool to its endpoint and LicenseSpring docs page. Keep it in sync when tools change. LicenseSpring docs are available as Markdown by appending `.md` to any docs.licensespring.com URL (index: https://docs.licensespring.com/llms.txt).

## Development Commands

```bash
npm run build            # Compile TypeScript to dist/
npm run lint             # ESLint (src, tests/unit)
npm run typecheck        # tsc including tests (tsconfig.test.json)
npm test                 # Vitest unit tests (mocked HTTP)
npm run test:coverage    # Unit tests with 100% coverage thresholds (enforced in CI)
npm run test:integration # Build, then read-only checks against the live APIs (needs credentials)
npm run dev -- --help    # Run the CLI from source
```

## Architecture

- `src/index.ts` → `src/cli.ts`: CLI router (`license-api` default, `management-api`, `--help`, `--version`); starts servers in-process.
- `src/license-api-server.ts`, `src/management-api-server.ts`: thin bin entry points.
- `src/license-api/{server,tools}.ts`: License API server factory and tool definitions.
- `src/management-api/server.ts` + `src/management-api/tools/*.ts`: one module per toolset; `tools/shared.ts` has the list/retrieve/create/update/action/remove/upload builders; `tools/index.ts` maps toolset names (keep in sync with `MANAGEMENT_TOOLSET_NAMES` in `src/config.ts`).
- `src/tools.ts`: `defineTool`/`registerTools`/`selectTools` (read-only filter), MCP annotation presets, result/error formatting, `ToolInputError`.
- `src/config.ts`: environment parsing (`ConfigError` on invalid config).
- `src/runtime.ts`: stdio transport, graceful shutdown, health payload.
- `src/utils/http.ts`: `LicenseApiClient` (HMAC or OAuth bearer signing, offline payload builder) and `ManagementApiClient` (`Api-Key`), query building, retries, `handleApiError`.
- `src/utils/auth.ts`: request and offline signatures. `src/utils/oauth.ts`: client-credentials token cache. `src/utils/retry.ts`, `src/utils/logger.ts`.

Rules:
- Never write to stdout from server code. stdout carries the MCP protocol, so logs go to stderr via `Logger`.
- License API key auth requires `LICENSE_SHARED_KEY` (requests are HMAC-signed). OAuth (`LICENSE_CLIENT_ID`/`LICENSE_CLIENT_SECRET`) is the alternative.
- Only GET requests are retried on network/5xx errors. 429 is retried for every method.
- New tools need a docs-backed method/path/body, a row in `docs/API_COVERAGE.md`, and test cases in `tests/unit/*-tools.test.ts`.

## Testing

- Unit tests live in `tests/unit/` (Vitest). Tools are exercised through a real MCP `Client` over `InMemoryTransport`, with axios mocked at the adapter level (`tests/unit/helpers.ts` → `mockAxios`), so signing, URLs and bodies are asserted.
- Coverage must stay at 100% (lines, branches, functions, statements).
- `tests/integration.mjs` runs read-only calls against the real APIs using credentials from the environment.

## Release

semantic-release driven by Conventional Commits (`.releaserc.json`, `.github/workflows/semantic-release.yml`). The version is read from `package.json` at runtime, so there are no hardcoded version strings.

## Environment

Node.js ≥ 22.12. TypeScript (NodeNext modules, strict), `@modelcontextprotocol/sdk` 1.x, zod 4, axios, dotenv (loaded with `quiet: true`).
