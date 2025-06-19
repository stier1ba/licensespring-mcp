// Common types for LicenseSpring MCP servers

export interface LicenseSpringConfig {
  apiUrl: string;
  apiKey: string;
  sharedKey?: string; // Only needed for License API
}

export interface LicenseApiConfig extends LicenseSpringConfig {
  sharedKey: string;
}

export interface ManagementApiConfig {
  apiKey: string;
  baseUrl: string;
  // Management API specific configuration
}

// License API Types
export interface ActivateLicenseRequest {
  license_key: string;
  hardware_id: string;
  product: string;
  quantity?: number;
}

export interface CheckLicenseRequest {
  license_key: string;
  hardware_id: string;
  product: string;
}

export interface AddConsumptionRequest {
  license_key: string;
  hardware_id: string;
  product: string;
  consumptions: number;
  max_overages?: number;
  allow_overages?: boolean;
}

export interface AddFeatureConsumptionRequest {
  license_key: string;
  hardware_id: string;
  product: string;
  feature: string;
  consumptions: number;
}

export interface TrialKeyRequest {
  hardware_id: string;
  product: string;
}

export interface ProductDetailsRequest {
  product: string;
}

export interface TrackDeviceVariablesRequest {
  license_key: string;
  hardware_id: string;
  product: string;
  variables: Record<string, string>;
}

export interface GetDeviceVariablesRequest {
  license_key: string;
  hardware_id: string;
  product: string;
}

export interface FloatingReleaseRequest {
  license_key: string;
  hardware_id: string;
  product: string;
}

export interface FloatingBorrowRequest {
  license_key: string;
  hardware_id: string;
  product: string;
  borrowed_until: string;
}

export interface ChangePasswordRequest {
  username: string;
  password: string;
  new_password: string;
}

export interface VersionsRequest {
  license_key: string;
  hardware_id: string;
  product: string;
}

export interface InstallationFileRequest {
  license_key: string;
  hardware_id: string;
  product: string;
}

export interface DeactivateLicenseRequest {
  license_key: string;
  hardware_id: string;
  product: string;
}

export interface GetCustomerLicenseUsersRequest {
  license_key: string;
  hardware_id: string;
  product: string;
}

export interface ActivateOfflineRequest {
  license_key: string;
  hardware_id: string;
  product: string;
  quantity?: number;
}

export interface DeactivateOfflineRequest {
  license_key: string;
  hardware_id: string;
  product: string;
}

// Management API Types
export interface ListLicensesRequest {
  limit?: number;
  offset?: number;
  order_by?: string;
  license_key?: string;
  customer_email?: string;
  product_id?: number;
  enabled?: boolean;
}

export interface CreateLicenseRequest {
  product: number;
  customer: number;
  license_key?: string;
  validity_period?: number;
  enabled?: boolean;
  note?: string;
}

export interface UpdateLicenseRequest {
  id: number;
  enabled?: boolean;
  note?: string;
  validity_period?: number;
}

export interface ListCustomersRequest {
  limit?: number;
  offset?: number;
  email?: string;
  company_name?: string;
}

export interface CreateCustomerRequest {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone?: string;
  reference?: string;
}

export interface UpdateCustomerRequest {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone?: string;
  reference?: string;
}

// License User Management Types
export interface ListLicenseUsersRequest {
  limit?: number;
  offset?: number;
  license_id?: number;
  email?: string;
}

export interface AssignUserToLicenseRequest {
  license_id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  is_manager?: boolean;
  password?: string;
  max_activations?: number;
  total_activations?: number;
}

export interface UnassignUserFromLicenseRequest {
  license_id: number;
  license_user_id: number;
}

export interface SetUserActivationsRequest {
  license_id: number;
  user_activations: Record<string, {
    max_activations?: number;
    reset_total_activations?: boolean;
  }>;
}

// Bulk Operations Types
export interface BulkUpdateLicensesRequest {
  licenses: Array<{
    id: number;
    is_trial?: boolean;
    enable_maintenance_period?: boolean;
    enabled?: boolean;
    note?: string;
    validity_period?: number;
  }>;
}

export interface BulkDisableLicensesRequest {
  license_ids: number[];
}

export interface ImportLicensesFromCsvRequest {
  csv_file: string; // Base64 encoded CSV content or file path
  product_id?: number;
  customer_id?: number;
}

export interface ListProductsRequest {
  limit?: number;
  offset?: number;
  name?: string;
}

export interface CreateProductRequest {
  name: string;
  code: string;
  description?: string;
}

export interface UpdateProductRequest {
  id: number;
  name?: string;
  description?: string;
}

// Common response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}
