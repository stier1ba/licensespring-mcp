import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createManagementApiServer } from '../../src/management-api/server.js';
import { createManagementApiTools } from '../../src/management-api/tools/index.js';
import { ManagementApiClient } from '../../src/utils/http.js';
import { callTool, connect, mockAxios, resultText, type MockResponder, type RecordedRequest } from './helpers.js';

let respond: MockResponder;
const { http, requests } = mockAxios((request) => respond(request));
const apiClient = new ManagementApiClient({ baseUrl: 'https://saas.test', apiKey: 'mk', timeoutMs: 1000, maxRetries: 0, readOnly: false }, { http });
let client: Client;

beforeAll(async () => {
  client = await connect(createManagementApiServer(apiClient, { baseUrl: 'https://saas.test' }));
});
afterAll(async () => client.close());
beforeEach(() => {
  requests.length = 0;
  respond = () => ({ data: { ok: true } });
});

function split(request: RecordedRequest) {
  const [path, qs = ''] = request.url.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs)) };
}

type Case = [tool: string, args: Record<string, unknown>, method: string, path: string, query: Record<string, string>, body?: unknown];

const cases: Case[] = [
  // Licenses
  ['list_licenses', { limit: 10, offset: 20, order_by: '-created_at', customer_email: 'a@b.io', enabled: false, filters: { license_key__icontains: 'AB', is_trial: true } },
    'GET', '/api/v1/licenses/', { limit: '10', offset: '20', order_by: '-created_at', customer_email: 'a@b.io', enabled: 'false', license_key__icontains: 'AB', is_trial: 'true' }],
  ['list_licenses', {}, 'GET', '/api/v1/licenses/', {}],
  ['get_license', { id: 1593781720493289 }, 'GET', '/api/v1/licenses/1593781720493289/', {}],
  ['update_license', { id: 5, max_activations: 3, is_trial: true, validity_period: '2030-01-02', consumption_pool: null }, 'PATCH', '/api/v1/licenses/5/', {},
    { max_activations: 3, is_trial: true, validity_period: '2030-01-02', consumption_pool: null }],
  ['delete_license', { id: 5 }, 'DELETE', '/api/v1/licenses/5/', {}],
  ['enable_license', { id: 5 }, 'POST', '/api/v1/licenses/5/enable/', {}],
  ['disable_license', { id: 5 }, 'POST', '/api/v1/licenses/5/disable/', {}],
  ['reset_license', { id: 5, reset_metadata: true }, 'POST', '/api/v1/licenses/5/reset/', {}, { reset_metadata: true }],
  ['reset_license_consumption', { id: 5 }, 'POST', '/api/v1/licenses/5/reset_consumption', {}],
  ['apply_license_policy', { id: 5, policy_code: 'gold', overrides: { max_activations: 9, policy_code: 'ignored' } }, 'POST', '/api/v1/licenses/5/apply_policy/', {},
    { max_activations: 9, policy_code: 'gold' }],
  ['apply_license_policy', { id: 5, policy_code: 'gold' }, 'POST', '/api/v1/licenses/5/apply_policy/', {}, { policy_code: 'gold' }],
  ['update_license_features', { id: 5, product_features: [{ product_feature: 'f2', max_consumption: 88 }] }, 'POST', '/api/v1/licenses/5/update_features/', {},
    { product_features: [{ product_feature: 'f2', max_consumption: 88 }] }],
  ['bulk_update_licenses', { licenses: [{ id: 1, is_trial: true }, { id: 2, enable_maintenance_period: true, maintenance_duration: '4m' }] },
    'PATCH', '/api/v1/licenses/bulk_update/', {}, [{ id: 1, is_trial: true }, { id: 2, enable_maintenance_period: true, maintenance_duration: '4m' }]],
  ['bulk_disable_licenses', { license_ids: [1, 2, 3] }, 'POST', '/api/v1/licenses/disable_bulk/', {}, [1, 2, 3]],
  ['check_license_status', { hardware_id: 'HW', product: 'P', license_key: 'K' }, 'GET', '/api/v1/licenses/check_license/', { hardware_id: 'HW', product: 'P', license_key: 'K' }],
  ['list_license_import_results', { limit: 5 }, 'GET', '/api/v1/licenses-import-results/', { limit: '5' }],
  // License users
  ['assign_user_to_license', { license_id: 5, email: 'u@x.io', is_manager: false, max_activations: 2 }, 'POST', '/api/v1/licenses/5/assign_user/', {},
    { email: 'u@x.io', is_manager: false, max_activations: 2 }],
  ['assign_users_to_license', { license_id: 5, emails: [{ email: 'a@x.io', is_manager: true }] }, 'POST', '/api/v1/licenses/5/assign_users/', {},
    { emails: [{ email: 'a@x.io', is_manager: true }] }],
  ['unassign_user_from_license', { license_id: 5, license_user_id: 9 }, 'POST', '/api/v1/licenses/5/unassign_user/', {}, { license_user_id: 9 }],
  ['unassign_user_from_license', { license_id: 5, license_user_email: 'u@x.io' }, 'POST', '/api/v1/licenses/5/unassign_user/', {}, { license_user_email: 'u@x.io' }],
  ['set_user_activations', { license_id: 5, user_activations: { 2449: { max_activations: 100 } } }, 'POST', '/api/v1/licenses/5/set_users_activations/', {},
    { 2449: { max_activations: 100 } }],
  ['list_license_users', { filters: { true_email__icontains: 'acme' } }, 'GET', '/api/v1/license-users/', { true_email__icontains: 'acme' }],
  ['get_license_user', { id: 9 }, 'GET', '/api/v1/license-users/9/', {}],
  ['create_license_user', { email: 'u@x.io', metadata: { a: 1 } }, 'POST', '/api/v1/license-users/', {}, { email: 'u@x.io', metadata: { a: 1 } }],
  ['update_license_user', { id: 9, first_name: 'Harry' }, 'PATCH', '/api/v1/license-users/9/', {}, { first_name: 'Harry' }],
  ['delete_license_user', { id: 9 }, 'DELETE', '/api/v1/license-users/9/', {}],
  ['set_license_user_password', { id: 9, password: 'pw' }, 'POST', '/api/v1/license-users/9/set_password/', {}, { password: 'pw' }],
  ['set_license_user_password', { email: 'u+1@x.io', password: 'pw' }, 'POST', '/api/v1/license-users/set_password/', { email: 'u+1@x.io' }, { password: 'pw' }],
  // License features
  ['list_license_features', { license: 5 }, 'GET', '/api/v1/license-product-features/', { license: '5' }],
  ['update_license_feature', { id: 3, max_consumption: 20, consumption_period: 'annualy' }, 'PATCH', '/api/v1/license-product-features/3/', {},
    { max_consumption: 20, consumption_period: 'annualy' }],
  // Orders
  ['list_orders', { order_by: 'created_at', filters: { store_id: 'S1' } }, 'GET', '/api/v1/orders/', { order_by: 'created_at', store_id: 'S1' }],
  ['get_order', { id: 4 }, 'GET', '/api/v1/orders/4/', {}],
  ['create_order', { id: 'order-1', items: [{ product_code: 'P', licenses: [{ key: 'AAAA', max_activations: 2 }] }], customer: { email: 'c@x.io' }, metadata: { crm: 7 } },
    'POST', '/api/v1/orders/create_order/', {},
    { id: 'order-1', items: [{ product_code: 'P', licenses: [{ key: 'AAAA', max_activations: 2 }] }], customer: { email: 'c@x.io' }, metadata: '{"crm":7}' }],
  ['create_order', { id: 'order-2', items: [{ product_code: 'P', licenses: [{ users: [{ email: 'u@x.io' }] }] }] }, 'POST', '/api/v1/orders/create_order/', {},
    { id: 'order-2', items: [{ product_code: 'P', licenses: [{ users: [{ email: 'u@x.io' }] }] }] }],
  ['update_order', { id: 4, store_id: 'new' }, 'PATCH', '/api/v1/orders/4/', {}, { store_id: 'new' }],
  ['delete_order', { id: 4 }, 'DELETE', '/api/v1/orders/4/safe_delete/', {}],
  ['generate_license_keys', { product: 'P', quantity: 3, key_length: 20 }, 'GET', '/api/v1/orders/generate_license/', { product: 'P', quantity: '3', key_length: '20' }],
  ['generate_license_keys', { product: 'P' }, 'GET', '/api/v1/orders/generate_license/', { product: 'P', quantity: '1' }],
  // Customers
  ['list_customers', { email: 'c@x.io' }, 'GET', '/api/v1/customers/', { email: 'c@x.io' }],
  ['get_customer', { id: 2 }, 'GET', '/api/v1/customers/2/', {}],
  ['create_customer', { email: 'c@x.io', first_name: 'Harry', customer_account: 1 }, 'POST', '/api/v1/customers/', {}, { email: 'c@x.io', first_name: 'Harry', customer_account: 1 }],
  ['update_customer', { id: 2, first_name: 'Toni' }, 'PATCH', '/api/v1/customers/2/', {}, { first_name: 'Toni' }],
  ['delete_customer', { id: 2 }, 'DELETE', '/api/v1/customers/2/', {}],
  ['list_customer_accounts', { filters: { code: 'acme' } }, 'GET', '/api/v1/customer-accounts/', { code: 'acme' }],
  ['get_customer_account', { id: 8 }, 'GET', '/api/v1/customer-accounts/8/', {}],
  ['create_customer_account', { code: 'tc6', name: 'Test' }, 'POST', '/api/v1/customer-accounts/', {}, { code: 'tc6', name: 'Test' }],
  // Products
  ['list_products', { filters: { is_bundle: true } }, 'GET', '/api/v1/products/', { is_bundle: 'true' }],
  ['get_product', { id: 11 }, 'GET', '/api/v1/products/11/', {}],
  ['list_product_features', { product: 11 }, 'GET', '/api/v1/product-features/', { product: '11' }],
  ['list_license_policies', { product: 11 }, 'GET', '/api/v1/license-templates/', { product: '11' }],
  ['list_installation_files', { product: 11 }, 'GET', '/api/v1/installation-files/', { product: '11' }],
  // Devices
  ['list_devices', { license: 5, hardware_id: 'HW', order_by: '-id' }, 'GET', '/api/v1/devices/', { license: '5', hardware_id: 'HW', order_by: '-id' }],
  ['get_device', { id: 12 }, 'GET', '/api/v1/devices/12/', {}],
  ['reset_device', { id: 12 }, 'POST', '/api/v1/devices/12/reset/', {}],
  ['blacklist_device', { id: 12 }, 'POST', '/api/v1/devices/12/blacklist/', {}],
  ['whitelist_device', { id: 12 }, 'POST', '/api/v1/devices/12/whitelist/', {}],
  ['borrow_device', { id: 12, borrowed_until: '2026-04-14T12:30:50' }, 'POST', '/api/v1/devices/12/borrow/', {}, { borrowed_until: '2026-04-14T12:30:50' }],
  ['release_borrowed_device', { id: 12 }, 'POST', '/api/v1/devices/12/borrow_release/', {}],
  ['list_device_variables', { device: 12 }, 'GET', '/api/v1/device-variables/', { device: '12' }],
  // History & analytics
  ['list_license_activation_histories', { license: 5, filters: { action: 'activation' } }, 'GET', '/api/v1/license-activation-histories/', { license: '5', action: 'activation' }],
  ['list_license_usage_histories', { license: 5 }, 'GET', '/api/v1/license-histories/', { license: '5' }],
  ['list_activities', { filters: { action__in: 'check,activation' } }, 'GET', '/api/v1/activities/', { action__in: 'check,activation' }],
  // Licenses (extended)
  ['reset_licenses_bulk', { id: 5, license_ids: [5, 6] }, 'POST', '/api/v1/licenses/5/reset_bulk/', {}, [5, 6]],
  ['reset_licenses_custom_bulk', { license_ids: [5], reset_consumptions: true }, 'POST', '/api/v1/licenses/custom_bulk_reset', {}, { license_ids: [5], reset_consumptions: true }],
  ['export_license_users', { id: 5 }, 'GET', '/api/v1/licenses/5/export_license_users/', {}],
  ['get_license_import_result', { id: 3 }, 'GET', '/api/v1/licenses-import-results/3/', {}],
  ['list_license_feature_import_results', { filters: { status__iexact: 'error' } }, 'GET', '/api/v1/license-features-import-results/', { status__iexact: 'error' }],
  ['get_license_feature_import_result', { id: 3 }, 'GET', '/api/v1/license-features-import-results/3/', {}],
  ['get_license_feature', { id: 3 }, 'GET', '/api/v1/license-product-features/3/', {}],
  ['create_license_feature', { license: 5, product_feature: 128, max_consumption: 80, expiry_date: '2029-12-12' }, 'POST', '/api/v1/license-product-features/', {},
    { license: 5, product_feature: 128, max_consumption: 80, expiry_date: '2029-12-12' }],
  ['delete_license_feature', { id: 3 }, 'DELETE', '/api/v1/license-product-features/3/', {}],
  ['release_license_feature_device', { id: 3, device: 90 }, 'POST', '/api/v1/license-product-features/3/release_device/', {}, { device: 90 }],
  ['list_license_custom_fields', { license: 5 }, 'GET', '/api/v1/license-custom-fields/', { license: '5' }],
  ['get_license_custom_field', { id: 7 }, 'GET', '/api/v1/license-custom-fields/7/', {}],
  ['create_license_custom_field', { license: 5, product_custom_field: 51, value: '23' }, 'POST', '/api/v1/license-custom-fields/', {}, { license: 5, product_custom_field: 51, value: '23' }],
  ['update_license_custom_field', { id: 7, value: '24' }, 'PATCH', '/api/v1/license-custom-fields/7/', {}, { value: '24' }],
  ['delete_license_custom_field', { id: 7 }, 'DELETE', '/api/v1/license-custom-fields/7/', {}],
  // License users (extended)
  ['add_license_user_to_group', { id: 9, license_user_group_id: 2 }, 'POST', '/api/v1/license-users/9/add_to_group/', {}, { license_user_group_id: 2 }],
  ['remove_license_user_from_group', { id: 9, license_user_group_id: 2 }, 'POST', '/api/v1/license-users/9/remove_from_group/', {}, { license_user_group_id: 2 }],
  ['list_license_manager_permissions', {}, 'GET', '/api/v1/license-manager-permissions/', {}],
  ['update_license_manager_permissions', { id: 9, permission_ids: [1, 2], products: [{ product_id: 7, num_of_licenses: null }], license_templates: [10], customer_account_ids: [834] },
    'POST', '/api/v1/license-users/9/update_lm_permissions/', {},
    { permission_ids: [1, 2], products: [{ product_id: 7, num_of_licenses: null }], license_templates: [10], customer_account_ids: [834] }],
  ['remove_license_manager_permissions', { id: 9 }, 'POST', '/api/v1/license-users/9/remove_lm_permissions/', {}],
  ['list_license_user_groups', { customer_account: 811 }, 'GET', '/api/v1/license-user-groups/', { customer_account: '811' }],
  ['get_license_user_group', { id: 4 }, 'GET', '/api/v1/license-user-groups/4/', {}],
  ['create_license_user_group', { code: 'lug10', name: 'Group 10' }, 'POST', '/api/v1/license-user-groups/', {}, { code: 'lug10', name: 'Group 10' }],
  ['update_license_user_group', { id: 4, description: 'Harry' }, 'PATCH', '/api/v1/license-user-groups/4/', {}, { description: 'Harry' }],
  ['delete_license_user_group', { id: 4 }, 'DELETE', '/api/v1/license-user-groups/4/', {}],
  ['list_license_user_group_members', { id: 4 }, 'GET', '/api/v1/license-user-groups/4/members/', {}],
  ['list_license_user_group_managers', { id: 4 }, 'GET', '/api/v1/license-user-groups/4/managers/', {}],
  ['add_license_user_group_manager', { id: 4, email: 'm@x.io', first_name: 'M' }, 'POST', '/api/v1/license-user-groups/4/add_manager/', {}, { email: 'm@x.io', first_name: 'M' }],
  ['remove_license_user_group_manager', { id: 4, license_user_id: 3420 }, 'POST', '/api/v1/license-user-groups/4/remove_manager/', {}, { license_user_id: 3420 }],
  // Orders (extended)
  ['update_order', { id: 4, customer: 123 }, 'PATCH', '/api/v1/orders/4/', {}, { customer: 123 }],
  ['export_orders', { range: 'last30' }, 'GET', '/api/v1/orders/export/', { range: 'last30' }],
  ['export_orders', { from: '2020-07-04', to: '2020-07-10' }, 'GET', '/api/v1/orders/export/', { from: '2020-07-04', to: '2020-07-10' }],
  ['export_order', { id: 4 }, 'GET', '/api/v1/orders/4/export/', {}],
  ['list_order_managers', { id: 4 }, 'GET', '/api/v1/orders/4/managers/', {}],
  ['add_order_manager', { id: 4, email: 'm@x.io', password: 'pw' }, 'POST', '/api/v1/orders/4/add_manager/', {}, { email: 'm@x.io', password: 'pw' }],
  ['add_order_managers', { id: 4, managers: [{ email: 'a@x.io' }, { email: 'b@x.io', last_name: 'B' }] }, 'POST', '/api/v1/orders/4/add_managers/', {},
    [{ email: 'a@x.io' }, { email: 'b@x.io', last_name: 'B' }]],
  ['remove_order_manager', { id: 4, license_user_id: 2149 }, 'POST', '/api/v1/orders/4/remove_manager/', {}, { license_user_id: 2149 }],
  // Customers (extended)
  ['merge_customers', { id: 2, customer_to_merge_id: 1013240 }, 'POST', '/api/v1/customers/2/merge/', {}, { customer_to_merge_id: 1013240 }],
  ['export_customers', {}, 'GET', '/api/v1/customers/export/', {}],
  ['list_customer_import_results', {}, 'GET', '/api/v1/customers-import-results/', {}],
  ['get_customer_import_result', { id: 1 }, 'GET', '/api/v1/customers-import-results/1/', {}],
  ['list_customer_labels', { limit: 50 }, 'GET', '/api/v1/clabels/', { limit: '50' }],
  ['get_customer_label', { id: 8 }, 'GET', '/api/v1/clabels/8/', {}],
  ['create_customer_label', { label: 'VIP', color: '#2e86de' }, 'POST', '/api/v1/clabels/', {}, { label: 'VIP', color: '#2e86de' }],
  ['update_customer_label', { id: 8, color: '#000000' }, 'PATCH', '/api/v1/clabels/8/', {}, { color: '#000000' }],
  ['delete_customer_label', { id: 8 }, 'DELETE', '/api/v1/clabels/8/', {}],
  ['add_label_to_customer', { customer: 101, customer_label: 53 }, 'POST', '/api/v1/customerclabels/', {}, { customer: 101, customer_label: 53 }],
  ['remove_label_from_customer', { id: 3 }, 'DELETE', '/api/v1/customerclabels/3/', {}],
  ['update_customer_account', { id: 8, description: 'test desc' }, 'PATCH', '/api/v1/customer-accounts/8/', {}, { description: 'test desc' }],
  ['delete_customer_account', { id: 8 }, 'DELETE', '/api/v1/customer-accounts/8/', {}],
  ['list_customer_account_managers', { id: 8 }, 'GET', '/api/v1/customer-accounts/8/managers/', {}],
  ['add_customer_account_manager', { id: 8, email: 'm@x.io' }, 'POST', '/api/v1/customer-accounts/8/add_manager/', {}, { email: 'm@x.io' }],
  ['remove_customer_account_manager', { id: 8, license_user_id: 3420 }, 'POST', '/api/v1/customer-accounts/8/remove_manager/', {}, { license_user_id: 3420 }],
  // OAuth clients
  ['get_license_oauth_client', { id: 5 }, 'GET', '/api/v1/licenses/5/client', {}],
  ['create_license_oauth_client', { id: 5 }, 'POST', '/api/v1/licenses/5/client', {}],
  ['delete_license_oauth_client', { id: 5 }, 'DELETE', '/api/v1/licenses/5/client', {}],
  ['get_customer_oauth_client', { id: 2 }, 'GET', '/api/v1/customers/2/client', {}],
  ['create_customer_oauth_client', { id: 2 }, 'POST', '/api/v1/customers/2/client', {}],
  ['delete_customer_oauth_client', { id: 2 }, 'DELETE', '/api/v1/customers/2/client', {}],
  ['get_customer_account_oauth_client', { id: 8 }, 'GET', '/api/v1/customer-accounts/8/client', {}],
  ['create_customer_account_oauth_client', { id: 8 }, 'POST', '/api/v1/customer-accounts/8/client', {}],
  ['delete_customer_account_oauth_client', { id: 8 }, 'DELETE', '/api/v1/customer-accounts/8/client', {}],
  // Products (extended)
  ['create_product', { product_name: 'Tool', short_code: 'tool-1', authorization_method: 'license-key', default_license_type: 'perpetual' }, 'POST', '/api/v1/products/', {},
    { product_name: 'Tool', short_code: 'tool-1', authorization_method: 'license-key', default_license_type: 'perpetual' }],
  ['export_products', {}, 'GET', '/api/v1/products/export/', {}],
  ['list_bundle_products', { id: 11 }, 'GET', '/api/v1/products/11/bundle/', {}],
  ['list_product_bundles', { id: 11 }, 'GET', '/api/v1/products/11/in_bundle/', {}],
  ['add_product_to_bundle', { id: 11, product_id: 12 }, 'POST', '/api/v1/products/11/add_to_bundle/', {}, { product_id: 12 }],
  ['remove_product_from_bundle', { id: 11, product_id: 12 }, 'POST', '/api/v1/products/11/remove_from_bundle/', {}, { product_id: 12 }],
  ['get_product_feature', { id: 194 }, 'GET', '/api/v1/product-features/194/', {}],
  ['create_product_feature', { product: 11, name: 'f4', code: 'f4', feature_type: 'consumption', consumption_period: 'annually' }, 'POST', '/api/v1/product-features/', {},
    { product: 11, name: 'f4', code: 'f4', feature_type: 'consumption', consumption_period: 'annually' }],
  ['update_product_feature', { id: 194, is_deleted: true }, 'PATCH', '/api/v1/product-features/194/', {}, { is_deleted: true }],
  ['delete_product_feature', { id: 194 }, 'DELETE', '/api/v1/product-features/194/', {}],
  ['list_product_custom_fields', { product: 11 }, 'GET', '/api/v1/product-custom-fields/', { product: '11' }],
  ['get_product_custom_field', { id: 51 }, 'GET', '/api/v1/product-custom-fields/51/', {}],
  ['create_product_custom_field', { product: 11, name: 'cf2', default_value: '2', data_type: 'number' }, 'POST', '/api/v1/product-custom-fields/', {},
    { product: 11, name: 'cf2', default_value: '2', data_type: 'number' }],
  ['update_product_custom_field', { id: 51, name: 'cf44' }, 'PATCH', '/api/v1/product-custom-fields/51/', {}, { name: 'cf44' }],
  ['delete_product_custom_field', { id: 51 }, 'DELETE', '/api/v1/product-custom-fields/51/', {}],
  ['list_product_custom_field_enums', { product_custom_field: 51 }, 'GET', '/api/v1/product-custom-field-enums/', { product_custom_field: '51' }],
  ['get_product_custom_field_enum', { id: 6 }, 'GET', '/api/v1/product-custom-field-enums/6/', {}],
  ['create_product_custom_field_enum', { product_custom_field: 51, value: 'vv2' }, 'POST', '/api/v1/product-custom-field-enums/', {}, { product_custom_field: 51, value: 'vv2' }],
  ['update_product_custom_field_enum', { id: 6, value: 'f4' }, 'PATCH', '/api/v1/product-custom-field-enums/6/', {}, { value: 'f4' }],
  ['delete_product_custom_field_enum', { id: 6 }, 'DELETE', '/api/v1/product-custom-field-enums/6/', {}],
  ['get_installation_file', { id: 21 }, 'GET', '/api/v1/installation-files/21/', {}],
  ['create_installation_file', { product: 11, version: '1.0.4', environment: 'linux64', size: '600', release_date: '2024-04-05' }, 'POST', '/api/v1/installation-files/', {},
    { product: 11, version: '1.0.4', environment: 'linux64', size: '600', release_date: '2024-04-05' }],
  ['update_installation_file', { id: 21, version: '7' }, 'PATCH', '/api/v1/installation-files/21/', {}, { version: '7' }],
  ['delete_installation_file', { id: 21 }, 'DELETE', '/api/v1/installation-files/21/', {}],
  ['get_license_policy', { id: 938 }, 'GET', '/api/v1/license-templates/938/', {}],
  ['create_license_policy', { product: 11, code: 'gold', name: 'Gold', max_activations: 3, license_product_feature_templates: [{ id: 194, max_consumption: 100 }] },
    'POST', '/api/v1/license-templates/', {},
    { product: 11, code: 'gold', name: 'Gold', max_activations: 3, license_product_feature_templates: [{ id: 194, max_consumption: 100 }] }],
  ['update_license_policy', { id: 938, valid_duration: '1y' }, 'PATCH', '/api/v1/license-templates/938/', {}, { valid_duration: '1y' }],
  ['delete_license_policy', { id: 938 }, 'DELETE', '/api/v1/license-templates/938/', {}],
  // Devices (extended)
  ['get_device_variable', { id: 2018 }, 'GET', '/api/v1/device-variables/2018/', {}],
  ['create_device_variable', { device: 90001, variable: 'v', value: '2' }, 'POST', '/api/v1/device-variables/', {}, { device: 90001, variable: 'v', value: '2' }],
  ['update_device_variable', { id: 2018, value: 'ggg' }, 'PATCH', '/api/v1/device-variables/2018/', {}, { value: 'ggg' }],
  ['delete_device_variable', { id: 2018 }, 'DELETE', '/api/v1/device-variables/2018/', {}],
  // Analytics (extended)
  ['list_hourly_activities', { filters: { 'ts__date__gte': '2026-01-01' } }, 'GET', '/api/v1/activities-hourly/', { ts__date__gte: '2026-01-01' }],
  ['list_hourly_activity_action_stats', {}, 'GET', '/api/v1/activities-hourly/actions_stats/', {}],
  ['list_hourly_activity_top_customers', { limit: 5 }, 'GET', '/api/v1/activities-hourly/top_call_count_customers/', { limit: '5' }],
  ['list_hourly_activity_top_licenses', {}, 'GET', '/api/v1/activities-hourly/top_call_count_licenses/', {}],
  ['list_hourly_activity_top_orders', {}, 'GET', '/api/v1/activities-hourly/top_call_count_orders/', {}],
  ['list_hourly_activity_total_calls', {}, 'GET', '/api/v1/activities-hourly/total_call_count/', {}],
  ['get_license_activation_history', { id: 22 }, 'GET', '/api/v1/license-activation-histories/22/', {}],
  ['count_license_transfers', { license: 5 }, 'GET', '/api/v1/license-activation-histories/transfer_count/', { license: '5' }],
  ['get_license_usage_history', { id: 74336 }, 'GET', '/api/v1/license-histories/74336/', {}],
  ['export_license_usage_histories', { ts__gte: '2026-01-01T00:00:00Z', ts__lte: '2026-01-01T23:00:00Z', license: 5 }, 'GET', '/api/v1/license-histories/export',
    { ts__gte: '2026-01-01T00:00:00Z', ts__lte: '2026-01-01T23:00:00Z', license: '5' }],
  // Consumption pools
  ['list_consumption_pools', { customer_account: 811, order_by: 'name' }, 'GET', '/api/v1/consumption-pools/', { customer_account: '811', order_by: 'name' }],
  ['get_consumption_pool', { id: 1 }, 'GET', '/api/v1/consumption-pools/1/', {}],
  ['create_consumption_pool', { customer_account: 811, name: 'Acme', code: 'acme', type: 'license', max_consumptions: 1000, consumption_period: 'monthly' },
    'POST', '/api/v1/consumption-pools/', {}, { customer_account: 811, name: 'Acme', code: 'acme', type: 'license', max_consumptions: 1000, consumption_period: 'monthly' }],
  ['update_consumption_pool', { id: 1, max_consumptions: 2000 }, 'PATCH', '/api/v1/consumption-pools/1/', {}, { max_consumptions: 2000 }],
  ['delete_consumption_pool', { id: 1 }, 'DELETE', '/api/v1/consumption-pools/1/', {}],
  ['list_consumption_pool_members', { id: 1, filters: { id__in: '1,2' } }, 'GET', '/api/v1/consumption-pools/1/members/', { id__in: '1,2' }],
  ['list_consumption_pool_license_checkouts', { filters: { consumption_pool: 1 } }, 'GET', '/api/v1/consumption-pool-license-checkouts/', { consumption_pool: '1' }],
  ['get_consumption_pool_license_checkout', { id: 2 }, 'GET', '/api/v1/consumption-pool-license-checkouts/2/', {}],
  ['list_consumption_pool_feature_checkouts', {}, 'GET', '/api/v1/consumption-pool-license-feature-checkouts/', {}],
  ['get_consumption_pool_feature_checkout', { id: 2 }, 'GET', '/api/v1/consumption-pool-license-feature-checkouts/2/', {}],
];

describe('Management API tools', () => {
  it('registers all tools with annotations', async () => {
    const { tools } = await client.listTools();
    const names = createManagementApiTools(apiClient).map((tool) => tool.name);
    expect(tools.map((tool) => tool.name).sort()).toEqual([...names].sort());
    expect(new Set(names).size).toBe(names.length);
    expect(tools.find((tool) => tool.name === 'delete_license')?.annotations).toMatchObject({ destructiveHint: true });
    expect(tools.find((tool) => tool.name === 'list_licenses')?.annotations).toMatchObject({ readOnlyHint: true });
  });

  it('covers every tool in the request table', () => {
    const tested = new Set(cases.map(([tool]) => tool).concat(uploads.map(([tool]) => tool)));
    const untested = createManagementApiTools(apiClient).map((tool) => tool.name).filter((name) => !tested.has(name));
    expect(untested).toEqual([]);
  });

  it.each(cases)('%s → %s %s (%#)', async (tool, args, method, path, query, body) => {
    const result = await callTool(client, tool, args);
    expect(result.isError, resultText(result)).toBeFalsy();
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe(method);
    expect(split(requests[0])).toEqual({ path, query });
    if (body !== undefined) expect(requests[0].data).toEqual(body);
  });

  const uploads: Array<[string, string, string]> = [
    ['import_licenses_from_csv', '/api/v1/licenses/import_from_csv/', 'licenses.csv'],
    ['import_license_features_from_csv', '/api/v1/licenses/import_features_from_csv/', 'license-features.csv'],
    ['import_customers_from_csv', '/api/v1/customers/import_from_csv/', 'customers.csv'],
    ['import_products_from_csv', '/api/v1/products/import_from_csv/', 'products.csv'],
    ['import_product_features_from_csv', '/api/v1/product-features/import_from_csv/', 'product-features.csv'],
  ];

  it.each(uploads)('%s uploads CSV as multipart form data', async (tool, path, fileName) => {
    const result = await callTool(client, tool, { csv_content: 'a,b\n1,2\n' });
    expect(result.isError).toBeFalsy();
    expect(requests[0]).toMatchObject({ method: 'POST', url: path });
    expect(requests[0].headers['Content-Type']).toBe('multipart/form-data');
    const file = (requests[0].data as FormData).get('file') as File;
    expect(file.name).toBe(fileName);
    expect(file.type).toBe('text/csv');
    await expect(file.text()).resolves.toBe('a,b\n1,2\n');

    await callTool(client, tool, { csv_content: 'x', file_name: 'batch.csv' });
    expect(((requests[1].data as FormData).get('file') as File).name).toBe('batch.csv');
  });

  it.each([
    ['update_license', { id: 1, valid_duration: '1y', validity_period: '2030-01-01' }, 'valid_duration and validity_period cannot be sent'],
    ['bulk_update_licenses', { licenses: [{ id: 1, valid_duration: '1y', validity_period: '2030-01-01' }] }, 'valid_duration and validity_period cannot be sent'],
    ['unassign_user_from_license', { license_id: 1 }, 'Provide license_user_id or license_user_email'],
    ['set_license_user_password', { password: 'pw' }, 'Provide id or email'],
    ['check_license_status', { hardware_id: 'HW', product: 'P' }, 'Provide license_key or username'],
    ['export_orders', {}, 'Provide range, or both from and to'],
    ['export_orders', { from: '2020-01-01' }, 'Provide range, or both from and to'],
  ])('%s validates input combinations', async (tool, args, message) => {
    const result = await callTool(client, tool, args);
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain(message);
    expect(requests).toHaveLength(0);
  });

  it.each([
    ['update_license', { id: 1, validity_period: '01/02/2030' }],
    ['update_license', { id: 1, valid_duration: '2 years' }],
    ['set_user_activations', { license_id: 1, user_activations: {} }],
    ['set_user_activations', { license_id: 1, user_activations: { abc: { max_activations: 1 } } }],
    ['bulk_disable_licenses', { license_ids: [] }],
    ['get_license', { id: -1 }],
    ['create_customer_label', { label: 'x', color: 'red' }],
    ['create_product', { product_name: 'x', short_code: 'bad code!' }],
    ['create_installation_file', { product: 1, size: '12kb' }],
  ])('%s rejects invalid schema input', async (tool, args) => {
    const result = await callTool(client, tool, args);
    expect(result.isError).toBe(true);
    expect(requests).toHaveLength(0);
  });

  it('returns API validation errors as tool errors', async () => {
    respond = () => ({ status: 400, data: { email: ['Enter a valid email address.'] } });
    const result = await callTool(client, 'create_customer', { email: 'c@x.io' });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toBe('Create Customer failed: HTTP 400: email: Enter a valid email address.');
  });

  it('reports success for 204 responses', async () => {
    respond = () => ({ status: 204, data: '' });
    expect(JSON.parse(resultText(await callTool(client, 'delete_order', { id: 1 })))).toEqual({ success: true });
  });
});

describe('toolsets and read-only mode', () => {
  it('keeps config toolset names in sync with the tool modules', async () => {
    const { MANAGEMENT_TOOLSET_NAMES } = await import('../../src/config.js');
    const { MANAGEMENT_TOOLSETS } = await import('../../src/management-api/tools/index.js');
    expect([...MANAGEMENT_TOOLSET_NAMES].sort()).toEqual(Object.keys(MANAGEMENT_TOOLSETS).sort());
  });

  it('registers only the selected toolsets', async () => {
    const server = createManagementApiServer(apiClient, { baseUrl: 'https://saas.test', toolsets: ['orders', 'devices'] });
    const scoped = await connect(server);
    const names = (await scoped.listTools()).tools.map((tool) => tool.name);
    expect(names).toContain('create_order');
    expect(names).toContain('reset_device');
    expect(names).not.toContain('list_licenses');
    expect(names).toHaveLength(24);
    const health = await scoped.readResource({ uri: 'licensespring://health' });
    expect(JSON.parse(String((health.contents[0] as { text: string }).text)).environment).toMatchObject({ toolsets: ['orders', 'devices'], read_only: false });
    await scoped.close();
  });

  it('registers only read-only tools in read-only mode', async () => {
    const server = createManagementApiServer(apiClient, { baseUrl: 'https://saas.test', readOnly: true });
    const scoped = await connect(server);
    const { tools } = await scoped.listTools();
    expect(tools.length).toBeGreaterThan(50);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(tools.map((tool) => tool.name)).not.toContain('delete_license');
    await scoped.close();
  });
});
