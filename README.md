# Serper.live MCP server

[![Serper Live MCP server – quality and maintenance score on Glama](https://glama.ai/mcp/servers/serper-live/serper-live-mcp/badges/score.svg)](https://glama.ai/mcp/servers/serper-live/serper-live-mcp)

Live Google search for AI agents. This [Model Context Protocol](https://modelcontextprotocol.io) server lets Claude, OpenAI Codex, Cursor, VS Code and other MCP clients run a real Google search through [Serper.live](https://serper.live) for the country, language and device you choose, and check where a domain ranks right now.

Every search is fresh: nothing is cached, and a page of 10 results usually comes back in 2–3 seconds. Positions count organic results only, without ads, sitelinks, video or image blocks, so the number an agent reads is the number a rank tracker would store.

## Tools

| Tool | What it does | Cost |
| --- | --- | --- |
| `google_search` | Live organic results for a keyword: `position`, `title`, `url`, `domain`, `snippet`, up to 100 per call | Billed per page of up to 10 results |
| `domain_position` | Where a domain ranks for a keyword in a country and on a device; every position if it appears more than once, or "not in the top N" | Same as `google_search` for the depth checked |
| `list_countries` | Markets open right now and the default Google language of each | Free, no token |

Arguments: `query` (2–120 characters), `country` (two-letter code such as `US`, `GB`, `DE`, `FR`, `TR`, `UA`), optional `language` (Google interface language, defaults to the country's), `device` (`desktop` or `mobile`) and `limit` / `depth` (1–100, default 10).

## Setup

1. Create an account at [serper.live](https://serper.live), add credit (from $5 in USDT or USDC, no subscription, credit never expires) and create an API token on [API tokens](https://serper.live/account/tokens).
2. Add the server to your client with the token in `SERPER_LIVE_TOKEN`. It runs with `npx`, so Node.js 20 or newer is all you need; Claude Desktop can also install it in one click without Node.js.

### Claude Code

```bash
claude mcp add serper-live -e SERPER_LIVE_TOKEN=sl_live_YOUR_TOKEN -- npx -y @serper-live/mcp
```

### Claude Desktop

One click: download [`serper-live-mcp.mcpb`](https://github.com/serper-live/serper-live-mcp/releases/latest/download/serper-live-mcp.mcpb) from the latest release and open it. Claude Desktop shows an install dialog, asks for the API token once, stores it securely and runs the server with its own Node.js.

Or by hand, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "serper-live": {
      "command": "npx",
      "args": ["-y", "@serper-live/mcp"],
      "env": {
        "SERPER_LIVE_TOKEN": "sl_live_YOUR_TOKEN"
      }
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json` or `.cursor/mcp.json` in a project:

```json
{
  "mcpServers": {
    "serper-live": {
      "command": "npx",
      "args": ["-y", "@serper-live/mcp"],
      "env": {
        "SERPER_LIVE_TOKEN": "sl_live_YOUR_TOKEN"
      }
    }
  }
}
```

### VS Code

`.vscode/mcp.json` — VS Code asks for the token once and keeps it out of the file:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "serper-live-token",
      "description": "Serper.live API token",
      "password": true
    }
  ],
  "servers": {
    "serper-live": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@serper-live/mcp"],
      "env": {
        "SERPER_LIVE_TOKEN": "${input:serper-live-token}"
      }
    }
  }
}
```

### OpenAI Codex

```bash
codex mcp add serper-live --env SERPER_LIVE_TOKEN=sl_live_YOUR_TOKEN -- npx -y @serper-live/mcp
```

Or by hand, in `~/.codex/config.toml` (the Codex CLI, its IDE extension and the ChatGPT desktop app share this file):

```toml
[mcp_servers.serper-live]
command = "npx"
args = ["-y", "@serper-live/mcp"]

[mcp_servers.serper-live.env]
SERPER_LIVE_TOKEN = "sl_live_YOUR_TOKEN"
```

Any other MCP client: run `npx -y @serper-live/mcp` over stdio with `SERPER_LIVE_TOKEN` in the environment.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `SERPER_LIVE_TOKEN` | for searches | API token from [API tokens](https://serper.live/account/tokens). Without it `list_countries` still works |
| `SERPER_LIVE_API_URL` | no | API base URL, default `https://api.serper.live` |

## What to ask

- "Where does example.com rank on Google in Germany on mobile for *project management software*? Check the top 30."
- "Compare the top 10 Google results for *best running shoes* in the US and the UK."
- "Which markets can you search in?"

## Billing and retries

Searches are billed to your Serper.live balance per page of up to 10 organic results, at the price of the market ([pricing](https://serper.live/pricing)); desktop and mobile cost the same. Each call sends an `Idempotency-Key`, so a repeated call is never billed twice.

## Development

```bash
npm install
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
npm run bundle   # serper-live-mcp.mcpb: dist/, manifest.json, icon.png and the production dependencies
```

## Releasing

The version lives in `package.json`, in `version` plus `packages[0].version` of `server.json`, which the [MCP Registry](https://registry.modelcontextprotocol.io) checks against npm, and in `manifest.json` of the MCP Bundle. `npm version` sets all of them: its `version` script ([`scripts/sync-version.mjs`](scripts/sync-version.mjs)) copies the new version into `server.json` and `manifest.json`.

A pushed `v*` tag runs [`.github/workflows/publish.yml`](.github/workflows/publish.yml): it checks that the tag matches every version field, builds, packs and validates the MCP Bundle, publishes to npm through trusted publishing (no npm token, with provenance), waits until npm serves the new version (up to 30 minutes), attaches `serper-live-mcp.mcpb` to the GitHub release and updates the MCP Registry through GitHub OIDC with two packages: npm and the bundle with its SHA-256. A failed run can be re-run as is: a version npm already has is not published again, and the release asset is replaced.

```bash
npm version x.y.z --no-git-tag-version   # package.json, package-lock.json, server.json, manifest.json
git commit -am "Release x.y.z"
git tag vx.y.z
git push && git push origin vx.y.z
```

The npm package lists this workflow as its trusted publisher (package settings → Trusted Publisher → GitHub Actions: `serper-live/serper-live-mcp`, workflow `publish.yml`, with **Allow npm publish** ticked under Allowed actions).

## Links

- [Serper.live](https://serper.live) — live Google SERP API
- [API documentation](https://serper.live/docs)
- [Playground](https://serper.live/playground) — try a live search in the browser without an account
- [Contact](https://serper.live/contact)

## License

MIT