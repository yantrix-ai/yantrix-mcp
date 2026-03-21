# @yantrix/mcp

> Dynamic MCP server for the Yantrix API portfolio. One install gives any MCP-compatible AI agent access to 30+ tools across research, memory, language, legal, security, intelligence, and more.

[![Yantrix MCP server](https://glama.ai/mcp/servers/praveen030686/yantrix-mcp/badges/card.svg)](https://glama.ai/mcp/servers/praveen030686/yantrix-mcp)

## What makes it dynamic

Unlike static MCP packages, `@yantrix/mcp` fetches its tool list from `registry.yantrix.ai` on startup. When new APIs are added to the Yantrix portfolio, they appear automatically on your next MCP host restart — no package update needed.

---

## Install

```bash
npm install -g @yantrix/mcp
```

Or use directly with npx:

```bash
npx @yantrix/mcp
```

---

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yantrix": {
      "command": "npx",
      "args": ["@yantrix/mcp"],
      "env": {
        "X_PAYMENT_HEADER": "<your-x402-payment-proof>",
        "DEV_MODE": "false"
      }
    }
  }
}
```

### Development / Testing (no payment required)

```json
{
  "mcpServers": {
    "yantrix": {
      "command": "npx",
      "args": ["@yantrix/mcp"],
      "env": {
        "DEV_MODE": "true"
      }
    }
  }
}
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `X_PAYMENT_HEADER` | x402 payment proof for USDC micropayments | — |
| `DEV_MODE` | Skip payment validation (local testing only) | `false` |
| `YANTRIX_REGISTRY_URL` | Custom registry URL | `https://registry.yantrix.ai/mcp-registry.json` |

---

## Available Tools

Tools are loaded dynamically from the registry. Current categories:

| Category | Tools |
|---|---|
| `research` | verify_claim, deep_verify_claim, batch_verify |
| `memory` | write_memory, read_memory, search_memory |
| `language` | transliterate, indic_sentiment, detect_code_switching, indic_ner |
| `legal` | scan_contract, scan_clause |
| `security` | model_threats, check_compliance |
| `intelligence` | score_trend, compare_trends, scan_competitor |
| `education` | generate_exam |
| `content` | rewrite_in_style |
| `india` | company_lookup, gst_intelligence, lookup_ifsc |
| `sales` | analyze_call, extract_crm_data |
| `utility` | validate_phone, detect_timezone, convert_timezone, find_timezone_overlap |
| `infrastructure` | check_quota, consume_quota, track_api_event |
| `reasoning` | argue_claim, detect_fallacies |

---

## Payment

All tools use [x402](https://x402.org) micropayments in USDC on Base Mainnet.

Costs range from `$0.0001` (event tracking) to `$0.025` (sales call analysis).

To get a payment header, visit [x402.org](https://x402.org) or use the x402 client SDK.

---

## How it works

```
1. npx @yantrix/mcp starts
2. Fetches https://registry.yantrix.ai/mcp-registry.json
3. Registers all tools dynamically
4. MCP host calls any tool
5. @yantrix/mcp routes call to correct Yantrix API
6. Response returned to agent
```

The registry is cached for 5 minutes. New tools appear on next restart.

---

## Adding new APIs (for maintainers)

No npm republish needed. Just update `main.py` in the `mcp-registry` service:

```python
# Add to TOOLS list in mcp-registry/main.py
{
    "name": "new_tool_name",
    "service": "newapi",
    "endpoint": "https://newapi.yantrix.ai/endpoint",
    "method": "POST",
    "description": "What this tool does.",
    "input_schema": {...},
    "cost_usdc": "0.005",
    "category": "category",
}
```

Deploy the registry → all users get the new tool on next restart.

---

## Links

- Registry: https://registry.yantrix.ai
- Docs: https://yantrix.ai
- x402: https://x402.org