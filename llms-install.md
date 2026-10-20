# Installing the Serper.live MCP server

Instructions for an AI agent (Cline and similar) setting up this server for a user.

## Requirements

- Node.js 20 or newer (`node --version`). The server runs with `npx`, nothing is cloned or built.
- A Serper.live API token (`sl_live_…`). Ask the user for it; it is created at https://serper.live/account/tokens after signing up and adding credit at https://serper.live. Without a token only `list_countries` works.

## Configuration

Add the server to the MCP settings file of the client, with the token from the user in place of `sl_live_YOUR_TOKEN`. Keep any servers already in the file.

For Cline the file is `cline_mcp_settings.json`: Cline for JetBrains and the Cline CLI keep it at `~/.cline/data/settings/cline_mcp_settings.json`; in any Cline it also opens from the MCP Servers panel → Configure → Configure MCP Servers. Do not search the IDE's own files for it.

```json
{
  "mcpServers": {
    "serper-live": {
      "command": "npx",
      "args": ["-y", "@serper-live/mcp"],
      "env": {
        "SERPER_LIVE_TOKEN": "sl_live_YOUR_TOKEN"
      },
      "disabled": false,
      "autoApprove": ["list_countries"],
      "timeout": 120
    }
  }
}
```

Keep the token in this file only; do not write it into the project or print it back to the user.

## Check

Call `list_countries`. It is free and returns the open markets, each with its default Google language, e.g. `US — default language en`. An answer means the server is running.

## Tools

- `google_search` — live organic Google results for `query` and `country`, with optional `language`, `device` (`desktop` or `mobile`) and `limit` (1–100, default 10).
- `domain_position` — where `domain` ranks for `query` in `country`, with optional `language`, `device` and `depth` (1–100, default 10).
- `list_countries` — open markets and the default Google language of each; free.

`google_search` and `domain_position` are billed to the user's Serper.live balance per started page of 10 results, so leave them out of `autoApprove` and do not run them speculatively.
