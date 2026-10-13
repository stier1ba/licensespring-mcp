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

### Catalog-only endpoints

The [Public API Metadata](https://docs.licensespring.com/license-api/public-api-metadata) catalog also lists `GET /oauth_url`, `POST /webhook/order` and `GET /webhook/license`. None of them has a request/response reference in the documentation (the docs search confirms this); the webhook routes are inbound callbacks used by store integrations rather than client-facing calls. They are therefore not exposed as tools. Every License API endpoint that has a reference page is covered.

Response signature verification ([v1](https://docs.licensespring.com/license-api/license-api-authorization/response-signature), [v2](https://docs.licensespring.com/license-api/license-api-authorization/response-signature-v2)) is left to the client application. The tools return the signatures unchanged.

## Management API (`https://saas.licensespring.com/api/v1`)

Requests carry `Authorization: Api-Key <key>` ([Management API authorization](https://docs.licensespring.com/management-api/management-api-authorization)). List tools forward `limit`, `offset`, `order_by` (where supported) and any documented filter through `filters` ([metadata filtering](https://docs.licensespring.com/management-api/metadata-filtering)).

**All documented Management API endpoints are covered** (173 tools). Tools are grouped into toolsets that can be enabled selectively with `MANAGEMENT_TOOLSETS`; `LICENSESPRING_READ_ONLY=true` registers only read-only tools on either server.

### Licenses (`licenses`)

| Tool | Method & path | Docs |
| --- | --- | --- |
| `list_licenses` | `GET /licenses/` | [List Licenses](https://docs.licensespring.com/management-api/license/list-licenses) |
| `get_license` | `GET /licenses/{id}/` | [Retrieve License](https://docs.licensespring.com/management-api/license/retrieve-license) |
| `update_license` | `PATCH /licenses/{id}/` | [Update License](https://docs.licensespring.com/management-api/license/update-license) |
| `delete_license` | `DELETE /licenses/{id}/` | [Delete License](https://docs.licensespring.com/management-api/license/delete-license) |
| `enable_license` | `POST /licenses/{id}/enable/` | [Enable License](https://docs.licensespring.com/management-api/license/enable-license) |
| `disable_license` | `POST /licenses/{id}/disable/` | [Disable License](https://docs.licensespring.com/management-api/license/disable-license) |
| `reset_license` | `POST /licenses/{id}/reset/` | [Reset License](https://docs.licensespring.com/management-api/license/reset-license) |
| `reset_licenses_bulk` | `POST /licenses/{id}/reset_bulk/` | [Reset Licenses (Bulk)](https://docs.licensespring.com/management-api/license/reset-licenses-bulk) |
| `reset_licenses_custom_bulk` | `POST /licenses/custom_bulk_reset` | [Reset Licenses(Custom-Bulk)](https://docs.licensespring.com/management-api/license/reset-licenses-custom-bulk) |
| `reset_license_consumption` | `POST /licenses/{id}/reset_consumption` | [Reset Consumptions on License](https://docs.licensespring.com/management-api/license/reset-consumptions-on-license) |
| `apply_license_policy` | `POST /licenses/{id}/apply_policy/` | [Apply License Policy](https://docs.licensespring.com/management-api/license/apply-license-policy) |
| `update_license_features` | `POST /licenses/{id}/update_features/` | [Update License Product Features](https://docs.licensespring.com/management-api/license/update-license-product-features) |
| `bulk_update_licenses` | `PATCH /licenses/bulk_update/` | [Update Licenses (Bulk)](https://docs.licensespring.com/management-api/license/update-licenses-bulk) |
| `bulk_disable_licenses` | `POST /licenses/disable_bulk/` | [Disable Licenses (Bulk)](https://docs.licensespring.com/management-api/license/disable-licenses-bulk) |
| `check_license_status` | `GET /licenses/check_license/` | [Check License](https://docs.licensespring.com/management-api/license/check-license) |
| `export_license_users` | `GET /licenses/{id}/export_license_users/` | [Export License Users](https://docs.licensespring.com/management-api/license/export-license-users) |
| `import_licenses_from_csv` | `POST /licenses/import_from_csv/` | [Import Licenses From CSV](https://docs.licensespring.com/management-api/license/import-licenses-from-csv) |
| `list_license_import_results` | `GET /licenses-import-results/` | [List Licenses Import Results](https://docs.licensespring.com/management-api/license/import-results/list-licenses-import-results) |
| `get_license_import_result` | `GET /licenses-import-results/{id}/` | [Retrieve Licenses Import Result](https://docs.licensespring.com/management-api/license/import-results/retrieve-licenses-import-result) |
| `import_license_features_from_csv` | `POST /licenses/import_features_from_csv/` | [Import License Features From CSV](https://docs.licensespring.com/management-api/license/import-license-features-from-csv) |
| `list_license_feature_import_results` | `GET /license-features-import-results/` | [List License Features Import Results](https://docs.licensespring.com/management-api/license/features-import-results/list-license-features-import-results) |
| `get_license_feature_import_result` | `GET /license-features-import-results/{id}/` | [Retrieve License Features Import Result](https://docs.licensespring.com/management-api/license/features-import-results/retrieve-license-features-import-result) |
| `list_license_features` | `GET /license-product-features/` | [List License Product Features](https://docs.licensespring.com/management-api/license/features/list-license-product-features) |
| `get_license_feature` | `GET /license-product-features/{id}/` | [Retrieve License Product Feature](https://docs.licensespring.com/management-api/license/features/retrieve-license-product-feature) |
| `create_license_feature` | `POST /license-product-features/` | [Create License Product Feature](https://docs.licensespring.com/management-api/license/features/create-license-product-feature) |
| `update_license_feature` | `PATCH /license-product-features/{id}/` | [Update License Product Feature](https://docs.licensespring.com/management-api/license/features/update-license-product-feature) |
| `delete_license_feature` | `DELETE /license-product-features/{id}/` | [Delete License Product Feature](https://docs.licensespring.com/management-api/license/features/delete-license-product-feature) |
| `release_license_feature_device` | `POST /license-product-features/{id}/release_device/` | [Release Device From License Product Feature](https://docs.licensespring.com/management-api/license/features/release-device-from-license-product-feature) |
| `list_license_custom_fields` | `GET /license-custom-fields/` | [List License Custom Fields](https://docs.licensespring.com/management-api/license/custom-fields/list-license-custom-fields) |
| `get_license_custom_field` | `GET /license-custom-fields/{id}/` | [Retrieve License Custom Field](https://docs.licensespring.com/management-api/license/custom-fields/retrieve-license-custom-field) |
| `create_license_custom_field` | `POST /license-custom-fields/` | [Create License Custom Field](https://docs.licensespring.com/management-api/license/custom-fields/create-license-custom-field) |
| `update_license_custom_field` | `PATCH /license-custom-fields/{id}/` | [Update License Custom Field](https://docs.licensespring.com/management-api/license/custom-fields/update-license-custom-field) |
| `delete_license_custom_field` | `DELETE /license-custom-fields/{id}/` | [Delete License Custom Field](https://docs.licensespring.com/management-api/license/custom-fields/delete-license-custom-field) |

### License users, groups & manager permissions (`license_users`)

| Tool | Method & path | Docs |
| --- | --- | --- |
| `assign_user_to_license` | `POST /licenses/{id}/assign_user/` | [Assign User to License](https://docs.licensespring.com/management-api/license/assign-user-to-license) |
| `assign_users_to_license` | `POST /licenses/{id}/assign_users/` | [Assign Users (Bulk) to License](https://docs.licensespring.com/management-api/license/assign-users-bulk-to-license) |
| `unassign_user_from_license` | `POST /licenses/{id}/unassign_user/` | [Unassign User from License](https://docs.licensespring.com/management-api/license/unassign-user-from-license) |
| `set_user_activations` | `POST /licenses/{id}/set_users_activations/` | [Set Activations Data for User](https://docs.licensespring.com/management-api/license/set-activations-data-for-user) |
| `list_license_users` | `GET /license-users/` | [List License Users](https://docs.licensespring.com/management-api/license/users/list-license-users) |
| `get_license_user` | `GET /license-users/{id}/` | [Retrieve License User](https://docs.licensespring.com/management-api/license/users/retrieve-license-user) |
| `create_license_user` | `POST /license-users/` | [Create License User](https://docs.licensespring.com/management-api/license/users/create-license-user) |
| `update_license_user` | `PATCH /license-users/{id}/` | [Update License user group](https://docs.licensespring.com/management-api/license/user-groups/update-license-user-group) |
| `delete_license_user` | `DELETE /license-users/{id}/` | [Delete License User](https://docs.licensespring.com/management-api/license/users/delete-license-user) |
| `set_license_user_password` | `POST /license-users/{id}/set_password/`, or `POST /license-users/set_password/?email=` when called with `email` | [Set Password for License User](https://docs.licensespring.com/management-api/license/users/set-password-for-license-user) |
| `add_license_user_to_group` | `POST /license-users/{id}/add_to_group/` | [Add License User to License User Group](https://docs.licensespring.com/management-api/license/users/add-license-user-to-license-user-group) |
| `remove_license_user_from_group` | `POST /license-users/{id}/remove_from_group/` | [Remove License User from License User Group](https://docs.licensespring.com/management-api/license/users/remove-license-user-from-license-user-group) |
| `list_license_manager_permissions` | `GET /license-manager-permissions/` | [List License Manager Permissions](https://docs.licensespring.com/management-api/license/managers/list-license-manager-permissions) |
| `update_license_manager_permissions` | `POST /license-users/{id}/update_lm_permissions/` | [Update License Manager Permissions](https://docs.licensespring.com/management-api/license/managers/update-license-manager-permissions) |
| `remove_license_manager_permissions` | `POST /license-users/{id}/remove_lm_permissions/` | [Remove License Manager Permissions](https://docs.licensespring.com/management-api/license/managers/remove-license-manager-permissions) |
| `list_license_user_groups` | `GET /license-user-groups/` | [List License User Groups](https://docs.licensespring.com/management-api/license/user-groups/list-license-user-groups) |
| `get_license_user_group` | `GET /license-user-groups/{id}/` | [Retrieve License User Group](https://docs.licensespring.com/management-api/license/user-groups/retrieve-license-user-group) |
| `create_license_user_group` | `POST /license-user-groups/` | [Create License User Group](https://docs.licensespring.com/management-api/license/user-groups/create-license-user-group) |
| `update_license_user_group` | `PATCH /license-user-groups/{id}/` | [Update License user group](https://docs.licensespring.com/management-api/license/user-groups/update-license-user-group) |
| `delete_license_user_group` | `DELETE /license-user-groups/{id}/` | [Delete License User Group](https://docs.licensespring.com/management-api/license/user-groups/delete-license-user-group) |
| `list_license_user_group_members` | `GET /license-user-groups/{id}/members/` | [List License User Group members](https://docs.licensespring.com/management-api/license/user-groups/list-license-user-group-members) |
| `list_license_user_group_managers` | `GET /license-user-groups/{id}/managers/` | [List License User Group managers](https://docs.licensespring.com/management-api/license/user-groups/list-license-user-group-managers) |
| `add_license_user_group_manager` | `POST /license-user-groups/{id}/add_manager/` | [Add manager to License User Group](https://docs.licensespring.com/management-api/license/user-groups/add-manager-to-license-user-group) |
| `remove_license_user_group_manager` | `POST /license-user-groups/{id}/remove_manager/` | [Remove manager from License User Group](https://docs.licensespring.com/management-api/license/user-groups/remove-manager-from-license-user-group) |

### Orders (`orders`)

| Tool | Method & path | Docs |
| --- | --- | --- |
| `list_orders` | `GET /orders/` | [List Orders](https://docs.licensespring.com/management-api/order/list-orders) |
| `get_order` | `GET /orders/{id}/` | [Retrieve Order](https://docs.licensespring.com/management-api/order/retrieve-order) |
| `create_order` | `POST /orders/create_order/` | [Create Order](https://docs.licensespring.com/management-api/order/create-order) |
| `update_order` | `PATCH /orders/{id}/` | [Change Customer on Order](https://docs.licensespring.com/management-api/order/change-customer-on-order) |
| `delete_order` | `DELETE /orders/{id}/safe_delete/` | [Delete Order](https://docs.licensespring.com/management-api/order/delete-order) |
| `generate_license_keys` | `GET /orders/generate_license/` | [Generate License Key](https://docs.licensespring.com/management-api/order/generate-license-key) |
| `export_orders` | `GET /orders/export/` | [Export Orders](https://docs.licensespring.com/management-api/order/export-orders) |
| `export_order` | `GET /orders/{id}/export/` | [Export Order](https://docs.licensespring.com/management-api/order/export-order) |
| `list_order_managers` | `GET /orders/{id}/managers/` | [List Managers on Order](https://docs.licensespring.com/management-api/order/list-managers-on-order) |
| `add_order_manager` | `POST /orders/{id}/add_manager/` | [Add Manager to Order](https://docs.licensespring.com/management-api/order/add-manager-to-order) |
| `add_order_managers` | `POST /orders/{id}/add_managers/` | [Add Managers (bulk) to Order](https://docs.licensespring.com/management-api/order/add-managers-bulk-to-order) |
| `remove_order_manager` | `POST /orders/{id}/remove_manager/` | [Remove Manager from Order](https://docs.licensespring.com/management-api/order/remove-manager-from-order) |

### Customers, labels & customer accounts (`customers`)

| Tool | Method & path | Docs |
| --- | --- | --- |
| `list_customers` | `GET /customers/` | [List Customers](https://docs.licensespring.com/management-api/customer/list-customers) |
| `get_customer` | `GET /customers/{id}/` | [Retrieve Customer](https://docs.licensespring.com/management-api/customer/retrieve-customer) |
| `create_customer` | `POST /customers/` | [Create Customer](https://docs.licensespring.com/management-api/customer/create-customer) |
| `update_customer` | `PATCH /customers/{id}/` | [Update Customer](https://docs.licensespring.com/management-api/customer/update-customer) |
| `delete_customer` | `DELETE /customers/{id}/` | [Delete Customer](https://docs.licensespring.com/management-api/customer/delete-customer) |
| `merge_customers` | `POST /customers/{id}/merge/` | [Merge Customers](https://docs.licensespring.com/management-api/customer/merge-customers) |
| `export_customers` | `GET /customers/export/` | [Export Customers](https://docs.licensespring.com/management-api/customer/export-customers) |
| `import_customers_from_csv` | `POST /customers/import_from_csv/` | [Import Customers from CSV](https://docs.licensespring.com/management-api/customer/import-customers-from-csv) |
| `list_customer_import_results` | `GET /customers-import-results/` | [List Customers Import Results](https://docs.licensespring.com/management-api/customer/import-results/list-customers-import-results) |
| `get_customer_import_result` | `GET /customers-import-results/{id}/` | [Retrieve Customers Import Result](https://docs.licensespring.com/management-api/customer/import-results/retrieve-customers-import-result) |
| `list_customer_labels` | `GET /clabels/` | [List Customer Labels](https://docs.licensespring.com/management-api/customer/labels/list-customer-labels) |
| `get_customer_label` | `GET /clabels/{id}/` | [Retrieve Customer Label](https://docs.licensespring.com/management-api/customer/labels/retrieve-customer-label) |
| `create_customer_label` | `POST /clabels/` | [Create Customer Label](https://docs.licensespring.com/management-api/customer/labels/create-customer-label) |
| `update_customer_label` | `PATCH /clabels/{id}/` | [Update Customer Label](https://docs.licensespring.com/management-api/customer/labels/update-customer-label) |
| `delete_customer_label` | `DELETE /clabels/{id}/` | [Delete Customer Label](https://docs.licensespring.com/management-api/customer/labels/delete-customer-label) |
| `add_label_to_customer` | `POST /customerclabels/` | [Add Label to Customer](https://docs.licensespring.com/management-api/customer/labels/add-label-to-customer) |
| `remove_label_from_customer` | `DELETE /customerclabels/{id}/` | [Remove Label From Customer](https://docs.licensespring.com/management-api/customer/labels/remove-label-from-customer) |
| `list_customer_accounts` | `GET /customer-accounts/` | [List Customer Accounts](https://docs.licensespring.com/management-api/customer/accounts/list-customer-accounts) |
| `get_customer_account` | `GET /customer-accounts/{id}/` | [Retrieve Customer Account](https://docs.licensespring.com/management-api/customer/accounts/retrieve-customer-account) |
| `create_customer_account` | `POST /customer-accounts/` | [Create Customer Account](https://docs.licensespring.com/management-api/customer/accounts/create-customer-account) |
| `update_customer_account` | `PATCH /customer-accounts/{id}/` | [Update Customer Account](https://docs.licensespring.com/management-api/customer/accounts/update-customer-account) |
| `delete_customer_account` | `DELETE /customer-accounts/{id}/` | [Delete Customer Account](https://docs.licensespring.com/management-api/customer/accounts/delete-customer-account) |
| `list_customer_account_managers` | `GET /customer-accounts/{id}/managers/` | [List Customer Account managers](https://docs.licensespring.com/management-api/customer/accounts/list-customer-account-managers) |
| `add_customer_account_manager` | `POST /customer-accounts/{id}/add_manager/` | [Add manager to Customer Account](https://docs.licensespring.com/management-api/customer/accounts/add-manager-to-customer-account) |
| `remove_customer_account_manager` | `POST /customer-accounts/{id}/remove_manager/` | [Remove manager from Customer Account](https://docs.licensespring.com/management-api/customer/accounts/remove-manager-from-customer-account) |

### Products, features, custom fields, installation files & policies (`products`)

| Tool | Method & path | Docs |
| --- | --- | --- |
| `list_products` | `GET /products/` | [List Products](https://docs.licensespring.com/management-api/product/list-products) |
| `get_product` | `GET /products/{id}/` | [Retrieve Product](https://docs.licensespring.com/management-api/product/retrieve-product) |
| `create_product` | `POST /products/` | [Create Product](https://docs.licensespring.com/management-api/product/create-product) |
| `export_products` | `GET /products/export/` | [Export Products](https://docs.licensespring.com/management-api/product/export-products) |
| `import_products_from_csv` | `POST /products/import_from_csv/` | [Import Products From CSV](https://docs.licensespring.com/management-api/product/import-products-from-csv) |
| `list_bundle_products` | `GET /products/{id}/bundle/` | [List Products in a Bundle](https://docs.licensespring.com/management-api/product/list-products-in-a-bundle) |
| `list_product_bundles` | `GET /products/{id}/in_bundle/` | [List Bundles for a Product](https://docs.licensespring.com/management-api/product/list-bundles-for-a-product) |
| `add_product_to_bundle` | `POST /products/{id}/add_to_bundle/` | [Add Product to a Bundle](https://docs.licensespring.com/management-api/product/add-product-to-a-bundle) |
| `remove_product_from_bundle` | `POST /products/{id}/remove_from_bundle/` | [Remove Product from a Bundle](https://docs.licensespring.com/management-api/product/remove-product-from-a-bundle) |
| `list_product_features` | `GET /product-features/` | [List Product Features](https://docs.licensespring.com/management-api/product/features/list-product-features) |
| `get_product_feature` | `GET /product-features/{id}/` | [Retrieve Product Feature](https://docs.licensespring.com/management-api/product/features/retrieve-product-feature) |
| `create_product_feature` | `POST /product-features/` | [Create Product Feature](https://docs.licensespring.com/management-api/product/features/create-product-feature) |
| `update_product_feature` | `PATCH /product-features/{id}/` | [Update Product Feature](https://docs.licensespring.com/management-api/product/features/update-product-feature) |
| `delete_product_feature` | `DELETE /product-features/{id}/` | [Delete Product Feature](https://docs.licensespring.com/management-api/product/features/delete-product-feature) |
| `import_product_features_from_csv` | `POST /product-features/import_from_csv/` | [Import Product Features From CSV](https://docs.licensespring.com/management-api/product/features/import-product-features-from-csv) |
| `list_product_custom_fields` | `GET /product-custom-fields/` | [List Product Custom Fields](https://docs.licensespring.com/management-api/product/custom-fields/list-product-custom-fields) |
| `get_product_custom_field` | `GET /product-custom-fields/{id}/` | [Retrieve Product Custom Field](https://docs.licensespring.com/management-api/product/custom-fields/retrieve-product-custom-field) |
| `create_product_custom_field` | `POST /product-custom-fields/` | [Create Product Custom Field](https://docs.licensespring.com/management-api/product/custom-fields/create-product-custom-field) |
| `update_product_custom_field` | `PATCH /product-custom-fields/{id}/` | [Update Product Custom Field](https://docs.licensespring.com/management-api/product/custom-fields/update-product-custom-field) |
| `delete_product_custom_field` | `DELETE /product-custom-fields/{id}/` | [Delete Product Custom Field](https://docs.licensespring.com/management-api/product/custom-fields/delete-product-custom-field) |
| `list_product_custom_field_enums` | `GET /product-custom-field-enums/` | [List Product custom field enumerations](https://docs.licensespring.com/management-api/product/custom-fields-enumerations/list-product-custom-field-enumerations) |
| `get_product_custom_field_enum` | `GET /product-custom-field-enums/{id}/` | [Retrieve Product custom field enumeration](https://docs.licensespring.com/management-api/product/custom-fields-enumerations/retrieve-product-custom-field-enumeration) |
| `create_product_custom_field_enum` | `POST /product-custom-field-enums/` | [Create Product custom field enumeration](https://docs.licensespring.com/management-api/product/custom-fields-enumerations/create-product-custom-field-enumeration) |
| `update_product_custom_field_enum` | `PATCH /product-custom-field-enums/{id}/` | [Update Product custom field enumeration](https://docs.licensespring.com/management-api/product/custom-fields-enumerations/update-product-custom-field-enumeration) |
| `delete_product_custom_field_enum` | `DELETE /product-custom-field-enums/{id}/` | [Delete Product custom field enumeration](https://docs.licensespring.com/management-api/product/custom-fields-enumerations/delete-product-custom-field-enumeration) |
| `list_installation_files` | `GET /installation-files/` | [List Installation Files](https://docs.licensespring.com/management-api/product/installation-files/list-installation-files) |
| `get_installation_file` | `GET /installation-files/{id}/` | [Retrieve Installation File](https://docs.licensespring.com/management-api/product/installation-files/retrieve-installation-file) |
| `create_installation_file` | `POST /installation-files/` | [Create Installation File](https://docs.licensespring.com/management-api/product/installation-files/create-installation-file) |
| `update_installation_file` | `PATCH /installation-files/{id}/` | [Update Installation File](https://docs.licensespring.com/management-api/product/installation-files/update-installation-file) |
| `delete_installation_file` | `DELETE /installation-files/{id}/` | [Delete Installation File](https://docs.licensespring.com/management-api/product/installation-files/delete-installation-file) |
| `list_license_policies` | `GET /license-templates/` | [List License Policies](https://docs.licensespring.com/management-api/license/license-policies/list-license-policies) |
| `get_license_policy` | `GET /license-templates/{id}/` | [Retrieve License Policy](https://docs.licensespring.com/management-api/license/license-policies/retrieve-license-policy) |
| `create_license_policy` | `POST /license-templates/` | [Create License Policy](https://docs.licensespring.com/management-api/license/license-policies/create-license-policy) |
| `update_license_policy` | `PATCH /license-templates/{id}/` | [Update License Policy](https://docs.licensespring.com/management-api/license/license-policies/update-license-policy) |
| `delete_license_policy` | `DELETE /license-templates/{id}/` | [Delete License Policy](https://docs.licensespring.com/management-api/license/license-policies/delete-license-policy) |

### Devices (`devices`)

| Tool | Method & path | Docs |
| --- | --- | --- |
| `list_devices` | `GET /devices/` | [List Devices](https://docs.licensespring.com/management-api/device/list-devices) |
| `get_device` | `GET /devices/{id}/` | [Retrieve Device](https://docs.licensespring.com/management-api/device/retrieve-device) |
| `reset_device` | `POST /devices/{id}/reset/` | [Reset Device](https://docs.licensespring.com/management-api/device/reset-device) |
| `blacklist_device` | `POST /devices/{id}/blacklist/` | [Blacklist Device](https://docs.licensespring.com/management-api/device/blacklist-device) |
| `whitelist_device` | `POST /devices/{id}/whitelist/` | [Whitelist Device](https://docs.licensespring.com/management-api/device/whitelist-device) |
| `borrow_device` | `POST /devices/{id}/borrow/` | [Borrow Device](https://docs.licensespring.com/management-api/device/borrow-device) |
| `release_borrowed_device` | `POST /devices/{id}/borrow_release/` | [Release Borrowed Device](https://docs.licensespring.com/management-api/device/release-borrowed-device) |
| `list_device_variables` | `GET /device-variables/` | [List Device Variables](https://docs.licensespring.com/management-api/device/device-variables/list-device-variables) |
| `get_device_variable` | `GET /device-variables/{id}/` | [Retrieve Device Variable](https://docs.licensespring.com/management-api/device/device-variables/retrieve-device-variable) |
| `create_device_variable` | `POST /device-variables/` | [Create Device Variable](https://docs.licensespring.com/management-api/device/device-variables/create-device-variable) |
| `update_device_variable` | `PATCH /device-variables/{id}/` | [Update Device Variable](https://docs.licensespring.com/management-api/device/device-variables/update-device-variable) |
| `delete_device_variable` | `DELETE /device-variables/{id}/` | [Delete Device Variable](https://docs.licensespring.com/management-api/device/device-variables/delete-device-variable) |

### Analytics & history (`analytics`)

| Tool | Method & path | Docs |
| --- | --- | --- |
| `list_activities` | `GET /activities/` | [List Activities](https://docs.licensespring.com/management-api/analytics/list-activities) |
| `list_hourly_activities` | `GET /activities-hourly/` | [List Hourly Activities](https://docs.licensespring.com/management-api/analytics/hourly-activities/list-hourly-activities) |
| `list_hourly_activity_action_stats` | `GET /activities-hourly/actions_stats/` | [List Hourly Activities Actions Stats](https://docs.licensespring.com/management-api/analytics/hourly-activities/list-hourly-activities-actions-stats) |
| `list_hourly_activity_top_customers` | `GET /activities-hourly/top_call_count_customers/` | [List Hourly Activities Top Call Counts For Customers](https://docs.licensespring.com/management-api/analytics/hourly-activities/list-hourly-activities-top-call-counts-for-customers) |
| `list_hourly_activity_top_licenses` | `GET /activities-hourly/top_call_count_licenses/` | [List Hourly Activities Top Call Counts For Licenses](https://docs.licensespring.com/management-api/analytics/hourly-activities/list-hourly-activities-top-call-counts-for-licenses) |
| `list_hourly_activity_top_orders` | `GET /activities-hourly/top_call_count_orders/` | [List Hourly Activities Top Call Counts For Orders](https://docs.licensespring.com/management-api/analytics/hourly-activities/list-hourly-activities-top-call-counts-for-orders) |
| `list_hourly_activity_total_calls` | `GET /activities-hourly/total_call_count/` | [List Hourly Activities Total Call Counts](https://docs.licensespring.com/management-api/analytics/hourly-activities/list-hourly-activities-total-call-counts) |
| `list_license_activation_histories` | `GET /license-activation-histories/` | [List License Activation Histories](https://docs.licensespring.com/management-api/license/activation-histories/list-license-activation-histories) |
| `get_license_activation_history` | `GET /license-activation-histories/{id}/` | [Retrieve License Activation History](https://docs.licensespring.com/management-api/license/activation-histories/retrieve-license-activation-history) |
| `count_license_transfers` | `GET /license-activation-histories/transfer_count/` | [Count License Transfers](https://docs.licensespring.com/management-api/license/activation-histories/count-license-transfers) |
| `list_license_usage_histories` | `GET /license-histories/` | [List License Usage Histories](https://docs.licensespring.com/management-api/license/usage-histories/list-license-usage-histories) |
| `get_license_usage_history` | `GET /license-histories/{id}/` | [Retrieve License Usage History](https://docs.licensespring.com/management-api/license/usage-histories/retrieve-license-usage-history) |
| `export_license_usage_histories` | `GET /license-histories/export` | [Export license histories](https://docs.licensespring.com/management-api/license/usage-histories/export-license-histories) |

### Consumption pools (`consumption_pools`)

| Tool | Method & path | Docs |
| --- | --- | --- |
| `list_consumption_pools` | `GET /consumption-pools/` | [List Consumption Pools](https://docs.licensespring.com/management-api/license/consumption-pools/list-consumption-pools) |
| `get_consumption_pool` | `GET /consumption-pools/{id}/` | [Retrieve Consumption Pool](https://docs.licensespring.com/management-api/license/consumption-pools/retrieve-consumption-pool) |
| `create_consumption_pool` | `POST /consumption-pools/` | [Create Consumption Pool](https://docs.licensespring.com/management-api/license/consumption-pools/create-consumption-pool) |
| `update_consumption_pool` | `PATCH /consumption-pools/{id}/` | [Update Consumption Pool](https://docs.licensespring.com/management-api/license/consumption-pools/update-consumption-pool) |
| `delete_consumption_pool` | `DELETE /consumption-pools/{id}/` | [Delete Consumption Pool](https://docs.licensespring.com/management-api/license/consumption-pools/delete-consumption-pool) |
| `list_consumption_pool_members` | `GET /consumption-pools/{id}/members/` | [List Consumption Pool members](https://docs.licensespring.com/management-api/license/consumption-pools/list-consumption-pool-members) |
| `list_consumption_pool_license_checkouts` | `GET /consumption-pool-license-checkouts/` | [List Consumption Pool License checkouts](https://docs.licensespring.com/management-api/license/consumption-pools/license-checkouts/list-consumption-pool-license-checkouts) |
| `get_consumption_pool_license_checkout` | `GET /consumption-pool-license-checkouts/{id}/` | [Retrieve Consumption Pool License checkout](https://docs.licensespring.com/management-api/license/consumption-pools/license-checkouts/retrieve-consumption-pool-license-checkout) |
| `list_consumption_pool_feature_checkouts` | `GET /consumption-pool-license-feature-checkouts/` | [List Consumption Pool License Feature checkouts](https://docs.licensespring.com/management-api/license/consumption-pools/license-feature-checkouts/list-consumption-pool-license-feature-checkouts) |
| `get_consumption_pool_feature_checkout` | `GET /consumption-pool-license-feature-checkouts/{id}/` | [Retrieve Consumption Pool License Feature checkout](https://docs.licensespring.com/management-api/license/consumption-pools/license-feature-checkouts/retrieve-consumption-pool-license-feature-checkout) |

### OAuth clients (`oauth_clients`)

| Tool | Method & path | Docs |
| --- | --- | --- |
| `get_license_oauth_client` | `GET /licenses/{id}/client` | [Get Client](https://docs.licensespring.com/management-api/oauth/license/get-client) |
| `create_license_oauth_client` | `POST /licenses/{id}/client` | [Create Client](https://docs.licensespring.com/management-api/oauth/license/create-client) |
| `delete_license_oauth_client` | `DELETE /licenses/{id}/client` | [Delete Client](https://docs.licensespring.com/management-api/oauth/license/delete-client) |
| `get_customer_oauth_client` | `GET /customers/{id}/client` | [Get Client](https://docs.licensespring.com/management-api/oauth/customer/get-client) |
| `create_customer_oauth_client` | `POST /customers/{id}/client` | [Create Client](https://docs.licensespring.com/management-api/oauth/customer/create-client) |
| `delete_customer_oauth_client` | `DELETE /customers/{id}/client` | [Delete Client](https://docs.licensespring.com/management-api/oauth/customer/delete-client) |
| `get_customer_account_oauth_client` | `GET /customer-accounts/{id}/client` | [Get Client](https://docs.licensespring.com/management-api/oauth/customer-account/get-client) |
| `create_customer_account_oauth_client` | `POST /customer-accounts/{id}/client` | [Create Client](https://docs.licensespring.com/management-api/oauth/customer-account/create-client) |
| `delete_customer_account_oauth_client` | `DELETE /customer-accounts/{id}/client` | [Delete Client](https://docs.licensespring.com/management-api/oauth/customer-account/delete-client) |

### Documentation inconsistencies handled

- [Update License user group](https://docs.licensespring.com/management-api/license/user-groups/update-license-user-group) prints `PATCH /api/v1/license-users/{id}/`, which is the Update License User route. `update_license_user_group` uses `PATCH /api/v1/license-user-groups/{id}/`, consistent with the other license user group endpoints.
- [List License User Groups for License User](https://docs.licensespring.com/management-api/license/users/list-license-user-groups-for-license-user) prints the same route as List License User Group Members (`GET /license-user-groups/{id}/members/`); it is served by `list_license_user_group_members`.
- [Export Product Features](https://docs.licensespring.com/management-api/product/features/export-product-features) prints the same route as Export Products (`GET /products/export/`); it is served by `export_products`.
- [Change Customer on Order](https://docs.licensespring.com/management-api/order/change-customer-on-order) is the `customer` field of `update_order` (same `PATCH /orders/{id}/` route).
- License endpoints spell the yearly consumption period `annualy`; product feature and consumption pool endpoints spell it `annually`. Each tool accepts the spelling its endpoint documents.

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
| Management API coverage | 15 tools, several on wrong routes | 173 tools covering every documented endpoint, with toolset and read-only filters |
| Coverage | 1 unit test file (auth) | Every module and tool tested, with 100% coverage enforced in CI |
