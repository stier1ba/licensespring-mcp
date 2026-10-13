#!/usr/bin/env node
import { runCli } from './cli.js';

await runCli(process.argv.slice(2), {
  startLicenseApi: async () => (await import('./license-api/server.js')).startLicenseApiServer(),
  startManagementApi: async () => (await import('./management-api/server.js')).startManagementApiServer(),
  print: (text) => process.stdout.write(`${text}\n`),
  printError: (text) => process.stderr.write(`${text}\n`),
  exit: (code) => process.exit(code),
});
