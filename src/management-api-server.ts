#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { ManagementApiClient, handleApiError } from './utils/http.js';
import { validateManagementApiAuth } from './utils/auth.js';
import {
  ListLicensesRequest,
  CreateLicenseRequest,
  UpdateLicenseRequest,
  ListCustomersRequest,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  ListProductsRequest,
  CreateProductRequest,
  UpdateProductRequest,
} from './types/index.js';

// Load environment variables
dotenv.config();

const MANAGEMENT_API_URL = process.env.MANAGEMENT_API_URL || 'https://saas.licensespring.com';
const MANAGEMENT_API_KEY = process.env.MANAGEMENT_API_KEY;

// Validate configuration
validateManagementApiAuth(MANAGEMENT_API_KEY);

// Create HTTP client
const apiClient = new ManagementApiClient(MANAGEMENT_API_URL, MANAGEMENT_API_KEY!);

// Define tools
const tools: Tool[] = [
  // License Management Tools
  {
    name: 'list_licenses',
    description: 'List licenses with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of results (default: 100)' },
        offset: { type: 'number', description: 'Number of results to skip' },
        order_by: { type: 'string', description: 'Field to order by (e.g., "-created_at")' },
        license_key: { type: 'string', description: 'Filter by specific license key' },
        customer_email: { type: 'string', description: 'Filter by customer email' },
        product_id: { type: 'number', description: 'Filter by product ID' },
        enabled: { type: 'boolean', description: 'Filter by enabled status' },
      },
      required: [],
    },
  },
  {
    name: 'create_license',
    description: 'Create a new license',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'number', description: 'Product ID' },
        customer: { type: 'number', description: 'Customer ID' },
        license_key: { type: 'string', description: 'Custom license key (optional)' },
        validity_period: { type: 'number', description: 'Validity period in days' },
        enabled: { type: 'boolean', description: 'Whether license is enabled (default: true)' },
        note: { type: 'string', description: 'Optional note' },
      },
      required: ['product', 'customer'],
    },
  },
  {
    name: 'update_license',
    description: 'Update an existing license',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'License ID' },
        enabled: { type: 'boolean', description: 'Whether license is enabled' },
        note: { type: 'string', description: 'License note' },
        validity_period: { type: 'number', description: 'Validity period in days' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_license',
    description: 'Get details of a specific license',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'License ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_license',
    description: 'Delete a license',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'License ID' },
      },
      required: ['id'],
    },
  },

  // Customer Management Tools
  {
    name: 'list_customers',
    description: 'List customers with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of results (default: 100)' },
        offset: { type: 'number', description: 'Number of results to skip' },
        email: { type: 'string', description: 'Filter by email' },
        company_name: { type: 'string', description: 'Filter by company name' },
      },
      required: [],
    },
  },
  {
    name: 'create_customer',
    description: 'Create a new customer',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Customer email address' },
        first_name: { type: 'string', description: 'First name' },
        last_name: { type: 'string', description: 'Last name' },
        company_name: { type: 'string', description: 'Company name' },
        phone: { type: 'string', description: 'Phone number' },
        reference: { type: 'string', description: 'External reference' },
      },
      required: ['email'],
    },
  },
  {
    name: 'update_customer',
    description: 'Update an existing customer',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Customer ID' },
        email: { type: 'string', description: 'Customer email address' },
        first_name: { type: 'string', description: 'First name' },
        last_name: { type: 'string', description: 'Last name' },
        company_name: { type: 'string', description: 'Company name' },
        phone: { type: 'string', description: 'Phone number' },
        reference: { type: 'string', description: 'External reference' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_customer',
    description: 'Get details of a specific customer',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Customer ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_customer',
    description: 'Delete a customer',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Customer ID' },
      },
      required: ['id'],
    },
  },

  // Product Management Tools
  {
    name: 'list_products',
    description: 'List products with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of results (default: 100)' },
        offset: { type: 'number', description: 'Number of results to skip' },
        name: { type: 'string', description: 'Filter by product name' },
      },
      required: [],
    },
  },
  {
    name: 'create_product',
    description: 'Create a new product',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Product name' },
        code: { type: 'string', description: 'Product code' },
        description: { type: 'string', description: 'Product description' },
      },
      required: ['name', 'code'],
    },
  },
  {
    name: 'update_product',
    description: 'Update an existing product',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Product ID' },
        name: { type: 'string', description: 'Product name' },
        description: { type: 'string', description: 'Product description' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_product',
    description: 'Get details of a specific product',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Product ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_product',
    description: 'Delete a product',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Product ID' },
      },
      required: ['id'],
    },
  },
];

// Create server
const server = new Server(
  {
    name: 'licensespring-management-api',
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
      // License Management
      case 'list_licenses': {
        const params = args as unknown as ListLicensesRequest;
        const queryParams = new URLSearchParams();

        if (params.limit) queryParams.append('limit', params.limit.toString());
        if (params.offset) queryParams.append('offset', params.offset.toString());
        if (params.order_by) queryParams.append('order_by', params.order_by);
        if (params.license_key) queryParams.append('license_key', params.license_key);
        if (params.customer_email) queryParams.append('customer_email', params.customer_email);
        if (params.product_id) queryParams.append('product_id', params.product_id.toString());
        if (params.enabled !== undefined) queryParams.append('enabled', params.enabled.toString());

        const response = await apiClient.get(`/api/v1/licenses/?${queryParams}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'create_license': {
        const params = args as unknown as CreateLicenseRequest;
        const response = await apiClient.post('/api/v1/licenses/', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'update_license': {
        const { id, ...updateData } = args as unknown as UpdateLicenseRequest;
        const response = await apiClient.patch(`/api/v1/licenses/${id}/`, updateData);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'get_license': {
        const { id } = args as unknown as { id: number };
        const response = await apiClient.get(`/api/v1/licenses/${id}/`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'delete_license': {
        const { id } = args as unknown as { id: number };
        await apiClient.delete(`/api/v1/licenses/${id}/`);
        return {
          content: [
            {
              type: 'text',
              text: `License ${id} deleted successfully`,
            },
          ],
        };
      }

      // Customer Management
      case 'list_customers': {
        const params = args as unknown as ListCustomersRequest;
        const queryParams = new URLSearchParams();

        if (params.limit) queryParams.append('limit', params.limit.toString());
        if (params.offset) queryParams.append('offset', params.offset.toString());
        if (params.email) queryParams.append('email', params.email);
        if (params.company_name) queryParams.append('company_name', params.company_name);

        const response = await apiClient.get(`/api/v1/customers/?${queryParams}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'create_customer': {
        const params = args as unknown as CreateCustomerRequest;
        const response = await apiClient.post('/api/v1/customers/', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'update_customer': {
        const { id, ...updateData } = args as unknown as UpdateCustomerRequest;
        const response = await apiClient.patch(`/api/v1/customers/${id}/`, updateData);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'get_customer': {
        const { id } = args as unknown as { id: number };
        const response = await apiClient.get(`/api/v1/customers/${id}/`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'delete_customer': {
        const { id } = args as unknown as { id: number };
        await apiClient.delete(`/api/v1/customers/${id}/`);
        return {
          content: [
            {
              type: 'text',
              text: `Customer ${id} deleted successfully`,
            },
          ],
        };
      }

      // Product Management
      case 'list_products': {
        const params = args as unknown as ListProductsRequest;
        const queryParams = new URLSearchParams();

        if (params.limit) queryParams.append('limit', params.limit.toString());
        if (params.offset) queryParams.append('offset', params.offset.toString());
        if (params.name) queryParams.append('name', params.name);

        const response = await apiClient.get(`/api/v1/products/?${queryParams}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'create_product': {
        const params = args as unknown as CreateProductRequest;
        const response = await apiClient.post('/api/v1/products/', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'update_product': {
        const { id, ...updateData } = args as unknown as UpdateProductRequest;
        const response = await apiClient.patch(`/api/v1/products/${id}/`, updateData);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'get_product': {
        const { id } = args as unknown as { id: number };
        const response = await apiClient.get(`/api/v1/products/${id}/`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'delete_product': {
        const { id } = args as unknown as { id: number };
        await apiClient.delete(`/api/v1/products/${id}/`);
        return {
          content: [
            {
              type: 'text',
              text: `Product ${id} deleted successfully`,
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
  console.error('LicenseSpring Management API MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
