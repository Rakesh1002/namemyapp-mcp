# @namemyapp/mcp

Model Context Protocol (MCP) server for [namemy.app](https://namemy.app) — gives Claude Desktop, Claude Code, Cursor, Windsurf, Continue.dev, ChatGPT, and any MCP-aware client live domain availability and one-click buy URLs.

Three ways to connect:

| Mode | Endpoint | Auth | Best for |
|------|----------|------|----------|
| **Remote OAuth** | `https://mcp.namemy.app/mcp` | OAuth 2.1 + PKCE | Claude.ai web · ChatGPT · directory listings |
| **Remote direct** | `https://mcp.namemy.app/direct` | Bearer namemy.app key | Claude Desktop · curl · custom scripts |
| **Local stdio** | `npx -y @namemyapp/mcp` | Env var key | Claude Code plugin · restricted networks |

The remote OAuth endpoint is the recommended path for hosted clients. Use direct or stdio if your client doesn't speak OAuth. This npm package is the stdio mirror.

[![npm](https://img.shields.io/npm/v/@namemyapp/mcp.svg)](https://www.npmjs.com/package/@namemyapp/mcp)
[![license](https://img.shields.io/npm/l/@namemyapp/mcp.svg)](./LICENSE)

## What it does

Your AI agent can already suggest names. This server lets it:

- **Check domain availability** across registrars with unified retail pricing
- **Hand the user a one-click buy URL** that drops them into namemy.app's checkout — sign-up + payment in one flow, your agent never touches a card
- **Generate brandable names** with availability fused in (authed mode)
- **Buy domains server-to-server** (authed mode)
- **Set DNS records, generate logos, legal docs, brand kits** (authed mode)

## Install — Claude.ai web / Cursor / ChatGPT (remote, OAuth)

Use the OAuth-protected endpoint when the client supports it (Claude.ai web/mobile connectors, ChatGPT Apps, Cursor's remote MCP, anything that follows MCP protected-resource discovery):

```
https://mcp.namemy.app/mcp
```

The client opens a browser tab where you paste your namemy.app API key once — after that the connector refreshes its own OAuth tokens. OAuth metadata is at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`.

## Install — Claude Desktop / scripts (remote, direct bearer)

For clients that don't do OAuth (Claude Desktop's basic remote MCP, curl, custom scripts), point at the direct endpoint and pass your API key as a bearer token:

```json
{
  "mcpServers": {
    "namemyapp": {
      "transport": "http",
      "url": "https://mcp.namemy.app/direct",
      "headers": { "Authorization": "Bearer nma_live_..." }
    }
  }
}
```

Restart Claude Desktop. Ask: *"is codeflow.ai available?"*

## Install — Claude Desktop (local stdio fallback)

```json
{
  "mcpServers": {
    "namemyapp": {
      "command": "npx",
      "args": ["-y", "@namemyapp/mcp"],
      "env": { "NAMEMYAPP_AGENT_SOURCE": "claude-desktop" }
    }
  }
}
```

## Install — Claude Code

```
/plugin install namemyapp
```

The bundled plugin ships a SKILL that triggers on naming/domain prompts plus three slash commands (`/check-domain`, `/name-app`, `/buy-domain`). Or wire just the MCP server in `~/.claude.json` with the same JSON snippet as Claude Desktop.

## Install — Cursor / Windsurf / Continue.dev

Same JSON shape:

```json
{
  "mcpServers": {
    "namemyapp": {
      "command": "npx",
      "args": ["-y", "@namemyapp/mcp"],
      "env": { "NAMEMYAPP_AGENT_SOURCE": "cursor" }
    }
  }
}
```

- Cursor: `~/.cursor/mcp.json` (or workspace `.cursor/mcp.json`)
- Windsurf: `~/.codeium/windsurf/mcp_config.json`
- Continue.dev: `~/.continue/config.json` under `experimental.modelContextProtocolServers`

Full install matrix: <https://namemy.app/agents/install>.

## Two modes

| Mode | Trigger | Tools exposed |
|------|---------|---------------|
| **public** | no `NAMEMYAPP_API_KEY` | `buy_link` (URL builder, no network call) |
| **authed** | `NAMEMYAPP_API_KEY=nma_live_...` | All 12 tools wrapping `/api/v1/*` |

Public mode is the zero-friction path — `npx -y @namemyapp/mcp` works without any signup. Get a free key at <https://namemy.app/app/api-keys> for the full surface.

## Tools

### `buy_link` — always available

Build a one-click purchase URL.

```ts
{ domain: "codeflow.ai", priceUsd?: 13.20 }
// → { domain, buyUrl, source }
```

### `check_domain` — authed

Live single-domain availability + price.

```ts
{ domain: "codeflow.ai" }
// → { domain, available, bestPrice, comparison, buyUrl }
```

### `generate_names` — authed

AI brand name generation with availability fused in.

```ts
{ description: "AI task manager", tlds?, count?, industry? }
// → { meta, results: [{ name, tldOptions: [{ domain, available, price, buyUrl }] }] }
```

### Other authed tools

`buy_domain` (server-to-server), `list_domains`, `set_dns_record`, `brand_conflict_check`, `generate_logo`, `generate_legal_docs`, `generate_brand_kit`, `generate_social_kit`.

## Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `NAMEMYAPP_API_KEY` | — | Bearer token for authed mode |
| `NAMEMYAPP_API_URL` | `https://namemy.app` | Override for staging / self-hosted |
| `NAMEMYAPP_AGENT_SOURCE` | `mcp` | Attribution tag stamped on every API call + buyUrl |

## Attribution

Every API call sends `X-Agent-Source` header and `?source=` query param. namemy.app records this on every `Purchase` row and pushes attribution events to PostHog so we can credit the agent that drove the conversion.

## Transport

Stdio (this package) and Streamable HTTP. Two remote endpoints:

- `https://mcp.namemy.app/mcp` — OAuth 2.1 (auth code + PKCE, dynamic client registration via RFC 7591). Clients discover via `/.well-known/oauth-authorization-server`.
- `https://mcp.namemy.app/direct` — raw `Authorization: Bearer <namemy.app-api-key>`.

## Source + license

MIT. Source at <https://github.com/Rakesh1002/namemyapp/tree/main/packages/mcp>.
