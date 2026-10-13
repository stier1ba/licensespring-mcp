import { WRITE, type ToolDefinition } from '../../tools.js';
import type { Builders } from './shared.js';

const SCOPES = [
  { key: 'license', label: 'License', path: '/licenses/{id}/client' },
  { key: 'customer', label: 'Customer', path: '/customers/{id}/client' },
  { key: 'customer_account', label: 'Customer Account', path: '/customer-accounts/{id}/client' },
] as const;

/** OAuth client credentials scoped to a license, customer or customer account (for License API OAuth). */
export function oauthClientTools(b: Builders): ToolDefinition[] {
  return SCOPES.flatMap(({ key, label, path }) => [
    b.action({
      name: `get_${key}_oauth_client`,
      title: `Get ${label} OAuth Client`,
      description: `Get the License API OAuth client (client ID) scoped to a ${label.toLowerCase()}.`,
      path,
      what: label,
      method: 'GET',
    }),
    b.action({
      name: `create_${key}_oauth_client`,
      title: `Create ${label} OAuth Client`,
      description: `Create License API OAuth client credentials scoped to a ${label.toLowerCase()}. The response contains the client secret.`,
      path,
      what: label,
      annotations: WRITE,
    }),
    b.action({
      name: `delete_${key}_oauth_client`,
      title: `Delete ${label} OAuth Client`,
      description: `Delete the License API OAuth client scoped to a ${label.toLowerCase()}; its credentials stop working.`,
      path,
      what: label,
      method: 'DELETE',
    }),
  ]);
}
