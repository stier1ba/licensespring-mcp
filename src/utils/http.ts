import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { generateLicenseApiAuthHeader, generateManagementApiAuthHeader } from './auth.js';

/**
 * HTTP client for LicenseSpring License API
 */
export class LicenseApiClient {
  private client: AxiosInstance;
  private apiKey: string;
  private sharedKey: string;

  constructor(baseURL: string, apiKey: string, sharedKey: string) {
    this.apiKey = apiKey;
    this.sharedKey = sharedKey;
    
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json;charset=utf-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36'
      }
    });

    // Add request interceptor to add authentication headers
    this.client.interceptors.request.use((config) => {
      const { date, authorization } = generateLicenseApiAuthHeader(
        this.sharedKey,
        this.apiKey
      );
      
      config.headers.Date = date;
      config.headers.Authorization = authorization;
      
      return config;
    });
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
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
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': generateManagementApiAuthHeader(apiKey)
      }
    });
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete(url, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch(url, data, config);
  }
}

/**
 * Handle API errors consistently
 */
export function handleApiError(error: any): string {
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const data = error.response.data;
    
    if (data && typeof data === 'object') {
      if (data.message) return data.message;
      if (data.error) return data.error;
      if (data.detail) return data.detail;
    }
    
    return `HTTP ${status}: ${error.response.statusText}`;
  } else if (error.request) {
    // Request was made but no response received
    return 'No response received from server';
  } else {
    // Something else happened
    return error.message || 'Unknown error occurred';
  }
}
