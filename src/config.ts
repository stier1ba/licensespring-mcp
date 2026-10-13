/**
 * Environment configuration for both MCP servers.
 */

export const DEFAULT_LICENSE_API_URL = 'https://api.licensespring.com';
export const DEFAULT_MANAGEMENT_API_URL = 'https://saas.licensespring.com';
export const DEFAULT_OAUTH_TOKEN_URL = 'https://auth.licensespring.com/realms/user-portal/protocol/openid-connect/token';
export const DEFAULT_TIMEOUT_MS = 25_000;
export const DEFAULT_MAX_RETRIES = 2;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export type LicenseApiAuth =
  | { type: 'api-key'; apiKey: string; sharedKey: string }
  | { type: 'oauth'; clientId: string; clientSecret: string; tokenUrl: string };

export interface HttpOptions {
  timeoutMs: number;
  maxRetries: number;
  /** Only register tools annotated as read-only (LICENSESPRING_READ_ONLY=true). */
  readOnly: boolean;
}

export interface LicenseApiConfig extends HttpOptions {
  baseUrl: string;
  auth: LicenseApiAuth;
}

export interface ManagementApiConfig extends HttpOptions {
  baseUrl: string;
  apiKey: string;
  /** Toolsets to register (MANAGEMENT_TOOLSETS); undefined registers all. */
  toolsets?: string[];
}

type Env = Record<string, string | undefined>;

function value(env: Env, key: string): string | undefined {
  const raw = env[key]?.trim();
  return raw ? raw : undefined;
}

function nonNegativeInt(env: Env, key: string, fallback: number): number {
  const raw = value(env, key);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ConfigError(`${key} must be a non-negative integer (got "${raw}")`);
  }
  return parsed;
}

function bool(env: Env, key: string): boolean {
  const raw = value(env, key)?.toLowerCase();
  if (raw === undefined || ['false', '0', 'no', 'off'].includes(raw)) return false;
  if (['true', '1', 'yes', 'on'].includes(raw)) return true;
  throw new ConfigError(`${key} must be true or false (got "${raw}")`);
}

function httpOptions(env: Env): HttpOptions {
  return {
    timeoutMs: nonNegativeInt(env, 'LICENSESPRING_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
    maxRetries: nonNegativeInt(env, 'LICENSESPRING_MAX_RETRIES', DEFAULT_MAX_RETRIES),
    readOnly: bool(env, 'LICENSESPRING_READ_ONLY'),
  };
}

/** Parse a comma-separated list, validating each entry against `allowed`. */
function list(env: Env, key: string, allowed: readonly string[]): string[] | undefined {
  const raw = value(env, key);
  if (raw === undefined || raw.toLowerCase() === 'all') return undefined;
  const items = raw.split(',').map((item) => item.trim()).filter(Boolean);
  const unknown = items.filter((item) => !allowed.includes(item));
  if (unknown.length > 0 || items.length === 0) {
    throw new ConfigError(`${key} contains unknown toolsets: ${unknown.join(', ') || '(empty)'}. Valid: ${allowed.join(', ')}`);
  }
  return [...new Set(items)];
}

/**
 * Resolve License API configuration.
 *
 * LicenseSpring supports two authorization methods for the License API:
 * - OAuth client credentials (LICENSE_CLIENT_ID + LICENSE_CLIENT_SECRET), preferred when set
 * - API key + shared key (LICENSE_API_KEY + LICENSE_SHARED_KEY); every request is HMAC-signed,
 *   so the shared key is mandatory (the API rejects unsigned API-key requests with `hmac_required`)
 */
export function loadLicenseApiConfig(env: Env = process.env): LicenseApiConfig {
  const baseUrl = value(env, 'LICENSE_API_URL') ?? DEFAULT_LICENSE_API_URL;
  const clientId = value(env, 'LICENSE_CLIENT_ID');
  const clientSecret = value(env, 'LICENSE_CLIENT_SECRET');
  const apiKey = value(env, 'LICENSE_API_KEY');
  const sharedKey = value(env, 'LICENSE_SHARED_KEY');

  if (clientId || clientSecret) {
    if (!clientId || !clientSecret) {
      throw new ConfigError('OAuth requires both LICENSE_CLIENT_ID and LICENSE_CLIENT_SECRET');
    }
    return {
      baseUrl,
      auth: {
        type: 'oauth',
        clientId,
        clientSecret,
        tokenUrl: value(env, 'LICENSE_OAUTH_TOKEN_URL') ?? DEFAULT_OAUTH_TOKEN_URL,
      },
      ...httpOptions(env),
    };
  }

  if (!apiKey) {
    throw new ConfigError(
      'License API credentials missing: set LICENSE_API_KEY and LICENSE_SHARED_KEY, ' +
      'or LICENSE_CLIENT_ID and LICENSE_CLIENT_SECRET for OAuth',
    );
  }
  if (!sharedKey) {
    throw new ConfigError(
      'LICENSE_SHARED_KEY is required with LICENSE_API_KEY: the License API rejects unsigned requests ' +
      '(find it in the LicenseSpring platform under Settings > Keys), or use OAuth credentials instead',
    );
  }

  return { baseUrl, auth: { type: 'api-key', apiKey, sharedKey }, ...httpOptions(env) };
}

export const MANAGEMENT_TOOLSET_NAMES = [
  'licenses',
  'license_users',
  'orders',
  'customers',
  'products',
  'devices',
  'analytics',
  'consumption_pools',
  'oauth_clients',
] as const;

export function loadManagementApiConfig(env: Env = process.env): ManagementApiConfig {
  const apiKey = value(env, 'MANAGEMENT_API_KEY');
  if (!apiKey) {
    throw new ConfigError('MANAGEMENT_API_KEY is required (find it in the LicenseSpring platform under Settings > Keys)');
  }
  return {
    baseUrl: value(env, 'MANAGEMENT_API_URL') ?? DEFAULT_MANAGEMENT_API_URL,
    apiKey,
    toolsets: list(env, 'MANAGEMENT_TOOLSETS', MANAGEMENT_TOOLSET_NAMES),
    ...httpOptions(env),
  };
}
