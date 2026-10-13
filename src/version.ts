import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

/** Package version, read from package.json so it never drifts from releases. */
export const VERSION: string = pkg.version;
export const PACKAGE_NAME: string = pkg.name;
