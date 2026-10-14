import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { compact, handleApiError, ValidationError, type ManagementApiClient } from '../utils/http.js';
import type { Logger } from '../utils/logger.js';
import { createHealthState, registerHealthResource, type HealthState } from '../tools/health.js';
import { createRunner, DESTRUCTIVE, IDEMPOTENT_WRITE, READ_ONLY, WRITE } from '../tools/result.js';
import { VERSION } from '../version.js';

export const MANAGEMENT_SERVER_NAME = 'licensespring-management-api';
const API = '/api/v1';

export interface ManagementServerOptions {
  logger?: Logger;
  health?: HealthState;
}

const id = (label: string) => z.number().int().positive().describe(`${label} ID`);

const paginationShape = {
  limit: z.number().int().min(1).max(1000).optional().default(100).describe('Page size (max 1000)'),
  offset: z.number().int().min(0).optional().default(0).describe('Number of items to skip'),
  extra_filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
    .describe('Additional documented filters, e.g. {"metadata__plan": "pro"} or {"id__in": "1,2,3"}'),
};

/** Documented only for licenses, orders, devices and products lists. */
const orderBy = z.string().optional().describe('Sort field; prefix with "-" for descending, e.g. "-created_at"');

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const durationString = z.string().regex(/^\d+[hdmy]$/, 'Use a duration like "30d", "6m", "1y"');
// The docs spell the yearly period differently per endpoint: update endpoints use
// "annualy", the create-order schema uses "annually".
const consumptionPeriod = z.enum(['daily', 'weekly', 'monthly', 'annualy']).describe('Consumption reset period ("annualy" is this endpoint\'s spelling)');
const orderConsumptionPeriod = z.enum(['daily', 'weekly', 'monthly', 'annually']).describe('Consumption reset period');

/** Fields accepted by PATCH /licenses/{id}/ and each item of bulk update. */
const licenseUpdateShape = {
  is_trial: z.boolean().optional().describe('Required whenever validity_period, valid_duration or trial_days changes'),
  trial_days: z.number().int().min(0).optional(),
  validity_period: dateString.optional().describe('Expiry date YYYY-MM-DD (cannot be combined with valid_duration)'),
  valid_duration: durationString.optional().describe('Validity duration, e.g. "1y" (cannot be combined with validity_period)'),
  enable_maintenance_period: z.boolean().optional(),
  maintenance_duration: durationString.optional(),
  max_activations: z.number().int().min(0).optional(),
  max_consumptions: z.number().int().min(0).optional(),
  allow_overages: z.boolean().optional(),
  max_overages: z.number().int().min(0).optional(),
  reset_consumption: z.boolean().optional(),
  consumption_period: consumptionPeriod.optional(),
  is_floating: z.boolean().optional(),
  is_floating_cloud: z.boolean().optional(),
  floating_users: z.number().int().min(0).optional(),
  floating_timeout: z.number().int().min(0).optional().describe('Minutes before an inactive floating seat is released'),
  prevent_vm: z.boolean().optional(),
  max_license_users: z.number().int().min(0).optional().describe('0 = unlimited'),
  max_transfers: z.number().int().min(0).optional().describe('0 = unlimited'),
  note: z.string().optional(),
};

type LicenseUpdate = { [K in keyof typeof licenseUpdateShape]?: z.infer<(typeof licenseUpdateShape)[K]> };

/** Enforce the documented rules for validity changes. */
export function validateLicenseUpdate(update: LicenseUpdate, label = 'License update'): void {
  if (update.validity_period !== undefined && update.valid_duration !== undefined) {
    throw new ValidationError(`${label}: validity_period and valid_duration cannot be sent together.`);
  }
  if (update.maintenance_duration !== undefined && update.enable_maintenance_period === undefined) {
    throw new ValidationError(`${label}: enable_maintenance_period must be sent with maintenance_duration.`);
  }
  const changesValidity = update.validity_period !== undefined || update.valid_duration !== undefined || update.trial_days !== undefined;
  if (changesValidity && update.is_trial === undefined) {
    throw new ValidationError(`${label}: is_trial must be sent when changing validity_period, valid_duration or trial_days.`);
  }
}

const customerShape = {
  email: z.string().email().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company_name: z.string().optional(),
  phone: z.string().optional(),
  reference: z.string().optional().describe('Your own reference/ID for the customer'),
  address: z.string().optional(),
  postcode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  customer_account: z.number().int().positive().optional().describe('Customer account ID'),
  metadata: z.record(z.string(), z.unknown()).optional(),
};

const orderLicenseShape = z.object({
  key: z.string().optional().describe('License key (key-based). Generated if omitted.'),
  users: z.array(z.object({ email: z.string().email(), is_manager: z.boolean().optional() })).optional()
    .describe('License users (user-based products)'),
  policy_code: z.string().optional().describe('License policy code to apply'),
  license_type: z.enum(['perpetual', 'subscription', 'consumption', 'time-limited']).optional(),
  is_trial: z.boolean().optional(),
  trial_days: z.number().int().min(0).optional(),
  validity_period: dateString.optional(),
  valid_duration: z.string().optional().describe('e.g. "1y", "6m", "30d", "4h"'),
  start_date: dateString.optional(),
  max_activations: z.number().int().min(0).optional(),
  allow_unlimited_activations: z.boolean().optional(),
  max_consumptions: z.number().int().min(0).optional(),
  allow_unlimited_consumptions: z.boolean().optional(),
  allow_negative_consumptions: z.boolean().optional(),
  allow_overages: z.boolean().optional(),
  max_overages: z.number().int().min(0).optional(),
  reset_consumption: z.boolean().optional(),
  consumption_period: orderConsumptionPeriod.optional(),
  is_floating: z.boolean().optional(),
  is_floating_cloud: z.boolean().optional(),
  floating_users: z.number().int().min(0).optional(),
  floating_timeout: z.number().int().min(0).optional(),
  can_borrow: z.boolean().optional(),
  max_borrow_time: z.number().int().min(0).optional().describe('Maximum borrow time in hours'),
  enable_maintenance_period: z.boolean().optional(),
  maintenance_duration: z.string().optional(),
  prevent_vm: z.boolean().optional(),
  max_license_users: z.number().int().min(0).optional(),
  max_transfers: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  product_features: z.array(z.object({
    code: z.string().min(1),
    max_consumption: z.number().int().optional(),
    max_overages: z.number().int().optional(),
    allow_overages: z.boolean().optional(),
    is_floating: z.boolean().optional(),
    is_floating_cloud: z.boolean().optional(),
    floating_users: z.number().int().optional(),
    floating_timeout: z.number().int().optional(),
    consumption_period: orderConsumptionPeriod.optional(),
    expiry_date: z.string().optional(),
  })).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function listQuery(args: Record<string, unknown>): Record<string, unknown> {
  const { extra_filters, ...rest } = args as { extra_filters?: Record<string, unknown> } & Record<string, unknown>;
  return { ...(extra_filters ?? {}), ...rest };
}

export function createManagementApiServer(client: ManagementApiClient, options: ManagementServerOptions = {}): McpServer {
  const server = new McpServer({ name: MANAGEMENT_SERVER_NAME, version: VERSION });
  const run = createRunner('management', options.logger);
  const health = options.health ?? createHealthState();

  registerHealthResource(server, MANAGEMENT_SERVER_NAME, health, { api_url: client.baseURL });

  // ---- Resources -------------------------------------------------------
  const listResource = (name: string, title: string, path: string) => server.registerResource(
    name,
    `licensespring://management/${name.replace('-list', '')}`,
    { title, description: `First 100 ${title.toLowerCase()}`, mimeType: 'application/json' },
    async (uri) => {
      try {
        const data = await client.get(`${API}/${path}/`, { limit: 100 });
        return { contents: [{ uri: uri.toString(), mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };
      } catch (error) {
        throw new Error(`Failed to get ${title.toLowerCase()}: ${handleApiError(error, 'management')}`, { cause: error });
      }
    },
  );
  listResource('licenses-list', 'Licenses', 'licenses');
  listResource('customers-list', 'Customers', 'customers');
  listResource('products-list', 'Products', 'products');

  // ---- Prompts ---------------------------------------------------------
  server.registerPrompt(
    'license-management-workflow',
    {
      title: 'License Management Workflow',
      description: 'Guided workflow to create, update, audit or clean up licenses',
      argsSchema: {
        action: z.enum(['create', 'update', 'audit', 'cleanup']),
        customer_email: z.string().optional(),
        product_code: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    ({ action, customer_email, product_code, notes }) => {
      const steps: Record<string, string[]> = {
        create: [
          'Find the customer with list_customers (email filter) or plan to create them inline',
          'Confirm the product with list_products (short_code) and pick a policy with list_license_policies',
          'Create the license with create_order (licenses are created through orders)',
          'Report the generated license key(s) or user credentials',
        ],
        update: [
          'Locate the license with list_licenses',
          'Apply changes with update_license (send is_trial when changing validity)',
          'Use enable_license / disable_license for status changes',
          'Summarize what changed',
        ],
        audit: [
          'List licenses with list_licenses (filter by customer or product)',
          'Flag disabled, expired or over-consumed licenses',
          'Check activations with list_license_activation_history and list_devices',
          'Produce a summary report',
        ],
        cleanup: [
          'Identify inactive or expired licenses with list_licenses',
          'Prefer disable_license or bulk_disable_licenses over deletion',
          'Reset stale devices with reset_device if needed',
          'Confirm with the user before any delete_* call and document what was done',
        ],
      };
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Please run the "${action}" license management workflow.`,
              customer_email ? `Customer: ${customer_email}` : undefined,
              product_code ? `Product: ${product_code}` : undefined,
              notes ? `Notes: ${notes}` : undefined,
              '',
              ...steps[action].map((s, i) => `${i + 1}. ${s}`),
            ].filter((line) => line !== undefined).join('\n'),
          },
        }],
      };
    },
  );

  server.registerPrompt(
    'customer-analysis',
    {
      title: 'Customer Analysis',
      description: 'Analyze a customer\'s licenses for usage, compliance or renewal',
      argsSchema: {
        customer_email: z.string().optional(),
        customer_id: z.string().optional(),
        analysis_type: z.enum(['usage', 'compliance', 'renewal']).optional(),
      },
    },
    ({ customer_email, customer_id, analysis_type = 'usage' }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Please perform a ${analysis_type} analysis for this customer.`,
            customer_id ? `Customer ID: ${customer_id}` : undefined,
            customer_email ? `Customer Email: ${customer_email}` : undefined,
            '',
            '1. Fetch the customer (get_customer or list_customers) and their licenses (list_licenses with customer_email or customer_id)',
            '2. Review activations, devices and consumption for each license',
            analysis_type === 'renewal'
              ? '3. Identify licenses expiring soon and renewal risks'
              : analysis_type === 'compliance'
                ? '3. Flag over-activation, overages, blacklisted devices or VM use'
                : '3. Identify most and least used products and features',
            '4. Recommend concrete next actions',
          ].filter((line) => line !== undefined).join('\n'),
        },
      }],
    }),
  );

  // ---- Licenses --------------------------------------------------------
  server.registerTool('list_licenses', {
    title: 'List Licenses',
    description: 'List licenses with filtering and pagination. Returns {count, next, previous, results}.',
    inputSchema: {
      ...paginationShape,
      order_by: orderBy,
      license_key: z.string().optional().describe('Exact license key'),
      license_key__icontains: z.string().optional().describe('License key contains'),
      customer_email: z.string().optional().describe('Exact customer email'),
      customer_email__icontains: z.string().optional(),
      customer_id: z.number().int().positive().optional(),
      product_id: z.number().int().positive().optional(),
      enabled: z.boolean().optional(),
      order__store_id: z.string().optional().describe('Order ID from your store'),
      license_users__true_email: z.string().optional().describe('License user email (user-based licenses)'),
      note__icontains: z.string().optional(),
    },
    annotations: READ_ONLY,
  }, (args) => run('listing licenses', () => client.get(`${API}/licenses/`, listQuery(args))));

  server.registerTool('get_license', {
    title: 'Get License',
    description: 'Get a license by ID, including its license_users, features and activation data.',
    inputSchema: { id: id('License') },
    annotations: READ_ONLY,
  }, ({ id: licenseId }) => run('getting license', () => client.get(`${API}/licenses/${licenseId}/`)));

  server.registerTool('update_license', {
    title: 'Update License',
    description: 'Update license settings. Send is_trial whenever changing validity_period, valid_duration or trial_days. Use enable_license/disable_license to change status.',
    inputSchema: { id: id('License'), ...licenseUpdateShape },
    annotations: IDEMPOTENT_WRITE,
  }, ({ id: licenseId, ...fields }) => run('updating license', () => {
    const update = compact(fields);
    if (Object.keys(update).length === 0) throw new ValidationError('Provide at least one field to update.');
    validateLicenseUpdate(update);
    return client.patch(`${API}/licenses/${licenseId}/`, update);
  }));

  server.registerTool('enable_license', {
    title: 'Enable License',
    description: 'Enable a disabled license.',
    inputSchema: { id: id('License') },
    annotations: IDEMPOTENT_WRITE,
  }, ({ id: licenseId }) => run('enabling license', () => client.post(`${API}/licenses/${licenseId}/enable/`)));

  server.registerTool('disable_license', {
    title: 'Disable License',
    description: 'Disable a license so it can no longer be activated or checked.',
    inputSchema: { id: id('License') },
    annotations: { ...IDEMPOTENT_WRITE, destructiveHint: true },
  }, ({ id: licenseId }) => run('disabling license', () => client.post(`${API}/licenses/${licenseId}/disable/`)));

  server.registerTool('reset_license', {
    title: 'Reset License',
    description: 'Reset a license: removes device activations and optionally resets validity, maintenance, consumptions, metadata, features and custom fields.',
    inputSchema: {
      id: id('License'),
      reset_validity_period: z.boolean().optional().describe('Default true'),
      reset_maintenance_period: z.boolean().optional().describe('Default true'),
      reset_consumptions: z.boolean().optional().describe('Default true'),
      reset_metadata: z.boolean().optional().describe('Default false'),
      reset_product_features: z.boolean().optional().describe('Default false'),
      reset_custom_fields: z.boolean().optional().describe('Default false'),
    },
    annotations: DESTRUCTIVE,
  }, ({ id: licenseId, ...flags }) => run('resetting license', () => client.post(`${API}/licenses/${licenseId}/reset/`, compact(flags))));

  server.registerTool('delete_license', {
    title: 'Delete License',
    description: 'Permanently delete a license. Prefer disable_license unless deletion is explicitly required.',
    inputSchema: { id: id('License') },
    annotations: DESTRUCTIVE,
  }, ({ id: licenseId }) => run('deleting license', async () => {
    await client.delete(`${API}/licenses/${licenseId}/`);
    return `License ${licenseId} deleted`;
  }));

  server.registerTool('bulk_update_licenses', {
    title: 'Bulk Update Licenses',
    description: 'Update up to 100 licenses in one request (PATCH with a list of {id, ...fields}).',
    inputSchema: {
      licenses: z.array(z.object({
        id: id('License'),
        ...licenseUpdateShape,
        start_date: dateString.optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })).min(1).max(100),
    },
    annotations: IDEMPOTENT_WRITE,
  }, ({ licenses }) => run('bulk updating licenses', () => {
    licenses.forEach((item) => validateLicenseUpdate(item, `License ${item.id}`));
    return client.patch(`${API}/licenses/bulk_update/`, licenses.map((item) => compact(item)));
  }));

  server.registerTool('bulk_disable_licenses', {
    title: 'Bulk Disable Licenses',
    description: 'Disable up to 100 licenses in one request.',
    inputSchema: { license_ids: z.array(id('License')).min(1).max(100) },
    annotations: { ...IDEMPOTENT_WRITE, destructiveHint: true },
  }, ({ license_ids }) => run('bulk disabling licenses', () => client.post(`${API}/licenses/disable_bulk/`, license_ids)));

  server.registerTool('update_license_features', {
    title: 'Update License Features',
    description: 'Replace the product features on a license. WARNING: features already on the license but omitted here are removed.',
    inputSchema: {
      id: id('License'),
      product_features: z.array(z.object({
        product_feature: z.string().min(1).describe('Feature code'),
        max_consumption: z.number().int().optional(),
        total_consumptions: z.number().int().optional(),
        allow_overages: z.boolean().optional(),
        max_overages: z.number().int().optional(),
        reset_consumption: z.boolean().optional(),
        consumption_period: consumptionPeriod.optional(),
        expiry_date: dateString.optional(),
      })).min(1, 'Provide at least one feature (omitted features are removed from the license)'),
    },
    annotations: { ...IDEMPOTENT_WRITE, destructiveHint: true },
  }, ({ id: licenseId, product_features }) => run('updating license features', () =>
    client.post(`${API}/licenses/${licenseId}/update_features/`, { product_features })));

  server.registerTool('apply_license_policy', {
    title: 'Apply License Policy',
    description: 'Apply a license policy (template) to an existing license.',
    inputSchema: { id: id('License'), policy_code: z.string().min(1) },
    annotations: { ...IDEMPOTENT_WRITE, destructiveHint: true },
  }, ({ id: licenseId, policy_code }) => run('applying license policy', () =>
    client.post(`${API}/licenses/${licenseId}/apply_policy/`, { policy_code })));

  server.registerTool('assign_user_to_license', {
    title: 'Assign User to License',
    description: 'Assign a user to a user-based license. Returns a generated password when none is given.',
    inputSchema: {
      license_id: id('License'),
      email: z.string().email(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      phone_number: z.string().optional(),
      is_manager: z.boolean().optional().default(false),
      password: z.string().optional(),
      max_activations: z.number().int().min(0).optional(),
      total_activations: z.number().int().min(0).optional(),
    },
    annotations: WRITE,
  }, ({ license_id, ...body }) => run('assigning user to license', () =>
    client.post(`${API}/licenses/${license_id}/assign_user/`, compact(body))));

  server.registerTool('unassign_user_from_license', {
    title: 'Unassign User from License',
    description: 'Remove a user from a license, by license user ID or email.',
    inputSchema: {
      license_id: id('License'),
      license_user_id: z.number().int().positive().optional(),
      license_user_email: z.string().email().optional(),
    },
    annotations: { ...IDEMPOTENT_WRITE, destructiveHint: true },
  }, ({ license_id, license_user_id, license_user_email }) => run('unassigning user from license', () => {
    if ((license_user_id === undefined) === (license_user_email === undefined)) {
      throw new ValidationError('Provide exactly one of license_user_id or license_user_email.');
    }
    return client.post(`${API}/licenses/${license_id}/unassign_user/`, compact({ license_user_id, license_user_email }));
  }));

  server.registerTool('set_user_activations', {
    title: 'Set User Activations',
    description: 'Set per-user activation limits on a license. Keys are license user IDs.',
    inputSchema: {
      license_id: id('License'),
      user_activations: z.record(z.string().regex(/^\d+$/, 'Keys must be license user IDs'), z.object({
        max_activations: z.number().int().min(0).optional(),
        reset_total_activations: z.boolean().optional(),
      })).refine((obj) => Object.keys(obj).length > 0, 'At least one user must be specified'),
    },
    annotations: IDEMPOTENT_WRITE,
  }, ({ license_id, user_activations }) => run('setting user activations', () =>
    client.post(`${API}/licenses/${license_id}/set_users_activations/`, user_activations)));

  server.registerTool('import_licenses_from_csv', {
    title: 'Import Licenses from CSV',
    description: 'Start an asynchronous CSV import. Required columns: license__license_key, product__short_code. Optional: customer__*, order__*, license__* columns. Returns a job_id for get_license_import_result.',
    inputSchema: {
      csv_content: z.string().min(1).describe('Raw CSV text including the header row'),
      file_name: z.string().optional().default('licenses.csv'),
    },
    annotations: WRITE,
  }, ({ csv_content, file_name }) => run('importing licenses from CSV', () => {
    const form = new FormData();
    form.append('file', new Blob([csv_content], { type: 'text/csv' }), file_name);
    return client.postMultipart(`${API}/licenses/import_from_csv/`, form);
  }));

  server.registerTool('get_license_import_result', {
    title: 'Get License Import Result',
    description: 'Get the status and row counts of a CSV license import job.',
    inputSchema: { job_id: id('Import job') },
    annotations: READ_ONLY,
  }, ({ job_id }) => run('getting license import result', () => client.get(`${API}/licenses-import-results/${job_id}/`)));

  server.registerTool('list_license_activation_history', {
    title: 'List License Activation History',
    description: 'List activation/deactivation events for a license.',
    inputSchema: {
      ...paginationShape,
      license: id('License'),
      action: z.string().optional().describe('Event type, e.g. "activation"'),
      ts__gte: z.string().optional().describe('From timestamp (ISO 8601)'),
      ts__lte: z.string().optional().describe('To timestamp (ISO 8601)'),
    },
    annotations: READ_ONLY,
  }, (args) => run('listing activation history', () => client.get(`${API}/license-activation-histories/`, listQuery(args))));

  // ---- Orders ----------------------------------------------------------
  server.registerTool('create_order', {
    title: 'Create Order (create licenses)',
    description: 'Create an order, which is how licenses are created. Each item names a product short code and the licenses to issue. Use append=true to add items to an existing order ID.',
    inputSchema: {
      id: z.string().min(1).describe('Your unique order ID'),
      items: z.array(z.object({
        product_code: z.string().min(1).describe('Product short code'),
        licenses: z.array(orderLicenseShape).min(1),
      })).min(1),
      customer: z.object({
        email: z.string().email().optional(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        company_name: z.string().optional(),
        phone: z.string().optional(),
        reference: z.string().optional(),
      }).optional(),
      customer_account_id: z.number().int().positive().optional(),
      append: z.boolean().optional(),
      is_test: z.boolean().optional(),
      is_bundle: z.boolean().optional(),
      order_type: z.literal('normal').optional(),
    },
    annotations: WRITE,
  }, (args) => run('creating order', () => {
    args.items.forEach((item, i) => item.licenses.forEach((license, j) => {
      if (license.validity_period && license.valid_duration) {
        throw new ValidationError(`items[${i}].licenses[${j}]: validity_period and valid_duration cannot be sent together.`);
      }
    }));
    return client.post(`${API}/orders/create_order/`, compact(args));
  }));

  server.registerTool('list_orders', {
    title: 'List Orders',
    description: 'List orders with filtering and pagination.',
    inputSchema: {
      ...paginationShape,
      order_by: orderBy,
      store_id: z.string().optional().describe('Exact order ID from your store'),
      store_id__icontains: z.string().optional(),
      customer_id: z.number().int().positive().optional(),
      customer__email: z.string().optional(),
      customer__email__icontains: z.string().optional(),
      customer_company_name__icontains: z.string().optional(),
    },
    annotations: READ_ONLY,
  }, (args) => run('listing orders', () => client.get(`${API}/orders/`, listQuery(args))));

  server.registerTool('get_order', {
    title: 'Get Order',
    description: 'Get an order with its items and licenses.',
    inputSchema: { id: id('Order') },
    annotations: READ_ONLY,
  }, ({ id: orderId }) => run('getting order', () => client.get(`${API}/orders/${orderId}/`)));

  server.registerTool('generate_license_keys', {
    title: 'Generate License Keys',
    description: 'Generate license key strings for a product without creating licenses (use them as "key" in create_order).',
    inputSchema: {
      product: z.string().min(1).describe('Product short code'),
      quantity: z.number().int().min(1).max(1000).optional().default(1),
      key_length: z.number().int().min(16).max(240).optional().describe('Default 16'),
      alphabet: z.string().min(2).optional().describe('Characters to use (default excludes look-alike characters)'),
    },
    annotations: READ_ONLY,
  }, (args) => run('generating license keys', () => client.get(`${API}/orders/generate_license/`, args)));

  // ---- Customers -------------------------------------------------------
  server.registerTool('list_customers', {
    title: 'List Customers',
    description: 'List customers with filtering and pagination.',
    inputSchema: {
      ...paginationShape,
      email: z.string().optional().describe('Exact email'),
      email__icontains: z.string().optional(),
      company_name__icontains: z.string().optional(),
      first_name__icontains: z.string().optional(),
      last_name__icontains: z.string().optional(),
      reference: z.string().optional(),
      account: z.number().int().positive().optional().describe('Customer account ID'),
    },
    annotations: READ_ONLY,
  }, (args) => run('listing customers', () => client.get(`${API}/customers/`, listQuery(args))));

  server.registerTool('get_customer', {
    title: 'Get Customer',
    description: 'Get a customer by ID.',
    inputSchema: { id: id('Customer') },
    annotations: READ_ONLY,
  }, ({ id: customerId }) => run('getting customer', () => client.get(`${API}/customers/${customerId}/`)));

  server.registerTool('create_customer', {
    title: 'Create Customer',
    description: 'Create a customer record.',
    inputSchema: { ...customerShape, email: z.string().email('Valid email is required') },
    annotations: WRITE,
  }, (args) => run('creating customer', () => client.post(`${API}/customers/`, compact(args))));

  server.registerTool('update_customer', {
    title: 'Update Customer',
    description: 'Update customer fields.',
    inputSchema: { id: id('Customer'), ...customerShape },
    annotations: IDEMPOTENT_WRITE,
  }, ({ id: customerId, ...fields }) => run('updating customer', () => {
    const update = compact(fields);
    if (Object.keys(update).length === 0) throw new ValidationError('Provide at least one field to update.');
    return client.patch(`${API}/customers/${customerId}/`, update);
  }));

  server.registerTool('delete_customer', {
    title: 'Delete Customer',
    description: 'Permanently delete a customer.',
    inputSchema: { id: id('Customer') },
    annotations: DESTRUCTIVE,
  }, ({ id: customerId }) => run('deleting customer', async () => {
    await client.delete(`${API}/customers/${customerId}/`);
    return `Customer ${customerId} deleted`;
  }));

  // ---- License users ---------------------------------------------------
  server.registerTool('list_license_users', {
    title: 'List License Users',
    description: 'List license users. To list the users of one license, use get_license (license_users field).',
    inputSchema: {
      ...paginationShape,
      true_email__iexact: z.string().optional().describe('Exact email (case-insensitive)'),
      true_email__icontains: z.string().optional(),
      first_name__icontains: z.string().optional(),
      last_name__icontains: z.string().optional(),
      is_license_manager: z.boolean().optional(),
    },
    annotations: READ_ONLY,
  }, (args) => run('listing license users', () => client.get(`${API}/license-users/`, listQuery(args))));

  server.registerTool('get_license_user', {
    title: 'Get License User',
    description: 'Get a license user by ID.',
    inputSchema: { id: id('License user') },
    annotations: READ_ONLY,
  }, ({ id: userId }) => run('getting license user', () => client.get(`${API}/license-users/${userId}/`)));

  server.registerTool('create_license_user', {
    title: 'Create License User',
    description: 'Create a license user (not yet assigned to a license; use assign_user_to_license).',
    inputSchema: {
      email: z.string().email(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      phone_number: z.string().optional(),
      password: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    },
    annotations: WRITE,
  }, (args) => run('creating license user', () => client.post(`${API}/license-users/`, compact(args))));

  server.registerTool('update_license_user', {
    title: 'Update License User',
    description: 'Update a license user\'s name or phone number.',
    inputSchema: {
      id: id('License user'),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      phone_number: z.string().optional(),
    },
    annotations: IDEMPOTENT_WRITE,
  }, ({ id: userId, ...fields }) => run('updating license user', () => {
    const update = compact(fields);
    if (Object.keys(update).length === 0) throw new ValidationError('Provide at least one field to update.');
    return client.patch(`${API}/license-users/${userId}/`, update);
  }));

  server.registerTool('delete_license_user', {
    title: 'Delete License User',
    description: 'Permanently delete a license user.',
    inputSchema: { id: id('License user') },
    annotations: DESTRUCTIVE,
  }, ({ id: userId }) => run('deleting license user', async () => {
    await client.delete(`${API}/license-users/${userId}/`);
    return `License user ${userId} deleted`;
  }));

  server.registerTool('set_license_user_password', {
    title: 'Set License User Password',
    description: 'Set a license user\'s password, by user ID or email.',
    inputSchema: {
      id: z.number().int().positive().optional().describe('License user ID'),
      email: z.string().email().optional().describe('License user email'),
      password: z.string().min(1),
    },
    annotations: { ...IDEMPOTENT_WRITE, destructiveHint: true },
  }, ({ id: userId, email, password }) => run('setting license user password', () => {
    if ((userId === undefined) === (email === undefined)) {
      throw new ValidationError('Provide exactly one of id or email.');
    }
    return userId !== undefined
      ? client.post(`${API}/license-users/${userId}/set_password/`, { password })
      : client.post(`${API}/license-users/set_password/`, { password }, { email });
  }));

  // ---- Devices ---------------------------------------------------------
  server.registerTool('list_devices', {
    title: 'List Devices',
    description: 'List activated devices with filtering and pagination.',
    inputSchema: {
      ...paginationShape,
      order_by: orderBy,
      license: z.number().int().positive().optional().describe('License ID'),
      hardware_id: z.string().optional(),
      hostname: z.string().optional(),
      os: z.string().optional(),
      blacklisted: z.boolean().optional(),
      device_active: z.boolean().optional(),
      license_users__id: z.number().int().positive().optional(),
    },
    annotations: READ_ONLY,
  }, (args) => run('listing devices', () => client.get(`${API}/devices/`, listQuery(args))));

  server.registerTool('get_device', {
    title: 'Get Device',
    description: 'Get a device by ID.',
    inputSchema: { id: id('Device') },
    annotations: READ_ONLY,
  }, ({ id: deviceId }) => run('getting device', () => client.get(`${API}/devices/${deviceId}/`)));

  const deviceAction = (name: string, title: string, action: string, label: string, description: string, destructive: boolean) =>
    server.registerTool(name, {
      title,
      description,
      inputSchema: { id: id('Device') },
      annotations: { ...IDEMPOTENT_WRITE, destructiveHint: destructive },
    }, ({ id: deviceId }) => run(label, () => client.post(`${API}/devices/${deviceId}/${action}/`)));

  deviceAction('reset_device', 'Reset Device', 'reset', 'resetting device', 'Remove a device activation, freeing the activation slot.', true);
  deviceAction('blacklist_device', 'Blacklist Device', 'blacklist', 'blacklisting device', 'Blacklist a device so it can no longer activate.', true);
  deviceAction('whitelist_device', 'Whitelist Device', 'whitelist', 'whitelisting device', 'Remove a device from the blacklist.', false);

  // ---- Products --------------------------------------------------------
  server.registerTool('list_products', {
    title: 'List Products',
    description: 'List products.',
    inputSchema: {
      ...paginationShape,
      order_by: orderBy,
      short_code: z.string().optional(),
      is_archived: z.boolean().optional(),
      is_bundle: z.boolean().optional(),
    },
    annotations: READ_ONLY,
  }, (args) => run('listing products', () => client.get(`${API}/products/`, listQuery(args))));

  server.registerTool('get_product', {
    title: 'Get Product',
    description: 'Get a product by ID.',
    inputSchema: { id: id('Product') },
    annotations: READ_ONLY,
  }, ({ id: productId }) => run('getting product', () => client.get(`${API}/products/${productId}/`)));

  server.registerTool('list_product_features', {
    title: 'List Product Features',
    description: 'List features defined on a product.',
    inputSchema: { ...paginationShape, product: id('Product') },
    annotations: READ_ONLY,
  }, (args) => run('listing product features', () => client.get(`${API}/product-features/`, listQuery(args))));

  server.registerTool('list_license_policies', {
    title: 'List License Policies',
    description: 'List license policies (templates) for creating licenses.',
    inputSchema: {
      ...paginationShape,
      product: z.number().int().positive().optional().describe('Product ID'),
      is_archived: z.boolean().optional(),
      is_default: z.boolean().optional(),
    },
    annotations: READ_ONLY,
  }, (args) => run('listing license policies', () => client.get(`${API}/license-templates/`, listQuery(args))));

  return server;
}
