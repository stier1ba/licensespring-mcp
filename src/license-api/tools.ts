import { z } from 'zod';
import type { LicenseApiClient } from '../utils/http.js';
import { compact } from '../utils/http.js';
import {
  defineTool,
  IDEMPOTENT_WRITE,
  READ_ONLY,
  ToolInputError,
  WRITE,
  type ToolDefinition,
} from '../tools.js';

/**
 * License API (`/api/v4`) tools.
 *
 * @see https://docs.licensespring.com/license-api
 */

const API = '/api/v4';

// ---------------------------------------------------------------------------
// Shared schema fragments
// ---------------------------------------------------------------------------

const hardwareId = z.string().min(1).describe('Unique hardware ID generated for the client device');
const product = z.string().min(1).describe('Product short code (not the product name)');
const optionalString = (description: string) => z.string().min(1).optional().describe(description);
const optionalBool = (description: string) => z.boolean().optional().describe(description);

/** Identity fields accepted by endpoints that only need to locate an existing license. */
const lookupIdentity = {
  license_key: optionalString('License key (key-based products)'),
  username: optionalString('License user email (user-based products)'),
  license_id: z.number().int().optional().describe('Restrict the action to the license with this ID'),
};

/** Identity fields accepted by endpoints that authenticate a license user. */
const authIdentity = {
  ...lookupIdentity,
  password: optionalString('License user password (user-based products)'),
  id_token: optionalString('SSO access token (user-based products, Implicit grant)'),
  code: optionalString('SSO authorization code (user-based products, Authorization Code grant)'),
  customer_account_code: optionalString('Customer account code (required with id_token or code)'),
};

const deviceInfo = {
  os_ver: optionalString('Operating system version'),
  hostname: optionalString('Device hostname'),
  os_hostname: optionalString('Operating system hostname'),
  ip: optionalString('Public IP address'),
  ip_local: optionalString('Local IP address'),
  app_ver: optionalString('Application version'),
  sdk_ver: optionalString('SDK version'),
  mac_address: optionalString('MAC address'),
};

const vmInfo = {
  is_vm: optionalBool('Whether the device is a virtual machine'),
  vm_info: optionalString('Virtual machine details'),
};

const variables = z
  .record(z.string(), z.string())
  .optional()
  .describe('Device variables to store, as a key/value object');

type Args = Record<string, unknown>;

function requireLookupIdentity(args: Args): void {
  if (!args.license_key && !args.username) {
    throw new ToolInputError('Provide license_key (key-based products) or username (user-based products)');
  }
}

function requireAuthIdentity(args: Args): void {
  if (args.license_key) return;
  if (args.username && args.password) return;
  if ((args.id_token || args.code) && args.customer_account_code) return;
  throw new ToolInputError(
    'Provide license_key, username + password, or id_token/code + customer_account_code',
  );
}

function requireOfflineIdentity(args: Args): void {
  if (args.license_key) return;
  if (args.username && args.password) return;
  throw new ToolInputError('Offline requests require license_key, or username + password');
}

export function createLicenseApiTools(client: LicenseApiClient): ToolDefinition[] {
  const get = (path: string, query: Args) => client.request({ method: 'GET', path: `${API}${path}`, query });
  const post = (path: string, body: Args) => client.request({ method: 'POST', path: `${API}${path}`, body: compact(body) });
  const postOffline = (path: string, fields: Args & { hardware_id: string }) =>
    client.request({
      method: 'POST',
      path: `${API}${path}`,
      body: client.buildOfflinePayload(compact(fields) as Args & { hardware_id: string }),
      headers: { 'Content-Type': 'text/plain' },
    });

  return [
    // ----- Activation & deactivation (online) -------------------------------
    defineTool({
      name: 'activate_license',
      title: 'Activate License',
      description: 'Activate a license on a device (online method) and return the license payload.',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        ...authIdentity,
        bundle_code: optionalString('Bundle short code, when activating a license inside a bundle'),
        app_ver: optionalString('Application version'),
        app_name: optionalString('Application name'),
        sdk_ver: optionalString('SDK version'),
        redirect_uri: optionalString('SSO redirect URI'),
        variables,
        include_metadata_string: optionalBool('Include metadata as a JSON string in the response'),
        include_scheduled_changes: optionalBool('Include scheduled license changes in the response'),
      },
      annotations: WRITE,
      run: async (args) => {
        requireAuthIdentity(args);
        return post('/activate_license', args);
      },
    }),
    defineTool({
      name: 'deactivate_license',
      title: 'Deactivate License',
      description: 'Deactivate a license on a device (online method).',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        ...authIdentity,
        sdk_ver: optionalString('SDK version'),
        consumptions: z.number().int().optional().describe('Consumptions to sync before deactivating'),
      },
      annotations: WRITE,
      run: async (args) => {
        requireAuthIdentity(args);
        return post('/deactivate_license', args);
      },
    }),
    defineTool({
      name: 'activate_bundle',
      title: 'Activate Bundle',
      description: 'Activate every license in a bundle on a device (online method).',
      inputSchema: {
        hardware_id: hardwareId,
        product: z.string().min(1).describe('Bundle product short code'),
        ...authIdentity,
        ...deviceInfo,
        ...vmInfo,
        variables,
      },
      annotations: WRITE,
      run: async (args) => {
        requireAuthIdentity(args);
        return post('/activate_bundle', args);
      },
    }),
    defineTool({
      name: 'deactivate_bundle',
      title: 'Deactivate Bundle',
      description: 'Deactivate a bundle license on a device (online method).',
      inputSchema: {
        hardware_id: hardwareId,
        product: z.string().min(1).describe('Bundle product short code'),
        ...authIdentity,
        ...deviceInfo,
        ...vmInfo,
      },
      annotations: WRITE,
      run: async (args) => {
        requireAuthIdentity(args);
        return post('/deactivate_bundle', args);
      },
    }),

    // ----- Activation & deactivation (offline) ------------------------------
    defineTool({
      name: 'activate_offline',
      title: 'Activate License Offline',
      description:
        'Activate a license using the offline method. The server builds and signs the base64 offline ' +
        'request payload with the configured credentials and submits it. Supports trial, perpetual and consumption licenses.',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        license_key: authIdentity.license_key,
        username: authIdentity.username,
        password: authIdentity.password,
        license_id: authIdentity.license_id,
        bundle_code: optionalString('Bundle short code'),
        request_id: optionalString('Unique request ID (generated when omitted)'),
        ...deviceInfo,
        ...vmInfo,
        app_name: optionalString('Application name'),
        variables,
      },
      annotations: WRITE,
      run: async (args) => {
        requireOfflineIdentity(args);
        return postOffline('/activate_offline', args as Args & { hardware_id: string });
      },
    }),
    defineTool({
      name: 'deactivate_offline',
      title: 'Deactivate License Offline',
      description: 'Deactivate a license using the offline method (signed base64 payload built by the server).',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        license_key: authIdentity.license_key,
        username: authIdentity.username,
        password: authIdentity.password,
        license_id: authIdentity.license_id,
        bundle_code: optionalString('Bundle short code'),
        request_id: optionalString('Unique request ID (generated when omitted)'),
        consumptions: z.number().int().optional().describe('Consumptions to sync before deactivating'),
        ...deviceInfo,
        ...vmInfo,
      },
      annotations: WRITE,
      run: async (args) => {
        requireOfflineIdentity(args);
        return postOffline('/deactivate_offline', { ...args, request: 'deactivation' } as Args & { hardware_id: string });
      },
    }),
    defineTool({
      name: 'activate_bundle_offline',
      title: 'Activate Bundle Offline',
      description: 'Activate every license in a bundle using the offline method (signed base64 payload built by the server).',
      inputSchema: {
        hardware_id: hardwareId,
        product: z.string().min(1).describe('Bundle product short code'),
        license_key: authIdentity.license_key,
        username: authIdentity.username,
        password: authIdentity.password,
        license_id: authIdentity.license_id,
        request_id: optionalString('Unique request ID (generated when omitted)'),
        ...deviceInfo,
        ...vmInfo,
        variables,
      },
      annotations: WRITE,
      run: async (args) => {
        requireOfflineIdentity(args);
        return postOffline('/activate_bundle_offline', args as Args & { hardware_id: string });
      },
    }),
    defineTool({
      name: 'deactivate_bundle_offline',
      title: 'Deactivate Bundle Offline',
      description: 'Deactivate a bundle using the offline method (signed base64 payload built by the server).',
      inputSchema: {
        hardware_id: hardwareId,
        product: z.string().min(1).describe('Bundle product short code'),
        license_key: authIdentity.license_key,
        username: authIdentity.username,
        password: authIdentity.password,
        license_id: authIdentity.license_id,
        request_id: optionalString('Unique request ID (generated when omitted)'),
        ...deviceInfo,
        ...vmInfo,
      },
      annotations: WRITE,
      run: async (args) => {
        requireOfflineIdentity(args);
        return postOffline('/deactivate_bundle_offline', { ...args, request: 'deactivation' } as Args & { hardware_id: string });
      },
    }),

    // ----- Checks --------------------------------------------------------
    defineTool({
      name: 'check_license',
      title: 'Check License',
      description: 'Check the status and validity of a license on a device.',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        ...lookupIdentity,
        include_expired_features: optionalBool('Include expired license features'),
        include_scheduled_changes: optionalBool('Include scheduled license changes'),
        env: optionalString('Environment identifier, e.g. "win64", "mac", "linux"'),
        ...deviceInfo,
      },
      annotations: READ_ONLY,
      run: async (args) => {
        requireLookupIdentity(args);
        return get('/check_license', args);
      },
    }),
    defineTool({
      name: 'check_bundle',
      title: 'Check Bundle',
      description: 'Check the status and validity of a license bundle on a device.',
      inputSchema: {
        hardware_id: hardwareId,
        product: z.string().min(1).describe('Bundle product short code'),
        ...lookupIdentity,
        include_expired_features: optionalBool('Include expired license features'),
        env: optionalString('Environment identifier, e.g. "win64", "mac", "linux"'),
        ...deviceInfo,
      },
      annotations: READ_ONLY,
      run: async (args) => {
        requireLookupIdentity(args);
        return get('/check_bundle', args);
      },
    }),
    defineTool({
      name: 'check_license_feature',
      title: 'Check License Feature',
      description:
        'Check a license device against a license feature. The device is connected to the feature and, ' +
        'for floating features, takes a floating slot if one is available.',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        feature: z.string().min(1).describe('Feature code'),
        ...lookupIdentity,
      },
      annotations: IDEMPOTENT_WRITE,
      run: async (args) => {
        requireLookupIdentity(args);
        return get('/check_license_feature', args);
      },
    }),

    // ----- Consumption ---------------------------------------------------
    defineTool({
      name: 'add_consumption',
      title: 'Add Consumption',
      description: 'Add consumptions to a consumption-type license. Negative values are allowed when the license permits them.',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        ...lookupIdentity,
        consumptions: z.number().int().optional().describe('Number of consumptions to add (default 1)'),
        max_overages: z.number().int().min(0).optional().describe('Maximum overages allowed'),
        allow_overages: optionalBool('Allow overages'),
      },
      annotations: WRITE,
      run: async (args) => {
        requireLookupIdentity(args);
        return post('/add_consumption', args);
      },
    }),
    defineTool({
      name: 'add_feature_consumption',
      title: 'Add Feature Consumption',
      description: 'Add consumptions to a consumption-type license feature.',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        feature: z.string().min(1).describe('Feature code'),
        ...lookupIdentity,
        consumptions: z.number().int().optional().describe('Number of consumptions to add (default 1)'),
      },
      annotations: WRITE,
      run: async (args) => {
        requireLookupIdentity(args);
        return post('/add_feature_consumption', args);
      },
    }),

    // ----- Floating ------------------------------------------------------
    defineTool({
      name: 'floating_borrow',
      title: 'Borrow Floating License',
      description: 'Borrow a floating cloud license for offline use until the given time.',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        ...authIdentity,
        borrowed_until: z
          .string()
          .min(1)
          .nullable()
          .describe('ISO 8601 UTC timestamp; null borrows for the license max_borrow_time'),
        bundle_code: optionalString('Bundle short code'),
        sdk_ver: optionalString('SDK version'),
        redirect_uri: optionalString('SSO redirect URI'),
      },
      annotations: WRITE,
      run: async (args) => {
        requireAuthIdentity(args);
        return post('/floating/borrow', args);
      },
    }),
    defineTool({
      name: 'floating_release',
      title: 'Release Floating License',
      description: 'Release a floating cloud license from a device and remove the device from the floating pool.',
      inputSchema: { hardware_id: hardwareId, product, ...lookupIdentity },
      annotations: IDEMPOTENT_WRITE,
      run: async (args) => {
        requireLookupIdentity(args);
        return post('/floating/release', args);
      },
    }),
    defineTool({
      name: 'floating_feature_borrow',
      title: 'Borrow Floating Feature',
      description: 'Borrow a floating license feature until the given time.',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        feature: z.string().min(1).describe('Feature code'),
        ...authIdentity,
        borrowed_until: z
          .string()
          .min(1)
          .nullable()
          .describe('ISO 8601 UTC timestamp; null borrows for the feature max_borrow_time'),
        bundle_code: optionalString('Bundle short code'),
        sdk_ver: optionalString('SDK version'),
        redirect_uri: optionalString('SSO redirect URI'),
      },
      annotations: WRITE,
      run: async (args) => {
        requireAuthIdentity(args);
        return post('/floating/feature_borrow', args);
      },
    }),
    defineTool({
      name: 'floating_feature_release',
      title: 'Release Floating Feature',
      description: 'Release a floating license feature currently used by a device.',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        feature: z.string().min(1).describe('Feature code'),
        ...lookupIdentity,
      },
      annotations: IDEMPOTENT_WRITE,
      run: async (args) => {
        requireLookupIdentity(args);
        return post('/floating/feature_release', args);
      },
    }),

    // ----- Licenses lookups ---------------------------------------------
    defineTool({
      name: 'get_trial_key',
      title: 'Get Trial Key',
      description: 'Create and return a trial license for a product. User-based products require email.',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        email: z.string().email().optional().describe('License user email (required for user-based products)'),
        password: optionalString('License user password (user-based products)'),
        first_name: optionalString('Customer first name'),
        last_name: optionalString('Customer last name'),
        phone: optionalString('Customer phone'),
        address: optionalString('Customer address'),
        postcode: optionalString('Customer postcode'),
        city: optionalString('Customer city'),
        state: optionalString('Customer state'),
        country: optionalString('Customer country'),
        reference: optionalString('Customer reference'),
        license_policy: optionalString('License policy code (defaults to the product default policy)'),
      },
      annotations: WRITE,
      run: async (args) => get('/trial_key', args),
    }),
    defineTool({
      name: 'get_user_licenses',
      title: 'List Licenses for User',
      description: 'List the licenses assigned to a license user for a product (user-based products only).',
      inputSchema: {
        product,
        username: authIdentity.username,
        password: authIdentity.password,
        id_token: authIdentity.id_token,
        code: authIdentity.code,
        customer_account_code: authIdentity.customer_account_code,
        redirect_uri: optionalString('SSO redirect URI'),
      },
      annotations: READ_ONLY,
      run: async (args) => {
        const hasPassword = args.username && args.password;
        const hasSso = (args.id_token || args.code) && args.customer_account_code;
        if (!hasPassword && !hasSso) {
          throw new ToolInputError('Provide username + password, or id_token/code + customer_account_code');
        }
        return get('/user_licenses', args);
      },
    }),
    defineTool({
      name: 'get_device_licenses',
      title: 'List Licenses for Device',
      description: 'List all licenses assigned to a device.',
      inputSchema: { hardware_id: hardwareId },
      annotations: READ_ONLY,
      run: async (args) => get('/device_licenses', args),
    }),
    defineTool({
      name: 'get_customer_license_users',
      title: 'List License Users for Customer',
      description: 'List the license users assigned to licenses of a customer (user-based products only).',
      inputSchema: {
        product,
        customer: z.string().min(1).describe('Customer email'),
      },
      annotations: READ_ONLY,
      run: async (args) => get('/customer_license_users', args),
    }),

    // ----- Products ------------------------------------------------------
    defineTool({
      name: 'list_products',
      title: 'List Products',
      description: 'List all products available to the configured credentials.',
      inputSchema: {},
      annotations: READ_ONLY,
      run: async () => get('/products', {}),
    }),
    defineTool({
      name: 'get_product_details',
      title: 'Get Product Details',
      description: 'Get metadata and flags for a product.',
      inputSchema: {
        product,
        include_latest_version: optionalBool('Include the latest product version'),
        include_custom_fields: optionalBool('Include product custom fields'),
        env: optionalString('Installation file environment filter, e.g. "win64"'),
      },
      annotations: READ_ONLY,
      run: async (args) => get('/product_details', args),
    }),
    defineTool({
      name: 'get_versions',
      title: 'Get Product Versions',
      description: 'List product versions available to a license (limited by its maintenance/validity period).',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        ...lookupIdentity,
        env: optionalString('Environment identifier, e.g. "win64", "mac", "linux"'),
        channel: optionalString('Release channel, e.g. "staging", "prod"'),
      },
      annotations: READ_ONLY,
      run: async (args) => {
        requireLookupIdentity(args);
        return get('/versions', args);
      },
    }),
    defineTool({
      name: 'get_installation_file',
      title: 'Get Installation File',
      description: 'Get installation file metadata (download URL, hash, version) for a license.',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        ...lookupIdentity,
        version: optionalString('Version, e.g. "1.0.0" (latest when omitted)'),
        env: optionalString('Environment identifier, e.g. "win64", "mac", "linux"'),
        channel: optionalString('Release channel, e.g. "staging", "prod"'),
      },
      annotations: READ_ONLY,
      run: async (args) => {
        requireLookupIdentity(args);
        return get('/installation_file', args);
      },
    }),

    // ----- Device variables ----------------------------------------------
    defineTool({
      name: 'get_device_variables',
      title: 'Get Device Variables',
      description: 'Get the variables stored for a license device.',
      inputSchema: { hardware_id: hardwareId, product, ...lookupIdentity },
      annotations: READ_ONLY,
      run: async (args) => {
        requireLookupIdentity(args);
        return get('/get_device_variables', args);
      },
    }),
    defineTool({
      name: 'track_device_variables',
      title: 'Track Device Variables',
      description: 'Store variables for a license device. Existing variables with the same name are overwritten.',
      inputSchema: {
        hardware_id: hardwareId,
        product,
        ...lookupIdentity,
        variables: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .refine((value) => Object.keys(value).length > 0, 'At least one variable is required')
          .describe('Variables to store, as a key/value object'),
      },
      annotations: IDEMPOTENT_WRITE,
      run: async (args) => {
        requireLookupIdentity(args);
        return post('/track_device_variables', args);
      },
    }),

    // ----- Users & SSO ---------------------------------------------------
    defineTool({
      name: 'change_password',
      title: 'Change Password',
      description: "Change a license user's password.",
      inputSchema: {
        username: z.string().min(1).describe('License user email'),
        password: z.string().min(1).describe('Current password'),
        new_password: z.string().min(1).describe('New password'),
      },
      annotations: WRITE,
      run: async (args) => post('/change_password', args),
    }),
    defineTool({
      name: 'get_sso_url',
      title: 'Get SSO URL',
      description: 'Get the hosted single sign-on URL used to authorize license users of a customer account.',
      inputSchema: {
        product,
        customer_account_code: z.string().min(1).describe('Customer account code'),
        response_type: z
          .enum(['code', 'token'])
          .optional()
          .describe('"code" (Authorization Code grant, default) or "token" (Implicit grant)'),
      },
      annotations: READ_ONLY,
      run: async (args) => get('/sso_url', args),
    }),

    // ----- Metadata ------------------------------------------------------
    defineTool({
      name: 'get_api_metadata',
      title: 'Get API Metadata',
      description: 'Get public License API metadata: base URL, supported versions, release version and endpoints.',
      inputSchema: {},
      annotations: READ_ONLY,
      run: async () => get('/.well-known', {}),
    }),
  ];
}
