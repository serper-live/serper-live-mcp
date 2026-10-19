// Packs the built server into serper-live-mcp.mcpb, an MCP Bundle that Claude Desktop installs in one click:
// manifest.json, icon.png, package.json, dist/ and the production dependencies, nothing else. Run after `npm run build`.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const STAGE = 'bundle';
const OUTPUT = 'serper-live-mcp.mcpb';

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE);

for (const path of ['manifest.json', 'icon.png', 'package.json', 'package-lock.json', 'LICENSE', 'dist']) {
    cpSync(path, `${STAGE}/${path}`, { recursive: true });
}

execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: STAGE, stdio: 'inherit' });
execFileSync('npx', ['mcpb', 'pack', STAGE, OUTPUT], { stdio: 'inherit' });