import { PACKAGE_VERSION } from './utils/http.js';

export const USAGE = `LicenseSpring MCP Server v${PACKAGE_VERSION}

Usage:
  licensespring-mcp-server [license-api|management-api]   Start a server on stdio (default: license-api)
  licensespring-mcp-server --help                          Show this help
  licensespring-mcp-server --version                       Show the version

License API server environment:
  LICENSE_API_KEY + LICENSE_SHARED_KEY        API key authorization (requests are HMAC-signed)
  LICENSE_CLIENT_ID + LICENSE_CLIENT_SECRET   OAuth client credentials (alternative)
  LICENSE_API_URL                             Default: https://api.licensespring.com

Management API server environment:
  MANAGEMENT_API_KEY                          Management API key
  MANAGEMENT_API_URL                          Default: https://saas.licensespring.com

Optional:
  LICENSESPRING_TIMEOUT_MS (default 25000), LICENSESPRING_MAX_RETRIES (default 2), LOG_LEVEL

See README.md for details.
`;

export interface CliDeps {
  startLicenseApi: () => Promise<void>;
  startManagementApi: () => Promise<void>;
  /** Writes help/version text. Only used when no server is started, so stdout is safe. */
  print: (text: string) => void;
  printError: (text: string) => void;
  exit: (code: number) => void;
}

export async function runCli(args: string[], deps: CliDeps): Promise<void> {
  const [command = 'license-api'] = args;
  switch (command) {
    case '--help':
    case '-h':
      deps.print(USAGE);
      return;
    case '--version':
    case '-v':
      deps.print(PACKAGE_VERSION);
      return;
    case 'license-api':
      await deps.startLicenseApi();
      return;
    case 'management-api':
      await deps.startManagementApi();
      return;
    default:
      deps.printError(`Unknown server type: ${command}\n\n${USAGE}`);
      deps.exit(1);
  }
}
