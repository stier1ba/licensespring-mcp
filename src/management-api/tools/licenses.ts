import { z } from 'zod';
import { compact } from '../../utils/http.js';
import { defineTool, DESTRUCTIVE, IDEMPOTENT_WRITE, ToolInputError, type ToolDefinition } from '../../tools.js';
import {
  date,
  duration,
  id,
  ids,
  licenseConsumptionPeriod,
  metadata,
  optionalBool,
  optionalInt,
  optionalString,
  type Args,
  type Builders,
} from './shared.js';

/** Fields accepted by the Update License endpoint (and per item by Bulk Update). */
const licenseUpdateFields = {
  max_activations: optionalInt('Maximum activations'),
  max_consumptions: optionalInt('Maximum consumptions'),
  allow_overages: optionalBool('Allow overages'),
  max_overages: optionalInt('Maximum overages'),
  reset_consumption: optionalBool('Reset consumption each period'),
  consumption_period: licenseConsumptionPeriod,
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

const resetOptions = {
  reset_validity_period: optionalBool('Reset validity period'),
  reset_maintenance_period: optionalBool('Reset maintenance period'),
  reset_consumptions: optionalBool('Reset consumptions'),
  reset_metadata: optionalBool('Reset metadata'),
  reset_product_features: optionalBool('Reset product features'),
  reset_custom_fields: optionalBool('Reset custom fields'),
};

const licenseFeatureFields = {
  max_consumption: optionalInt('Maximum consumption'),
  allow_overages: optionalBool('Allow overages'),
  max_overages: optionalInt('Maximum overages'),
  consumption_period: licenseConsumptionPeriod,
  reset_consumption: optionalBool('Reset consumption each period'),
  allow_unlimited_consumptions: optionalBool('Allow unlimited consumptions'),
  allow_negative_consumptions: optionalBool('Allow negative consumptions'),
  expiry_date: date('Expiry date yyyy-mm-dd'),
  is_floating: optionalBool('Floating feature'),
  is_floating_cloud: optionalBool('Floating cloud feature'),
  floating_users: optionalInt('Simultaneous floating users'),
  floating_timeout: optionalInt('Floating timeout in minutes'),
  metadata,
};

export function licenseTools(b: Builders): ToolDefinition[] {
  const { call } = b;
  return [
    b.list({
      name: 'list_licenses',
      title: 'List Licenses',
      description: 'List licenses. Use filters for any documented license filter (e.g. license_key__icontains, validity_period__lte, is_trial).',
      path: '/licenses/',
      orderBy: true,
      extra: {
        license_key: optionalString('Exact license key'),
        customer_email: optionalString('Exact customer email'),
        customer_id: optionalInt('Customer ID'),
        product_id: optionalInt('Product ID'),
        enabled: optionalBool('Only enabled (true) or disabled (false) licenses'),
      },
    }),
    b.retrieve({ name: 'get_license', title: 'Get License', description: 'Get full details of a license.', path: '/licenses/{id}/', what: 'License' }),
    b.update({
      name: 'update_license',
      title: 'Update License',
      description:
        'Update license settings. Send is_trial with valid_duration/validity_period/trial_days and ' +
        'enable_maintenance_period with maintenance_duration. Use enable_license/disable_license to toggle a license.',
      path: '/licenses/{id}/',
      what: 'License',
      shape: { ...licenseUpdateFields, consumption_pool: z.number().int().nullable().optional().describe('Consumption pool ID, or null to unlink') },
      validate: checkValidity,
    }),
    b.remove({ name: 'delete_license', title: 'Delete License', description: 'Permanently delete a license.', path: '/licenses/{id}/', what: 'License' }),
    b.action({ name: 'enable_license', title: 'Enable License', description: 'Enable a license.', path: '/licenses/{id}/enable/', what: 'License', annotations: IDEMPOTENT_WRITE }),
    b.action({ name: 'disable_license', title: 'Disable License', description: 'Disable a license.', path: '/licenses/{id}/disable/', what: 'License', annotations: IDEMPOTENT_WRITE }),
    b.action({
      name: 'reset_license',
      title: 'Reset License',
      description: 'Reset a license and all its devices. Defaults: validity, maintenance and consumptions reset; metadata, features and custom fields kept.',
      path: '/licenses/{id}/reset/',
      what: 'License',
      shape: resetOptions,
    }),
    b.action({
      name: 'reset_licenses_bulk',
      title: 'Reset Licenses (Bulk)',
      description: 'Reset several licenses and their devices. `id` is the license in the URL path; license_ids lists all licenses to reset.',
      path: '/licenses/{id}/reset_bulk/',
      what: 'License',
      shape: { license_ids: ids('License') },
      body: (args) => args.license_ids,
    }),
    defineTool({
      name: 'reset_licenses_custom_bulk',
      title: 'Reset Licenses (Custom Bulk)',
      description: 'Reset several licenses, choosing what to reset (validity, consumptions, maintenance, features, custom fields, metadata).',
      inputSchema: { license_ids: ids('License'), ...resetOptions },
      annotations: DESTRUCTIVE,
      run: async (args) => call('POST', '/licenses/custom_bulk_reset', { body: compact(args) }),
    }),
    b.action({ name: 'reset_license_consumption', title: 'Reset License Consumption', description: 'Reset the consumptions of a license.', path: '/licenses/{id}/reset_consumption', what: 'License' }),
    b.action({
      name: 'apply_license_policy',
      title: 'Apply License Policy',
      description: 'Apply a license policy (license template) to a license. Extra fields override the policy values.',
      path: '/licenses/{id}/apply_policy/',
      what: 'License',
      annotations: IDEMPOTENT_WRITE,
      shape: {
        policy_code: z.string().min(1).describe('License policy code'),
        overrides: z.record(z.string(), z.unknown()).optional().describe('Update License fields that override the policy'),
      },
      body: ({ policy_code, overrides }) => ({ ...((overrides as Args | undefined) ?? {}), policy_code }),
    }),
    b.action({
      name: 'update_license_features',
      title: 'Update License Features',
      description: 'Replace the product features on a license: listed features are created or updated, features not listed are removed.',
      path: '/licenses/{id}/update_features/',
      what: 'License',
      shape: {
        product_features: z
          .array(z.object({
            product_feature: z.string().min(1).describe('Product feature code'),
            max_consumption: z.number().int().optional(),
            total_consumptions: z.number().int().optional(),
            expiry_date: date('Expiry date yyyy-mm-dd'),
            allow_overages: z.boolean().optional(),
            max_overages: z.number().int().optional(),
            reset_consumption: z.boolean().optional(),
            consumption_period: licenseConsumptionPeriod,
          }))
          .describe('The complete list of features the license should have'),
      },
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
      inputSchema: { license_ids: ids('License').max(1000) },
      annotations: IDEMPOTENT_WRITE,
      run: async ({ license_ids }) => call('POST', '/licenses/disable_bulk/', { body: license_ids }),
    }),
    b.query({
      name: 'check_license_status',
      title: 'Check License Status',
      description: 'Check a license for a device from the back office (no activation is performed).',
      path: '/licenses/check_license/',
      shape: {
        hardware_id: z.string().min(1).describe('Hardware ID'),
        product: z.string().min(1).describe('Product short code'),
        license_key: optionalString('License key (key-based licenses)'),
        username: optionalString('License user email (user-based licenses)'),
      },
      validate: (args) => {
        if (!args.license_key && !args.username) throw new ToolInputError('Provide license_key or username');
      },
    }),
    b.action({ name: 'export_license_users', title: 'Export License Users', description: 'Export the license users assigned to a license.', path: '/licenses/{id}/export_license_users/', what: 'License', method: 'GET' }),

    // Imports
    b.upload({
      name: 'import_licenses_from_csv',
      title: 'Import Licenses from CSV',
      description:
        'Import licenses from CSV content. Required headers: license__license_key, product__short_code. ' +
        'Optional headers include customer__email, order__store_id and license__* fields. Check progress with list_license_import_results.',
      path: '/licenses/import_from_csv/',
      defaultFileName: 'licenses.csv',
    }),
    b.list({ name: 'list_license_import_results', title: 'List License Import Results', description: 'List results of CSV license imports. Filter: status__iexact (pending, running, error, success).', path: '/licenses-import-results/' }),
    b.retrieve({ name: 'get_license_import_result', title: 'Get License Import Result', description: 'Get a CSV license import result.', path: '/licenses-import-results/{id}/', what: 'Import result' }),
    b.upload({
      name: 'import_license_features_from_csv',
      title: 'Import License Features from CSV',
      description:
        'Import license product features from CSV content. Required headers: license_key, code. Optional: max_consumption, ' +
        'total_consumptions, expiry_date, allow_overages, consumption_period, max_overages, reset_consumption.',
      path: '/licenses/import_features_from_csv/',
      defaultFileName: 'license-features.csv',
    }),
    b.list({ name: 'list_license_feature_import_results', title: 'List License Feature Import Results', description: 'List results of CSV license feature imports. Filter: status__iexact.', path: '/license-features-import-results/' }),
    b.retrieve({ name: 'get_license_feature_import_result', title: 'Get License Feature Import Result', description: 'Get a CSV license feature import result.', path: '/license-features-import-results/{id}/', what: 'Import result' }),

    // License product features
    b.list({
      name: 'list_license_features',
      title: 'List License Features',
      description: 'List license product features. Filters: license, consumption_pool.',
      path: '/license-product-features/',
      extra: { license: optionalInt('License ID') },
    }),
    b.retrieve({ name: 'get_license_feature', title: 'Get License Feature', description: 'Get a license product feature.', path: '/license-product-features/{id}/', what: 'License product feature' }),
    b.create({
      name: 'create_license_feature',
      title: 'Create License Feature',
      description: 'Add a product feature to a license.',
      path: '/license-product-features/',
      shape: { license: id('License'), product_feature: id('Product feature'), ...licenseFeatureFields },
    }),
    b.update({
      name: 'update_license_feature',
      title: 'Update License Feature',
      description: 'Update a single license product feature.',
      path: '/license-product-features/{id}/',
      what: 'License product feature',
      shape: { ...licenseFeatureFields, consumption_pool: z.number().int().nullable().optional().describe('Consumption pool ID, or null to unlink') },
    }),
    b.remove({ name: 'delete_license_feature', title: 'Delete License Feature', description: 'Remove a product feature from a license.', path: '/license-product-features/{id}/', what: 'License product feature' }),
    b.action({
      name: 'release_license_feature_device',
      title: 'Release Device from License Feature',
      description: 'Release a device from a license product feature (frees a floating feature slot).',
      path: '/license-product-features/{id}/release_device/',
      what: 'License product feature',
      annotations: IDEMPOTENT_WRITE,
      shape: { device: id('Device') },
    }),

    // License custom fields
    b.list({ name: 'list_license_custom_fields', title: 'List License Custom Fields', description: 'List license custom field values.', path: '/license-custom-fields/', extra: { license: optionalInt('License ID') } }),
    b.retrieve({ name: 'get_license_custom_field', title: 'Get License Custom Field', description: 'Get a license custom field value.', path: '/license-custom-fields/{id}/', what: 'License custom field' }),
    b.create({
      name: 'create_license_custom_field',
      title: 'Create License Custom Field',
      description: 'Set a product custom field value on a license.',
      path: '/license-custom-fields/',
      shape: { license: id('License'), product_custom_field: id('Product custom field'), value: z.string().describe('Value') },
    }),
    b.update({
      name: 'update_license_custom_field',
      title: 'Update License Custom Field',
      description: 'Change a license custom field value.',
      path: '/license-custom-fields/{id}/',
      what: 'License custom field',
      shape: { value: z.string().describe('Value') },
    }),
    b.remove({ name: 'delete_license_custom_field', title: 'Delete License Custom Field', description: 'Remove a custom field value from a license.', path: '/license-custom-fields/{id}/', what: 'License custom field' }),
  ];
}

