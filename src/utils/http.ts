import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { generateLicenseApiAuthHeader, generateManagementApiAuthHeader } from './auth.js';
// TODO: Integrate retry logic and logging in a future update
// import { withRetry, isRetryableError } from './retry.js';
// import { licenseApiLogger, managementApiLogger } from './logger.js';

/**
 * HTTP client for LicenseSpring License API
 * Uses LICENSE_API_KEY as the primary authentication method
 * Optionally uses LICENSE_SHARED_KEY for enhanced security when available
 */
export class LicenseApiClient {
  private client: AxiosInstance;
  private apiKey: string;
  private sharedKey?: string;
  private isTestMode: boolean;
  private hasSharedKey: boolean;

  constructor(baseURL: string, apiKey: string, sharedKey?: string) {
    this.apiKey = apiKey;
    this.sharedKey = sharedKey;
    this.isTestMode = apiKey.startsWith('test-') || process.env.NODE_ENV === 'test';
    this.hasSharedKey = !!sharedKey && !this.isTestMode;

    this.client = axios.create({
      baseURL,
      timeout: 25000, // 25 second timeout to prevent hanging requests
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json;charset=utf-8',
        'User-Agent': 'LicenseSpring-MCP-Server/2.0.0'
      }
    });

    // Add request interceptor to add authentication headers
    // LICENSE_API_KEY is always used as the primary authentication method
    this.client.interceptors.request.use((config) => {
      if (this.isTestMode) {
        // Test mode: use mock headers with API key
        config.headers.Date = new Date().toUTCString();
        config.headers.Authorization = `algorithm="hmac-sha256",headers="date",signature="test-signature",apikey="${this.apiKey}"`;
      } else if (this.hasSharedKey) {
        // Enhanced security mode: API key with HMAC signature using shared key
        const { date, authorization } = generateLicenseApiAuthHeader(
          this.sharedKey || '',
          this.apiKey
        );

        config.headers.Date = date;
        config.headers.Authorization = authorization;
      } else {
        // Standard mode: API key as primary authentication method
        config.headers.Date = new Date().toUTCString();
        config.headers.Authorization = `apikey="${this.apiKey}"`;
      }

      return config;
    });
  }

  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get(url, config);
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post(url, data, config);
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put(url, data, config);
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete(url, config);
  }
}

/**
 * HTTP client for LicenseSpring Management API
 */
export class ManagementApiClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(baseURL: string, apiKey: string) {
    this.apiKey = apiKey;

    this.client = axios.create({
      baseURL,
      timeout: 25000, // 25 second timeout to prevent hanging requests
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': generateManagementApiAuthHeader(apiKey)
      }
    });
  }

  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get(url, config);
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post(url, data, config);
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put(url, data, config);
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete(url, config);
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch(url, data, config);
  }
}

/**
 * Handle API errors consistently with authentication method awareness
 */
interface AxiosLikeError {
  response?: {
    status: number;
    statusText: string;
    data?: {
      message?: string;
      error?: string;
      detail?: string;
    };
  };
  request?: unknown;
  message?: string;
}

export function handleApiError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Unknown error occurred while communicating with LicenseSpring API';
  }
  
  const axiosError = error as AxiosLikeError;
  if (axiosError.response) {
    // Server responded with error status
    const status = axiosError.response.status;
    const data = axiosError.response.data;

    // Check for authentication-related errors
    if (status === 401 || status === 403) {
      const errorMessage = data?.message || data?.error || data?.detail || axiosError.response.statusText;

      // If it looks like an authentication error, provide helpful guidance
      if (errorMessage.toLowerCase().includes('auth') ||
          errorMessage.toLowerCase().includes('signature') ||
          errorMessage.toLowerCase().includes('unauthorized')) {
        return `Authentication failed: ${errorMessage}. ` +
               `Verify your LICENSE_API_KEY is correct. ` +
               `If your organization uses shared API settings, you may also need to provide LICENSE_SHARED_KEY for enhanced security.`;
      }

      return `Access denied: ${errorMessage}`;
    }

    // Handle other error types
    if (data && typeof data === 'object') {
      if (data.message) return data.message;
      if (data.error) return data.error;
      if (data.detail) return data.detail;
    }

    return `HTTP ${status}: ${axiosError.response.statusText}`;
  } else if (axiosError.request) {
    // Request was made but no response received
    return 'No response received from LicenseSpring API server. Please check your internet connection.';
  } else {
    // Something else happened
    return axiosError.message || 'Unknown error occurred while communicating with LicenseSpring API';
  }
}
