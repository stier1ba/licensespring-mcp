#!/usr/bin/env node
// Thin executable wrapper; logic lives in main.ts (unit tested).
// Covered by tests/smoke/stdio.test.mjs which spawns the built binary.
import { runLicenseApiServer } from './main.js';
import { loadEnv } from './runtime.js';

loadEnv();
void runLicenseApiServer({ proc: process });
