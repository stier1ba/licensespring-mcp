#!/usr/bin/env node
// Thin executable wrapper; all logic lives in cli.ts / main.ts (unit tested).
// Covered by tests/smoke/stdio.test.mjs which spawns the built binary.
import { runCli } from './cli.js';
import { runLicenseApiServer, runManagementApiServer } from './main.js';
import { loadEnv } from './runtime.js';

loadEnv();
void runCli(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
  exit: (code) => process.exit(code),
  start: (server) => (server === 'management-api' ? runManagementApiServer : runLicenseApiServer)({ proc: process }),
});
