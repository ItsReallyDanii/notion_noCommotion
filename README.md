# Notion Verdict Board

A human-in-the-loop verdict system for uncertain AI outputs, backed by Notion as the control plane.

Requests enter a Notion inbox, pass through a three-pass LLM pipeline (generator → auditor → clerk), and land as structured verdicts waiting for human review. You approve, revise, or reject in Notion. Approved items are promoted into full artifact pages.

**Notion MCP is a runtime component** — not just dev tooling. The verdict pipeline uses the Notion MCP server for context retrieval when `MCP_SERVER_URL` is set, making Notion a live knowledge base for the generator.

---

## How it works

```
User submits request
      ↓
NVB Inbox (Notion) — Status: Queued
      ↓
Verdict pipeline:
  Context retrieval  ← FallbackContextProvider (if MCP_SERVER_URL set)
                         |- MCPContextProvider (MCP server, attempted first)
                         |- DirectContextProvider (direct API, on MCP failure)
                       DirectContextProvider (if MCP_SERVER_URL not set)
  Generator          → drafts answer with Notion context
  Auditor            → flags unsupported claims
  Clerk              → synthesizes structured verdict
      ↓
NVB Inbox — Status: Awaiting Review
NVB Runs  — full verdict JSON + retrieved_via log
      ↓
Human sets Human Decision = Approve / Revise / Reject in Notion
      ↓ (on Approve)
NVB Artifacts — promoted artifact page with structured content
NVB Inbox  — Status: Promoted
```

---

## Repo structure

```
notion-verdict-board/
├── .env.example
├── .mcp.json                   ← MCP server config for Cursor/Claude Desktop
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
│
├── apps/web/                   ← Next.js app (submit form + board + API routes)
│   └── src/app/
│       ├── page.tsx            ← Submit form
│       ├── board/page.tsx      ← Review board (server component)
│       └── api/
│           ├── intake/         ← POST: create inbox item
│           ├── run/            ← POST: run verdict pipeline
│           ├── promote/        ← POST: promote to artifact
│           └── webhook/        ← POST: stubbed (Notion webhooks not GA)
│
├── packages/
│   ├── schema/    ← Zod schemas: Verdict, IntakePayload, DB property constants
│   ├── notion/    ← Notion adapter: inbox, runs, artifacts, evidence
│   ├── mcp/       ← Context providers: MCPContextProvider + DirectContextProvider
│   ├── llm/       ← LLM client: OpenAI/OpenRouter, callLLM, callLLMJson
│   ├── prompts/   ← Versioned prompts: generator, auditor, clerk
│   ├── workflows/ ← Pipeline logic: intake, verdict, promote
│   └── github/    ← GitHub issue creation (optional, stubbed)
│
└── scripts/
    ├── validate-env.ts   ← Check env vars + Notion DB access
    ├── seed-notion.ts    ← Create test inbox item + run record
    └── demo-run.ts       ← Full CLI pipeline (no UI)
```

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/your-org/notion-verdict-board.git
cd notion-verdict-board
pnpm install
```

### 2. Set up Notion databases

Create 4 databases in Notion following `docs/notion-schema.md` exactly:
- NVB Inbox
- NVB Evidence
- NVB Runs
- NVB Artifacts

Create an internal integration at https://www.notion.so/profile/integrations and connect it to all 4 databases.

### 3. Configure environment

```bash
cp .env.example .env
# Fill in: NOTION_TOKEN, 4 database IDs, OPENAI_API_KEY (or OPENROUTER_API_KEY)
```

### 4. Validate setup

```bash
pnpm validate-env
```

All checks must show ✓. If any fail, the error message tells you exactly what to fix.

### 5. Seed test data

```bash
pnpm seed
```

Verify a test inbox item appears in NVB Inbox and NVB Runs in Notion.

### 6. Run the demo (without UI)

```bash
# Intake + verdict only
pnpm demo

# Full loop: intake + verdict + promote to artifact
pnpm demo --promote
```

### 7. Start the web app

```bash
pnpm dev
```

- Submit form: http://localhost:3000
- Review board: http://localhost:3000/board

---

## Enabling MCP at runtime

By default the pipeline uses the direct Notion API for context retrieval.
To activate the Notion MCP server as the runtime context provider:

```bash
# 1. Start the MCP server on HTTP transport (in a separate terminal)
npx @notionhq/notion-mcp-server --transport http --port 3001

# 2. Add to .env
MCP_SERVER_URL=http://localhost:3001

# 3. Run the demo — it will use MCP for context retrieval
pnpm demo
```

When active you'll see: `[MCP] Connected. Available tools: ...` in the output.

The `retrieved_via` field is stored in the NVB Runs record with one of three values:
- `mcp` — MCP server connected and returned results
- `direct` — MCP_SERVER_URL was not set; direct Notion API ran
- `mcp_fallback_to_direct` — MCP_SERVER_URL was set but MCP failed; direct API ran as fallback

MCP retrieval is a workspace search returning page titles and URLs (up to 5 pages).
Page body content is not fetched.

---

## Editor MCP setup (dev tooling)

Copy `.mcp.json` → `.cursor/mcp.json` (Cursor) or your Claude Desktop config, then replace `YOUR_NOTION_TOKEN`:

```json
{
  "mcpServers": {
    "notion-verdict-board": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": { "NOTION_TOKEN": "your-token-here" }
    }
  }
}
```

This lets your AI editor browse NVB databases interactively via STDIO transport. Separate from the runtime HTTP transport.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NOTION_TOKEN` | Yes | Internal integration token (`ntn_...`) |
| `NOTION_DB_INBOX` | Yes | NVB Inbox database ID |
| `NOTION_DB_EVIDENCE` | Yes | NVB Evidence database ID |
| `NOTION_DB_RUNS` | Yes | NVB Runs database ID |
| `NOTION_DB_ARTIFACTS` | Yes | NVB Artifacts database ID |
| `OPENAI_API_KEY` | One of these | LLM provider |
| `OPENROUTER_API_KEY` | One of these | Multi-model proxy |
| `LLM_GENERATOR_MODEL` | No | Default: `gpt-4o` |
| `LLM_AUDITOR_MODEL` | No | Default: `gpt-4o` |
| `LLM_CLERK_MODEL` | No | Default: `gpt-4o-mini` |
| `MCP_SERVER_URL` | No | Activates MCP context provider (e.g. `http://localhost:3001`) |
| `MCP_AUTH_TOKEN` | No | Bearer token if MCP server uses `--auth-token` |
| `GITHUB_TOKEN` | No | For GitHub artifact creation |
| `GITHUB_OWNER` | No | GitHub org/user |
| `GITHUB_REPO` | No | Target repo |

---

## API

### POST /api/intake
Create an inbox item (no pipeline).
```json
{ "title": "...", "raw_request": "...", "request_type": "question", "priority": "medium" }
```
Returns: `{ inboxPageId, requestId }`

### POST /api/run
Run the verdict pipeline for an existing inbox item.
```json
{ "inbox_page_id": "...", "raw_request": "...", "request_type": "...", "source_links": [] }
```
Returns: `{ verdict, runPageId, retrievedVia }`

### POST /api/promote
Promote an approved inbox item to an artifact. Requires Human Decision = "Approve" in Notion.
```json
{ "inbox_page_id": "...", "create_github_artifact": false }
```
Returns: `{ artifactPageId, notionUrl, githubUrl }`

---

## Docs

- [`docs/architecture.md`](docs/architecture.md) — Full architecture including MCP runtime model
- [`docs/notion-schema.md`](docs/notion-schema.md) — Exact database schemas
- [`docs/build-order.md`](docs/build-order.md) — 3-day build plan
- [`docs/demo-walkthrough.md`](docs/demo-walkthrough.md) — Challenge demo script

---

## Known limitations (honest)

- Notion webhooks are in private beta — the `/api/webhook` route is stubbed
- Pipeline runs synchronously in the HTTP request — ~15–45s, will timeout on Vercel Hobby
- MCP tool names vary by `@notionhq/notion-mcp-server` version — `MCPContextProvider` tries `notion_post_v1_search`, `API-post-search`, `search` in order and logs available tools on connect. If none match, it throws, and `FallbackContextProvider` catches the error and uses the direct path.
- No pagination on board view (first 100 items)
- GitHub file artifact creation is TODO — issue creation works

---

Built for the Notion MCP Challenge.
