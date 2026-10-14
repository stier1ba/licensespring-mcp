import { randomUUID } from 'node:crypto';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { generateOfflineSignature } from '../utils/auth.js';
import { compact, handleApiError, type LicenseApiClient } from '../utils/http.js';
import type { Logger } from '../utils/logger.js';
import { createHealthState, registerHealthResource, type HealthState } from '../tools/health.js';
import { createRunner, IDEMPOTENT_WRITE, READ_ONLY, WRITE } from '../tools/result.js';
import { VERSION } from '../version.js';
import {
  fullIdentityShape,
  keyOrUserShape,
  pickFullIdentity,
  pickKeyOrUser,
} from './identity.js';

export const LICENSE_SERVER_NAME = 'licensespring-license-api';
const API = '/api/v4';

export interface LicenseServerOptions {
  logger?: Logger;
  health?: HealthState;
  /** Generates request_id values for offline requests (injectable for tests). */
  randomId?: () => string;
}

const required = (label: string) => z.string().min(1, `${label} is required`);
const hardwareId = required('Hardware ID').describe('Unique device identifier');
const product = required('Product code').describe('Product short code');

const envParam = z.string().min(1).describe('Target platform, e.g. win, win32, win64, mac, linux, linux32, linux64');

const deviceInfoShape = {
  os_ver: z.string().optional().describe('Operating system version'),
  hostname: z.string().optional().describe('Device hostname'),
  os_hostname: z.string().optional().describe('Hostname as reported by the OS'),
  ip: z.string().optional().describe('Public IP address'),
  ip_local: z.string().optional().describe('Local IP address'),
  mac_address: z.string().optional().describe('Device MAC address'),
  app_ver: z.string().optional().describe('Application version'),
  sdk_ver: z.string().optional().describe('SDK version'),
};

const checkOptionsShape = {
  include_expired_features: z.boolean().optional().describe('Include expired product features in the response'),
  env: z.string().optional().describe('Environment identifier, e.g. "win64", "mac", "linux"'),
  ...deviceInfoShape,
};

const activateOptionsShape = {
  bundle_code: z.string().optional().describe('Bundle code, when activating a product inside a bundle'),
  app_ver: z.string().optional().describe('Application version'),
  app_name: z.string().optional().describe('Application name'),
  sdk_ver: z.string().optional().describe('SDK version'),
  variables: z.record(z.string(), z.string()).optional().describe('Device variables to store on activation'),
  include_metadata_string: z.boolean().optional().describe('Return metadata as a JSON string'),
  include_scheduled_changes: z.boolean().optional().describe('Include scheduled license changes in the response'),
  redirect_uri: z.string().optional().describe('SSO redirect URI (authorization code flow)'),
};

const productFeatureConsumptions = z.array(z.object({
  feature: z.string().min(1).describe('Feature code'),
  consumptions: z.number().int().describe('Consumption units to sync'),
}));

const borrowedUntil = z.string().min(1).nullable().optional().describe(
  'ISO 8601 UTC date/time to borrow until (e.g. "2026-12-31T23:59:00Z" or "2026-12-31"). Omit or null for the maximum borrow time.',
);

export function createLicenseApiServer(client: LicenseApiClient, options: LicenseServerOptions = {}): McpServer {
  const server = new McpServer({ name: LICENSE_SERVER_NAME, version: VERSION });
  const run = createRunner('license', options.logger);
  const randomId = options.randomId ?? randomUUID;
  const health = options.health ?? createHealthState();

  registerHealthResource(server, LICENSE_SERVER_NAME, health, {
    api_url: client.baseURL,
    auth_method: client.auth.type,
  });

  // ---- Resources -------------------------------------------------------
  server.registerResource(
    'product-details',
    new ResourceTemplate('licensespring://product/{product}/details', { list: undefined }),
    { title: 'Product Details', description: 'Product configuration from the License API', mimeType: 'application/json' },
    async (uri, variables) => {
      try {
        const data = await client.get(`${API}/product_details`, { product: String(variables.product) });
        return { contents: [{ uri: uri.toString(), mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };
      } catch (error) {
        throw new Error(`Failed to get product details: ${handleApiError(error, 'license')}`, { cause: error });
      }
    },
  );

  // ---- Prompts ---------------------------------------------------------
  server.registerPrompt(
    'license-troubleshooting',
    {
      title: 'License Troubleshooting',
      description: 'Diagnose and resolve a license issue',
      argsSchema: {
        license_key: z.string().min(1, 'License key is required'),
        issue_description: z.string().min(1, 'Issue description is required'),
        product: z.string().optional(),
        hardware_id: z.string().optional(),
      },
    },
    ({ license_key, issue_description, product: productCode, hardware_id }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: [
            'Please help troubleshoot this LicenseSpring license issue:',
            '',
            `License Key: ${license_key}`,
            productCode ? `Product: ${productCode}` : undefined,
            hardware_id ? `Hardware ID: ${hardware_id}` : undefined,
            `Issue Description: ${issue_description}`,
            '',
            'Please:',
            '1. Run check_license (needs product and hardware_id) to see status, expiry and activations',
            '2. Verify the license is enabled, active and not expired',
            '3. Check consumption limits/overages and floating seat usage',
            '4. Use check_license_feature for feature-specific problems',
            '5. Explain the root cause and give concrete next steps',
          ].filter((line) => line !== undefined).join('\n'),
        },
      }],
    }),
  );

  server.registerPrompt(
    'trial-onboarding',
    {
      title: 'Trial Onboarding',
      description: 'Issue a trial license for a new evaluator',
      argsSchema: {
        product_code: z.string().min(1, 'Product code is required'),
        hardware_id: z.string().min(1, 'Hardware ID is required'),
        email: z.string().optional(),
      },
    },
    ({ product_code, hardware_id, email }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: [
            'Please set up a trial for a new evaluator:',
            '',
            `Product: ${product_code}`,
            `Hardware ID: ${hardware_id}`,
            email ? `Email: ${email}` : undefined,
            '',
            '1. Use get_product_details to confirm the product allows trials and whether it is key- or user-based',
            '2. Use get_trial_key (email is required for user-based products)',
            '3. Activate the trial with activate_license',
            '4. Summarize the trial length, limits and activation details',
          ].filter((line) => line !== undefined).join('\n'),
        },
      }],
    }),
  );

  // ---- Activation ------------------------------------------------------
  server.registerTool('activate_license', {
    title: 'Activate License',
    description: 'Activate a license on a device. Identify the license with license_key, username + password, or SSO (id_token/code + customer_account_code).',
    inputSchema: { hardware_id: hardwareId, product, ...fullIdentityShape, ...activateOptionsShape },
    annotations: WRITE,
  }, ({ hardware_id, product: p, ...rest }) => run('activating license', () => {
    const identity = pickFullIdentity(rest);
    return client.post(`${API}/activate_license`, compact({
      hardware_id, product: p, ...identity,
      bundle_code: rest.bundle_code, app_ver: rest.app_ver, app_name: rest.app_name, sdk_ver: rest.sdk_ver,
      variables: rest.variables, include_metadata_string: rest.include_metadata_string,
      include_scheduled_changes: rest.include_scheduled_changes, redirect_uri: rest.redirect_uri,
    }));
  }));

  server.registerTool('check_license', {
    title: 'Check License',
    description: 'Check license status and validity for a device (key-based: license_key, user-based: username).',
    inputSchema: {
      hardware_id: hardwareId, product, ...keyOrUserShape, ...checkOptionsShape,
      include_scheduled_changes: z.boolean().optional().describe('Include scheduled license changes'),
    },
    annotations: READ_ONLY,
  }, ({ hardware_id, product: p, license_key, username, license_id, ...opts }) => run('checking license', () =>
    client.get(`${API}/check_license`, { hardware_id, product: p, ...pickKeyOrUser({ license_key, username, license_id }), ...opts })));

  server.registerTool('deactivate_license', {
    title: 'Deactivate License',
    description: 'Deactivate a license on a device, optionally syncing final consumptions.',
    inputSchema: {
      hardware_id: hardwareId, product, ...fullIdentityShape,
      bundle_code: z.string().optional(),
      sdk_ver: z.string().optional(),
      consumptions: z.number().int().optional().describe('Unsynced license consumptions to record before deactivating'),
      product_features: productFeatureConsumptions.optional().describe('Unsynced feature consumptions'),
      variables: z.record(z.string(), z.string()).optional(),
    },
    annotations: { ...IDEMPOTENT_WRITE, destructiveHint: true },
  }, ({ hardware_id, product: p, bundle_code, sdk_ver, consumptions, product_features, variables, ...identityArgs }) =>
    run('deactivating license', () => client.post(`${API}/deactivate_license`, compact({
      hardware_id, product: p, ...pickFullIdentity(identityArgs), bundle_code, sdk_ver, consumptions, product_features, variables,
    }))));

  const offlineIdentityShape = {
    license_key: keyOrUserShape.license_key,
    username: keyOrUserShape.username,
    password: fullIdentityShape.password,
    license_id: keyOrUserShape.license_id,
  };

  function buildOfflinePayload(
    request: 'activation' | 'deactivation',
    args: { hardware_id: string; product: string; license_key?: string; username?: string; password?: string; license_id?: number },
    extra: Record<string, unknown>,
  ): string {
    const identity = pickFullIdentity({
      license_key: args.license_key, username: args.username, password: args.password, license_id: args.license_id,
    });
    const credentials = client.offlineCredentials();
    const date = client.currentDate();
    const signature = generateOfflineSignature({
      signingKey: credentials.signingKey,
      date,
      licenseKeyOrUsername: (identity.license_key ?? identity.username) as string,
      hardwareId: args.hardware_id,
      apiKeyOrClientId: credentials.value,
    });
    const payload = compact({
      request,
      request_id: randomId(),
      hardware_id: args.hardware_id,
      product: args.product,
      license_key: identity.license_key,
      username: identity.username,
      password: identity.password,
      license_id: identity.license_id,
      [credentials.field]: credentials.value,
      date,
      signature,
      ...extra,
    });
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  }

  server.registerTool('activate_offline', {
    title: 'Activate License Offline',
    description: 'Submit an offline (air-gapped) activation request on behalf of a device. The request is signed and base64-encoded as the API requires; the response contains the signed license for the device.',
    inputSchema: {
      hardware_id: hardwareId, product, ...offlineIdentityShape,
      bundle_code: z.string().optional(),
      ...deviceInfoShape,
      app_name: z.string().optional(),
      variables: z.record(z.string(), z.string()).optional(),
    },
    annotations: WRITE,
  }, ({ hardware_id, product: p, license_key, username, password, license_id, ...extra }) =>
    run('activating license offline', () => client.postText(
      `${API}/activate_offline`,
      buildOfflinePayload('activation', { hardware_id, product: p, license_key, username, password, license_id }, compact(extra)),
    )));

  server.registerTool('deactivate_offline', {
    title: 'Deactivate License Offline',
    description: 'Submit an offline (air-gapped) deactivation request, optionally syncing final consumptions.',
    inputSchema: {
      hardware_id: hardwareId, product, ...offlineIdentityShape,
      consumptions: z.number().int().optional(),
      product_features: productFeatureConsumptions.optional(),
    },
    annotations: { ...IDEMPOTENT_WRITE, destructiveHint: true },
  }, ({ hardware_id, product: p, license_key, username, password, license_id, ...extra }) =>
    run('deactivating license offline', () => client.postText(
      `${API}/deactivate_offline`,
      buildOfflinePayload('deactivation', { hardware_id, product: p, license_key, username, password, license_id }, compact(extra)),
    )));

  // ---- Bundles ---------------------------------------------------------
  server.registerTool('activate_bundle', {
    title: 'Activate Bundle',
    description: 'Activate all licenses of a bundle on a device (product = bundle code).',
    inputSchema: {
      hardware_id: hardwareId,
      product: required('Bundle code').describe('Bundle short code'),
      ...fullIdentityShape, ...deviceInfoShape,
      variables: z.record(z.string(), z.string()).optional(),
    },
    annotations: WRITE,
  }, ({ hardware_id, product: p, license_key, username, password, id_token, code, customer_account_code, license_id, ...opts }) =>
    run('activating bundle', () => client.post(`${API}/activate_bundle`, compact({
      hardware_id, product: p,
      ...pickFullIdentity({ license_key, username, password, id_token, code, customer_account_code, license_id }),
      ...opts,
    }))));

  server.registerTool('check_bundle', {
    title: 'Check Bundle',
    description: 'Check all licenses of a bundle on a device.',
    inputSchema: { hardware_id: hardwareId, product: required('Bundle code'), ...keyOrUserShape, ...checkOptionsShape },
    annotations: READ_ONLY,
  }, ({ hardware_id, product: p, license_key, username, license_id, ...opts }) => run('checking bundle', () =>
    client.get(`${API}/check_bundle`, { hardware_id, product: p, ...pickKeyOrUser({ license_key, username, license_id }), ...opts })));

  server.registerTool('deactivate_bundle', {
    title: 'Deactivate Bundle',
    description: 'Deactivate all licenses of a bundle on a device.',
    inputSchema: { hardware_id: hardwareId, product: required('Bundle code'), ...fullIdentityShape, sdk_ver: z.string().optional() },
    annotations: { ...IDEMPOTENT_WRITE, destructiveHint: true },
  }, ({ hardware_id, product: p, sdk_ver, ...identityArgs }) => run('deactivating bundle', () =>
    client.post(`${API}/deactivate_bundle`, compact({ hardware_id, product: p, ...pickFullIdentity(identityArgs), sdk_ver }))));

  // ---- Features & consumption -----------------------------------------
  server.registerTool('check_license_feature', {
    title: 'Check License Feature',
    description: 'Check whether a specific feature is available on an activated license.',
    inputSchema: { hardware_id: hardwareId, product, feature: required('Feature code'), ...keyOrUserShape },
    annotations: READ_ONLY,
  }, ({ hardware_id, product: p, feature, license_key, username, license_id }) => run('checking license feature', () =>
    client.get(`${API}/check_license_feature`, { hardware_id, product: p, feature, ...pickKeyOrUser({ license_key, username, license_id }) })));

  server.registerTool('add_consumption', {
    title: 'Add Consumption',
    description: 'Record consumption units on a consumption license. Negative values are allowed when the license permits it. Not idempotent.',
    inputSchema: {
      hardware_id: hardwareId, product, ...keyOrUserShape,
      consumptions: z.number().int().optional().describe('Units to add (default 1)'),
      max_overages: z.number().int().min(0).optional().describe('Maximum overages allowed'),
      allow_overages: z.boolean().optional().describe('Allow consumption beyond the limit'),
    },
    annotations: WRITE,
  }, ({ hardware_id, product: p, license_key, username, license_id, ...opts }) => run('adding consumption', () =>
    client.post(`${API}/add_consumption`, compact({ hardware_id, product: p, ...pickKeyOrUser({ license_key, username, license_id }), ...opts }))));

  server.registerTool('add_feature_consumption', {
    title: 'Add Feature Consumption',
    description: 'Record consumption units on a consumption feature. Not idempotent.',
    inputSchema: {
      hardware_id: hardwareId, product, feature: required('Feature code'), ...keyOrUserShape,
      consumptions: z.number().int().optional().describe('Units to add (default 1)'),
    },
    annotations: WRITE,
  }, ({ hardware_id, product: p, feature, consumptions, license_key, username, license_id }) => run('adding feature consumption', () =>
    client.post(`${API}/add_feature_consumption`, compact({
      hardware_id, product: p, feature, consumptions, ...pickKeyOrUser({ license_key, username, license_id }),
    }))));

  // ---- Trials, products, license lists --------------------------------
  server.registerTool('get_trial_key', {
    title: 'Get Trial Key',
    description: 'Generate a trial license for a device (creates a license; not retried automatically). For user-based products, email is required. Customer fields create or link a customer record.',
    inputSchema: {
      hardware_id: hardwareId, product,
      email: z.string().email().optional().describe('Customer email (required for user-based products)'),
      password: z.string().optional().describe('Password for the trial user (user-based; random if omitted)'),
      license_policy: z.string().optional().describe('License policy code (product default if omitted)'),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      postcode: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      reference: z.string().optional(),
    },
    annotations: WRITE,
  }, (args) => run('generating trial key', () =>
    // trial_key creates a license, so it must not be retried automatically.
    client.get(`${API}/trial_key`, args, { retry: false })));

  server.registerTool('get_product_details', {
    title: 'Get Product Details',
    description: 'Get product configuration (license type, trial settings, features, etc.).',
    inputSchema: {
      product,
      include_latest_version: z.boolean().optional().describe('Include the latest installation file version'),
      include_custom_fields: z.boolean().optional().describe('Include product custom fields'),
      env: z.string().optional().describe('Environment for the latest version, e.g. "win64"'),
    },
    annotations: READ_ONLY,
  }, (args) => run('getting product details', () => client.get(`${API}/product_details`, args)));

  server.registerTool('list_products', {
    title: 'List Products',
    description: 'List products available to the configured credentials.',
    inputSchema: {},
    annotations: READ_ONLY,
  }, () => run('listing products', () => client.get(`${API}/products`)));

  server.registerTool('get_user_licenses', {
    title: 'Get User Licenses',
    description: 'List licenses assigned to a license user (username + password, or SSO).',
    inputSchema: {
      product,
      username: fullIdentityShape.username,
      password: fullIdentityShape.password,
      id_token: fullIdentityShape.id_token,
      code: fullIdentityShape.code,
      customer_account_code: fullIdentityShape.customer_account_code,
      redirect_uri: z.string().optional(),
    },
    annotations: READ_ONLY,
  }, ({ product: p, redirect_uri, ...identityArgs }) => run('getting user licenses', () => {
    const { license_id: _ignored, ...identity } = pickFullIdentity(identityArgs);
    return client.get(`${API}/user_licenses`, { product: p, ...identity, redirect_uri });
  }));

  server.registerTool('get_device_licenses', {
    title: 'Get Device Licenses',
    description: 'List licenses activated on a device.',
    inputSchema: { hardware_id: hardwareId },
    annotations: READ_ONLY,
  }, (args) => run('getting device licenses', () => client.get(`${API}/device_licenses`, args)));

  server.registerTool('get_customer_license_users', {
    title: 'Get Customer License Users',
    description: 'List license users belonging to a customer for a product.',
    inputSchema: {
      product,
      customer: required('Customer email').describe('Customer email address'),
    },
    annotations: READ_ONLY,
  }, (args) => run('getting customer license users', () => client.get(`${API}/customer_license_users`, args)));

  // ---- Device variables -----------------------------------------------
  server.registerTool('track_device_variables', {
    title: 'Track Device Variables',
    description: 'Store custom variables on an activated device. Existing variables with the same name are overwritten.',
    inputSchema: {
      hardware_id: hardwareId, product, ...keyOrUserShape,
      variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .refine((obj) => Object.keys(obj).length > 0, 'At least one variable is required'),
    },
    annotations: IDEMPOTENT_WRITE,
  }, ({ hardware_id, product: p, variables, license_key, username, license_id }) => run('tracking device variables', () =>
    client.post(`${API}/track_device_variables`, compact({
      hardware_id, product: p, variables, ...pickKeyOrUser({ license_key, username, license_id }),
    }))));

  server.registerTool('get_device_variables', {
    title: 'Get Device Variables',
    description: 'Get custom variables stored on an activated device.',
    inputSchema: { hardware_id: hardwareId, product, ...keyOrUserShape },
    annotations: READ_ONLY,
  }, ({ hardware_id, product: p, license_key, username, license_id }) => run('getting device variables', () =>
    client.get(`${API}/get_device_variables`, { hardware_id, product: p, ...pickKeyOrUser({ license_key, username, license_id }) })));

  // ---- Floating --------------------------------------------------------
  server.registerTool('floating_borrow', {
    title: 'Borrow Floating License',
    description: 'Borrow a floating license seat for offline use until a given time.',
    inputSchema: {
      hardware_id: hardwareId, product, ...fullIdentityShape,
      borrowed_until: borrowedUntil,
      bundle_code: z.string().optional(),
      sdk_ver: z.string().optional(),
    },
    annotations: WRITE,
  }, ({ hardware_id, product: p, borrowed_until, bundle_code, sdk_ver, ...identityArgs }) => run('borrowing floating license', () =>
    client.post(`${API}/floating/borrow`, compact({
      hardware_id, product: p, ...pickFullIdentity(identityArgs),
      borrowed_until: borrowed_until ?? null, bundle_code, sdk_ver,
    }))));

  server.registerTool('floating_release', {
    title: 'Release Floating License',
    description: 'Release a floating license seat held by a device.',
    inputSchema: { hardware_id: hardwareId, product, ...keyOrUserShape },
    annotations: IDEMPOTENT_WRITE,
  }, ({ hardware_id, product: p, license_key, username, license_id }) => run('releasing floating license', () =>
    client.post(`${API}/floating/release`, compact({ hardware_id, product: p, ...pickKeyOrUser({ license_key, username, license_id }) }))));

  server.registerTool('floating_feature_borrow', {
    title: 'Borrow Floating Feature',
    description: 'Borrow a floating feature seat for offline use.',
    inputSchema: {
      hardware_id: hardwareId, product, feature: required('Feature code'), ...fullIdentityShape,
      borrowed_until: borrowedUntil,
    },
    annotations: WRITE,
  }, ({ hardware_id, product: p, feature, borrowed_until, ...identityArgs }) => run('borrowing floating feature', () =>
    client.post(`${API}/floating/feature_borrow`, compact({
      hardware_id, product: p, feature, ...pickFullIdentity(identityArgs), borrowed_until: borrowed_until ?? null,
    }))));

  server.registerTool('floating_feature_release', {
    title: 'Release Floating Feature',
    description: 'Release a floating feature seat held by a device.',
    inputSchema: { hardware_id: hardwareId, product, feature: required('Feature code'), ...keyOrUserShape },
    annotations: IDEMPOTENT_WRITE,
  }, ({ hardware_id, product: p, feature, license_key, username, license_id }) => run('releasing floating feature', () =>
    client.post(`${API}/floating/feature_release`, compact({
      hardware_id, product: p, feature, ...pickKeyOrUser({ license_key, username, license_id }),
    }))));

  // ---- Users, versions, SSO -------------------------------------------
  server.registerTool('change_password', {
    title: 'Change Password',
    description: 'Change the password of a license user (user-based licenses).',
    inputSchema: {
      username: required('Username'),
      password: required('Current password'),
      new_password: required('New password'),
    },
    annotations: IDEMPOTENT_WRITE,
  }, (args) => run('changing password', () => client.post(`${API}/change_password`, args)));

  server.registerTool('get_versions', {
    title: 'Get Software Versions',
    description: 'List installation file versions available to a license.',
    inputSchema: {
      hardware_id: hardwareId, product, ...keyOrUserShape,
      env: envParam.optional(),
      channel: z.string().optional().describe('Release channel, e.g. "prod" or "staging"'),
    },
    annotations: READ_ONLY,
  }, ({ hardware_id, product: p, license_key, username, license_id, env, channel }) => run('getting versions', () =>
    client.get(`${API}/versions`, { hardware_id, product: p, ...pickKeyOrUser({ license_key, username, license_id }), env, channel })));

  server.registerTool('get_installation_file', {
    title: 'Get Installation File',
    description: 'Get installation file download information (latest, or a specific version).',
    inputSchema: {
      hardware_id: hardwareId, product, ...keyOrUserShape,
      version: z.string().optional().describe('Specific version (latest if omitted)'),
      env: envParam.optional(),
      channel: z.string().optional().describe('Release channel'),
    },
    annotations: READ_ONLY,
  }, ({ hardware_id, product: p, license_key, username, license_id, version, env, channel }) => run('getting installation file', () =>
    client.get(`${API}/installation_file`, {
      hardware_id, product: p, ...pickKeyOrUser({ license_key, username, license_id }), version, env, channel,
    })));

  server.registerTool('get_sso_url', {
    title: 'Get SSO URL',
    description: 'Get the customer SSO login URL for user-based licenses.',
    inputSchema: {
      product,
      customer_account_code: required('Customer account code'),
      response_type: z.enum(['code', 'token']).optional().describe('"code" (authorization code, API default) or "token" (implicit)'),
    },
    annotations: READ_ONLY,
  }, (args) => run('getting SSO URL', () => client.get(`${API}/sso_url`, args)));

  return server;
}
