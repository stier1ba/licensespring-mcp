# LicenseSpring® MCP Server

[Model Context Protocol](https://modelcontextprotocol.io) servers for the [LicenseSpring](https://licensespring.com) **License API** and **Management API**. They let Claude and other MCP clients activate and check licenses, track consumption, manage floating and offline licenses, and administer orders, customers, users and devices.

Two servers ship in one package so you can grant only the access you need:

| Server | Binary | API | Tools |
|---|---|---|---|
| License API | `licensespring-mcp-license` | `https://api.licensespring.com/api/v4` | 27 |
| Management API | `licensespring-mcp-management` | `https://saas.licensespring.com/api/v1` | 41 |

Synced against the LicenseSpring documentation as of **October 2026**. See [docs/API_COVERAGE.md](docs/API_COVERAGE.md) for the full tool → endpoint map.

## Requirements

- Node.js **22.14+** (or Docker)
- LicenseSpring credentials from the portal under **Settings → Keys**

## Configuration

### License API — choose one authentication method

| Method | Variables | Notes |
|---|---|---|
| API key + shared key | `LICENSE_API_KEY`, `LICENSE_SHARED_KEY` | Every request is HMAC-signed. **Both are required** — LicenseSpring rejects unsigned requests (`hmac_required`). |
| OAuth client credentials | `LICENSE_CLIENT_ID`, `LICENSE_CLIENT_SECRET` | Tokens are fetched from LicenseSpring's Keycloak and refreshed automatically. Takes precedence when set. Override the token endpoint with `LICENSE_OAUTH_TOKEN_URL`. |

Optional: `LICENSE_API_URL` (default `https://api.licensespring.com`).

The License API rejects requests whose `Date` header is more than 15 minutes off, so keep the host clock in sync.

### Management API

| Variable | Notes |
|---|---|
| `MANAGEMENT_API_KEY` | The **Management API key** — the License API key/shared key do not work here. |
| `MANAGEMENT_API_URL` | Optional, default `https://saas.licensespring.com` |

### Logging

Logs are JSON lines on **stderr** (stdout carries the MCP protocol). Set `LOG_LEVEL` to `error`, `warn` (default), `info` or `debug`.

## Usage with Claude Desktop

```json
{
  "mcpServers": {
    "licensespring-license": {
      "command": "npx",
      "args": ["-y", "-p", "@tfedorko/licensespring-mcp-server", "licensespring-mcp-license"],
      "env": {
        "LICENSE_API_KEY": "your_api_key",
        "LICENSE_SHARED_KEY": "your_shared_key"
      }
    },
    "licensespring-management": {
      "command": "npx",
      "args": ["-y", "-p", "@tfedorko/licensespring-mcp-server", "licensespring-mcp-management"],
      "env": {
        "MANAGEMENT_API_KEY": "your_management_api_key"
      }
    }
  }
}
```

Using Claude Code:

```bash
claude mcp add licensespring-license \
  -e LICENSE_API_KEY=... -e LICENSE_SHARED_KEY=... \
  -- npx -y -p @tfedorko/licensespring-mcp-server licensespring-mcp-license
```

### Docker

```bash
docker build -t licensespring-mcp .                                   # License API
docker build -f Dockerfile.management -t licensespring-mcp-management .
docker run -i --rm --env-file .env licensespring-mcp
```

## Tools

Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`) so clients can ask for confirmation before destructive calls. API failures come back as tool results with `isError: true` and LicenseSpring's error code, e.g. `HTTP 400 (license_not_found): License not found`.

### License API

Key-based licenses are identified by `license_key`; user-based licenses by `username` (plus `password` where the API requires it). Activation also supports SSO (`id_token` or `code` + `customer_account_code`).

| Area | Tools |
|---|---|
| Activation | `activate_license`, `check_license`, `deactivate_license` |
| Offline (air-gapped) | `activate_offline`, `deactivate_offline` — payloads are signed and base64-encoded as the API requires |
| Bundles | `activate_bundle`, `check_bundle`, `deactivate_bundle` |
| Features & consumption | `check_license_feature`, `add_consumption`, `add_feature_consumption` |
| Floating | `floating_borrow`, `floating_release`, `floating_feature_borrow`, `floating_feature_release` |
| Trials & products | `get_trial_key`, `get_product_details`, `list_products` |
| License lookup | `get_user_licenses`, `get_device_licenses`, `get_customer_license_users` |
| Device variables | `track_device_variables`, `get_device_variables` |
| Distribution | `get_versions`, `get_installation_file` |
| Users & SSO | `change_password`, `get_sso_url` |

Resources: `licensespring://health`, `licensespring://product/{product}/details`. Prompts: `license-troubleshooting`, `trial-onboarding`.

### Management API

List tools accept `limit` (≤1000), `offset`, `order_by` (prefix `-` for descending), documented filters, and `extra_filters` for anything else (e.g. `{"metadata__plan": "pro"}`). Responses are `{count, next, previous, results}`.

| Area | Tools |
|---|---|
| Licenses | `list_licenses`, `get_license`, `update_license`, `enable_license`, `disable_license`, `reset_license`, `delete_license` |
| Bulk | `bulk_update_licenses`, `bulk_disable_licenses`, `import_licenses_from_csv`, `get_license_import_result` |
| License config | `update_license_features`, `apply_license_policy`, `list_license_activation_history` |
| License users on a license | `assign_user_to_license`, `unassign_user_from_license`, `set_user_activations` |
| Orders | `create_order` (this is how licenses are created), `list_orders`, `get_order`, `generate_license_keys` |
| Customers | `list_customers`, `get_customer`, `create_customer`, `update_customer`, `delete_customer` |
| License users | `list_license_users`, `get_license_user`, `create_license_user`, `update_license_user`, `delete_license_user`, `set_license_user_password` |
| Devices | `list_devices`, `get_device`, `reset_device`, `blacklist_device`, `whitelist_device` |
| Products | `list_products`, `get_product`, `list_product_features`, `list_license_policies` |

Resources: `licensespring://health`, `licensespring://management/{licenses,customers,products}`. Prompts: `license-management-workflow`, `customer-analysis`.

Documented API rules are enforced before any request is sent — for example `update_license` requires `is_trial` whenever validity changes, `enable_maintenance_period` with `maintenance_duration`, and rejects `validity_period` together with `valid_duration`.

## Development

```bash
npm install
npm run build
npm run lint
npm test                 # unit tests (Jest, mocked HTTP + in-memory MCP client)
npm run test:coverage    # same, with a 100% statement/branch/function/line threshold
npm run test:smoke       # spawns the built binaries over stdio against a local mock HTTP server
npm run test:integration # live API tests; skipped unless credentials are set (see tests/README.md)
npm run test:all         # lint + coverage + build + smoke
```

Project layout:

```
src/
  config.ts                 env → typed config (HMAC or OAuth)
  license-api/server.ts     License API tools, resources, prompts
  management-api/server.ts  Management API tools, resources, prompts
  utils/http.ts             API clients (signing, OAuth tokens, GET retries, errors)
  utils/auth.ts             HMAC request + offline payload signatures
  runtime.ts / main.ts      stdio transport, graceful shutdown, startup
  cli.ts / index.ts         CLI entry point
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `LICENSE_SHARED_KEY is required with LICENSE_API_KEY` | Add the shared key from Settings → Keys, or switch to OAuth. |
| `HTTP 401 (signature_mismatch)` | Wrong shared key, or the key pair belongs to a different company. |
| `HTTP 400 (date_header_diff)` | Host clock is more than 15 minutes off; sync NTP. |
| `HTTP 401 (oauth_required)` | Your company enforces OAuth; set `LICENSE_CLIENT_ID`/`LICENSE_CLIENT_SECRET`. |
| `HTTP 429` | LicenseSpring rate limit. Read-only GETs are retried with backoff; writes (and `get_trial_key`, which creates a license) are not. |
| Management API `401`/`403` | Use the Management API key, not the License API key. |

## Upgrading from 2.x

3.0 is a breaking release; see [CHANGELOG.md](CHANGELOG.md) once published and [docs/API_COVERAGE.md](docs/API_COVERAGE.md#changes-from-2x). Highlights:

- `LICENSE_SHARED_KEY` is now required with `LICENSE_API_KEY` (API-key-only requests never worked against the real API). OAuth is supported as an alternative.
- `create_license` is replaced by `create_order`; licenses are created through orders.
- Fixed request formats for `bulk_update_licenses` (PATCH, list body), `bulk_disable_licenses`, `set_user_activations`, `import_licenses_from_csv` (multipart `csv_content`), `activate_offline`/`deactivate_offline` (signed base64 payload).
- `update_license` no longer accepts `enabled`; use `enable_license`/`disable_license`. `validity_period` is a `YYYY-MM-DD` date.
- Filters renamed to the documented names (`company_name__icontains`, `true_email__icontains`, …).
- `activate_license`/`activate_offline` no longer send the undocumented `quantity` parameter.

## License

MIT — see [LICENSE](LICENSE). LicenseSpring® is a trademark of its respective owner; see [TRADEMARK](TRADEMARK). This project is not affiliated with LicenseSpring.
