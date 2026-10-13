import axios, { type AxiosInstance } from 'axios';

/**
 * OAuth 2.0 client-credentials token provider for the License API.
 *
 * @see https://docs.licensespring.com/license-api/license-api-authorization/oauth-authorization
 */

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

export interface OAuthTokenProviderOptions {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
  /** Seconds subtracted from `expires_in` so tokens are refreshed before they lapse. */
  refreshSkewSeconds?: number;
  http?: Pick<AxiosInstance, 'post'>;
  now?: () => number;
}

export class OAuthTokenProvider {
  private token?: string;
  private expiresAt = 0;
  private pending?: Promise<string>;
  private readonly http: Pick<AxiosInstance, 'post'>;
  private readonly now: () => number;

  constructor(private readonly options: OAuthTokenProviderOptions) {
    this.http = options.http ?? axios.create({ timeout: options.timeoutMs });
    this.now = options.now ?? Date.now;
  }

  /** Return a cached access token, fetching a new one when missing or about to expire. */
  async getToken(): Promise<string> {
    if (this.token && this.now() < this.expiresAt) return this.token;
    // Share one in-flight request between concurrent callers.
    this.pending ??= this.fetchToken().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  /** Drop the cached token, e.g. after the API rejects it. */
  invalidate(): void {
    this.token = undefined;
    this.expiresAt = 0;
  }

  private async fetchToken(): Promise<string> {
    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
    });
    const response = await this.http.post<TokenResponse>(this.options.tokenUrl, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token: accessToken, expires_in: expiresIn } = response.data ?? {};
    if (!accessToken) {
      throw new Error('OAuth token response did not include an access_token');
    }

    const skew = this.options.refreshSkewSeconds ?? 30;
    const lifetime = Math.max((expiresIn ?? 60) - skew, 0);
    this.token = accessToken;
    this.expiresAt = this.now() + lifetime * 1000;
    return accessToken;
  }
}
