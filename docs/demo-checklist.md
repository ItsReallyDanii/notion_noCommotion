# NVB Demo Checklist — Proof of Runtime Modes

Exact commands and expected output for proving all three `retrieved_via` values in the Run record.

---

## Prerequisites (all modes)

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and fill in .env
cp .env.example .env
# Required: NOTION_TOKEN, NOTION_DB_INBOX, NOTION_DB_EVIDENCE, NOTION_DB_RUNS, NOTION_DB_ARTIFACTS
# Required: OPENAI_API_KEY or OPENROUTER_API_KEY

# 3. Validate setup (all checks must show ✓)
pnpm validate-env
```

---

## Mode 1: Direct

**What it proves:** `retrieved_via = "direct"` — context retrieval used the Notion API directly; no MCP server was attempted.

**Setup:** `MCP_SERVER_URL` must be unset (blank or absent in `.env`).

```bash
# Confirm MCP_SERVER_URL is not set
grep MCP_SERVER_URL .env
# Expected: MCP_SERVER_URL=   (blank)

# Run the demo
pnpm demo
```

**Expected output (key lines):**

```
║  Context mode: Direct (Notion API)           ║
[context] MCP_SERVER_URL not set — using direct Notion API provider
  Context via:   direct (Notion API)
```

**Verify in Notion:**

Open NVB Runs → find the new run record. The Notes field contains:

```
retrieved_via: direct
```

**Proof confirmed:** `retrieved_via = "direct"` ✓

---

## Mode 2: MCP

**What it proves:** `retrieved_via = "mcp"` — the Notion MCP server connected successfully and returned search results (page titles and URLs, up to 5 pages).

**Setup:**

```bash
# Terminal 1: Start the MCP server on HTTP transport
npx @notionhq/notion-mcp-server --transport http --port 3001

# In .env, set:
MCP_SERVER_URL=http://localhost:3001
```

```bash
# Terminal 2: Run the demo
pnpm demo
```

**Expected output (key lines):**

```
║  Context mode: MCP (Notion MCP server)       ║
[context] MCP_SERVER_URL set — attempting MCPContextProvider at http://localhost:3001
[MCP] Connected. Available tools: API-post-search, ...
  Context via:   mcp (Notion MCP server)
```

**Note:** MCP retrieval is workspace search returning page titles and URLs only. Page body content is not fetched. The generator receives titles and URLs as its context window.

**Verify in Notion:**

Open NVB Runs → find the new run record. The Notes field contains:

```
retrieved_via: mcp
```

**Proof confirmed:** `retrieved_via = "mcp"` ✓

---

## Mode 3: mcp_fallback_to_direct

**What it proves:** `retrieved_via = "mcp_fallback_to_direct"` — `MCP_SERVER_URL` was set, but the server was unreachable; the pipeline automatically fell back to the direct Notion API.

**Setup:** Set `MCP_SERVER_URL` to an unreachable address. Do NOT start the MCP server.

```bash
# In .env, set a bad URL (no server running at this port):
MCP_SERVER_URL=http://localhost:9999
```

```bash
# Run the demo (no MCP server running)
pnpm demo
```

**Expected output (key lines):**

```
║  Context mode: MCP (Notion MCP server)       ║
[context] MCP_SERVER_URL set — attempting MCPContextProvider at http://localhost:9999
[context] MCPContextProvider failed: ...
[context] Falling back to DirectContextProvider. Run record will show retrievedVia=mcp_fallback_to_direct.
  Context via:   mcp_fallback_to_direct (MCP attempted, fell back to direct API)
```

**Verify in Notion:**

Open NVB Runs → find the new run record. The Notes field contains:

```
retrieved_via: mcp_fallback_to_direct
```

**Proof confirmed:** `retrieved_via = "mcp_fallback_to_direct"` ✓

---

## Summary

| Mode | `MCP_SERVER_URL` | MCP server running | `retrieved_via` |
|---|---|---|---|
| direct | unset | — | `"direct"` |
| mcp | `http://localhost:3001` | yes | `"mcp"` |
| mcp_fallback_to_direct | `http://localhost:9999` | no | `"mcp_fallback_to_direct"` |

All three values are stored in the NVB Runs record (Notes field) after each pipeline run, providing a machine-readable audit trail of which context path actually executed.
