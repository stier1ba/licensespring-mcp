import { VERSION } from './version.js';

export const USAGE = `LicenseSpring MCP Server v${VERSION}

Usage:
  licensespring-mcp-server [license-api|management-api]   (default: license-api)
  licensespring-mcp-license                                License API server
  licensespring-mcp-management                             Management API server
  licensespring-mcp-server --help | --version

License API (choose one auth method):
  LICENSE_API_KEY + LICENSE_SHARED_KEY       HMAC request signing
  LICENSE_CLIENT_ID + LICENSE_CLIENT_SECRET  OAuth client credentials
  LICENSE_API_URL          default https://api.licensespring.com
  LICENSE_OAUTH_TOKEN_URL  default LicenseSpring Keycloak token endpoint

Management API:
  MANAGEMENT_API_KEY       Management API key (Settings → Keys)
  MANAGEMENT_API_URL       default https://saas.licensespring.com

Logging (always stderr): LOG_LEVEL=error|warn|info|debug
`;

export type ServerKind = 'license-api' | 'management-api';

export type CliAction =
  | { type: 'help' }
  | { type: 'version' }
  | { type: 'start'; server: ServerKind }
  | { type: 'error'; message: string };

export function parseArgs(argv: string[]): CliAction {
  const [first] = argv;
  if (first === '--help' || first === '-h') return { type: 'help' };
  if (first === '--version' || first === '-v') return { type: 'version' };
  if (first === undefined || first === 'license-api') return { type: 'start', server: 'license-api' };
  if (first === 'management-api') return { type: 'start', server: 'management-api' };
  return { type: 'error', message: `Unknown server type: ${first}. Valid options: license-api, management-api` };
}

export interface CliDeps {
  /** stdout is only used for --help/--version, never while a server runs. */
  stdout: { write(chunk: string): unknown };
  stderr: { write(chunk: string): unknown };
  exit(code: number): void;
  start(server: ServerKind): Promise<unknown>;
}

export async function runCli(argv: string[], deps: CliDeps): Promise<void> {
  const action = parseArgs(argv);
  switch (action.type) {
    case 'help':
      deps.stdout.write(USAGE);
      return;
    case 'version':
      deps.stdout.write(`${VERSION}\n`);
      return;
    case 'error':
      deps.stderr.write(`${action.message}\n\n${USAGE}`);
      deps.exit(1);
      return;
    case 'start':
      await deps.start(action.server);
  }
}
