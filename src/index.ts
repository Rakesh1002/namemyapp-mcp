#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";

const API_KEY = process.env.NAMEMYAPP_API_KEY || "";
const API_BASE = (process.env.NAMEMYAPP_API_URL || "https://namemy.app").replace(/\/$/, "");
const AGENT_SOURCE = process.env.NAMEMYAPP_AGENT_SOURCE || "mcp";

// Two modes: "authed" exposes the full surface (12 tools wrapping /api/v1/*)
// against a user-provided API key. "public" mode (no key) exposes only the
// always-free primitives — currently `buy_link` (pure URL builder, no API
// call) — and degrades gracefully so first-time installers get something
// useful without signing up. The /api/public/* surface (no-auth domain
// availability) is also reachable in public mode without a key.
const MODE: "authed" | "public" = API_KEY ? "authed" : "public";

if (MODE === "public") {
  console.error(
    "[namemyapp-mcp] No NAMEMYAPP_API_KEY set — running in public mode (buy_link only). " +
      "Generate a free key at https://namemy.app/app/api-keys for full tool access.",
  );
}

async function api(path: string, opts: { method?: string; body?: unknown } = {}) {
  if (MODE === "public") {
    throw new Error(
      "This tool requires a NAMEMYAPP_API_KEY. Generate one at https://namemy.app/app/api-keys",
    );
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "X-Agent-Source": AGENT_SOURCE,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) || `${res.status}`);
  return data;
}

function buildBuyLink(domain: string, priceUsd?: number): string {
  const params = new URLSearchParams({ domain, source: AGENT_SOURCE });
  if (typeof priceUsd === "number" && Number.isFinite(priceUsd)) {
    params.set("price", priceUsd.toFixed(2));
  }
  return `${API_BASE}/checkout?${params.toString()}`;
}

const BUY_LINK_TOOL: Tool = {
  name: "buy_link",
  description:
    "Build a one-click purchase URL the user can open to buy a domain on namemy.app. Always available (works without an API key). Use this when the user has decided on a name they like — hand them the URL and they sign up + pay in their browser.",
  inputSchema: {
    type: "object",
    properties: {
      domain: {
        type: "string",
        description: "Fully-qualified domain to buy, e.g. 'codeflow.ai'",
      },
      priceUsd: {
        type: "number",
        description:
          "Optional quoted price in USD. If omitted, the checkout page will fetch the live price.",
      },
    },
    required: ["domain"],
  },
};

const AUTHED_TOOLS: Tool[] = [
  {
    name: "generate_names",
    description: "Generate brandable business names with real-time domain availability. Returns names that are ACTUALLY available to register, with pricing.",
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "What does the project/business do?",
        },
        tlds: {
          type: "array",
          items: { type: "string" },
          description: "Preferred TLDs",
          default: [".com", ".io", ".ai", ".app"],
        },
        count: {
          type: "number",
          description: "Max results",
          default: 10,
        },
        industry: {
          type: "string",
          description: "Industry context (e.g., 'saas', 'fintech', 'healthcare')",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "check_domain",
    description: "Check if a domain is available and get pricing from the cheapest registrar.",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Domain to check, e.g. 'taskflow.app'",
        },
      },
      required: ["domain"],
    },
  },
  {
    name: "buy_domain",
    description: "Purchase a domain using the stored payment method. Returns success/failure.",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Domain to purchase",
        },
        years: {
          type: "number",
          description: "Registration years",
          default: 1,
        },
      },
      required: ["domain"],
    },
  },
  {
    name: "list_domains",
    description: "List all domains owned by the user.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "set_dns_record",
    description: "Add or update a DNS record for a domain. Useful for pointing domains to Vercel, Netlify, or email services.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        type: { type: "string", enum: ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] },
        host: { type: "string", description: "Subdomain or @ for root" },
        value: { type: "string" },
        ttl: { type: "number", default: 300 },
      },
      required: ["domain", "type", "host", "value"],
    },
  },
  {
    name: "brand_conflict_check",
    description: "Check if a brand name conflicts with USPTO trademarks, live company homepages, or search results. Free for all tiers.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Brand name to check" },
        context: {
          type: "string",
          description: "Optional industry/product context to narrow results (e.g., 'AI task manager')",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "generate_logo",
    description: "Generate AI logo concepts (icon + palette + typography + layout) for a business. Returns N variations. Requires Founder sub or one-time LOGO_PACK/BRAND_KIT purchase.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string", description: "What the business does" },
        slogan: { type: "string" },
        count: { type: "number", default: 4, description: "Number of variations (1-9)" },
        preferences: {
          type: "object",
          properties: {
            industry: { type: "string" },
            styles: { type: "array", items: { type: "string" } },
            colorPalette: { type: "string" },
          },
        },
      },
      required: ["name", "description"],
    },
  },
  {
    name: "generate_legal_docs",
    description: "Generate Privacy Policy, Terms of Service, and Cookie Policy for a business. Region-aware (GDPR, CCPA, LGPD). Requires Founder sub or LEGAL_KIT purchase.",
    inputSchema: {
      type: "object",
      properties: {
        businessName: { type: "string" },
        businessType: {
          type: "string",
          description: "saas | ecommerce | agency | marketplace | …",
        },
        websiteUrl: { type: "string" },
        contactEmail: { type: "string" },
        regions: {
          type: "array",
          items: { type: "string" },
          default: ["gdpr", "ccpa"],
        },
      },
      required: ["businessName", "businessType"],
    },
  },
  {
    name: "generate_brand_kit",
    description: "Generate a complete brand kit (essentials, audience, personality, visual identity, voice, imagery, applications, dos-and-donts). Requires Founder sub or BRAND_KIT purchase.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        industry: { type: "string" },
        description: { type: "string" },
        includeVisuals: { type: "boolean", default: true },
      },
      required: ["name"],
    },
  },
  {
    name: "generate_social_kit",
    description: "Generate a social media strategy + content kit (posts, captions, calendar, analytics framework). Requires Founder sub or SOCIAL_MEDIA_KIT purchase.",
    inputSchema: {
      type: "object",
      properties: {
        businessName: { type: "string" },
        industry: { type: "string" },
        description: { type: "string" },
        targetAudience: { type: "string" },
        goals: { type: "array", items: { type: "string" } },
        platforms: {
          type: "array",
          items: {
            type: "string",
            enum: ["twitter", "linkedin", "instagram", "tiktok", "youtube", "facebook", "threads", "bluesky"],
          },
        },
        voiceTone: {
          type: "string",
          enum: ["professional", "friendly", "witty", "technical", "casual", "bold", "inspirational"],
        },
      },
      required: ["businessName", "industry", "targetAudience"],
    },
  },
];

const TOOLS: Tool[] =
  MODE === "authed" ? [...AUTHED_TOOLS, BUY_LINK_TOOL] : [BUY_LINK_TOOL];

const server = new Server(
  { name: "namemyapp-mcp", version: "1.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments as Record<string, unknown>;

  try {
    let result: Record<string, unknown>;

    switch (name) {
      case "buy_link": {
        const domain = String(args.domain || "").trim();
        if (!domain) throw new Error("domain is required");
        const priceUsd = typeof args.priceUsd === "number" ? args.priceUsd : undefined;
        result = {
          domain,
          buyUrl: buildBuyLink(domain, priceUsd),
          source: AGENT_SOURCE,
        };
        break;
      }

      case "generate_names":
        result = await api(
          `/api/v1/names/generate?source=${encodeURIComponent(AGENT_SOURCE)}`,
          {
            method: "POST",
            body: {
              description: args.description,
              tlds: args.tlds,
              count: args.count ?? 10,
              industry: args.industry,
            },
          },
        );
        break;

      case "check_domain":
        result = await api(
          `/api/v1/domains/check?name=${encodeURIComponent(String(args.domain))}&source=${encodeURIComponent(AGENT_SOURCE)}`,
        );
        break;

      case "buy_domain":
        result = await api("/api/v1/domains/buy", {
          method: "POST",
          body: {
            domain: args.domain,
            years: args.years ?? 1,
          },
        });
        break;

      case "list_domains":
        result = await api("/api/v1/domains/list");
        break;

      case "set_dns_record":
        result = await api(`/api/v1/domains/${encodeURIComponent(String(args.domain))}/dns`, {
          method: "POST",
          body: {
            type: args.type,
            host: args.host,
            value: args.value,
            ttl: args.ttl ?? 300,
          },
        });
        break;

      case "brand_conflict_check":
        result = await api("/api/v1/brand-conflict", {
          method: "POST",
          body: { name: args.name, context: args.context },
        });
        break;

      case "generate_logo":
        result = await api("/api/v1/logos", {
          method: "POST",
          body: {
            name: args.name,
            description: args.description,
            slogan: args.slogan,
            count: args.count ?? 4,
            preferences: args.preferences,
          },
        });
        break;

      case "generate_legal_docs":
        result = await api("/api/v1/legal", {
          method: "POST",
          body: {
            businessName: args.businessName,
            businessType: args.businessType,
            websiteUrl: args.websiteUrl,
            contactEmail: args.contactEmail,
            regions: args.regions ?? ["gdpr", "ccpa"],
          },
        });
        break;

      case "generate_brand_kit":
        result = await api("/api/v1/brand-kits", {
          method: "POST",
          body: {
            name: args.name,
            industry: args.industry,
            description: args.description,
            includeVisuals: args.includeVisuals ?? true,
          },
        });
        break;

      case "generate_social_kit":
        result = await api("/api/v1/social-kits", {
          method: "POST",
          body: {
            businessName: args.businessName,
            industry: args.industry,
            description: args.description,
            targetAudience: args.targetAudience,
            goals: args.goals ?? [],
            platforms: args.platforms ?? [],
            voiceTone: args.voiceTone ?? "professional",
          },
        });
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        { type: "text", text: JSON.stringify(result, null, 2) },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("namemyapp MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
