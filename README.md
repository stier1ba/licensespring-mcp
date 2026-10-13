# LicenseSpring® MCP Server

[Model Context Protocol](https://modelcontextprotocol.io) servers for the [LicenseSpring](https://licensespring.com) APIs. They let Claude and other MCP clients activate and check licenses, manage orders, customers, license users and devices, and investigate license issues.

The package ships two stdio servers:

| Server | API | Typical use |
| --- | --- | --- |
| `license-api` | [License API](https://docs.licensespring.com/license-api) (`/api/v4`) | Client-side operations: activation, checks, consumption, floating, trials, offline activation |
| `management-api` | [Management API](https://docs.licensespring.com/management-api) (`/api/v1`) | Back-office operations: every documented endpoint for orders, licenses, customers, license users, products, devices, consumption pools, OAuth clients and analytics |

Every tool, its HTTP endpoint and the matching LicenseSpring documentation page are listed in [docs/API_COVERAGE.md](docs/API_COVERAGE.md).

## Requirements

- Node.js 22.12 or later
- LicenseSpring credentials from the vendor platform under **Settings → Keys**

## Configuration

### License API server

The License API accepts two authorization methods ([docs](https://docs.licensespring.com/license-api/license-api-authorization)):

| Method | Variables | Notes |
| --- | --- | --- |
| API key | `LICENSE_API_KEY` **and** `LICENSE_SHARED_KEY` | Each request is HMAC-SHA256 signed with the shared key. Unsigned API key requests are rejected with `hmac_required`, so both values are required. |
| OAuth | `LICENSE_CLIENT_ID` **and** `LICENSE_CLIENT_SECRET` | Client-credentials tokens are fetched from `auth.licensespring.com`, cached, and refreshed before they expire. Takes precedence when set. |

Offline activation tools sign their payload with the shared key (API key method) or client secret (OAuth).

### Management API server

| Variable | Description |
| --- | --- |
| `MANAGEMENT_API_KEY` | Management API key, sent as `Authorization: Api-Key …` |

### Optional settings

| Variable | Default | Description |
| --- | --- | --- |
| `LICENSE_API_URL` | `https://api.licensespring.com` | License API base URL |
| `MANAGEMENT_API_URL` | `https://saas.licensespring.com` | Management API base URL |
| `LICENSE_OAUTH_TOKEN_URL` | LicenseSpring Keycloak token endpoint | Override for OAuth tokens |
| `LICENSESPRING_TIMEOUT_MS` | `25000` | Per-request timeout |
| `LICENSESPRING_MAX_RETRIES` | `2` | Retries for rate limiting (any method) and network/5xx errors (GET only) |
| `MANAGEMENT_TOOLSETS` | all | Comma-separated Management toolsets to register: `licenses`, `license_users`, `orders`, `customers`, `products`, `devices`, `analytics`, `consumption_pools`, `oauth_clients` |
| `LICENSESPRING_READ_ONLY` | `false` | Register only read-only tools (both servers) |
| `LOG_LEVEL` | `INFO` (`WARN` in production) | `ERROR`, `WARN`, `INFO` or `DEBUG`. Logs go to stderr. |

Variables can also be placed in a `.env` file in the working directory (see [.env.example](.env.example)).

## Usage

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "licensespring": {
      "command": "npx",
      "args": ["-y", "@tfedorko/licensespring-mcp-server", "license-api"],
      "env": {
        "LICENSE_API_KEY": "YOUR_LICENSE_API_KEY",
        "LICENSE_SHARED_KEY": "YOUR_SHARED_KEY"
      }
    },
    "licensespring-management": {
      "command": "npx",
      "args": ["-y", "@tfedorko/licensespring-mcp-server", "management-api"],
      "env": {
        "MANAGEMENT_API_KEY": "YOUR_MANAGEMENT_API_KEY"
      }
    }
  }
}
```

To use OAuth instead, replace the License API `env` block with `LICENSE_CLIENT_ID` and `LICENSE_CLIENT_SECRET`.

### Claude Code

```bash
claude mcp add licensespring \
  -e LICENSE_API_KEY=YOUR_LICENSE_API_KEY -e LICENSE_SHARED_KEY=YOUR_SHARED_KEY \
  -- npx -y @tfedorko/licensespring-mcp-server license-api

claude mcp add licensespring-management \
  -e MANAGEMENT_API_KEY=YOUR_MANAGEMENT_API_KEY \
  -- npx -y @tfedorko/licensespring-mcp-server management-api
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "inputs": [
    { "type": "promptString", "id": "license_api_key", "description": "LicenseSpring License API key", "password": true },
    { "type": "promptString", "id": "license_shared_key", "description": "LicenseSpring shared key", "password": true }
  ],
  "servers": {
    "licensespring": {
      "command": "npx",
      "args": ["-y", "@tfedorko/licensespring-mcp-server", "license-api"],
      "env": {
        "LICENSE_API_KEY": "${input:license_api_key}",
        "LICENSE_SHARED_KEY": "${input:license_shared_key}"
      }
    }
  }
}
```

### Docker

```bash
docker build -t licensespring-mcp -f Dockerfile .
docker build -t licensespring-mcp-management -f Dockerfile.management .

docker run -i --rm -e LICENSE_API_KEY -e LICENSE_SHARED_KEY licensespring-mcp
docker run -i --rm -e MANAGEMENT_API_KEY licensespring-mcp-management
```

### Command line

```bash
npx @tfedorko/licensespring-mcp-server license-api      # default when no argument is given
npx @tfedorko/licensespring-mcp-server management-api
npx @tfedorko/licensespring-mcp-server --help
```

The `licensespring-mcp-license` and `licensespring-mcp-management` binaries start a specific server directly.

## Tools

### License API server (30 tools)

| Area | Tools |
| --- | --- |
| Activation | `activate_license`, `deactivate_license`, `activate_bundle`, `deactivate_bundle` |
| Offline activation | `activate_offline`, `deactivate_offline`, `activate_bundle_offline`, `deactivate_bundle_offline` |
| Checks | `check_license`, `check_bundle`, `check_license_feature` |
| Consumption | `add_consumption`, `add_feature_consumption` |
| Floating | `floating_borrow`, `floating_release`, `floating_feature_borrow`, `floating_feature_release` |
| Licenses & users | `get_trial_key`, `get_user_licenses`, `get_device_licenses`, `get_customer_license_users`, `change_password`, `get_sso_url` |
| Products | `list_products`, `get_product_details`, `get_versions`, `get_installation_file` |
| Device variables | `get_device_variables`, `track_device_variables` |
| Metadata | `get_api_metadata` |

Key-based products identify a license with `license_key`, and user-based products with `username` (plus `password`, or SSO `id_token`/`code` with `customer_account_code` where the endpoint authenticates the user).

Resources: `licensespring://health`, `licensespring://products`, `licensespring://product/{product}/details`.
Prompts: `license-troubleshooting`, `customer-onboarding`.

### Management API server (173 tools, every documented endpoint)

| Toolset | Covers |
| --- | --- |
| `licenses` (33) | List, get, update, delete, enable/disable, reset (single, bulk, custom bulk), consumption reset, policy apply, bulk update/disable, back-office check, license features, license custom fields, CSV imports of licenses and license features with their results, license user export |
| `license_users` (24) | Assign/unassign users and activation limits, license user CRUD and passwords, license user groups and their managers, license manager permissions |
| `orders` (12) | List, get, create (issues licenses), update (including changing the customer), delete, key generation, exports, order managers |
| `customers` (25) | Customer CRUD, merge, export, CSV import, labels, customer accounts and their managers |
| `products` (35) | Products, bundles, product features, custom fields and enumerations, installation files, license policies, exports and CSV imports |
| `devices` (12) | Devices (reset, blacklist/whitelist, borrow/release) and device variables |
| `analytics` (13) | Activities, hourly aggregates, activation and usage history, transfer counts, usage history export |
| `consumption_pools` (10) | Consumption pools, members and offline checkouts |
| `oauth_clients` (9) | License API OAuth clients scoped to licenses, customers and customer accounts |

Licenses are issued with `create_order`, which matches how the Management API creates them. List tools accept `limit`, `offset` and a `filters` object for any documented filter, such as `{"customer_email__icontains": "acme"}` or [metadata filters](https://docs.licensespring.com/management-api/metadata-filtering).

Many MCP clients work best with fewer tools, and some cap the count (for example 128). Set `MANAGEMENT_TOOLSETS` to a comma-separated list (e.g. `licenses,orders,customers`) to register only those toolsets. Set `LICENSESPRING_READ_ONLY=true` to register only read-only tools on either server.

Resources: `licensespring://health` and the first 100 licenses, customers, products and orders (`licensespring://management/{licenses,customers,products,orders}`).
Prompts: `license-management-workflow`, `customer-analysis`.

Every tool carries MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`) so clients can ask for confirmation before destructive calls.

## Development

```bash
npm install
npm run build            # compile to dist/
npm run lint             # ESLint
npm run typecheck        # tsc including tests
npm test                 # unit tests (Vitest, mocked HTTP)
npm run test:coverage    # unit tests with the enforced 100% coverage threshold
npm run test:integration # read-only checks against the live APIs (needs credentials)
```

Unit tests call every tool through a real MCP client connected over an in-memory transport. They mock HTTP at the axios adapter, so request signing, URLs, query strings and bodies are all checked. See [tests/README.md](tests/README.md).

## Releases

Releases are automated with semantic-release from [Conventional Commits](https://www.conventionalcommits.org): `feat:` publishes a minor release, `fix:` a patch, and a `BREAKING CHANGE:` footer a major. See [docs/RELEASE_AUTOMATION.md](docs/RELEASE_AUTOMATION.md).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Configuration error: LICENSE_SHARED_KEY is required…` | Add the shared key from Settings → Keys, or use OAuth credentials. |
| `[hmac_required]` or `[signature_mismatch]` | The shared key is missing or wrong. |
| `[date_header_diff]` | The machine clock is more than 15 minutes off. Sync it. |
| `HTTP 429: rate limit exceeded` | LicenseSpring limits requests per company per 60 seconds ([rate limits](https://docs.licensespring.com/license-api/rate-limiting)). The server retries automatically. Wait for the window to reset if it persists. |
| Client shows "Connection closed" on startup | Check the client's MCP log. Configuration errors are printed to stderr before the server exits. |

## License

MIT. See [LICENSE](LICENSE).

## Trademark Notice

This project uses the LicenseSpring® name under permission from Cense Data Inc. See the [TRADEMARK](TRADEMARK) file for details. This project is not affiliated with or endorsed by Cense Data Inc.
