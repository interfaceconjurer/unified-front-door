import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
export const origin = process.env.BROWSER_TEST_ORIGIN ?? 'http://127.0.0.1:3487';
export const outputDirectory = process.env.BROWSER_TEST_OUTPUT ?? join(tmpdir(), 'ufd-browser-results');
mkdirSync(outputDirectory, { recursive: true });
export const outputPath = name => join(outputDirectory, name);
export const httpCredentials = { username: process.env.BASIC_AUTH_USER ?? 'guest', password: process.env.BASIC_AUTH_PASSWORD ?? 'phase6-browser' };
