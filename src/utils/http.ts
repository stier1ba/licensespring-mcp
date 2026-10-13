import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { LicenseApiConfig, ManagementApiConfig } from '../config.js';
import {
  generateApiKeyAuthorization,
  generateManagementApiAuthHeader,
  generateOfflineSignature,
  httpDate,
} from './auth.js';
import { OAuthTokenProvider } from './oauth.js';
import { errorStatus, isRetryableError, withRetry, type RetryOptions } from './retry.js';
import type { Logger } from './logger.js';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiRequest {
  method: HttpMethod;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ApiClient {
  request<T = unknown>(request: ApiRequest): Promise<T>;
}

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const PACKAGE_VERSION = readPackageVersion();
export const USER_AGENT = `licensespring-mcp-server/${PACKAGE_VERSION}`;

/**
 * Serialize query parameters, dropping undefined/null values. Arrays become comma-separated
 * lists (e.g. `id__in`), objects are JSON-encoded (e.g. `metadata` filters).
 */
export function buildQueryString(query: Record<string, unknown> = {}): string {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null) continue;
    let value: string;
    if (Array.isArray(raw)) value = raw.join(',');
    else if (typeof raw === 'object') value = JSON.stringify(raw);
    else value = String(raw);
    params.append(key, value);
  }
  return params.toString();
}

/** Remove keys whose value is undefined so they are not sent in JSON bodies. */
export function compact<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<T>;
}

abstract class BaseApiClient implements ApiClient {
  constructor(
    protected readonly http: AxiosInstance,
    private readonly retry: RetryOptions,
    protected readonly logger?: Logger,
  ) {}

  async request<T = unknown>({ method, path, query, body, headers }: ApiRequest): Promise<T> {
    const qs = buildQueryString(query);
    const url = qs ? `${path}?${qs}` : path;

    const response = await withRetry(
      () => this.http.request<T>({ method, url, data: body, headers }),
      {
        ...this.retry,
        shouldRetry: (error) => isRetryableError(error, method),
        onRetry: (attempt, error, delayMs) =>
          this.logger?.warn('Retrying LicenseSpring API request', {
            method,
            path,
            attempt,
            delayMs,
            status: errorStatus(error),
          }),
      },
    );
    return response.data;
  }
}

function createAxios(baseURL: string, timeout: number, headers: Record<string, string>): AxiosInstance {
  return axios.create({
    baseURL,
    timeout,
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...headers },
  });
}

export interface ClientDeps {
  http?: AxiosInstance;
  tokenProvider?: OAuthTokenProvider;
  retry?: RetryOptions;
  logger?: Logger;
}

/** HTTP client for the License API (`/api/v4`). Signs every request. */
export class LicenseApiClient extends BaseApiClient {
  private readonly tokenProvider?: OAuthTokenProvider;

  constructor(private readonly config: LicenseApiConfig, deps: ClientDeps = {}) {
    super(
      deps.http ?? createAxios(config.baseUrl, config.timeoutMs, { 'Content-Type': 'application/json' }),
      { maxRetries: config.maxRetries, ...deps.retry },
      deps.logger,
    );

    if (config.auth.type === 'oauth') {
      this.tokenProvider = deps.tokenProvider ?? new OAuthTokenProvider({
        tokenUrl: config.auth.tokenUrl,
        clientId: config.auth.clientId,
        clientSecret: config.auth.clientSecret,
        timeoutMs: config.timeoutMs,
      });
    }

    this.http.interceptors.request.use((request) => this.authorize(request));
  }

  get authType(): LicenseApiConfig['auth']['type'] {
    return this.config.auth.type;
  }

  private async authorize(request: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
    const date = httpDate();
    request.headers.set('Date', date);
    const auth = this.config.auth;
    const authorization = auth.type === 'api-key'
      ? generateApiKeyAuthorization(auth.apiKey, auth.sharedKey, date)
      : `Bearer ${await (this.tokenProvider as OAuthTokenProvider).getToken()}`;
    request.headers.set('Authorization', authorization);
    return request;
  }

  override async request<T = unknown>(request: ApiRequest): Promise<T> {
    try {
      return await super.request<T>(request);
    } catch (error) {
      // A rejected bearer token may have been revoked; fetch a fresh one next time.
      if (this.tokenProvider && errorStatus(error) === 401) this.tokenProvider.invalidate();
      throw error;
    }
  }

  /**
   * Build the base64-encoded, signed payload used by the offline activation/deactivation
   * endpoints. Adds `date`, `request_id`, the key identifier and the `signature`.
   */
  buildOfflinePayload(fields: Record<string, unknown> & { hardware_id: string }): string {
    const identity = (fields.license_key ?? fields.username) as string | undefined;
    if (!identity) {
      throw new Error('Offline requests require license_key or username');
    }

    const auth = this.config.auth;
    const keyId = auth.type === 'oauth' ? auth.clientId : auth.apiKey;
    const secret = auth.type === 'oauth' ? auth.clientSecret : auth.sharedKey;
    const date = httpDate();

    const payload = compact({
      ...fields,
      request_id: (fields.request_id as string | undefined) ?? randomUUID(),
      date,
      ...(auth.type === 'oauth' ? { client_id: keyId } : { api_key: keyId }),
      signature: generateOfflineSignature({
        secret,
        date,
        licenseKeyOrUsername: identity,
        hardwareId: fields.hardware_id,
        keyId,
      }),
    });

    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }
}

/** HTTP client for the Management API (`/api/v1`). */
export class ManagementApiClient extends BaseApiClient {
  constructor(config: ManagementApiConfig, deps: ClientDeps = {}) {
    super(
      deps.http ?? createAxios(config.baseUrl, config.timeoutMs, {
        'Content-Type': 'application/json',
        Authorization: generateManagementApiAuthHeader(config.apiKey),
      }),
      { maxRetries: config.maxRetries, ...deps.retry },
      deps.logger,
    );
  }
}

/** Hints for common License API error codes. */
const ERROR_HINTS: Record<string, string> = {
  hmac_required: 'The request was not signed. Set LICENSE_SHARED_KEY alongside LICENSE_API_KEY.',
  signature_mismatch: 'The request signature is invalid. Check that LICENSE_SHARED_KEY matches the key in Settings > Keys.',
  invalid_api_key: 'Check LICENSE_API_KEY in Settings > Keys.',
  date_header_diff: 'The system clock differs from LicenseSpring by more than 15 minutes.',
  authorization_invalid_headers: 'The Authorization header is malformed.',
  authorization_missing_params: 'The Authorization header is missing data.',
};

interface ErrorBody {
  status?: number;
  code?: string;
  message?: string;
  detail?: string;
  error?: string;
  error_description?: string;
  [key: string]: unknown;
}

function describeBody(data: unknown): string | undefined {
  if (data === undefined || data === null || data === '') return undefined;
  if (typeof data === 'string') return data.length > 500 ? `${data.slice(0, 500)}…` : data;
  if (Array.isArray(data)) return data.map(String).join('; ');
  if (typeof data !== 'object') return String(data);

  const body = data as ErrorBody;
  if (body.code && body.message) {
    const hint = ERROR_HINTS[body.code];
    return `${body.message} [${body.code}]${hint ? ` ${hint}` : ''}`;
  }
  if (body.message) return body.message;
  if (body.detail) return body.detail;
  if (body.error_description) return body.error ? `${body.error}: ${body.error_description}` : body.error_description;
  if (body.error) return body.error;

  // Django REST framework style field errors: {"field": ["message", ...]}
  return Object.entries(body)
    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : JSON.stringify(messages)}`)
    .join('; ') || undefined;
}

interface AxiosLikeError {
  response?: { status: number; statusText?: string; data?: unknown };
  request?: unknown;
  message?: string;
  code?: string;
}

/** Convert an API error into a concise, actionable message. */
export function handleApiError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Unknown error occurred while communicating with the LicenseSpring API';
  }

  const err = error as AxiosLikeError;
  if (err.response) {
    const { status, statusText, data } = err.response;
    const detail = describeBody(data) ?? statusText ?? 'Request failed';
    if (status === 429) {
      return `HTTP 429: rate limit exceeded (${detail}). LicenseSpring limits requests per company per 60-second window; retry shortly.`;
    }
    if (status === 401 || status === 403) {
      return `HTTP ${status}: ${detail}. Verify the configured LicenseSpring credentials and their permissions.`;
    }
    return `HTTP ${status}: ${detail}`;
  }

  if (err.request) {
    const reason = err.code === 'ECONNABORTED' ? 'request timed out' : 'no response received';
    return `LicenseSpring API unreachable (${reason}). Check network connectivity and the API URL.`;
  }

  return err.message || 'Unknown error occurred while communicating with the LicenseSpring API';
}
