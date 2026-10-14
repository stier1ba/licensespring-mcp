import axios, {
  type AxiosAdapter,
  type AxiosInstance,
  type AxiosRequestConfig,
  type Method,
} from 'axios';
import type { LicenseApiAuth } from '../config.js';
import { VERSION } from '../version.js';
import {
  buildHmacAuthorization,
  generateLicenseApiSignature,
  generateManagementApiAuthHeader,
  httpDate,
} from './auth.js';
import type { Logger } from './logger.js';
import { withRetry, type RetryOptions } from './retry.js';

export interface HttpClientOptions {
  /** Custom axios adapter (used by tests to mock the network). */
  adapter?: AxiosAdapter;
  timeout?: number;
  retry?: RetryOptions;
  now?: () => Date;
  logger?: Logger;
}

/** Thrown for input combinations the API would reject; reported back as a tool error. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

type QueryInput = Record<string, unknown> | undefined;

/**
 * Convert tool arguments into query parameters: drops undefined/null,
 * stringifies booleans and numbers, joins arrays with commas (Django `__in`).
 */
export function buildQuery(params: QueryInput): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    query.append(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return query;
}

/** Remove keys whose value is undefined so they are not sent in JSON bodies. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

abstract class BaseApiClient {
  protected readonly http: AxiosInstance;
  protected readonly now: () => Date;
  protected readonly retry: RetryOptions;
  protected readonly logger?: Logger;

  constructor(baseURL: string, options: HttpClientOptions, accept: string) {
    this.now = options.now ?? (() => new Date());
    this.retry = options.retry ?? {};
    this.logger = options.logger;
    this.http = axios.create({
      baseURL,
      timeout: options.timeout ?? 25_000,
      adapter: options.adapter,
      headers: {
        Accept: accept,
        'User-Agent': `licensespring-mcp-server/${VERSION}`,
      },
    });
  }

  get baseURL(): string | undefined {
    return this.http.defaults.baseURL;
  }

  protected abstract authHeaders(): Promise<Record<string, string>>;

  protected async execute<T>(config: AxiosRequestConfig): Promise<T> {
    const headers = { ...(config.headers as Record<string, string> | undefined), ...(await this.authHeaders()) };
    const response = await this.http.request<T>({ ...config, headers });
    this.logger?.debug('API request', { method: config.method, url: config.url, status: response.status });
    return response.data;
  }

  protected request<T>(method: Method, url: string, config: AxiosRequestConfig = {}, retryable = method === 'GET'): Promise<T> {
    const run = () => this.execute<T>({ ...config, method, url });
    if (!retryable) return run();
    return withRetry(run, {
      ...this.retry,
      onRetry: (attempt, error, delay) => {
        this.logger?.warn('Retrying API request', { url, attempt, delay: Math.round(delay), error: describeError(error) });
        this.retry.onRetry?.(attempt, error, delay);
      },
    });
  }

  /**
   * GET requests are retried on 429/5xx/network errors unless `retry: false`
   * (for GETs with side effects, such as the License API trial_key).
   */
  get<T = unknown>(url: string, params?: QueryInput, options: { retry?: boolean } = {}): Promise<T> {
    return this.request<T>('GET', url, { params: buildQuery(params) }, options.retry ?? true);
  }

  post<T = unknown>(url: string, data?: unknown, params?: QueryInput): Promise<T> {
    return this.request<T>('POST', url, { data, params: params ? buildQuery(params) : undefined });
  }

  patch<T = unknown>(url: string, data?: unknown): Promise<T> {
    return this.request<T>('PATCH', url, { data });
  }

  delete<T = unknown>(url: string): Promise<T> {
    return this.request<T>('DELETE', url);
  }
}

const OAUTH_RETRY_CODES = new Set(['oauth_token_expired', 'oauth_token_malformed']);

/**
 * License API client (https://api.licensespring.com/api/v4).
 * Every request carries a Date header plus either an HMAC signature
 * (API key + shared key) or an OAuth bearer token.
 */
export class LicenseApiClient extends BaseApiClient {
  private token?: { value: string; expiresAt: number };
  private pendingToken?: Promise<string>;
  private readonly tokenHttp: AxiosInstance;

  constructor(baseURL: string, readonly auth: LicenseApiAuth, options: HttpClientOptions = {}) {
    super(baseURL, options, 'application/json');
    this.tokenHttp = axios.create({ timeout: options.timeout ?? 25_000, adapter: options.adapter });
  }

  protected async authHeaders(): Promise<Record<string, string>> {
    const date = httpDate(this.now());
    if (this.auth.type === 'hmac') {
      const signature = generateLicenseApiSignature(this.auth.sharedKey, date);
      return { Date: date, Authorization: buildHmacAuthorization(this.auth.apiKey, signature) };
    }
    return { Date: date, Authorization: `Bearer ${await this.getAccessToken()}` };
  }

  protected override async execute<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      return await super.execute<T>(config);
    } catch (error) {
      if (this.auth.type === 'oauth' && OAUTH_RETRY_CODES.has(errorCode(error) ?? '')) {
        this.token = undefined;
        return super.execute<T>(config);
      }
      throw error;
    }
  }

  async getAccessToken(): Promise<string> {
    if (this.auth.type !== 'oauth') throw new Error('OAuth is not configured');
    if (this.token && this.token.expiresAt > this.now().getTime()) return this.token.value;
    if (!this.pendingToken) {
      this.pendingToken = this.fetchToken(this.auth).finally(() => {
        this.pendingToken = undefined;
      });
    }
    return this.pendingToken;
  }

  private async fetchToken(auth: Extract<LicenseApiAuth, { type: 'oauth' }>): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
    });
    const { data } = await this.tokenHttp.post<{ access_token: string; expires_in?: number }>(
      auth.tokenUrl,
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    if (!data?.access_token) throw new Error('OAuth token response did not include access_token');
    // Refresh 30s early to avoid using a token that expires mid-request.
    const lifetimeMs = Math.max((data.expires_in ?? 300) - 30, 0) * 1000;
    this.token = { value: data.access_token, expiresAt: this.now().getTime() + lifetimeMs };
    return data.access_token;
  }

  /** Raw text POST used by the offline activation endpoints (base64 payload). */
  postText<T = unknown>(url: string, text: string): Promise<T> {
    return this.request<T>('POST', url, { data: text, headers: { 'Content-Type': 'text/plain' } });
  }

  /** Credential fields used inside offline request payloads. */
  offlineCredentials(): { field: 'api_key' | 'client_id'; value: string; signingKey: string } {
    return this.auth.type === 'hmac'
      ? { field: 'api_key', value: this.auth.apiKey, signingKey: this.auth.sharedKey }
      : { field: 'client_id', value: this.auth.clientId, signingKey: this.auth.clientSecret };
  }

  currentDate(): string {
    return httpDate(this.now());
  }
}

/** Management API client (https://saas.licensespring.com/api/v1). */
export class ManagementApiClient extends BaseApiClient {
  constructor(baseURL: string, private readonly apiKey: string, options: HttpClientOptions = {}) {
    super(baseURL, options, 'application/json');
  }

  protected async authHeaders(): Promise<Record<string, string>> {
    return { Authorization: generateManagementApiAuthHeader(this.apiKey) };
  }

  postMultipart<T = unknown>(url: string, form: FormData): Promise<T> {
    return this.request<T>('POST', url, { data: form });
  }
}

interface ErrorLike {
  response?: { status: number; statusText?: string; data?: unknown };
  request?: unknown;
  message?: string;
  code?: string;
}

function errorCode(error: unknown): string | undefined {
  const data = (error as ErrorLike | undefined)?.response?.data;
  if (data && typeof data === 'object' && typeof (data as { code?: unknown }).code === 'string') {
    return (data as { code: string }).code;
  }
  return undefined;
}

/** Short description for retry logs; only called with retryable (object) errors. */
function describeError(error: unknown): string {
  const err = error as ErrorLike;
  return err.response ? `HTTP ${err.response.status}` : String(err.message);
}

function extractMessage(data: unknown): string | undefined {
  if (typeof data === 'string') return data.trim() || undefined;
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  for (const key of ['message', 'detail', 'error']) {
    if (typeof d[key] === 'string' && d[key]) return d[key] as string;
  }
  // Django REST Framework field errors: {"field": ["msg"]}
  return JSON.stringify(data);
}

export type ApiName = 'license' | 'management';

const AUTH_HINTS: Record<ApiName, string> = {
  license: 'Check LICENSE_API_KEY + LICENSE_SHARED_KEY (or LICENSE_CLIENT_ID + LICENSE_CLIENT_SECRET) and that the server clock is correct (Date must be within 15 minutes).',
  management: 'Check MANAGEMENT_API_KEY (Settings → Keys → Management API key).',
};

/** Turn any thrown error into a readable, actionable message. */
export function handleApiError(error: unknown, api: ApiName = 'license'): string {
  if (error instanceof ValidationError) return error.message;
  if (!error || typeof error !== 'object') {
    return 'Unknown error occurred while communicating with LicenseSpring API';
  }
  const err = error as ErrorLike;
  if (err.response) {
    const { status, statusText, data } = err.response;
    const code = errorCode(error);
    const message = extractMessage(data) ?? statusText ?? 'Request failed';
    const prefix = `HTTP ${status}${code ? ` (${code})` : ''}: ${message}`;
    if (status === 401 || status === 403) return `${prefix}. ${AUTH_HINTS[api]}`;
    if (status === 429) return `${prefix}. LicenseSpring rate limit reached; wait and retry.`;
    return prefix;
  }
  if (err.request) {
    return `No response received from LicenseSpring API${err.code ? ` (${err.code})` : ''}. Check network connectivity.`;
  }
  return err.message || 'Unknown error occurred while communicating with LicenseSpring API';
}
