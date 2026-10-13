import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import dotenv from 'dotenv';
import { z } from 'zod';
import { ConfigError, loadManagementApiConfig } from '../config.js';
import { createServerState, healthPayload, runStdioServer, type ServerState } from '../runtime.js';
import { registerTools, selectTools } from '../tools.js';
import { handleApiError, ManagementApiClient, PACKAGE_VERSION, type ApiClient } from '../utils/http.js';
import { managementApiLogger } from '../utils/logger.js';
import type { StartOptions } from '../license-api/server.js';
import { createManagementApiTools, type ManagementToolset } from './tools/index.js';

export const MANAGEMENT_SERVER_NAME = 'licensespring-management-api';

const LIST_RESOURCES = [
  { name: 'licenses-list', uri: 'licensespring://management/licenses', title: 'Licenses', path: '/api/v1/licenses/' },
  { name: 'customers-list', uri: 'licensespring://management/customers', title: 'Customers', path: '/api/v1/customers/' },
  { name: 'products-list', uri: 'licensespring://management/products', title: 'Products', path: '/api/v1/products/' },
  { name: 'orders-list', uri: 'licensespring://management/orders', title: 'Orders', path: '/api/v1/orders/' },
];

export function createManagementApiServer(
  client: ApiClient,
  options: { baseUrl: string; state?: ServerState; toolsets?: readonly string[]; readOnly?: boolean },
): McpServer {
  const state = options.state ?? createServerState();
  const server = new McpServer({ name: MANAGEMENT_SERVER_NAME, version: PACKAGE_VERSION });

  server.registerResource(
    'health',
    'licensespring://health',
    { title: 'Health Check', description: 'Service health status and metrics', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(
          healthPayload(MANAGEMENT_SERVER_NAME, PACKAGE_VERSION, state, {
            api_url: options.baseUrl,
            toolsets: options.toolsets ?? 'all',
            read_only: options.readOnly ?? false,
          }),
          null,
          2,
        ),
      }],
    }),
  );

  for (const resource of LIST_RESOURCES) {
    server.registerResource(
      resource.name,
      resource.uri,
      { title: resource.title, description: `First 100 ${resource.title.toLowerCase()}`, mimeType: 'application/json' },
      async (uri) => {
        try {
          const data = await client.request({ method: 'GET', path: resource.path, query: { limit: 100 } });
          return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };
        } catch (error) {
          throw new Error(`Failed to list ${resource.title.toLowerCase()}: ${handleApiError(error)}`);
        }
      },
    );
  }

  server.registerPrompt(
    'license-management-workflow',
    {
      title: 'License Management Workflow',
      description: 'Create, update, audit or clean up licenses',
      argsSchema: {
        action: z.enum(['create', 'update', 'audit', 'cleanup']),
        customer_email: z.string().email().optional(),
        product_code: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    ({ action, customer_email, product_code, notes }) => {
      const steps: Record<typeof action, string[]> = {
        create: [
          'Find the customer with list_customers (filter email) or create one with create_customer.',
          'Issue the license with create_order (licenses are created through orders).',
          'Confirm the result with list_licenses filtered by customer_email.',
        ],
        update: [
          'Find the license with list_licenses and inspect it with get_license.',
          'Apply changes with update_license, enable_license/disable_license or apply_license_policy.',
          'Summarize the before/after values.',
        ],
        audit: [
          'List licenses with list_licenses (use filters such as validity_period__lte or enabled=false).',
          'Review activation history with list_license_activation_histories for suspicious patterns.',
          'Report expired, unused, disabled or over-activated licenses.',
        ],
        cleanup: [
          'Identify expired or unused licenses with list_licenses and list_devices.',
          'Confirm with the user before any destructive call.',
          'Disable (bulk_disable_licenses) rather than delete unless deletion is explicitly approved.',
        ],
      };
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Please help with a LicenseSpring license ${action} task.`,
              customer_email ? `Customer: ${customer_email}` : undefined,
              product_code ? `Product: ${product_code}` : undefined,
              notes ? `Notes: ${notes}` : undefined,
              '',
              'Steps:',
              ...steps[action].map((step, index) => `${index + 1}. ${step}`),
            ].filter((line) => line !== undefined).join('\n'),
          },
        }],
      };
    },
  );

  server.registerPrompt(
    'customer-analysis',
    {
      title: 'Customer Analysis',
      description: 'Analyze a customer\'s licenses, usage and renewal outlook',
      argsSchema: {
        customer_id: z.string().optional(),
        customer_email: z.string().email().optional(),
        analysis_type: z.enum(['usage', 'compliance', 'renewal']).optional(),
      },
    },
    ({ customer_id, customer_email, analysis_type = 'usage' }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Please run a ${analysis_type} analysis for a LicenseSpring customer.`,
            customer_id ? `Customer ID: ${customer_id}` : undefined,
            customer_email ? `Customer email: ${customer_email}` : undefined,
            '',
            'Use get_customer / list_customers, list_licenses (filter customer_id or customer_email), ',
            'list_devices, list_license_activation_histories and list_license_usage_histories to gather data.',
            analysis_type === 'renewal'
              ? 'Focus on upcoming expirations (validity_period), maintenance periods and renewal risks.'
              : analysis_type === 'compliance'
                ? 'Focus on activation limits, blacklisted devices, overages and VM usage.'
                : 'Focus on activations, consumption trends and under-used licenses.',
            'Finish with concrete recommendations.',
          ].filter((line) => line !== undefined).join('\n'),
        },
      }],
    }),
  );

  const tools = createManagementApiTools(client, options.toolsets as readonly ManagementToolset[] | undefined);
  registerTools(server, selectTools(tools, options.readOnly));
  return server;
}

/** Load configuration, build the server and serve it over stdio. Exits the process on fatal errors. */
export async function startManagementApiServer(options: StartOptions = {}): Promise<void> {
  const { proc = process, logger = managementApiLogger } = options;
  if (!options.env) dotenv.config({ quiet: true });
  const env = options.env ?? process.env;

  try {
    const config = loadManagementApiConfig(env);
    const client = new ManagementApiClient(config, { logger });
    const state = createServerState();
    const server = createManagementApiServer(client, {
      baseUrl: config.baseUrl,
      state,
      toolsets: config.toolsets,
      readOnly: config.readOnly,
    });
    await runStdioServer({
      server,
      logger,
      name: `LicenseSpring Management API MCP server v${PACKAGE_VERSION}`,
      state,
      transport: options.transport,
      proc,
    });
  } catch (error) {
    if (error instanceof ConfigError) {
      logger.error(`Configuration error: ${error.message}. See README.md for setup instructions.`);
    } else {
      logger.error('Failed to start Management API MCP server', error);
    }
    proc.exit(1);
  }
}
