#!/usr/bin/env node
/**
 * @yantrix/mcp — Dynamic MCP Server
 *
 * Fetches tool registry from registry.yantrix.ai on startup.
 * New APIs appear automatically — no package update needed.
 *
 * Usage:
 *   npx @yantrix/mcp
 *   X_PAYMENT_HEADER=<your-payment> npx @yantrix/mcp
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const REGISTRY_URL =
  process.env.YANTRIX_REGISTRY_URL ||
   "https://mcp-registry-production-07b3.up.railway.app/mcp-registry.json";

const X_PAYMENT_HEADER = process.env.X_PAYMENT_HEADER || "";
const DEV_MODE = process.env.DEV_MODE === "true";
const REGISTRY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegistryTool {
  name: string;
  service: string;
  endpoint: string;
  method: string;
  description: string;
  input_schema: Record<string, unknown>;
  cost_usdc: string;
  category: string;
}

interface Registry {
  version: string;
  updated_at: string;
  total_tools: number;
  payment: {
    protocol: string;
    token: string;
    network: string;
    wallet: string;
  };
  tools: RegistryTool[];
}

// ─── Registry Cache ───────────────────────────────────────────────────────────

let cachedRegistry: Registry | null = null;
let cacheTimestamp = 0;

async function fetchRegistry(): Promise<Registry> {
  const now = Date.now();
  if (cachedRegistry && now - cacheTimestamp < REGISTRY_CACHE_TTL_MS) {
    return cachedRegistry;
  }

  const response = await fetch(REGISTRY_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch registry: ${response.status}`);
  }

  cachedRegistry = (await response.json()) as Registry;
  cacheTimestamp = now;
  return cachedRegistry;
}

function registryToolToMCPTool(tool: RegistryTool): Tool {
  return {
    name: tool.name,
    description: `${tool.description} Cost: $${tool.cost_usdc} USDC. Service: ${tool.service}.`,
    inputSchema: tool.input_schema as Tool["inputSchema"],
  };
}

// ─── API Call ─────────────────────────────────────────────────────────────────

async function callTool(
  tool: RegistryTool,
  args: Record<string, unknown>
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (X_PAYMENT_HEADER) {
    headers["X-PAYMENT"] = X_PAYMENT_HEADER;
  }

  if (DEV_MODE) {
    headers["X-Dev-Mode"] = "true";
  }

  const response = await fetch(tool.endpoint, {
    method: tool.method,
    headers,
    body: JSON.stringify(args),
  });

  if (response.status === 402) {
    const detail = await response.json().catch(() => ({}));
    return {
      error: "Payment Required",
      amount_usdc: tool.cost_usdc,
      service: tool.service,
      instructions:
        "Set X_PAYMENT_HEADER env var with a valid x402 payment proof, or set DEV_MODE=true for testing.",
      detail,
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    return {
      error: `HTTP ${response.status}`,
      service: tool.service,
      detail: text,
    };
  }

  return await response.json();
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "@yantrix/mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  let registry: Registry;
  try {
    registry = await fetchRegistry();
  } catch (error) {
    console.error("[yantrix-mcp] Failed to fetch registry:", error);
    return { tools: [] };
  }

  const tools = registry.tools.map(registryToolToMCPTool);

  console.error(
    `[yantrix-mcp] Loaded ${tools.length} tools from registry v${registry.version} (updated ${registry.updated_at})`
  );

  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let registry: Registry;
  try {
    registry = await fetchRegistry();
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: "Failed to fetch tool registry", detail: String(error) }),
        },
      ],
    };
  }

  const tool = registry.tools.find((t) => t.name === name);
  if (!tool) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: `Tool '${name}' not found`,
            available_tools: registry.tools.map((t) => t.name),
          }),
        },
      ],
    };
  }

  try {
    const result = await callTool(tool, args as Record<string, unknown>);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Tool call failed",
            tool: name,
            service: tool.service,
            detail: String(error),
          }),
        },
      ],
    };
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  console.error("[yantrix-mcp] Starting dynamic MCP server...");
  console.error(`[yantrix-mcp] Registry: ${REGISTRY_URL}`);
  console.error(
    `[yantrix-mcp] Payment: ${X_PAYMENT_HEADER ? "configured" : "not set (402 errors expected)"}`
  );
  console.error(`[yantrix-mcp] Dev mode: ${DEV_MODE}`);

  // Pre-fetch registry to validate connection
  try {
    const registry = await fetchRegistry();
    console.error(
      `[yantrix-mcp] Registry loaded: ${registry.total_tools} tools available`
    );
  } catch (error) {
    console.error("[yantrix-mcp] Warning: Could not pre-fetch registry:", error);
    console.error("[yantrix-mcp] Will retry on first tool list request.");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[yantrix-mcp] MCP server running on stdio");
}

main().catch((error) => {
  console.error("[yantrix-mcp] Fatal error:", error);
  process.exit(1);
});
