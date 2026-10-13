import type { AxiosAdapter } from 'axios';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { loadLicenseApiConfig, loadManagementApiConfig } from './config.js';
import { createLicenseApiServer, LICENSE_SERVER_NAME } from './license-api/server.js';
import { createManagementApiServer, MANAGEMENT_SERVER_NAME } from './management-api/server.js';
import { reportConfigError, startServer, type ProcessLike, type RunningServer } from './runtime.js';
import { createHealthState } from './tools/health.js';
import { LicenseApiClient, ManagementApiClient } from './utils/http.js';
import { createLogger, type Logger } from './utils/logger.js';

export interface MainDeps {
  proc: ProcessLike;
  transport?: Transport;
  logger?: Logger;
  adapter?: AxiosAdapter;
}

export async function runLicenseApiServer(deps: MainDeps): Promise<RunningServer | undefined> {
  let config;
  try {
    config = loadLicenseApiConfig(deps.proc.env);
  } catch (error) {
    reportConfigError(deps.proc, error,
      'Set LICENSE_API_KEY + LICENSE_SHARED_KEY, or LICENSE_CLIENT_ID + LICENSE_CLIENT_SECRET (OAuth).');
    deps.proc.exit(1);
    return undefined;
  }
  const logger = deps.logger ?? createLogger('license-api');
  const health = createHealthState();
  const client = new LicenseApiClient(config.baseURL, config.auth, { logger, adapter: deps.adapter });
  const server = createLicenseApiServer(client, { logger, health });
  logger.info('License API configured', { api_url: config.baseURL, auth: config.auth.type });
  return startServer({ server, name: LICENSE_SERVER_NAME, logger, health, proc: deps.proc, transport: deps.transport });
}

export async function runManagementApiServer(deps: MainDeps): Promise<RunningServer | undefined> {
  let config;
  try {
    config = loadManagementApiConfig(deps.proc.env);
  } catch (error) {
    reportConfigError(deps.proc, error, 'Set MANAGEMENT_API_KEY.');
    deps.proc.exit(1);
    return undefined;
  }
  const logger = deps.logger ?? createLogger('management-api');
  const health = createHealthState();
  const client = new ManagementApiClient(config.baseURL, config.apiKey, { logger, adapter: deps.adapter });
  const server = createManagementApiServer(client, { logger, health });
  logger.info('Management API configured', { api_url: config.baseURL });
  return startServer({ server, name: MANAGEMENT_SERVER_NAME, logger, health, proc: deps.proc, transport: deps.transport });
}
