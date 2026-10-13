import { z } from 'zod';
import { IDEMPOTENT_WRITE, type ToolDefinition } from '../../tools.js';
import { consumptionPeriod, date, duration, id, metadata, optionalBool, optionalInt, optionalString, type Builders } from './shared.js';

const productFields = {
  active: optionalBool('Active'),
  default_license_type: z.enum(['perpetual', 'subscription', 'time-limited', 'consumption']).optional(),
  subscription_duration: optionalString('Subscription duration'),
  valid_duration: optionalString('Validity duration, e.g. 1y'),
  enable_maintenance_period: optionalBool('Enable maintenance period'),
  maintenance_duration: optionalString('Maintenance duration, e.g. 1y'),
  max_consumptions: optionalInt('Maximum consumptions'),
  allow_overages: optionalBool('Allow overages'),
  max_overages: optionalInt('Maximum overages'),
  reset_consumption: optionalBool('Reset consumption each period'),
  consumption_period: consumptionPeriod,
  is_floating: optionalBool('Floating'),
  is_floating_cloud: optionalBool('Floating cloud'),
  floating_users: optionalInt('Simultaneous floating users'),
  floating_timeout: optionalInt('Floating timeout in minutes'),
  max_activations: optionalInt('Maximum activations'),
  allow_trial: optionalBool('Allow trials'),
  trial_days: optionalInt('Trial length in days'),
  authorization_method: z.enum(['license-key', 'user']).optional().describe('Key-based or user-based licensing'),
  prevent_vm: optionalBool('Prevent activation on virtual machines'),
  hardware_id_required: optionalBool('Require a hardware ID'),
  is_upgrade: optionalBool('Upgrade product'),
  upgrade_from: z.array(z.number().int()).optional().describe('Product IDs this product upgrades from'),
  is_node_locked: optionalBool('Node-locked'),
  is_user_locked: optionalBool('User-locked'),
};

const productFeatureFields = {
  name: optionalString('Feature name'),
  code: optionalString('Feature code'),
  feature_type: z.enum(['activation', 'consumption']).optional(),
  max_consumption: optionalInt('Maximum consumption'),
  allow_overages: optionalBool('Allow overages'),
  max_overages: optionalInt('Maximum overages'),
  reset_consumption: optionalBool('Reset consumption each period'),
  consumption_period: consumptionPeriod,
  metadata,
};

const customFieldFields = {
  data_type: z.enum(['number', 'text', 'date/time']).optional(),
  default_value: optionalString('Default value'),
  description: optionalString('Description'),
};

const environment = z.enum(['win', 'win32', 'win64', 'mac', 'linux', 'linux32', 'linux64']).optional();
const installationFileFields = {
  environment,
  version: optionalString('Version, e.g. 1.0.4'),
  full_link: optionalString('Download URL'),
  filename: optionalString('File name'),
  hash_md5: optionalString('MD5 hash'),
  size: z.string().regex(/^\d+$/, 'Digits only').optional().describe('Size in bytes (digits only)'),
  release_date: date('Release date yyyy-mm-dd'),
  release_notes_link: optionalString('Release notes URL'),
  eula_link: optionalString('EULA URL'),
  requires_version: optionalString('Minimum version required to update'),
  channel: optionalString('Release channel'),
  enabled: optionalBool('Enabled'),
};

const policyFields = {
  name: optionalString('Policy name'),
  default_license_type: z.enum(['perpetual', 'subscription', 'time-limited', 'consumption']).optional(),
  allow_trial: optionalBool('Trial policy'),
  trial_days: optionalInt('Trial length in days'),
  max_activations: optionalInt('Maximum activations'),
  allow_unlimited_activations: optionalBool('Unlimited activations'),
  max_license_users: optionalInt('Maximum license users'),
  user_max_activations: optionalInt('Maximum activations per license user'),
  is_floating: optionalBool('Floating'),
  is_floating_cloud: optionalBool('Floating cloud'),
  floating_users: optionalInt('Simultaneous floating users'),
  floating_timeout: optionalInt('Floating timeout in minutes'),
  enable_maintenance_period: optionalBool('Enable maintenance period'),
  maintenance_duration: duration('Maintenance duration, e.g. 1y'),
  valid_duration: duration('Validity duration, e.g. 1y'),
  prevent_vm: optionalBool('Prevent activation on virtual machines'),
  allow_grace_period: optionalBool('Allow grace period'),
  grace_period: optionalInt('Grace period in hours'),
  max_consumptions: optionalInt('Maximum consumptions'),
  allow_unlimited_consumptions: optionalBool('Unlimited consumptions'),
  allow_overages: optionalBool('Allow overages'),
  max_overages: optionalInt('Maximum overages'),
  reset_consumption: optionalBool('Reset consumption each period'),
  consumption_period: z.union([z.string(), z.number().int()]).optional().describe('Consumption reset period'),
  max_transfers: optionalInt('Maximum device transfers'),
  is_air_gapped: optionalBool('Air-gapped licensing'),
  can_borrow: optionalBool('Allow borrowing'),
  max_borrow_time: optionalInt('Maximum borrow time in hours'),
  is_archived: optionalBool('Archived'),
  is_hardware_key_auth: optionalBool('Hardware key authorization'),
  is_sku: optionalBool('SKU policy'),
  installation_file: optionalInt('Installation file ID'),
  metadata,
  license_product_feature_templates: z
    .array(z.object({
      id: z.number().int().describe('Product feature ID'),
      max_consumption: z.number().int().optional(),
      allow_unlimited_consumptions: z.boolean().optional(),
      allow_overages: z.boolean().optional(),
      max_overages: z.number().int().optional(),
      reset_consumption: z.boolean().optional(),
      consumption_period: z.string().optional(),
    }).catchall(z.unknown()))
    .optional()
    .describe('Feature settings applied by the policy'),
};

export function productTools(b: Builders): ToolDefinition[] {
  return [
    // Products
    b.list({ name: 'list_products', title: 'List Products', description: 'List products. Filters: short_code, is_archived, is_bundle.', path: '/products/' }),
    b.retrieve({ name: 'get_product', title: 'Get Product', description: 'Get a product.', path: '/products/{id}/', what: 'Product' }),
    b.create({
      name: 'create_product',
      title: 'Create Product',
      description: 'Create a product.',
      path: '/products/',
      shape: {
        product_name: z.string().min(1).describe('Product name'),
        short_code: z.string().regex(/^[A-Za-z0-9-]+$/, 'Letters, digits and dashes only').describe('Product short code'),
        ...productFields,
      },
    }),
    b.query({ name: 'export_products', title: 'Export Products', description: 'Export all products with their features.', path: '/products/export/', shape: {} }),
    b.upload({
      name: 'import_products_from_csv',
      title: 'Import Products from CSV',
      description: 'Import products from CSV content. Required headers: product_name, short_code. Optional: active, valid_duration, trial_days, hardware_id_required, allow_trial, authorization_method, is_archived, floating_timeout, is_bundle.',
      path: '/products/import_from_csv/',
      defaultFileName: 'products.csv',
    }),
    b.action({ name: 'list_bundle_products', title: 'List Products in Bundle', description: 'List the products in a bundle product.', path: '/products/{id}/bundle/', what: 'Bundle product', method: 'GET' }),
    b.action({ name: 'list_product_bundles', title: 'List Bundles for Product', description: 'List the bundles a product belongs to.', path: '/products/{id}/in_bundle/', what: 'Product', method: 'GET' }),
    b.action({
      name: 'add_product_to_bundle',
      title: 'Add Product to Bundle',
      description: 'Add a non-bundle product with the same authorization method to a bundle.',
      path: '/products/{id}/add_to_bundle/',
      what: 'Bundle product',
      annotations: IDEMPOTENT_WRITE,
      shape: { product_id: id('Product to add') },
    }),
    b.action({
      name: 'remove_product_from_bundle',
      title: 'Remove Product from Bundle',
      description: 'Remove a product from a bundle (the last product cannot be removed).',
      path: '/products/{id}/remove_from_bundle/',
      what: 'Bundle product',
      shape: { product_id: id('Product to remove') },
    }),

    // Product features
    b.list({ name: 'list_product_features', title: 'List Product Features', description: 'List product features.', path: '/product-features/', extra: { product: optionalInt('Product ID') } }),
    b.retrieve({ name: 'get_product_feature', title: 'Get Product Feature', description: 'Get a product feature.', path: '/product-features/{id}/', what: 'Product feature' }),
    b.create({
      name: 'create_product_feature',
      title: 'Create Product Feature',
      description: 'Create a product feature.',
      path: '/product-features/',
      shape: { product: id('Product'), ...productFeatureFields, name: z.string().min(1), code: z.string().min(1) },
    }),
    b.update({
      name: 'update_product_feature',
      title: 'Update Product Feature',
      description: 'Update a product feature. Set is_deleted to retire it while keeping it on existing licenses.',
      path: '/product-features/{id}/',
      what: 'Product feature',
      shape: { ...productFeatureFields, is_deleted: optionalBool('Soft-delete (keeps the feature on existing licenses)') },
    }),
    b.remove({ name: 'delete_product_feature', title: 'Delete Product Feature', description: 'Permanently delete a product feature, also removing it from every license.', path: '/product-features/{id}/', what: 'Product feature' }),
    b.upload({
      name: 'import_product_features_from_csv',
      title: 'Import Product Features from CSV',
      description: 'Import product features from CSV content. Headers: product__short_code, code, name, feature_type, max_consumption, allow_overages, max_overages, reset_consumption, consumption_period, is_floating, is_floating_cloud, floating_users, floating_timeout.',
      path: '/product-features/import_from_csv/',
      defaultFileName: 'product-features.csv',
    }),

    // Product custom fields
    b.list({ name: 'list_product_custom_fields', title: 'List Product Custom Fields', description: 'List product custom fields.', path: '/product-custom-fields/', extra: { product: optionalInt('Product ID') } }),
    b.retrieve({ name: 'get_product_custom_field', title: 'Get Product Custom Field', description: 'Get a product custom field.', path: '/product-custom-fields/{id}/', what: 'Product custom field' }),
    b.create({
      name: 'create_product_custom_field',
      title: 'Create Product Custom Field',
      description: 'Create a product custom field.',
      path: '/product-custom-fields/',
      shape: { product: id('Product'), name: z.string().min(1), ...customFieldFields },
    }),
    b.update({
      name: 'update_product_custom_field',
      title: 'Update Product Custom Field',
      description: 'Update a product custom field.',
      path: '/product-custom-fields/{id}/',
      what: 'Product custom field',
      shape: { name: optionalString('Name'), ...customFieldFields },
    }),
    b.remove({ name: 'delete_product_custom_field', title: 'Delete Product Custom Field', description: 'Delete a product custom field.', path: '/product-custom-fields/{id}/', what: 'Product custom field' }),
    b.list({
      name: 'list_product_custom_field_enums',
      title: 'List Product Custom Field Enumerations',
      description: 'List the allowed values of product custom fields.',
      path: '/product-custom-field-enums/',
      extra: { product_custom_field: optionalInt('Product custom field ID') },
    }),
    b.retrieve({ name: 'get_product_custom_field_enum', title: 'Get Product Custom Field Enumeration', description: 'Get an allowed custom field value.', path: '/product-custom-field-enums/{id}/', what: 'Enumeration' }),
    b.create({
      name: 'create_product_custom_field_enum',
      title: 'Create Product Custom Field Enumeration',
      description: 'Add an allowed value to a product custom field.',
      path: '/product-custom-field-enums/',
      shape: { product_custom_field: id('Product custom field'), value: z.string().min(1) },
    }),
    b.update({
      name: 'update_product_custom_field_enum',
      title: 'Update Product Custom Field Enumeration',
      description: 'Change an allowed custom field value.',
      path: '/product-custom-field-enums/{id}/',
      what: 'Enumeration',
      shape: { value: z.string().min(1) },
    }),
    b.remove({ name: 'delete_product_custom_field_enum', title: 'Delete Product Custom Field Enumeration', description: 'Remove an allowed custom field value.', path: '/product-custom-field-enums/{id}/', what: 'Enumeration' }),

    // Installation files
    b.list({ name: 'list_installation_files', title: 'List Installation Files', description: 'List product installation files.', path: '/installation-files/', extra: { product: optionalInt('Product ID') } }),
    b.retrieve({ name: 'get_installation_file', title: 'Get Installation File', description: 'Get an installation file.', path: '/installation-files/{id}/', what: 'Installation file' }),
    b.create({
      name: 'create_installation_file',
      title: 'Create Installation File',
      description: 'Register an installation file (download) for a product version.',
      path: '/installation-files/',
      shape: { product: id('Product'), ...installationFileFields },
    }),
    b.update({
      name: 'update_installation_file',
      title: 'Update Installation File',
      description: 'Update an installation file.',
      path: '/installation-files/{id}/',
      what: 'Installation file',
      shape: { product: optionalInt('Product ID'), ...installationFileFields },
    }),
    b.remove({ name: 'delete_installation_file', title: 'Delete Installation File', description: 'Delete an installation file.', path: '/installation-files/{id}/', what: 'Installation file' }),

    // License policies (license templates)
    b.list({
      name: 'list_license_policies',
      title: 'List License Policies',
      description: 'List license policies (license templates). Filters: product, is_default, is_archived, is_sku, is_air_gapped.',
      path: '/license-templates/',
      extra: { product: optionalInt('Product ID') },
    }),
    b.retrieve({ name: 'get_license_policy', title: 'Get License Policy', description: 'Get a license policy.', path: '/license-templates/{id}/', what: 'License policy' }),
    b.create({
      name: 'create_license_policy',
      title: 'Create License Policy',
      description: 'Create a license policy (license template) for a product.',
      path: '/license-templates/',
      shape: { product: id('Product'), code: z.union([z.string(), z.number()]).describe('Policy code'), ...policyFields, name: z.string().min(1) },
    }),
    b.update({
      name: 'update_license_policy',
      title: 'Update License Policy',
      description: 'Update a license policy.',
      path: '/license-templates/{id}/',
      what: 'License policy',
      shape: policyFields,
    }),
    b.remove({ name: 'delete_license_policy', title: 'Delete License Policy', description: 'Delete a license policy.', path: '/license-templates/{id}/', what: 'License policy' }),
  ];
}
