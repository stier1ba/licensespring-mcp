#!/usr/bin/env node

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { ManagementApiClient, handleApiError } from './utils/http.js';
import { validateManagementApiAuth } from './utils/auth.js';

// Load environment variables
dotenv.config();

const MANAGEMENT_API_URL = process.env.MANAGEMENT_API_URL || 'https://saas.licensespring.com';
const MANAGEMENT_API_KEY = process.env.MANAGEMENT_API_KEY;

// Validate configuration
validateManagementApiAuth(MANAGEMENT_API_KEY);

// Create HTTP client
const apiClient = new ManagementApiClient(MANAGEMENT_API_URL, MANAGEMENT_API_KEY!);

// Create MCP server
const server = new McpServer({
  name: 'licensespring-management-api',
  version: '2.0.0',
});

// Resources - Expose management data
server.registerResource(
  'licenses-list',
  'licensespring://management/licenses',
  {
    title: 'Licenses List',
    description: 'List of all licenses in the system',
    mimeType: 'application/json'
  },
  async (uri: any) => {
    try {
      const response = await apiClient.get('/api/v1/licenses/?limit=100');
      
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(response.data, null, 2),
          mimeType: 'application/json'
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get licenses list: ${handleApiError(error)}`);
    }
  }
);

server.registerResource(
  'customers-list',
  'licensespring://management/customers',
  {
    title: 'Customers List',
    description: 'List of all customers in the system',
    mimeType: 'application/json'
  },
  async (uri: any) => {
    try {
      const response = await apiClient.get('/api/v1/customers/?limit=100');
      
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(response.data, null, 2),
          mimeType: 'application/json'
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get customers list: ${handleApiError(error)}`);
    }
  }
);

server.registerResource(
  'products-list',
  'licensespring://management/products',
  {
    title: 'Products List',
    description: 'List of all products in the system',
    mimeType: 'application/json'
  },
  async (uri: any) => {
    try {
      const response = await apiClient.get('/api/v1/products/?limit=100');
      
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(response.data, null, 2),
          mimeType: 'application/json'
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get products list: ${handleApiError(error)}`);
    }
  }
);

// Prompts - Management workflows
server.registerPrompt(
  'license-management-workflow',
  {
    title: 'License Management Workflow',
    description: 'Complete workflow for managing licenses',
    argsSchema: {
      action: z.enum(['create', 'update', 'audit', 'cleanup']),
      customer_email: z.string().email().optional(),
      product_id: z.string().optional(),
      notes: z.string().optional()
    }
  },
  ({ action, customer_email, product_id, notes }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Please help with license management workflow:

Action: ${action}
${customer_email ? `Customer: ${customer_email}` : ''}
${product_id ? `Product ID: ${product_id}` : ''}
${notes ? `Notes: ${notes}` : ''}

Based on the action requested:

**Create**: Set up new licenses for customers
1. Verify customer exists or create new customer
2. Create license with appropriate settings
3. Configure validity period and features
4. Send activation instructions

**Update**: Modify existing licenses
1. Find and review current license settings
2. Update as needed (enable/disable, extend validity)
3. Document changes made

**Audit**: Review license usage and compliance
1. List all licenses and their status
2. Check for expired or unused licenses
3. Identify any compliance issues
4. Generate summary report

**Cleanup**: Remove or deactivate unused licenses
1. Identify inactive or expired licenses
2. Safely deactivate or remove as appropriate
3. Update customer records
4. Document cleanup actions

Use the available management tools to complete the requested workflow.`
      }
    }]
  })
);

server.registerPrompt(
  'customer-analysis',
  {
    title: 'Customer Analysis',
    description: 'Analyze customer usage and license patterns',
    argsSchema: {
      customer_id: z.string().optional(),
      customer_email: z.string().email().optional(),
      analysis_type: z.enum(['usage', 'compliance', 'renewal']).optional()
    }
  },
  ({ customer_id, customer_email, analysis_type = 'usage' }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Please analyze customer data:

${customer_id ? `Customer ID: ${customer_id}` : ''}
${customer_email ? `Customer Email: ${customer_email}` : ''}
Analysis Type: ${analysis_type}

Please perform the following analysis:

**Usage Analysis**:
1. Get customer details and license history
2. Review license activation and usage patterns
3. Identify most/least used products
4. Suggest optimization opportunities

**Compliance Analysis**:
1. Check all customer licenses for compliance
2. Verify license terms are being followed
3. Identify any violations or concerns
4. Recommend corrective actions

**Renewal Analysis**:
1. Review upcoming license expirations
2. Analyze historical renewal patterns
3. Identify renewal opportunities and risks
4. Suggest proactive renewal strategies

Use the management API tools to gather data and provide comprehensive insights.`
      }
    }]
  })
);

// License Management Tools
server.registerTool('list_licenses', {
  title: 'List Licenses',
  description: 'List licenses with optional filtering',
  inputSchema: {
    limit: z.number().optional().default(100),
    offset: z.number().optional().default(0),
    order_by: z.string().optional(),
    license_key: z.string().optional(),
    customer_email: z.string().optional(),
    product_id: z.number().optional(),
    enabled: z.boolean().optional(),
  },
}, async ({ limit, offset, order_by, license_key, customer_email, product_id, enabled }) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (limit) queryParams.append('limit', limit.toString());
    if (offset) queryParams.append('offset', offset.toString());
    if (order_by) queryParams.append('order_by', order_by);
    if (license_key) queryParams.append('license_key', license_key);
    if (customer_email) queryParams.append('customer_email', customer_email);
    if (product_id) queryParams.append('product_id', product_id.toString());
    if (enabled !== undefined) queryParams.append('enabled', enabled.toString());
    
    const response = await apiClient.get(`/api/v1/licenses/?${queryParams}`);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error listing licenses: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('create_license', {
  title: 'Create License',
  description: 'Create a new license',
  inputSchema: {
    product: z.number().min(1, 'Product ID is required'),
    customer: z.number().min(1, 'Customer ID is required'),
    license_key: z.string().optional(),
    validity_period: z.number().optional(),
    enabled: z.boolean().optional().default(true),
    note: z.string().optional(),
  },
}, async ({ product, customer, license_key, validity_period, enabled, note }) => {
  try {
    const response = await apiClient.post('/api/v1/licenses/', {
      product,
      customer,
      license_key,
      validity_period,
      enabled,
      note,
    });
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error creating license: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('update_license', {
  title: 'Update License',
  description: 'Update an existing license',
  inputSchema: {
    id: z.number().min(1, 'License ID is required'),
    enabled: z.boolean().optional(),
    note: z.string().optional(),
    validity_period: z.number().optional(),
  },
}, async ({ id, enabled, note, validity_period }) => {
  try {
    const updateData: any = {};
    if (enabled !== undefined) updateData.enabled = enabled;
    if (note !== undefined) updateData.note = note;
    if (validity_period !== undefined) updateData.validity_period = validity_period;

    const response = await apiClient.patch(`/api/v1/licenses/${id}/`, updateData);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error updating license: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('get_license', {
  title: 'Get License',
  description: 'Get details of a specific license',
  inputSchema: {
    id: z.number().min(1, 'License ID is required'),
  },
}, async ({ id }) => {
  try {
    const response = await apiClient.get(`/api/v1/licenses/${id}/`);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error getting license: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('delete_license', {
  title: 'Delete License',
  description: 'Delete a license',
  inputSchema: {
    id: z.number().min(1, 'License ID is required'),
  },
}, async ({ id }) => {
  try {
    await apiClient.delete(`/api/v1/licenses/${id}/`);

    return {
      content: [{
        type: 'text',
        text: `License ${id} deleted successfully`,
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error deleting license: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

// Customer Management Tools
server.registerTool('list_customers', {
  title: 'List Customers',
  description: 'List customers with optional filtering',
  inputSchema: {
    limit: z.number().optional().default(100),
    offset: z.number().optional().default(0),
    email: z.string().optional(),
    company_name: z.string().optional(),
  },
}, async ({ limit, offset, email, company_name }) => {
  try {
    const queryParams = new URLSearchParams();

    if (limit) queryParams.append('limit', limit.toString());
    if (offset) queryParams.append('offset', offset.toString());
    if (email) queryParams.append('email', email);
    if (company_name) queryParams.append('company_name', company_name);

    const response = await apiClient.get(`/api/v1/customers/?${queryParams}`);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error listing customers: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('create_customer', {
  title: 'Create Customer',
  description: 'Create a new customer',
  inputSchema: {
    email: z.string().email('Valid email is required'),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    company_name: z.string().optional(),
    phone: z.string().optional(),
    reference: z.string().optional(),
  },
}, async ({ email, first_name, last_name, company_name, phone, reference }) => {
  try {
    const response = await apiClient.post('/api/v1/customers/', {
      email,
      first_name,
      last_name,
      company_name,
      phone,
      reference,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error creating customer: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LicenseSpring Management API MCP server v2.0.0 running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
