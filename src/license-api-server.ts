#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { LicenseApiClient, handleApiError } from './utils/http.js';
import { validateLicenseApiAuth } from './utils/auth.js';
import {
  ActivateLicenseRequest,
  CheckLicenseRequest,
  AddConsumptionRequest,
  AddFeatureConsumptionRequest,
  TrialKeyRequest,
  ProductDetailsRequest,
  TrackDeviceVariablesRequest,
  GetDeviceVariablesRequest,
  FloatingReleaseRequest,
  FloatingBorrowRequest,
  ChangePasswordRequest,
  VersionsRequest,
  InstallationFileRequest,
  DeactivateLicenseRequest,
} from './types/index.js';

// Load environment variables
dotenv.config();

const LICENSE_API_URL = process.env.LICENSE_API_URL || 'https://api.licensespring.com';
const LICENSE_API_KEY = process.env.LICENSE_API_KEY;
const LICENSE_SHARED_KEY = process.env.LICENSE_SHARED_KEY;

// Validate configuration
validateLicenseApiAuth(LICENSE_API_KEY, LICENSE_SHARED_KEY);

// Create HTTP client
const apiClient = new LicenseApiClient(LICENSE_API_URL, LICENSE_API_KEY!, LICENSE_SHARED_KEY!);

// Define tools
const tools: Tool[] = [
  {
    name: 'activate_license',
    description: 'Activate a license with hardware ID and product code',
    inputSchema: {
      type: 'object',
      properties: {
        license_key: { type: 'string', description: 'The license key to activate' },
        hardware_id: { type: 'string', description: 'Unique hardware identifier' },
        product: { type: 'string', description: 'Product code' },
        quantity: { type: 'number', description: 'Optional quantity (default: 1)' },
      },
      required: ['license_key', 'hardware_id', 'product'],
    },
  },
  {
    name: 'check_license',
    description: 'Check license status and validity',
    inputSchema: {
      type: 'object',
      properties: {
        license_key: { type: 'string', description: 'The license key to check' },
        hardware_id: { type: 'string', description: 'Unique hardware identifier' },
        product: { type: 'string', description: 'Product code' },
      },
      required: ['license_key', 'hardware_id', 'product'],
    },
  },
  {
    name: 'deactivate_license',
    description: 'Deactivate a license for a specific hardware ID',
    inputSchema: {
      type: 'object',
      properties: {
        license_key: { type: 'string', description: 'The license key to deactivate' },
        hardware_id: { type: 'string', description: 'Unique hardware identifier' },
        product: { type: 'string', description: 'Product code' },
      },
      required: ['license_key', 'hardware_id', 'product'],
    },
  },
  {
    name: 'add_consumption',
    description: 'Add consumption units to a license',
    inputSchema: {
      type: 'object',
      properties: {
        license_key: { type: 'string', description: 'The license key' },
        hardware_id: { type: 'string', description: 'Unique hardware identifier' },
        product: { type: 'string', description: 'Product code' },
        consumptions: { type: 'number', description: 'Number of consumption units to add' },
        max_overages: { type: 'number', description: 'Maximum allowed overages' },
        allow_overages: { type: 'boolean', description: 'Whether to allow overages' },
      },
      required: ['license_key', 'hardware_id', 'product', 'consumptions'],
    },
  },
  {
    name: 'add_feature_consumption',
    description: 'Add consumption units to a specific feature',
    inputSchema: {
      type: 'object',
      properties: {
        license_key: { type: 'string', description: 'The license key' },
        hardware_id: { type: 'string', description: 'Unique hardware identifier' },
        product: { type: 'string', description: 'Product code' },
        feature: { type: 'string', description: 'Feature code' },
        consumptions: { type: 'number', description: 'Number of consumption units to add' },
      },
      required: ['license_key', 'hardware_id', 'product', 'feature', 'consumptions'],
    },
  },
  {
    name: 'get_trial_key',
    description: 'Generate a trial license key for a product',
    inputSchema: {
      type: 'object',
      properties: {
        hardware_id: { type: 'string', description: 'Unique hardware identifier' },
        product: { type: 'string', description: 'Product code' },
      },
      required: ['hardware_id', 'product'],
    },
  },
  {
    name: 'get_product_details',
    description: 'Get detailed information about a product',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product code' },
      },
      required: ['product'],
    },
  },
  {
    name: 'track_device_variables',
    description: 'Track custom variables for a device',
    inputSchema: {
      type: 'object',
      properties: {
        license_key: { type: 'string', description: 'The license key' },
        hardware_id: { type: 'string', description: 'Unique hardware identifier' },
        product: { type: 'string', description: 'Product code' },
        variables: { 
          type: 'object', 
          description: 'Key-value pairs of variables to track',
          additionalProperties: { type: 'string' }
        },
      },
      required: ['license_key', 'hardware_id', 'product', 'variables'],
    },
  },
  {
    name: 'get_device_variables',
    description: 'Get tracked variables for a device',
    inputSchema: {
      type: 'object',
      properties: {
        license_key: { type: 'string', description: 'The license key' },
        hardware_id: { type: 'string', description: 'Unique hardware identifier' },
        product: { type: 'string', description: 'Product code' },
      },
      required: ['license_key', 'hardware_id', 'product'],
    },
  },
  {
    name: 'floating_release',
    description: 'Release a floating license',
    inputSchema: {
      type: 'object',
      properties: {
        license_key: { type: 'string', description: 'The license key' },
        hardware_id: { type: 'string', description: 'Unique hardware identifier' },
        product: { type: 'string', description: 'Product code' },
      },
      required: ['license_key', 'hardware_id', 'product'],
    },
  },
  {
    name: 'floating_borrow',
    description: 'Borrow a floating license for offline use',
    inputSchema: {
      type: 'object',
      properties: {
        license_key: { type: 'string', description: 'The license key' },
        hardware_id: { type: 'string', description: 'Unique hardware identifier' },
        product: { type: 'string', description: 'Product code' },
        borrowed_until: { type: 'string', description: 'ISO date string when borrow expires' },
      },
      required: ['license_key', 'hardware_id', 'product', 'borrowed_until'],
    },
  },
  {
    name: 'change_password',
    description: 'Change password for a user-based license',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Username/email' },
        password: { type: 'string', description: 'Current password' },
        new_password: { type: 'string', description: 'New password' },
      },
      required: ['username', 'password', 'new_password'],
    },
  },
  {
    name: 'get_versions',
    description: 'Get available software versions for a product',
    inputSchema: {
      type: 'object',
      properties: {
        license_key: { type: 'string', description: 'The license key' },
        hardware_id: { type: 'string', description: 'Unique hardware identifier' },
        product: { type: 'string', description: 'Product code' },
      },
      required: ['license_key', 'hardware_id', 'product'],
    },
  },
  {
    name: 'get_installation_file',
    description: 'Get installation file download information',
    inputSchema: {
      type: 'object',
      properties: {
        license_key: { type: 'string', description: 'The license key' },
        hardware_id: { type: 'string', description: 'Unique hardware identifier' },
        product: { type: 'string', description: 'Product code' },
      },
      required: ['license_key', 'hardware_id', 'product'],
    },
  },
  {
    name: 'get_sso_url',
    description: 'Get Single Sign-On URL for customer portal access',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product code' },
        customer_account_code: { type: 'string', description: 'Customer account code' },
        response_type: { type: 'string', description: 'Response type (default: token)' },
      },
      required: ['product', 'customer_account_code'],
    },
  },
];

// Create server
const server = new Server(
  {
    name: 'licensespring-license-api',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'activate_license': {
        const params = args as ActivateLicenseRequest;
        const response = await apiClient.post('/api/v4/activate_license', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'check_license': {
        const params = args as CheckLicenseRequest;
        const queryParams = new URLSearchParams({
          license_key: params.license_key,
          hardware_id: params.hardware_id,
          product: params.product,
        });
        const response = await apiClient.get(`/api/v4/check_license?${queryParams}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'deactivate_license': {
        const params = args as DeactivateLicenseRequest;
        const response = await apiClient.post('/api/v4/deactivate_license', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'add_consumption': {
        const params = args as AddConsumptionRequest;
        const response = await apiClient.post('/api/v4/add_consumption', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'add_feature_consumption': {
        const params = args as AddFeatureConsumptionRequest;
        const response = await apiClient.post('/api/v4/add_feature_consumption', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'get_trial_key': {
        const params = args as TrialKeyRequest;
        const queryParams = new URLSearchParams({
          hardware_id: params.hardware_id,
          product: params.product,
        });
        const response = await apiClient.get(`/api/v4/trial_key?${queryParams}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'get_product_details': {
        const params = args as ProductDetailsRequest;
        const queryParams = new URLSearchParams({ product: params.product });
        const response = await apiClient.get(`/api/v4/product_details?${queryParams}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'track_device_variables': {
        const params = args as TrackDeviceVariablesRequest;
        const response = await apiClient.post('/api/v4/track_device_variables', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'get_device_variables': {
        const params = args as GetDeviceVariablesRequest;
        const queryParams = new URLSearchParams({
          license_key: params.license_key,
          hardware_id: params.hardware_id,
          product: params.product,
        });
        const response = await apiClient.get(`/api/v4/get_device_variables?${queryParams}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'floating_release': {
        const params = args as FloatingReleaseRequest;
        const response = await apiClient.post('/api/v4/floating/release', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'floating_borrow': {
        const params = args as FloatingBorrowRequest;
        const response = await apiClient.post('/api/v4/floating/borrow', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'change_password': {
        const params = args as ChangePasswordRequest;
        const response = await apiClient.post('/api/v4/change_password', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'get_versions': {
        const params = args as VersionsRequest;
        const queryParams = new URLSearchParams({
          license_key: params.license_key,
          hardware_id: params.hardware_id,
          product: params.product,
        });
        const response = await apiClient.get(`/api/v4/versions?${queryParams}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'get_installation_file': {
        const params = args as InstallationFileRequest;
        const queryParams = new URLSearchParams({
          license_key: params.license_key,
          hardware_id: params.hardware_id,
          product: params.product,
        });
        const response = await apiClient.get(`/api/v4/installation_file?${queryParams}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'get_sso_url': {
        const params = args as { product: string; customer_account_code: string; response_type?: string };
        const queryParams = new URLSearchParams({
          product: params.product,
          customer_account_code: params.customer_account_code,
          response_type: params.response_type || 'token',
        });
        const response = await apiClient.get(`/api/v4/sso_url/?${queryParams}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = handleApiError(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LicenseSpring License API MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
