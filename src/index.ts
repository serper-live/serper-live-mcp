#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createRequire } from 'node:module';
import { DEFAULT_API_URL, SerperLiveClient } from './client.js';
import { createServer } from './server.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };
const token = process.env.SERPER_LIVE_TOKEN?.trim() || null;
const baseUrl = process.env.SERPER_LIVE_API_URL?.trim() || DEFAULT_API_URL;
const client = new SerperLiveClient(token, baseUrl, `serper-live-mcp/${version}`);

serveStdio(() => createServer(client, version));