import { z, type ZodRawShape } from 'zod';
import type { ApiClient } from '../utils/http.js';
import { compact } from '../utils/http.js';
import {
  defineTool,
  DESTRUCTIVE,
  IDEMPOTENT_WRITE,
  pathWith,
  READ_ONLY,
  ToolInputError,
  WRITE,
  type ToolDefinition,
} from '../tools.js';

/**
 * Management API (`/api/v1`) tools.
 *
 * @see https://docs.licensespring.com/management-api
 */

type Args = Record<string, unknown>;

const id = (what: string) => z.number().int().positive().describe(`${what} ID`);
const optionalString = (description: string) => z.string().optional().describe(description);
const optionalInt = (description: string) => z.number().int().optional().describe(description);
const optionalBool = (description: string) => z.boolean().optional().describe(description);
const date = (description: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected yyyy-mm-dd').optional().describe(description);
const duration = (description: string) =>
  z.string().regex(/^\d+[dmy]$/, 'Expected a duration such as 35d, 4m or 2y').optional().describe(description);
const consumptionPeriod = z
  .enum(['daily', 'weekly', 'monthly', 'annualy'])
  .optional()
  .describe('Consumption reset period (LicenseSpring spells the yearly value "annualy")');
const metadata = z.record(z.string(), z.unknown()).optional().describe('Custom metadata (JSON object)');

const filters = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .optional()
  .describe(
    'Additional filters passed as query parameters, using LicenseSpring filter syntax ' +
    '(e.g. {"customer_email__icontains": "acme", "metadata__plan": "\\"pro\\""}).',
  );

function listShape(options: { orderBy?: boolean; extra?: ZodRawShape } = {}): ZodRawShape {
  return {
    limit: z.number().int().min(1).max(1000).optional().describe('Results per page (API default 20, max 1000)'),
    offset: z.number().int().min(0).optional().describe('Index of the first result'),
    ...(options.orderBy
      ? { order_by: optionalString('Attribute to order by; prefix with "-" for descending (e.g. "-created_at")') }
      : {}),
    ...options.extra,
    filters,
  };
}

/** Flatten `filters` into the query alongside the explicit list parameters. */
function listQuery(args: Args): Args {
  const { filters: extra, ...rest } = args;
  return { ...((extra as Args | undefined) ?? {}), ...rest };
}

/** Fields accepted by the Update License endpoint (and per item by Bulk Update). */
const licenseUpdateFields = {
  max_activations: optionalInt('Maximum activations'),
  max_consumptions: optionalInt('Maximum consumptions'),
  allow_overages: optionalBool('Allow overages'),
  max_overages: optionalInt('Maximum overages'),
  reset_consumption: optionalBool('Reset consumption each period'),
  consumption_period: consumptionPeriod,
  is_trial: optionalBool('Trial license (send with valid_duration, validity_period or trial_days)'),
  trial_days: optionalInt('Trial length in days'),
  enable_maintenance_period: optionalBool('Enable maintenance period (send with maintenance_duration)'),
  maintenance_duration: duration('Maintenance duration, e.g. 35d, 4m, 2y'),
  is_floating: optionalBool('Floating license'),
  is_floating_cloud: optionalBool('Floating cloud license'),
  floating_users: optionalInt('Number of simultaneous floating users'),
  floating_timeout: optionalInt('Floating timeout in minutes'),
  valid_duration: duration('Validity duration, e.g. 35d, 4m, 2y (not together with validity_period)'),
  validity_period: date('Expiry date yyyy-mm-dd (not together with valid_duration)'),
  prevent_vm: optionalBool('Prevent activation on virtual machines'),
  note: optionalString('Note'),
  max_license_users: optionalInt('Maximum license users (0 = unlimited)'),
  max_transfers: optionalInt('Maximum device transfers (0 = unlimited)'),
  metadata,
  start_date: date('License start date yyyy-mm-dd'),
};

function checkValidity(update: Args): void {
  if (update.valid_duration !== undefined && update.validity_period !== undefined) {
    throw new ToolInputError('valid_duration and validity_period cannot be sent in the same update');
  }
}

const customerFields = {
  first_name: optionalString('First name'),
  last_name: optionalString('Last name'),
  company_name: optionalString('Company name'),
  phone: optionalString('Phone'),
  reference: optionalString('Custom reference, e.g. your CRM ID'),
  address: optionalString('Address'),
  postcode: optionalString('Postcode'),
  city: optionalString('City'),
  state: optionalString('State'),
  country: optionalString('Country'),
  customer_account: z.number().int().optional().describe('Customer account ID'),
  metadata,
};

const orderLicense = z
  .object({
    key: z.string().optional().describe('License key (key-based products; generated when omitted)'),
    users: z
      .array(z.object({
        email: z.string().email(),
        is_manager: z.boolean().optional(),
        max_activations: z.number().int().optional(),
      }))
      .optional()
      .describe('License users (user-based products)'),
  })
  .catchall(z.unknown())
  .describe(
    'License definition; besides key/users it accepts any documented license field, e.g. license_type, ' +
    'max_activations, valid_duration, validity_period, is_trial, trial_days, policy_code, product_features, custom_fields',
  );

const orderItem = z.object({
  product_code: z.string().min(1).describe('Product short code'),
  licenses: z.array(orderLicense).min(1).describe('Licenses to create for the product'),
  license_policy: z.string().optional().describe('License policy code'),
  note: z.string().optional(),
  subscription_id: z.string().optional(),
  customer_account_id: z.number().int().optional(),
  active: z.boolean().optional(),
});

export function createManagementApiTools(client: ApiClient): ToolDefinition[] {
  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, extra: { query?: Args; body?: unknown } = {}) =>
    client.request({ method, path: `/api/v1${path}`, ...extra });

  const list = (name: string, title: string, description: string, path: string, options: { orderBy?: boolean; extra?: ZodRawShape } = {}) =>
    defineTool({
      name,
      title,
      description,
      inputSchema: listShape(options),
      annotations: READ_ONLY,
      run: async (args) => call('GET', path, { query: listQuery(args) }),
    });

  const retrieve = (name: string, title: string, description: string, path: string, what: string) =>
    defineTool({
      name,
      title,
      description,
      inputSchema: { id: id(what) },
      annotations: READ_ONLY,
      run: async ({ id: value }) => call('GET', pathWith(path, { id: value as number })),
    });

  const action = (name: string, title: string, description: string, method: 'POST' | 'DELETE', path: string, what: string, annotations = DESTRUCTIVE) =>
    defineTool({
      name,
      title,
      description,
      inputSchema: { id: id(what) },
      annotations,
      run: async ({ id: value }) => call(method, pathWith(path, { id: value as number })),
    });

  return [
    // ----- Licenses --------------------------------------------------------
    list('list_licenses', 'List Licenses', 'List licenses. Use filters for any documented license filter (e.g. license_key__icontains, validity_period__lte, is_trial).', '/licenses/', {
      orderBy: true,
      extra: {
        license_key: optionalString('Exact license key'),
        customer_email: optionalString('Exact customer email'),
        customer_id: optionalInt('Customer ID'),
        product_id: optionalInt('Product ID'),
        enabled: optionalBool('Only enabled (true) or disabled (false) licenses'),
      },
    }),
    retrieve('get_license', 'Get License', 'Get full details of a license.', '/licenses/{id}/', 'License'),
    defineTool({
      name: 'update_license',
      title: 'Update License',
      description:
        'Update license settings. Send is_trial with valid_duration/validity_period/trial_days and ' +
        'enable_maintenance_period with maintenance_duration. Use enable_license/disable_license to toggle a license.',
      inputSchema: { id: id('License'), ...licenseUpdateFields, consumption_pool: z.number().int().nullable().optional().describe('Consumption pool ID, or null to unlink') },
      annotations: IDEMPOTENT_WRITE,
      run: async ({ id: value, ...update }) => {
        checkValidity(update);
        return call('PATCH', pathWith('/licenses/{id}/', { id: value as number }), { body: compact(update) });
      },
    }),
    action('delete_license', 'Delete License', 'Permanently delete a license.', 'DELETE', '/licenses/{id}/', 'License'),
    action('enable_license', 'Enable License', 'Enable a license.', 'POST', '/licenses/{id}/enable/', 'License', IDEMPOTENT_WRITE),
    action('disable_license', 'Disable License', 'Disable a license.', 'POST', '/licenses/{id}/disable/', 'License', IDEMPOTENT_WRITE),
    defineTool({
      name: 'reset_license',
      title: 'Reset License',
      description: 'Reset a license and all its devices.',
      inputSchema: {
        id: id('License'),
        reset_validity_period: optionalBool('Reset validity period (default true)'),
        reset_maintenance_period: optionalBool('Reset maintenance period (default true)'),
        reset_consumptions: optionalBool('Reset consumptions (default true)'),
        reset_metadata: optionalBool('Reset metadata (default false)'),
        reset_product_features: optionalBool('Reset product features (default false)'),
        reset_custom_fields: optionalBool('Reset custom fields (default false)'),
      },
      annotations: DESTRUCTIVE,
      run: async ({ id: value, ...options }) =>
        call('POST', pathWith('/licenses/{id}/reset/', { id: value as number }), { body: compact(options) }),
    }),
    action('reset_license_consumption', 'Reset License Consumption', 'Reset the consumptions of a license.', 'POST', '/licenses/{id}/reset_consumption', 'License'),
    defineTool({
      name: 'apply_license_policy',
      title: 'Apply License Policy',
      description: 'Apply a license policy (license template) to a license. Extra fields override the policy values.',
      inputSchema: {
        id: id('License'),
        policy_code: z.string().min(1).describe('License policy code'),
        overrides: z.record(z.string(), z.unknown()).optional().describe('Update License fields that override the policy'),
      },
      annotations: IDEMPOTENT_WRITE,
      run: async ({ id: value, policy_code, overrides }) =>
        call('POST', pathWith('/licenses/{id}/apply_policy/', { id: value as number }), {
          body: { ...((overrides as Args | undefined) ?? {}), policy_code },
        }),
    }),
    defineTool({
      name: 'update_license_features',
      title: 'Update License Features',
      description:
        'Replace the product features on a license: listed features are created or updated, features not listed are removed.',
      inputSchema: {
        id: id('License'),
        product_features: z
          .array(z.object({
            product_feature: z.string().min(1).describe('Product feature code'),
            max_consumption: z.number().int().optional(),
            total_consumptions: z.number().int().optional(),
            expiry_date: date('Expiry date yyyy-mm-dd'),
            allow_overages: z.boolean().optional(),
            max_overages: z.number().int().optional(),
            reset_consumption: z.boolean().optional(),
            consumption_period: consumptionPeriod,
          }))
          .describe('The complete list of features the license should have'),
      },
      annotations: DESTRUCTIVE,
      run: async ({ id: value, product_features }) =>
        call('POST', pathWith('/licenses/{id}/update_features/', { id: value as number }), { body: { product_features } }),
    }),
    defineTool({
      name: 'bulk_update_licenses',
      title: 'Bulk Update Licenses',
      description: 'Update several licenses in one request. Each item needs the license id plus the fields to change.',
      inputSchema: {
        licenses: z
          .array(z.object({ id: id('License'), ...licenseUpdateFields, installation_file: optionalInt('Installation file ID') }))
          .min(1)
          .max(1000),
      },
      annotations: IDEMPOTENT_WRITE,
      run: async ({ licenses }) => {
        const items = (licenses as Args[]).map((item) => {
          checkValidity(item);
          return compact(item);
        });
        return call('PATCH', '/licenses/bulk_update/', { body: items });
      },
    }),
    defineTool({
      name: 'bulk_disable_licenses',
      title: 'Bulk Disable Licenses',
      description: 'Disable several licenses in one request.',
      inputSchema: { license_ids: z.array(id('License')).min(1).max(1000) },
      annotations: IDEMPOTENT_WRITE,
      run: async ({ license_ids }) => call('POST', '/licenses/disable_bulk/', { body: license_ids }),
    }),
    defineTool({
      name: 'check_license_status',
      title: 'Check License Status',
      description: 'Check a license for a device from the back office (no activation is performed).',
      inputSchema: {
        hardware_id: z.string().min(1).describe('Hardware ID'),
        product: z.string().min(1).describe('Product short code'),
        license_key: optionalString('License key (key-based licenses)'),
        username: optionalString('License user email (user-based licenses)'),
      },
      annotations: READ_ONLY,
      run: async (args) => {
        if (!args.license_key && !args.username) {
          throw new ToolInputError('Provide license_key or username');
        }
        return call('GET', '/licenses/check_license/', { query: args });
      },
    }),
    defineTool({
      name: 'import_licenses_from_csv',
      title: 'Import Licenses from CSV',
      description:
        'Import licenses from CSV content. Required headers: license__license_key, product__short_code. ' +
        'Optional headers include customer__email, order__store_id and license__* fields. Check progress with list_license_import_results.',
      inputSchema: {
        csv_content: z.string().min(1).describe('Raw CSV text including the header row'),
        file_name: z.string().optional().describe('File name reported to LicenseSpring (default licenses.csv)'),
      },
      annotations: WRITE,
      run: async ({ csv_content, file_name }) => {
        const form = new FormData();
        form.append('file', new Blob([csv_content as string], { type: 'text/csv' }), (file_name as string | undefined) ?? 'licenses.csv');
        return client.request({
          method: 'POST',
          path: '/api/v1/licenses/import_from_csv/',
          body: form,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      },
    }),
    list('list_license_import_results', 'List License Import Results', 'List results of CSV license imports.', '/licenses-import-results/'),

    // ----- License users --------------------------------------------------
    defineTool({
      name: 'assign_user_to_license',
      title: 'Assign User to License',
      description: 'Assign a license user (by email) to a user-based license; the user is created when missing.',
      inputSchema: {
        license_id: id('License'),
        email: z.string().email(),
        first_name: optionalString('First name'),
        last_name: optionalString('Last name'),
        phone_number: optionalString('Phone number'),
        is_manager: optionalBool('Make the user a license manager'),
        password: optionalString('Initial password (generated when omitted)'),
        max_activations: optionalInt('Maximum activations for this user'),
        total_activations: optionalInt('Total activations already used'),
      },
      annotations: WRITE,
      run: async ({ license_id, ...user }) =>
        call('POST', pathWith('/licenses/{id}/assign_user/', { id: license_id as number }), { body: compact(user) }),
    }),
    defineTool({
      name: 'assign_users_to_license',
      title: 'Assign Users to License (Bulk)',
      description: 'Assign several license users (by email) to a user-based license.',
      inputSchema: {
        license_id: id('License'),
        emails: z.array(z.object({ email: z.string().email(), is_manager: z.boolean().optional() })).min(1),
      },
      annotations: WRITE,
      run: async ({ license_id, emails }) =>
        call('POST', pathWith('/licenses/{id}/assign_users/', { id: license_id as number }), { body: { emails } }),
    }),
    defineTool({
      name: 'unassign_user_from_license',
      title: 'Unassign User from License',
      description: 'Remove a license user from a license, by license user ID or email.',
      inputSchema: {
        license_id: id('License'),
        license_user_id: z.number().int().positive().optional().describe('License user ID'),
        license_user_email: z.string().email().optional().describe('License user email'),
      },
      annotations: DESTRUCTIVE,
      run: async ({ license_id, license_user_id, license_user_email }) => {
        if (!license_user_id && !license_user_email) {
          throw new ToolInputError('Provide license_user_id or license_user_email');
        }
        return call('POST', pathWith('/licenses/{id}/unassign_user/', { id: license_id as number }), {
          body: compact({ license_user_id, license_user_email }),
        });
      },
    }),
    defineTool({
      name: 'set_user_activations',
      title: 'Set User Activations',
      description: 'Set max activations and/or reset total activations for license users on a license.',
      inputSchema: {
        license_id: id('License'),
        user_activations: z
          .record(
            z.string().regex(/^\d+$/, 'Keys must be license user IDs'),
            z.object({
              max_activations: z.number().int().min(0).optional(),
              reset_total_activations: z.boolean().optional(),
            }),
          )
          .refine((value) => Object.keys(value).length > 0, 'At least one license user is required')
          .describe('Map of license user ID to activation settings'),
      },
      annotations: IDEMPOTENT_WRITE,
      run: async ({ license_id, user_activations }) =>
        call('POST', pathWith('/licenses/{id}/set_users_activations/', { id: license_id as number }), { body: user_activations }),
    }),
    list('list_license_users', 'List License Users', 'List license users. Filters include true_email__icontains, true_email__iexact, is_license_manager, license__order__customer_account.', '/license-users/'),
    retrieve('get_license_user', 'Get License User', 'Get a license user.', '/license-users/{id}/', 'License user'),
    defineTool({
      name: 'create_license_user',
      title: 'Create License User',
      description: 'Create a license user.',
      inputSchema: {
        email: z.string().email(),
        first_name: optionalString('First name'),
        last_name: optionalString('Last name'),
        phone_number: optionalString('Phone number'),
        password: optionalString('Initial password (generated when omitted)'),
        metadata,
      },
      annotations: WRITE,
      run: async (args) => call('POST', '/license-users/', { body: compact(args) }),
    }),
    defineTool({
      name: 'update_license_user',
      title: 'Update License User',
      description: 'Update the name or phone number of a license user.',
      inputSchema: {
        id: id('License user'),
        first_name: optionalString('First name'),
        last_name: optionalString('Last name'),
        phone_number: optionalString('Phone number'),
      },
      annotations: IDEMPOTENT_WRITE,
      run: async ({ id: value, ...update }) =>
        call('PATCH', pathWith('/license-users/{id}/', { id: value as number }), { body: compact(update) }),
    }),
    action('delete_license_user', 'Delete License User', 'Delete a license user.', 'DELETE', '/license-users/{id}/', 'License user'),
    defineTool({
      name: 'set_license_user_password',
      title: 'Set License User Password',
      description: 'Set the password of a license user, identified by ID or email.',
      inputSchema: {
        id: z.number().int().positive().optional().describe('License user ID'),
        email: z.string().email().optional().describe('License user email'),
        password: z.string().min(1).describe('New password'),
      },
      annotations: IDEMPOTENT_WRITE,
      run: async ({ id: value, email, password }) => {
        if (value) {
          return call('POST', pathWith('/license-users/{id}/set_password/', { id: value as number }), { body: { password } });
        }
        if (email) {
          return call('POST', '/license-users/set_password/', { query: { email }, body: { password } });
        }
        throw new ToolInputError('Provide id or email');
      },
    }),

    // ----- License features ------------------------------------------------
    list('list_license_features', 'List License Features', 'List license product features. Filters: license, consumption_pool.', '/license-product-features/', {
      extra: { license: optionalInt('License ID') },
    }),
    defineTool({
      name: 'update_license_feature',
      title: 'Update License Feature',
      description: 'Update a single license product feature.',
      inputSchema: {
        id: id('License product feature'),
        max_consumption: optionalInt('Maximum consumption'),
        allow_overages: optionalBool('Allow overages'),
        max_overages: optionalInt('Maximum overages'),
        consumption_period: consumptionPeriod,
        reset_consumption: optionalBool('Reset consumption each period'),
        allow_unlimited_consumptions: optionalBool('Allow unlimited consumptions'),
        allow_negative_consumptions: optionalBool('Allow negative consumptions'),
        expiry_date: date('Expiry date yyyy-mm-dd'),
        is_floating: optionalBool('Floating feature'),
        is_floating_cloud: optionalBool('Floating cloud feature'),
        floating_users: optionalInt('Simultaneous floating users'),
        floating_timeout: optionalInt('Floating timeout in minutes'),
        metadata,
      },
      annotations: IDEMPOTENT_WRITE,
      run: async ({ id: value, ...update }) =>
        call('PATCH', pathWith('/license-product-features/{id}/', { id: value as number }), { body: compact(update) }),
    }),

    // ----- Orders -----------------------------------------------------------
    list('list_orders', 'List Orders', 'List orders. Filters include store_id, customer__email__icontains, customer_id, customer__account.', '/orders/', { orderBy: true }),
    retrieve('get_order', 'Get Order', 'Get an order.', '/orders/{id}/', 'Order'),
    defineTool({
      name: 'create_order',
      title: 'Create Order',
      description:
        'Create an order with one or more licenses. This is how licenses are issued through the Management API.',
      inputSchema: {
        id: z.string().min(1).describe('Unique order ID chosen by you (e.g. a UUID or store order number)'),
        items: z.array(orderItem).min(1),
        customer: z
          .object({
            email: z.string().email().optional(),
            first_name: z.string().optional(),
            last_name: z.string().optional(),
            company_name: z.string().optional(),
            phone: z.string().optional(),
            reference: z.string().optional(),
          })
          .optional(),
        append: optionalBool('Append to an existing order with the same ID'),
        is_test: optionalBool('Test order'),
        is_bundle: optionalBool('Bundle order'),
        created: optionalString('Order creation timestamp'),
        language: optionalString('Language short code'),
        campaign_params: optionalString('Campaign parameters'),
        download_id: optionalString('Custom download ID'),
        prevent_vm: optionalBool('Prevent activation on virtual machines'),
        customer_account_id: optionalInt('Customer account ID'),
        add_to_customer_account: optionalBool('Assign the order to the customer account (default true)'),
        metadata,
      },
      annotations: WRITE,
      run: async ({ metadata: meta, ...order }) =>
        call('POST', '/orders/create_order/', {
          // The API expects order metadata as a serialized JSON string.
          body: compact({ ...order, metadata: meta === undefined ? undefined : JSON.stringify(meta) }),
        }),
    }),
    defineTool({
      name: 'update_order',
      title: 'Update Order',
      description: 'Update order fields, including moving it to another customer or customer account.',
      inputSchema: {
        id: id('Order'),
        store_id: optionalString('Store order ID'),
        type: optionalString('Order type'),
        is_test: optionalBool('Test order'),
        is_trial: optionalBool('Trial order'),
        download_id: optionalString('Download ID'),
        language: optionalString('Language short code'),
        campaign_params: optionalString('Campaign parameters'),
        customer: optionalInt('Customer ID'),
        customer_account: optionalInt('Customer account ID'),
      },
      annotations: IDEMPOTENT_WRITE,
      run: async ({ id: value, ...update }) =>
        call('PATCH', pathWith('/orders/{id}/', { id: value as number }), { body: compact(update) }),
    }),
    action('delete_order', 'Delete Order', 'Delete an order and its licenses.', 'DELETE', '/orders/{id}/safe_delete/', 'Order'),
    defineTool({
      name: 'generate_license_keys',
      title: 'Generate License Keys',
      description: 'Generate unused license keys for a product (keys are not assigned until used in an order).',
      inputSchema: {
        product: z.string().min(1).describe('Product short code'),
        quantity: z.number().int().min(1).max(1000).optional().describe('Number of keys (default 1)'),
        key_length: z.number().int().min(16).max(240).optional().describe('Characters per key (16-240, default 16)'),
        alphabet: optionalString('Allowed characters (default 23456789ABCDEFGHJKLMNPQRSTUVWXYZ)'),
      },
      annotations: READ_ONLY,
      run: async (args) => call('GET', '/orders/generate_license/', { query: { quantity: 1, ...args } }),
    }),

    // ----- Customers ----------------------------------------------------------
    list('list_customers', 'List Customers', 'List customers. Filters include email__icontains, company_name__icontains, reference, account__code.', '/customers/', {
      extra: { email: optionalString('Exact customer email') },
    }),
    retrieve('get_customer', 'Get Customer', 'Get a customer.', '/customers/{id}/', 'Customer'),
    defineTool({
      name: 'create_customer',
      title: 'Create Customer',
      description: 'Create a customer.',
      inputSchema: { email: z.string().email(), ...customerFields },
      annotations: WRITE,
      run: async (args) => call('POST', '/customers/', { body: compact(args) }),
    }),
    defineTool({
      name: 'update_customer',
      title: 'Update Customer',
      description: 'Update a customer.',
      inputSchema: { id: id('Customer'), email: z.string().email().optional(), ...customerFields },
      annotations: IDEMPOTENT_WRITE,
      run: async ({ id: value, ...update }) =>
        call('PATCH', pathWith('/customers/{id}/', { id: value as number }), { body: compact(update) }),
    }),
    action('delete_customer', 'Delete Customer', 'Delete a customer.', 'DELETE', '/customers/{id}/', 'Customer'),
    list('list_customer_accounts', 'List Customer Accounts', 'List customer accounts. Filters: code, name, email, reference.', '/customer-accounts/'),
    retrieve('get_customer_account', 'Get Customer Account', 'Get a customer account.', '/customer-accounts/{id}/', 'Customer account'),
    defineTool({
      name: 'create_customer_account',
      title: 'Create Customer Account',
      description: 'Create a customer account (a company grouping customers and license users).',
      inputSchema: {
        code: z.string().min(1).describe('Unique customer account code'),
        name: optionalString('Name'),
        description: optionalString('Description'),
        phone: optionalString('Phone'),
        address: optionalString('Address'),
        email: z.string().email().optional(),
      },
      annotations: WRITE,
      run: async (args) => call('POST', '/customer-accounts/', { body: compact(args) }),
    }),

    // ----- Products -----------------------------------------------------------
    list('list_products', 'List Products', 'List products. Filters: short_code, is_archived, is_bundle.', '/products/'),
    retrieve('get_product', 'Get Product', 'Get a product.', '/products/{id}/', 'Product'),
    list('list_product_features', 'List Product Features', 'List product features.', '/product-features/', {
      extra: { product: optionalInt('Product ID') },
    }),
    list('list_license_policies', 'List License Policies', 'List license policies (license templates). Filters: product, is_default, is_archived.', '/license-templates/', {
      extra: { product: optionalInt('Product ID') },
    }),
    list('list_installation_files', 'List Installation Files', 'List product installation files.', '/installation-files/', {
      extra: { product: optionalInt('Product ID') },
    }),

    // ----- Devices ------------------------------------------------------------
    list('list_devices', 'List Devices', 'List devices. Filters include license, hardware_id, hostname, blacklisted, device_active.', '/devices/', {
      orderBy: true,
      extra: { license: optionalInt('License ID'), hardware_id: optionalString('Hardware ID') },
    }),
    retrieve('get_device', 'Get Device', 'Get a device.', '/devices/{id}/', 'Device'),
    action('reset_device', 'Reset Device', 'Reset (deactivate) a device and free its activation.', 'POST', '/devices/{id}/reset/', 'Device'),
    action('blacklist_device', 'Blacklist Device', 'Blacklist a device so it can no longer activate.', 'POST', '/devices/{id}/blacklist/', 'Device'),
    action('whitelist_device', 'Whitelist Device', 'Remove a device from the blacklist.', 'POST', '/devices/{id}/whitelist/', 'Device', IDEMPOTENT_WRITE),
    defineTool({
      name: 'borrow_device',
      title: 'Borrow Device',
      description: 'Borrow a floating license for a device until the given time.',
      inputSchema: { id: id('Device'), borrowed_until: z.string().min(1).describe('ISO 8601 date-time, e.g. 2026-04-14T12:30:50') },
      annotations: WRITE,
      run: async ({ id: value, borrowed_until }) =>
        call('POST', pathWith('/devices/{id}/borrow/', { id: value as number }), { body: { borrowed_until } }),
    }),
    action('release_borrowed_device', 'Release Borrowed Device', 'Release a borrowed floating license from a device.', 'POST', '/devices/{id}/borrow_release/', 'Device', IDEMPOTENT_WRITE),
    list('list_device_variables', 'List Device Variables', 'List device variables.', '/device-variables/', {
      extra: { device: optionalInt('Device ID') },
    }),

    // ----- History & analytics ------------------------------------------------
    list('list_license_activation_histories', 'List License Activation Histories', 'List activation/deactivation history. Filters: license, action, ts__gte, ts__lte.', '/license-activation-histories/', {
      extra: { license: optionalInt('License ID') },
    }),
    list('list_license_usage_histories', 'List License Usage Histories', 'List license usage history entries. Filters: license, ts__gte, ts__lte.', '/license-histories/', {
      extra: { license: optionalInt('License ID') },
    }),
    list('list_activities', 'List Activities', 'List API activity records. Filters: action__in, product__in, license__in, status_code__in, ts__gte, ts__lte.', '/activities/'),
  ];
}
