#!/usr/bin/env node

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { LicenseApiClient, handleApiError } from './utils/http.js';
import { validateLicenseApiAuth } from './utils/auth.js';

// Load environment variables
dotenv.config();

const LICENSE_API_URL = process.env.LICENSE_API_URL || 'https://api.licensespring.com';
const LICENSE_API_KEY = process.env.LICENSE_API_KEY;
const LICENSE_SHARED_KEY = process.env.LICENSE_SHARED_KEY;

// Validate configuration with better error handling
try {
  validateLicenseApiAuth(LICENSE_API_KEY, LICENSE_SHARED_KEY);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('❌ Configuration Error:', errorMessage);
  console.error('');
  console.error('Please check your environment variables:');
  console.error('1. Copy .env.example to .env');
  console.error('2. Set LICENSE_API_KEY to your LicenseSpring License API key');
  console.error('3. Optionally set LICENSE_SHARED_KEY (required for premium tiers)');
  console.error('');
  console.error('For more information, see the README.md file.');
  process.exit(1);
}

// Create HTTP client
const apiClient = new LicenseApiClient(LICENSE_API_URL, LICENSE_API_KEY!, LICENSE_SHARED_KEY);

// Create MCP server
const server = new McpServer({
  name: 'licensespring-license-api',
  version: '2.0.0',
});

// Resources - Expose LicenseSpring data
server.registerResource(
  'product-details',
  new ResourceTemplate('licensespring://product/{product}/details', { list: undefined }),
  {
    title: 'Product Details',
    description: 'Detailed information about a specific product',
    mimeType: 'application/json'
  },
  async (uri: any, extra: any) => {
    try {
      const { product } = extra;
      const queryParams = new URLSearchParams({ product });
      const response = await apiClient.get(`/api/v4/product_details?${queryParams}`);

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(response.data, null, 2),
          mimeType: 'application/json'
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get product details: ${handleApiError(error)}`);
    }
  }
);

server.registerResource(
  'license-status',
  new ResourceTemplate('licensespring://license/{license_key}/status', { list: undefined }),
  {
    title: 'License Status',
    description: 'Current status and details of a specific license',
    mimeType: 'application/json'
  },
  async (uri: any, extra: any) => {
    try {
      const { license_key } = extra;
      // Note: This would need hardware_id and product in a real implementation
      // For now, we'll return a placeholder that explains the requirement
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            message: 'License status requires hardware_id and product parameters',
            license_key,
            note: 'Use the check_license tool with hardware_id and product for full status'
          }, null, 2),
          mimeType: 'application/json'
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get license status: ${handleApiError(error)}`);
    }
  }
);

// Prompts - Workflow templates
server.registerPrompt(
  'license-troubleshooting',
  {
    title: 'License Troubleshooting',
    description: 'Diagnose and resolve license issues',
    argsSchema: {
      license_key: z.string().min(1, 'License key is required'),
      issue_description: z.string().min(1, 'Issue description is required'),
      product: z.string().optional()
    }
  },
  ({ license_key, issue_description, product }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Please help troubleshoot this LicenseSpring license issue:

License Key: ${license_key}
${product ? `Product: ${product}` : ''}
Issue Description: ${issue_description}

Please:
1. Check the license status and activation history
2. Verify the license is enabled and not expired
3. Check for any consumption limits or overages
4. Suggest specific solutions based on the issue
5. Provide next steps for resolution

Use the available LicenseSpring tools to gather information and provide a comprehensive diagnosis.`
      }
    }]
  })
);

server.registerPrompt(
  'customer-onboarding',
  {
    title: 'Customer Onboarding',
    description: 'Guide for setting up a new customer with licenses',
    argsSchema: {
      customer_email: z.string().email('Valid email is required'),
      product_code: z.string().min(1, 'Product code is required'),
      license_type: z.enum(['trial', 'full']).optional()
    }
  },
  ({ customer_email, product_code, license_type = 'trial' }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Please help onboard a new customer to LicenseSpring:

Customer Email: ${customer_email}
Product: ${product_code}
License Type: ${license_type}

Please follow this onboarding workflow:
1. Create the customer record in the management system
2. ${license_type === 'trial' ? 'Generate a trial license key' : 'Create a full license'}
3. Provide activation instructions
4. Set up any necessary product configurations
5. Send welcome information to the customer

Use the available LicenseSpring tools to complete each step and provide a summary of actions taken.`
      }
    }]
  })
);

// License Operations Tools
server.registerTool('activate_license', {
  title: 'Activate License',
  description: 'Activate a license with hardware ID and product code',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
    quantity: z.number().optional().default(1),
  },
}, async ({ license_key, hardware_id, product, quantity }) => {
  try {
    const response = await apiClient.post('/api/v4/activate_license', {
      license_key,
      hardware_id,
      product,
      quantity,
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
        text: `Error activating license: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('check_license', {
  title: 'Check License',
  description: 'Check license status and validity',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
  },
}, async ({ license_key, hardware_id, product }) => {
  try {
    const queryParams = new URLSearchParams({
      license_key,
      hardware_id,
      product,
    });
    const response = await apiClient.get(`/api/v4/check_license?${queryParams}`);
    
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
        text: `Error checking license: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('deactivate_license', {
  title: 'Deactivate License',
  description: 'Deactivate a license for a specific hardware ID',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
  },
}, async ({ license_key, hardware_id, product }) => {
  try {
    const response = await apiClient.post('/api/v4/deactivate_license', {
      license_key,
      hardware_id,
      product,
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
        text: `Error deactivating license: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('add_consumption', {
  title: 'Add Consumption',
  description: 'Add consumption units to a license',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
    consumptions: z.number().min(1, 'Consumption units must be positive'),
    max_overages: z.number().optional(),
    allow_overages: z.boolean().optional(),
  },
}, async ({ license_key, hardware_id, product, consumptions, max_overages, allow_overages }) => {
  try {
    const response = await apiClient.post('/api/v4/add_consumption', {
      license_key,
      hardware_id,
      product,
      consumptions,
      max_overages,
      allow_overages,
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
        text: `Error adding consumption: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('add_feature_consumption', {
  title: 'Add Feature Consumption',
  description: 'Add consumption units to a specific feature',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
    feature: z.string().min(1, 'Feature code is required'),
    consumptions: z.number().min(1, 'Consumption units must be positive'),
  },
}, async ({ license_key, hardware_id, product, feature, consumptions }) => {
  try {
    const response = await apiClient.post('/api/v4/add_feature_consumption', {
      license_key,
      hardware_id,
      product,
      feature,
      consumptions,
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
        text: `Error adding feature consumption: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('get_trial_key', {
  title: 'Get Trial Key',
  description: 'Generate a trial license key for a product',
  inputSchema: {
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
  },
}, async ({ hardware_id, product }) => {
  try {
    const queryParams = new URLSearchParams({
      hardware_id,
      product,
    });
    const response = await apiClient.get(`/api/v4/trial_key?${queryParams}`);
    
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
        text: `Error generating trial key: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('get_product_details', {
  title: 'Get Product Details',
  description: 'Get detailed information about a product',
  inputSchema: {
    product: z.string().min(1, 'Product code is required'),
  },
}, async ({ product }) => {
  try {
    const queryParams = new URLSearchParams({ product });
    const response = await apiClient.get(`/api/v4/product_details?${queryParams}`);

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
        text: `Error getting product details: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('track_device_variables', {
  title: 'Track Device Variables',
  description: 'Track custom variables for a device',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
    variables: z.record(z.string(), z.string()).refine(obj => Object.keys(obj).length > 0, 'At least one variable is required'),
  },
}, async ({ license_key, hardware_id, product, variables }) => {
  try {
    const response = await apiClient.post('/api/v4/track_device_variables', {
      license_key,
      hardware_id,
      product,
      variables,
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
        text: `Error tracking device variables: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('get_device_variables', {
  title: 'Get Device Variables',
  description: 'Get tracked variables for a device',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
  },
}, async ({ license_key, hardware_id, product }) => {
  try {
    const queryParams = new URLSearchParams({
      license_key,
      hardware_id,
      product,
    });
    const response = await apiClient.get(`/api/v4/get_device_variables?${queryParams}`);

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
        text: `Error getting device variables: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('floating_release', {
  title: 'Release Floating License',
  description: 'Release a floating license',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
  },
}, async ({ license_key, hardware_id, product }) => {
  try {
    const response = await apiClient.post('/api/v4/floating/release', {
      license_key,
      hardware_id,
      product,
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
        text: `Error releasing floating license: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('floating_borrow', {
  title: 'Borrow Floating License',
  description: 'Borrow a floating license for offline use',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
    borrowed_until: z.string().min(1, 'Borrow expiration date is required'),
  },
}, async ({ license_key, hardware_id, product, borrowed_until }) => {
  try {
    const response = await apiClient.post('/api/v4/floating/borrow', {
      license_key,
      hardware_id,
      product,
      borrowed_until,
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
        text: `Error borrowing floating license: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('change_password', {
  title: 'Change Password',
  description: 'Change password for a user-based license',
  inputSchema: {
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(1, 'New password is required'),
  },
}, async ({ username, password, new_password }) => {
  try {
    const response = await apiClient.post('/api/v4/change_password', {
      username,
      password,
      new_password,
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
        text: `Error changing password: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('get_versions', {
  title: 'Get Software Versions',
  description: 'Get available software versions for a product',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
  },
}, async ({ license_key, hardware_id, product }) => {
  try {
    const queryParams = new URLSearchParams({
      license_key,
      hardware_id,
      product,
    });
    const response = await apiClient.get(`/api/v4/versions?${queryParams}`);

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
        text: `Error getting versions: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('get_installation_file', {
  title: 'Get Installation File',
  description: 'Get installation file download information',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
  },
}, async ({ license_key, hardware_id, product }) => {
  try {
    const queryParams = new URLSearchParams({
      license_key,
      hardware_id,
      product,
    });
    const response = await apiClient.get(`/api/v4/installation_file?${queryParams}`);

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
        text: `Error getting installation file: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('get_sso_url', {
  title: 'Get SSO URL',
  description: 'Get Single Sign-On URL for customer portal access',
  inputSchema: {
    product: z.string().min(1, 'Product code is required'),
    customer_account_code: z.string().min(1, 'Customer account code is required'),
    response_type: z.string().optional().default('token'),
  },
}, async ({ product, customer_account_code, response_type }) => {
  try {
    const queryParams = new URLSearchParams({
      product,
      customer_account_code,
      response_type,
    });
    const response = await apiClient.get(`/api/v4/sso_url/?${queryParams}`);

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
        text: `Error getting SSO URL: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('get_customer_license_users', {
  title: 'Get Customer License Users',
  description: 'Get customer license users for a specific license',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
  },
}, async ({ license_key, hardware_id, product }) => {
  try {
    const queryParams = new URLSearchParams({
      license_key,
      hardware_id,
      product,
    });
    const response = await apiClient.get(`/api/v4/customer_license_users?${queryParams}`);

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
        text: `Error getting customer license users: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('activate_offline', {
  title: 'Activate License Offline',
  description: 'Activate a license for offline use with hardware ID and product code',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
    quantity: z.number().min(1).optional().default(1),
  },
}, async ({ license_key, hardware_id, product, quantity }) => {
  try {
    const requestData = {
      license_key,
      hardware_id,
      product,
      quantity,
    };
    const response = await apiClient.post('/api/v4/activate_offline', requestData);

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
        text: `Error activating license offline: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

server.registerTool('deactivate_offline', {
  title: 'Deactivate License Offline',
  description: 'Deactivate a license for offline use with hardware ID and product code',
  inputSchema: {
    license_key: z.string().min(1, 'License key is required'),
    hardware_id: z.string().min(1, 'Hardware ID is required'),
    product: z.string().min(1, 'Product code is required'),
  },
}, async ({ license_key, hardware_id, product }) => {
  try {
    const requestData = {
      license_key,
      hardware_id,
      product,
    };
    const response = await apiClient.post('/api/v4/deactivate_offline', requestData);

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
        text: `Error deactivating license offline: ${handleApiError(error)}`,
      }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('LicenseSpring License API MCP server v2.0.0 running on stdio');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to start MCP server:', errorMessage);
    console.error('');
    console.error('This could be due to:');
    console.error('- Invalid MCP transport configuration');
    console.error('- Port already in use');
    console.error('- Permission issues');
    console.error('');
    console.error('Please check the server configuration and try again.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected server error:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
