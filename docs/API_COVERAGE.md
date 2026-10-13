# LicenseSpring API Coverage

This page maps every MCP tool to its LicenseSpring endpoint and documentation page. It was last reviewed against [docs.licensespring.com](https://docs.licensespring.com) in October 2026.

## License API (`https://api.licensespring.com/api/v4`)

Requests carry a `Date` header and either an HMAC-signed API key `Authorization` header ([API key authorization](https://docs.licensespring.com/license-api/license-api-authorization/api-key-authorization), [request signature](https://docs.licensespring.com/license-api/license-api-authorization/request-signature)) or an OAuth bearer token ([OAuth authorization](https://docs.licensespring.com/license-api/license-api-authorization/oauth-authorization)).

| Tool | Method & path | Docs |
| --- | --- | --- |
| `activate_license` | `POST /activate_license` | [Activate License (Online)](https://docs.licensespring.com/license-api/license-activation-and-deactivation/activate-license-online-method) |
| `deactivate_license` | `POST /deactivate_license` | [Deactivate License (Online)](https://docs.licensespring.com/license-api/license-activation-and-deactivation/deactivate-license-online-method) |
| `activate_bundle` | `POST /activate_bundle` | [Activate Bundle (Online)](https://docs.licensespring.com/license-api/license-activation-and-deactivation/activate-bundle-online-method) |
| `deactivate_bundle` | `POST /deactivate_bundle` | [Deactivate Bundle (Online)](https://docs.licensespring.com/license-api/license-activation-and-deactivation/deactivate-bundle-online-method) |
| `activate_offline` | `POST /activate_offline` (signed base64 body) | [Activate License (Offline)](https://docs.licensespring.com/license-api/license-activation-and-deactivation/activate-license-offline-method) |
| `deactivate_offline` | `POST /deactivate_offline` (signed base64 body) | [Deactivate License (Offline)](https://docs.licensespring.com/license-api/license-activation-and-deactivation/deactivate-license-offline-method) |
| `activate_bundle_offline` | `POST /activate_bundle_offline` (signed base64 body) | [Activate Bundle (Offline)](https://docs.licensespring.com/license-api/license-activation-and-deactivation/activate-bundle-offline-method) |
| `deactivate_bundle_offline` | `POST /deactivate_bundle_offline` (signed base64 body) | [Deactivate Bundle (Offline)](https://docs.licensespring.com/license-api/license-activation-and-deactivation/deactivate-bundle-offline-method) |
| `check_license` | `GET /check_license` | [Check License](https://docs.licensespring.com/license-api/license-check/check-license) |
| `check_bundle` | `GET /check_bundle` | [Check Bundle](https://docs.licensespring.com/license-api/license-check/check-bundle) |
| `check_license_feature` | `GET /check_license_feature` | [License Feature Check](https://docs.licensespring.com/license-api/license-feature-check) |
| `add_consumption` | `POST /add_consumption` | [Add Consumption](https://docs.licensespring.com/license-api/consumption/add-consumption) |
| `add_feature_consumption` | `POST /add_feature_consumption` | [Add Feature Consumption](https://docs.licensespring.com/license-api/consumption/add-feature-consumption) |
| `floating_borrow` | `POST /floating/borrow` | [Borrow Floating License](https://docs.licensespring.com/license-api/floating/license/borrow-floating-license) |
| `floating_release` | `POST /floating/release` | [Release Floating License](https://docs.licensespring.com/license-api/floating/license/release-floating-license) |
| `floating_feature_borrow` | `POST /floating/feature_borrow` | [Borrow Floating Feature](https://docs.licensespring.com/license-api/floating/features/borrow-floating-feature) |
| `floating_feature_release` | `POST /floating/feature_release` | [Release Floating Feature](https://docs.licensespring.com/license-api/floating/features/release-floating-feature) |
| `get_trial_key` | `GET /trial_key` | [Trial Key](https://docs.licensespring.com/license-api/trial-key) |
| `get_user_licenses` | `GET /user_licenses` | [Licenses for User](https://docs.licensespring.com/license-api/list-licenses/licenses-for-user) |
| `get_device_licenses` | `GET /device_licenses` | [Licenses for Device](https://docs.licensespring.com/license-api/list-licenses/licenses-for-device) |
| `get_customer_license_users` | `GET /customer_license_users` | [List License Users for Customer](https://docs.licensespring.com/license-api/list-license-users-for-customer) |
| `list_products` | `GET /products` | [List Products](https://docs.licensespring.com/license-api/products/list-products) |
| `get_product_details` | `GET /product_details` | [Get Product Details](https://docs.licensespring.com/license-api/products/get-product-details) |
| `get_versions` | `GET /versions` | [Get Product Versions](https://docs.licensespring.com/license-api/get-product-versions) |
| `get_installation_file` | `GET /installation_file` | [Get Installation File](https://docs.licensespring.com/license-api/get-installation-file) |
| `get_device_variables` | `GET /get_device_variables` | [Get Device Variables](https://docs.licensespring.com/license-api/device-variables/get-device-variables) |
| `track_device_variables` | `POST /track_device_variables` | [Track Device Variables](https://docs.licensespring.com/license-api/device-variables/track-device-variables) |
| `change_password` | `POST /change_password` | [Change Password](https://docs.licensespring.com/license-api/change-password) |
| `get_sso_url` | `GET /sso_url` | [Single Sign On URL](https://docs.licensespring.com/license-api/single-sign-on-url) |
| `get_api_metadata` | `GET /.well-known` | [Public API Metadata](https://docs.licensespring.com/license-api/public-api-metadata) |

Response signature verification ([v1](https://docs.licensespring.com/license-api/license-api-authorization/response-signature), [v2](https://docs.licensespring.com/license-api/license-api-authorization/response-signature-v2)) is left to the client application. The tools return the signatures unchanged.

## Management API (`https://saas.licensespring.com/api/v1`)

Requests carry `Authorization: Api-Key <key>` ([Management API authorization](https://docs.licensespring.com/management-api/management-api-authorization)). List tools forward `limit`, `offset`, `order_by` (where supported) and any documented filter through `filters`.

| Tool | Method & path | Docs |
| --- | --- | --- |
| `list_licenses` | `GET /licenses/` | [List Licenses](https://docs.licensespring.com/management-api/license/list-licenses) |
| `get_license` | `GET /licenses/{id}/` | [Retrieve License](https://docs.licensespring.com/management-api/license/retrieve-license) |
| `update_license` | `PATCH /licenses/{id}/` | [Update License](https://docs.licensespring.com/management-api/license/update-license) |
| `delete_license` | `DELETE /licenses/{id}/` | [Delete License](https://docs.licensespring.com/management-api/license/delete-license) |
| `enable_license` | `POST /licenses/{id}/enable/` | [Enable License](https://docs.licensespring.com/management-api/license/enable-license) |
| `disable_license` | `POST /licenses/{id}/disable/` | [Disable License](https://docs.licensespring.com/management-api/license/disable-license) |
| `reset_license` | `POST /licenses/{id}/reset/` | [Reset License](https://docs.licensespring.com/management-api/license/reset-license) |
| `reset_license_consumption` | `POST /licenses/{id}/reset_consumption` | [Reset Consumptions on License](https://docs.licensespring.com/management-api/license/reset-consumptions-on-license) |
| `apply_license_policy` | `POST /licenses/{id}/apply_policy/` | [Apply License Policy](https://docs.licensespring.com/management-api/license/apply-license-policy) |
| `update_license_features` | `POST /licenses/{id}/update_features/` | [Update License Product Features](https://docs.licensespring.com/management-api/license/update-license-product-features) |
| `bulk_update_licenses` | `PATCH /licenses/bulk_update/` (array body) | [Update Licenses (Bulk)](https://docs.licensespring.com/management-api/license/update-licenses-bulk) |
| `bulk_disable_licenses` | `POST /licenses/disable_bulk/` (array of IDs) | [Disable Licenses (Bulk)](https://docs.licensespring.com/management-api/license/disable-licenses-bulk) |
| `check_license_status` | `GET /licenses/check_license/` | [Check License](https://docs.licensespring.com/management-api/license/check-license) |
| `import_licenses_from_csv` | `POST /licenses/import_from_csv/` (multipart) | [Import Licenses From CSV](https://docs.licensespring.com/management-api/license/import-licenses-from-csv) |
| `list_license_import_results` | `GET /licenses-import-results/` | [List Licenses Import Results](https://docs.licensespring.com/management-api/license/import-results/list-licenses-import-results) |
| `assign_user_to_license` | `POST /licenses/{id}/assign_user/` | [Assign User to License](https://docs.licensespring.com/management-api/license/assign-user-to-license) |
| `assign_users_to_license` | `POST /licenses/{id}/assign_users/` | [Assign Users (Bulk) to License](https://docs.licensespring.com/management-api/license/assign-users-bulk-to-license) |
| `unassign_user_from_license` | `POST /licenses/{id}/unassign_user/` | [Unassign User from License](https://docs.licensespring.com/management-api/license/unassign-user-from-license) |
| `set_user_activations` | `POST /licenses/{id}/set_users_activations/` | [Set Activations Data for User](https://docs.licensespring.com/management-api/license/set-activations-data-for-user) |
| `list_license_users` | `GET /license-users/` | [List License Users](https://docs.licensespring.com/management-api/license/users/list-license-users) |
| `get_license_user` | `GET /license-users/{id}/` | [Retrieve License User](https://docs.licensespring.com/management-api/license/users/retrieve-license-user) |
| `create_license_user` | `POST /license-users/` | [Create License User](https://docs.licensespring.com/management-api/license/users/create-license-user) |
| `update_license_user` | `PATCH /license-users/{id}/` | [Update License User](https://docs.licensespring.com/management-api/license/users/update-license-user) |
| `delete_license_user` | `DELETE /license-users/{id}/` | [Delete License User](https://docs.licensespring.com/management-api/license/users/delete-license-user) |
| `set_license_user_password` | `POST /license-users/{id}/set_password/` or `POST /license-users/set_password/?email=` | [By ID](https://docs.licensespring.com/management-api/license/users/set-password-for-license-user), [by email](https://docs.licensespring.com/management-api/license/users/set-password-for-license-user-by-email) |
| `list_license_features` | `GET /license-product-features/` | [List License Product Features](https://docs.licensespring.com/management-api/license/features/list-license-product-features) |
| `update_license_feature` | `PATCH /license-product-features/{id}/` | [Update License Product Feature](https://docs.licensespring.com/management-api/license/features/update-license-product-feature) |
| `list_orders` | `GET /orders/` | [List Orders](https://docs.licensespring.com/management-api/order/list-orders) |
| `get_order` | `GET /orders/{id}/` | [Retrieve Order](https://docs.licensespring.com/management-api/order/retrieve-order) |
| `create_order` | `POST /orders/create_order/` | [Create Order](https://docs.licensespring.com/management-api/order/create-order) |
| `update_order` | `PATCH /orders/{id}/` | [Update Order](https://docs.licensespring.com/management-api/order/update-order) |
| `delete_order` | `DELETE /orders/{id}/safe_delete/` | [Delete Order](https://docs.licensespring.com/management-api/order/delete-order) |
| `generate_license_keys` | `GET /orders/generate_license/` | [Generate License Key](https://docs.licensespring.com/management-api/order/generate-license-key) |
| `list_customers` | `GET /customers/` | [List Customers](https://docs.licensespring.com/management-api/customer/list-customers) |
| `get_customer` | `GET /customers/{id}/` | [Retrieve Customer](https://docs.licensespring.com/management-api/customer/retrieve-customer) |
| `create_customer` | `POST /customers/` | [Create Customer](https://docs.licensespring.com/management-api/customer/create-customer) |
| `update_customer` | `PATCH /customers/{id}/` | [Update Customer](https://docs.licensespring.com/management-api/customer/update-customer) |
| `delete_customer` | `DELETE /customers/{id}/` | [Delete Customer](https://docs.licensespring.com/management-api/customer/delete-customer) |
| `list_customer_accounts` | `GET /customer-accounts/` | [List Customer Accounts](https://docs.licensespring.com/management-api/customer/accounts/list-customer-accounts) |
| `get_customer_account` | `GET /customer-accounts/{id}/` | [Retrieve Customer Account](https://docs.licensespring.com/management-api/customer/accounts/retrieve-customer-account) |
| `create_customer_account` | `POST /customer-accounts/` | [Create Customer Account](https://docs.licensespring.com/management-api/customer/accounts/create-customer-account) |
| `list_products` | `GET /products/` | [List Products](https://docs.licensespring.com/management-api/product/list-products) |
| `get_product` | `GET /products/{id}/` | [Retrieve Product](https://docs.licensespring.com/management-api/product/retrieve-product) |
| `list_product_features` | `GET /product-features/` | [List Product Features](https://docs.licensespring.com/management-api/product/features/list-product-features) |
| `list_license_policies` | `GET /license-templates/` | [List License Policies](https://docs.licensespring.com/management-api/license/license-policies/list-license-policies) |
| `list_installation_files` | `GET /installation-files/` | [List Installation Files](https://docs.licensespring.com/management-api/product/installation-files/list-installation-files) |
| `list_devices` | `GET /devices/` | [List Devices](https://docs.licensespring.com/management-api/device/list-devices) |
| `get_device` | `GET /devices/{id}/` | [Retrieve Device](https://docs.licensespring.com/management-api/device/retrieve-device) |
| `reset_device` | `POST /devices/{id}/reset/` | [Reset Device](https://docs.licensespring.com/management-api/device/reset-device) |
| `blacklist_device` | `POST /devices/{id}/blacklist/` | [Blacklist Device](https://docs.licensespring.com/management-api/device/blacklist-device) |
| `whitelist_device` | `POST /devices/{id}/whitelist/` | [Whitelist Device](https://docs.licensespring.com/management-api/device/whitelist-device) |
| `borrow_device` | `POST /devices/{id}/borrow/` | [Borrow Device](https://docs.licensespring.com/management-api/device/borrow-device) |
| `release_borrowed_device` | `POST /devices/{id}/borrow_release/` | [Release Borrowed Device](https://docs.licensespring.com/management-api/device/release-borrowed-device) |
| `list_device_variables` | `GET /device-variables/` | [List Device Variables](https://docs.licensespring.com/management-api/device/device-variables/list-device-variables) |
| `list_license_activation_histories` | `GET /license-activation-histories/` | [List License Activation Histories](https://docs.licensespring.com/management-api/license/activation-histories/list-license-activation-histories) |
| `list_license_usage_histories` | `GET /license-histories/` | [List License Usage Histories](https://docs.licensespring.com/management-api/license/usage-histories/list-license-usage-histories) |
| `list_activities` | `GET /activities/` | [List Activities](https://docs.licensespring.com/management-api/analytics/list-activities) |

### Not exposed as tools

The Management API has about 170 endpoints. These groups are deliberately left out to keep the tool list focused, and can be added with a few lines each in `src/management-api/tools.ts`:

- Customer labels, customer CSV import/export and merging
- Consumption pools and their checkouts
- License custom fields, license manager permissions and license user groups
- Product creation and CSV import, product custom fields and enumerations, bundle membership, installation file editing
- OAuth client management for customers, customer accounts and licenses
- Order managers and exports, hourly analytics aggregates

## Changes from the previous release (review findings)

The October 2026 review compared the previous implementation with the current documentation and fixed the following:

| Area | Before | Now |
| --- | --- | --- |
| License API auth | `LICENSE_SHARED_KEY` treated as optional, sending an unsigned `apikey=` header that the API rejects (`hmac_required`) | API key auth requires the shared key and every request is signed; OAuth client credentials are supported |
| Test mode | Any key starting with `test-` or `NODE_ENV=test` skipped signing in production code | Removed; tests mock HTTP instead |
| `activate_license` | Sent an undocumented `quantity` field; key-based only | Documented fields only; supports username/password and SSO identities |
| `activate_offline` / `deactivate_offline` | Posted plain JSON | Build the signed base64 payload the endpoints require |
| `add_consumption` | `consumptions` had to be at least 1 | Negative values allowed, as documented |
| `get_sso_url` | Defaulted `response_type` to `token` | Omitted by default, so the API default (`code`) applies |
| `create_license` | Called the undocumented `POST /licenses/` | Removed; use `create_order` |
| `update_license` | Accepted `enabled` and a numeric `validity_period` | `enable_license`/`disable_license`, `yyyy-mm-dd` dates and all documented fields |
| `bulk_update_licenses` | `POST` with `{licenses: [...]}` | `PATCH` with a JSON array |
| `bulk_disable_licenses` | `{license_ids: [...]}` | JSON array of IDs |
| `import_licenses_from_csv` | JSON body | `multipart/form-data` file upload |
| `list_license_users` | Undocumented `license_id`/`email` filters | Documented filters through `filters` |
| Logging | Some logs went to stdout, which corrupts the MCP stdio stream | All logs go to stderr |
| Coverage | 1 unit test file (auth) | Every module and tool tested, with 100% coverage enforced in CI |
