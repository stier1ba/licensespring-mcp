#!/usr/bin/env node
import { startManagementApiServer } from './management-api/server.js';

await startManagementApiServer();
