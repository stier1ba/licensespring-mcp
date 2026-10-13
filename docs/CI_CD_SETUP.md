# CI/CD Setup

## Workflows

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Push to `main`/`master`/`develop`, pull requests | Lint, typecheck, unit tests with 100% coverage, build on Node 22.x and 24.x; read-only live integration checks when secrets exist; production dependency audit |
| `.github/workflows/semantic-release.yml` | Push to release branches, manual dispatch | Same quality gates, then semantic-release (version bump, changelog, GitHub release, npm publish) |

## Repository secrets

| Secret | Required for |
| --- | --- |
| `LICENSE_API_KEY` + `LICENSE_SHARED_KEY` | License API integration checks (API key auth; both are required) |
| `LICENSE_CLIENT_ID` + `LICENSE_CLIENT_SECRET` | License API integration checks with OAuth (alternative) |
| `MANAGEMENT_API_KEY` | Management API integration checks |
| `NPM_TOKEN` | Publishing to npm |
| `CODECOV_TOKEN` | Coverage upload (optional) |

Integration checks only call read-only tools and are skipped when the credentials are absent.

## Running the same checks locally

```bash
npm ci
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:integration   # optional, needs credentials in .env
```
