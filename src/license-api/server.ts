import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import dotenv from 'dotenv';
import { z } from 'zod';
import { ConfigError, loadLicenseApiConfig } from '../config.js';
import { createServerState, healthPayload, runStdioServer, type ProcessLike, type ServerState } from '../runtime.js';
import { registerTools } from '../tools.js';
import { handleApiError, LicenseApiClient, PACKAGE_VERSION } from '../utils/http.js';
import { licenseApiLogger, type Logger } from '../utils/logger.js';
import { createLicenseApiTools } from './tools.js';

export const LICENSE_SERVER_NAME = 'licensespring-license-api';

export function createLicenseApiServer(
  client: LicenseApiClient,
  options: { baseUrl: string; state?: ServerState },
): McpServer {
  const state = options.state ?? createServerState();
  const server = new McpServer({ name: LICENSE_SERVER_NAME, version: PACKAGE_VERSION });

  server.registerResource(
    'health',
    'licensespring://health',
    { title: 'Health Check', description: 'Service health status and metrics', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(
          healthPayload(LICENSE_SERVER_NAME, PACKAGE_VERSION, state, { api_url: options.baseUrl, auth: client.authType }),
          null,
          2,
        ),
      }],
    }),
  );

  server.registerResource(
    'products',
    'licensespring://products',
    { title: 'Products', description: 'Products available to the configured License API credentials', mimeType: 'application/json' },
    async (uri) => {
      try {
        const data = await client.request({ method: 'GET', path: '/api/v4/products' });
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };
      } catch (error) {
        throw new Error(`Failed to list products: ${handleApiError(error)}`);
      }
    },
  );

  server.registerResource(
    'product-details',
    new ResourceTemplate('licensespring://product/{product}/details', { list: undefined }),
    { title: 'Product Details', description: 'Metadata and flags for a product', mimeType: 'application/json' },
    async (uri, variables) => {
      try {
        const data = await client.request({
          method: 'GET',
          path: '/api/v4/product_details',
          // Template variables arrive percent-encoded.
          query: { product: decodeURIComponent(String(variables.product)) },
        });
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };
      } catch (error) {
        throw new Error(`Failed to get product details: ${handleApiError(error)}`);
      }
    },
  );

  server.registerPrompt(
    'license-troubleshooting',
    {
      title: 'License Troubleshooting',
      description: 'Diagnose and resolve a license issue on a device',
      argsSchema: {
        license_key: z.string().min(1),
        issue_description: z.string().min(1),
        product: z.string().optional(),
        hardware_id: z.string().optional(),
      },
    },
    ({ license_key, issue_description, product, hardware_id }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: [
            'Please help troubleshoot this LicenseSpring license issue.',
            '',
            `License key: ${license_key}`,
            product ? `Product: ${product}` : 'Product: (unknown - use list_products to find it)',
            hardware_id ? `Hardware ID: ${hardware_id}` : 'Hardware ID: (unknown)',
            `Issue: ${issue_description}`,
            '',
            'Steps:',
            '1. Use check_license to read the license status (enabled, active, expiry, max activations).',
            '2. Use get_device_licenses for the hardware ID to see what the device holds.',
            '3. For consumption or floating licenses, check consumption totals and floating slots.',
            '4. Explain the root cause, propose a fix, and list the exact tool calls needed to apply it.',
          ].join('\n'),
        },
      }],
    }),
  );

  server.registerPrompt(
    'customer-onboarding',
    {
      title: 'Customer Onboarding',
      description: 'Plan the steps to get a new customer licensed for a product',
      argsSchema: {
        customer_email: z.string().email(),
        product_code: z.string().min(1),
        license_type: z.enum(['trial', 'full']).optional(),
      },
    },
    ({ customer_email, product_code, license_type = 'trial' }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: [
            'Please help onboard a new LicenseSpring customer.',
            '',
            `Customer email: ${customer_email}`,
            `Product: ${product_code}`,
            `License type: ${license_type}`,
            '',
            'Steps:',
            '1. Use get_product_details to confirm the product and its authorization method.',
            license_type === 'trial'
              ? '2. Use get_trial_key to issue a trial license for the customer device.'
              : '2. Create an order with a full license using the Management API server (create_order).',
            '3. Provide activation instructions (activate_license, or activate_offline for air-gapped devices).',
            '4. Summarize the actions taken and anything the customer must do next.',
          ].join('\n'),
        },
      }],
    }),
  );

  registerTools(server, createLicenseApiTools(client));
  return server;
}

export interface StartOptions {
  env?: Record<string, string | undefined>;
  proc?: ProcessLike;
  logger?: Logger;
  transport?: Parameters<typeof runStdioServer>[0]['transport'];
}

/** Load configuration, build the server and serve it over stdio. Exits the process on fatal errors. */
export async function startLicenseApiServer(options: StartOptions = {}): Promise<void> {
  const { proc = process, logger = licenseApiLogger } = options;
  if (!options.env) dotenv.config({ quiet: true });
  const env = options.env ?? process.env;

  try {
    const config = loadLicenseApiConfig(env);
    const client = new LicenseApiClient(config, { logger });
    const state = createServerState();
    const server = createLicenseApiServer(client, { baseUrl: config.baseUrl, state });
    await runStdioServer({
      server,
      logger,
      name: `LicenseSpring License API MCP server v${PACKAGE_VERSION}`,
      state,
      transport: options.transport,
      proc,
    });
    logger.info('License API configuration', { api_url: config.baseUrl, auth: config.auth.type });
  } catch (error) {
    if (error instanceof ConfigError) {
      logger.error(`Configuration error: ${error.message}. See README.md for setup instructions.`);
    } else {
      logger.error('Failed to start License API MCP server', error);
    }
    proc.exit(1);
  }
}
