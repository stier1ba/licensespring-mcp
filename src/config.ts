export const DEFAULT_LICENSE_API_URL = 'https://api.licensespring.com';
export const DEFAULT_MANAGEMENT_API_URL = 'https://saas.licensespring.com';
export const DEFAULT_OAUTH_TOKEN_URL =
  'https://auth.licensespring.com/realms/user-portal/protocol/openid-connect/token';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export type LicenseApiAuth =
  | { type: 'hmac'; apiKey: string; sharedKey: string }
  | { type: 'oauth'; clientId: string; clientSecret: string; tokenUrl: string };

export interface LicenseApiConfig {
  baseURL: string;
  auth: LicenseApiAuth;
}

export interface ManagementApiConfig {
  baseURL: string;
  apiKey: string;
}

type Env = Record<string, string | undefined>;

function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

/**
 * The License API requires either API key + shared key (HMAC request
 * signing) or an OAuth client (client credentials). An API key alone is
 * rejected by LicenseSpring with `hmac_required`.
 */
export function loadLicenseApiConfig(env: Env): LicenseApiConfig {
  const baseURL = read(env, 'LICENSE_API_URL') ?? DEFAULT_LICENSE_API_URL;
  const clientId = read(env, 'LICENSE_CLIENT_ID');
  const clientSecret = read(env, 'LICENSE_CLIENT_SECRET');
  const apiKey = read(env, 'LICENSE_API_KEY');
  const sharedKey = read(env, 'LICENSE_SHARED_KEY');

  if (clientId || clientSecret) {
    if (!clientId || !clientSecret) {
      throw new ConfigError('OAuth requires both LICENSE_CLIENT_ID and LICENSE_CLIENT_SECRET.');
    }
    return {
      baseURL,
      auth: {
        type: 'oauth',
        clientId,
        clientSecret,
        tokenUrl: read(env, 'LICENSE_OAUTH_TOKEN_URL') ?? DEFAULT_OAUTH_TOKEN_URL,
      },
    };
  }

  if (apiKey && sharedKey) {
    return { baseURL, auth: { type: 'hmac', apiKey, sharedKey } };
  }

  if (apiKey) {
    throw new ConfigError(
      'LICENSE_SHARED_KEY is required with LICENSE_API_KEY: the License API rejects unsigned requests. ' +
      'Find both under Settings → Keys in the LicenseSpring portal, or use LICENSE_CLIENT_ID/LICENSE_CLIENT_SECRET for OAuth.',
    );
  }

  throw new ConfigError(
    'No License API credentials found. Set LICENSE_API_KEY and LICENSE_SHARED_KEY, ' +
    'or LICENSE_CLIENT_ID and LICENSE_CLIENT_SECRET for OAuth.',
  );
}

export function loadManagementApiConfig(env: Env): ManagementApiConfig {
  const apiKey = read(env, 'MANAGEMENT_API_KEY');
  if (!apiKey) {
    throw new ConfigError(
      'MANAGEMENT_API_KEY is required. Find it under Settings → Keys in the LicenseSpring portal ' +
      '(the License API key and shared key do not work for the Management API).',
    );
  }
  return { baseURL: read(env, 'MANAGEMENT_API_URL') ?? DEFAULT_MANAGEMENT_API_URL, apiKey };
}
