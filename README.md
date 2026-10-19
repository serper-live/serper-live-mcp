# Serper.live MCP server

Live Google search for AI agents. This [Model Context Protocol](https://modelcontextprotocol.io) server lets Claude, Cursor, VS Code and other MCP clients run a real Google search through [Serper.live](https://serper.live) for the country, language and device you choose, and check where a domain ranks right now.

Every search is fresh: nothing is cached, and a page of 10 results usually comes back in 2–3 seconds. Positions count organic results only, without ads, sitelinks, video or image blocks, so the number an agent reads is the number a rank tracker would store.

## Tools

| Tool | What it does | Cost |
| --- | --- | --- |
| `google_search` | Live organic results for a keyword: `position`, `title`, `url`, `domain`, `snippet`, up to 100 per call | Billed per page of up to 10 results |
| `domain_position` | Where a domain ranks for a keyword in a country and on a device; every position if it appears more than once, or "not in the top N" | Same as `google_search` for the depth checked |
| `list_countries` | Markets open right now and the default Google language of each | Free, no token |

Arguments: `query` (2–120 characters), `country` (two-letter code such as `US`, `GB`, `DE`, `TR`, `UA`), optional `language` (Google interface language, defaults to the country's), `device` (`desktop` or `mobile`) and `limit` / `depth` (1–100, default 10).

## Setup

1. Create an account at [serper.live](https://serper.live), add credit (from $5 in USDT or USDC, no subscription, credit never expires) and create an API token on [API tokens](https://serper.live/account/tokens).
2. Add the server to your client with the token in `SERPER_LIVE_TOKEN`. It runs with `npx`, so Node.js 18 or newer is all you need.

### Claude Code

```bash
claude mcp add serper-live -e SERPER_LIVE_TOKEN=sl_live_YOUR_TOKEN -- npx -y @serper-live/mcp
```

### Claude Desktop

`claude_desktop_config.json`:

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

Searches are billed to your Serper.live balance per page of up to 10 organic results, at the price of the market ([pricing](https://serper.live/pricing)); desktop and mobile cost the same. Each call sends an `Idempotency-Key`, and a call that loses its connection is retried once with the same key, so a search that already finished is returned again instead of being billed twice. A search that fails on the Serper.live side is not charged.

## Development

```bash
npm install
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

## Releasing

The version lives in three places that must match: `package.json`, and `version` plus `packages[0].version` in `server.json`, which the [MCP Registry](https://registry.modelcontextprotocol.io) checks against npm. A pushed `v*` tag runs [`.github/workflows/publish.yml`](.github/workflows/publish.yml): it checks that the tag matches all three, builds, publishes to npm through trusted publishing (no npm token, with provenance) and updates the MCP Registry through GitHub OIDC.

```bash
npm version patch --no-git-tag-version   # bump package.json and package-lock.json
# set the same version in server.json (both fields)
git commit -am "Release x.y.z"
git tag vx.y.z
git push && git push --tags
```

The npm package lists this workflow as its trusted publisher (package settings → Trusted Publisher → GitHub Actions: `serper-live/serper-live-mcp`, workflow `publish.yml`).

## Links

- [Serper.live](https://serper.live) — live Google SERP API
- [API documentation](https://serper.live/docs)
- [Playground](https://serper.live/playground) — try a live search in the browser without an account
- [Contact](https://serper.live/contact)

## License

MIT