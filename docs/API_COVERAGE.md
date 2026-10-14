# API coverage

Tool → endpoint map, verified against the LicenseSpring documentation in **October 2026**
(`https://docs.licensespring.com/license-api/…` and `…/management-api/…`) and the official
Python (4.0.0) and Node (1.5.3) SDKs. Each mapping is pinned by a unit test in
`src/*/__tests__/server.test.ts`, and the wire format is checked end-to-end by `tests/smoke/`.

## License API — `https://api.licensespring.com/api/v4`

Auth on every request: `Date` (RFC 7231, ±15 min) plus either
`Authorization: algorithm="hmac-sha256",headers="date",signature="<b64 HMAC(shared_key, "licenseSpring\ndate: <Date>")>",apikey="<api_key>"`
or `Authorization: Bearer <token>` (OAuth client credentials).

| Tool | Request | Identity |
|---|---|---|
| `activate_license` | `POST activate_license` (JSON) | key · user+password · SSO |
| `check_license` | `GET check_license` | key · user |
| `deactivate_license` | `POST deactivate_license` (JSON; returns text) | key · user+password · SSO |
| `activate_offline` | `POST activate_offline` (`text/plain`, base64 signed payload) | key · user+password |
| `deactivate_offline` | `POST deactivate_offline` (`text/plain`, base64 signed payload) | key · user+password |
| `activate_bundle` | `POST activate_bundle` | key · user+password · SSO |
| `check_bundle` | `GET check_bundle` | key · user |
| `deactivate_bundle` | `POST deactivate_bundle` | key · user+password · SSO |
| `check_license_feature` | `GET check_license_feature` | key · user |
| `add_consumption` | `POST add_consumption` | key · user |
| `add_feature_consumption` | `POST add_feature_consumption` | key · user |
| `get_trial_key` | `GET trial_key` — creates a license, so never auto-retried | — (`email` required for user-based products) |
| `get_product_details` | `GET product_details` | — |
| `list_products` | `GET products` | — |
| `get_user_licenses` | `GET user_licenses` | user+password · SSO |
| `get_device_licenses` | `GET device_licenses` | — |
| `get_customer_license_users` | `GET customer_license_users` | — |
| `track_device_variables` | `POST track_device_variables` | key · user |
| `get_device_variables` | `GET get_device_variables` | key · user |
| `floating_borrow` | `POST floating/borrow` (`borrowed_until` null = max) | key · user+password · SSO |
| `floating_release` | `POST floating/release` | key · user |
| `floating_feature_borrow` | `POST floating/feature_borrow` | key · user+password · SSO |
| `floating_feature_release` | `POST floating/feature_release` | key · user |
| `change_password` | `POST change_password` | username + password |
| `get_versions` | `GET versions` | key · user |
| `get_installation_file` | `GET installation_file` | key · user |
| `get_sso_url` | `GET sso_url` | — |

**Offline payload** (before base64): `request`, `request_id`, `hardware_id`, `product`,
`license_key` or `username`+`password`, `api_key` (or `client_id` with OAuth), `date`,
`signature` = b64 HMAC(shared key or client secret,
`"licenseSpring\ndate: <date>\n<license_key|username>\n<hardware_id>\n<api_key|client_id>"`), plus optional device fields.
The docs don't name a request Content-Type; `text/plain` matches both official SDKs. Verify with a live
offline activation before relying on it in production.

Not implemented (no documented use for an MCP client, or undocumented): `activate_bundle_offline`,
`deactivate_bundle_offline`, `.well-known`, `oauth_url`, `webhook/*`.

## Management API — `https://saas.licensespring.com/api/v1`

Auth: `Authorization: Api-Key <management_api_key>`. Lists return `{count, next, previous, results}`.

| Tool | Request |
|---|---|
| `list_licenses` | `GET licenses/` |
| `get_license` | `GET licenses/{id}/` |
| `update_license` | `PATCH licenses/{id}/` |
| `enable_license` / `disable_license` | `POST licenses/{id}/enable/` · `…/disable/` |
| `reset_license` | `POST licenses/{id}/reset/` |
| `delete_license` | `DELETE licenses/{id}/` |
| `bulk_update_licenses` | `PATCH licenses/bulk_update/` — body is a list of `{id, …}` |
| `bulk_disable_licenses` | `POST licenses/disable_bulk/` — body is a list of IDs |
| `update_license_features` | `POST licenses/{id}/update_features/` (omitted features are removed) |
| `apply_license_policy` | `POST licenses/{id}/apply_policy/` |
| `assign_user_to_license` | `POST licenses/{id}/assign_user/` |
| `unassign_user_from_license` | `POST licenses/{id}/unassign_user/` |
| `set_user_activations` | `POST licenses/{id}/set_users_activations/` — body is `{<user_id>: {…}}` |
| `import_licenses_from_csv` | `POST licenses/import_from_csv/` — `multipart/form-data`, field `file` |
| `get_license_import_result` | `GET licenses-import-results/{id}/` |
| `list_license_activation_history` | `GET license-activation-histories/` |
| `create_order` | `POST orders/create_order/` (yearly `consumption_period` is `annually` here, `annualy` on update endpoints) |
| `list_orders` / `get_order` | `GET orders/` · `GET orders/{id}/` |
| `generate_license_keys` | `GET orders/generate_license/` |
| `list_customers` / `get_customer` | `GET customers/` · `GET customers/{id}/` |
| `create_customer` / `update_customer` / `delete_customer` | `POST customers/` · `PATCH customers/{id}/` · `DELETE customers/{id}/` |
| `list_license_users` / `get_license_user` | `GET license-users/` · `GET license-users/{id}/` |
| `create_license_user` / `update_license_user` / `delete_license_user` | `POST license-users/` · `PATCH license-users/{id}/` · `DELETE license-users/{id}/` |
| `set_license_user_password` | `POST license-users/{id}/set_password/` or `POST license-users/set_password/?email=` |
| `list_devices` / `get_device` | `GET devices/` · `GET devices/{id}/` |
| `reset_device` / `blacklist_device` / `whitelist_device` | `POST devices/{id}/reset/` · `…/blacklist/` · `…/whitelist/` |
| `list_products` / `get_product` | `GET products/` · `GET products/{id}/` |
| `list_product_features` | `GET product-features/?product=` |
| `list_license_policies` | `GET license-templates/` |

## Changes from 2.x

| 2.x behaviour | Problem (per docs) | 3.0 |
|---|---|---|
| API key without shared key sent `apikey="…"` only | Unsigned requests are rejected (`hmac_required`) | Shared key required; OAuth added |
| `create_license` → `POST licenses/` | No such endpoint; licenses come from orders | `create_order` |
| `update_license` sent `enabled`, numeric `validity_period` | `enabled` is not updatable; `validity_period` is `YYYY-MM-DD` | `enable_license`/`disable_license`; date validation; `is_trial` rule enforced |
| `bulk_update_licenses` → `POST {licenses:[…]}` | Endpoint is `PATCH` with a bare list | Fixed |
| `bulk_disable_licenses` → `{license_ids:[…]}` | Body is a bare list of IDs | Fixed |
| `set_user_activations` → `{user_activations:{…}}` | Body is the map itself | Fixed |
| `import_licenses_from_csv` → JSON `{csv_file, product_id, customer_id}` | `multipart/form-data` with `file`; product/customer are CSV columns | `csv_content` uploaded as a file; `get_license_import_result` added |
| `activate_offline`/`deactivate_offline` → JSON | Signed base64 `text/plain` payload | Fixed |
| `activate_license` sent `quantity` | Not a parameter (schema forbids extra properties) | Removed |
| `list_customers` `company_name`, `list_license_users` `license_id`/`email` | Not documented filters (silently ignored) | Documented filter names |
| User-based licenses unsupported | `username`/`password` accepted by most endpoints | Supported everywhere |
| Logs and dotenv tips on stdout | Corrupts the MCP stdio stream | All diagnostics on stderr |
