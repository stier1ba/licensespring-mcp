import type { ToolDefinition } from '../../tools.js';
import type { ApiClient } from '../../utils/http.js';
import { analyticsTools } from './analytics.js';
import { consumptionPoolTools } from './consumption-pools.js';
import { customerTools } from './customers.js';
import { deviceTools } from './devices.js';
import { licenseUserTools } from './license-users.js';
import { licenseTools } from './licenses.js';
import { oauthClientTools } from './oauth-clients.js';
import { orderTools } from './orders.js';
import { productTools } from './products.js';
import { builders, type Builders } from './shared.js';

/**
 * Management API (`/api/v1`) tools, grouped into toolsets that can be enabled selectively.
 *
 * @see https://docs.licensespring.com/management-api
 */
export const MANAGEMENT_TOOLSETS = {
  licenses: licenseTools,
  license_users: licenseUserTools,
  orders: orderTools,
  customers: customerTools,
  products: productTools,
  devices: deviceTools,
  analytics: analyticsTools,
  consumption_pools: consumptionPoolTools,
  oauth_clients: oauthClientTools,
} satisfies Record<string, (b: Builders) => ToolDefinition[]>;

export type ManagementToolset = keyof typeof MANAGEMENT_TOOLSETS;

export function createManagementApiTools(client: ApiClient, toolsets?: readonly ManagementToolset[]): ToolDefinition[] {
  const b = builders(client);
  const selected = toolsets ?? (Object.keys(MANAGEMENT_TOOLSETS) as ManagementToolset[]);
  return selected.flatMap((name) => MANAGEMENT_TOOLSETS[name](b));
}
