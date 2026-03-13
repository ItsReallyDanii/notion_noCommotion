# NVB Architecture

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript | Strong typing, Zod integration, good ecosystem |
| Monorepo | pnpm workspaces + Turbo | Fast installs, proper build caching |
| Frontend | Next.js 14 (App Router) | Server components for Notion reads, API routes for pipeline triggers |
| Styling | Tailwind CSS | Fast to iterate, no runtime overhead |
| Schema/validation | Zod | Runtime validation of all LLM outputs and API payloads |
| Notion (writes) | @notionhq/client (direct API) | Deterministic, typed, validated — required for state machine operations |
| Notion (reads) | @nvb/mcp — runtime context provider | **MCP is the preferred context retrieval path at runtime** |
| Notion MCP server | @notionhq/notion-mcp-server | Runs on HTTP transport; used for workspace search during verdict pipeline |
| MCP client | @modelcontextprotocol/sdk | Connects to the MCP server from within the verdict workflow |
| LLM | OpenAI SDK (provider-agnostic) | OpenRouter as fallback for multi-model support |
| GitHub | @octokit/rest | Optional artifact creation (stubbed) |

---

## Notion MCP: runtime architecture

This is the core architectural claim of NVB. Notion MCP is **not** just dev tooling here — it is wired into the verdict pipeline as the preferred context retrieval layer.

### How it works

```
Verdict pipeline step 2: context retrieval
                |
                v
       resolveContextProvider()
                |
                |-- MCP_SERVER_URL not set?
                |         |
                |         YES --> DirectContextProvider
                |                     |
                |                     +- queries NVB Evidence DB via @notionhq/client
                |                     +- returns evidence items linked to inbox item
                |                     +- retrievedVia = "direct"
                |
                +-- MCP_SERVER_URL is set --> FallbackContextProvider
                          |
                          +- tries MCPContextProvider first
                          |       |
                          |       +- connects via Streamable HTTP transport
                          |       +- calls search tool (notion_post_v1_search, etc.)
                          |       +- returns page titles + URLs (up to 5 pages)
                          |       +- retrievedVia = "mcp"
                          |
                          +- if MCPContextProvider throws:
                                  |
                                  +- logs warning
                                  +- retries with DirectContextProvider
                                  +- retrievedVia = "mcp_fallback_to_direct"
```

The verdict workflow (`packages/workflows/src/verdict.ts`) calls `resolveContextProvider()` and receives a `ContextProvider` — it does not care which implementation runs. The `retrieved_via` field in the Run record logs which path executed.

### What MCP provides in this context (accurately)

When `MCPContextProvider` runs:
1. The pipeline calls the MCP server's search tool with the user's raw request text
2. The server queries the Notion workspace for related pages
3. Search results (page titles and URLs, up to 5 pages) are formatted into the generator's context window
4. The generator can see page titles and URLs from the broader workspace

What it does **not** do: page body content is not fetched. No block children calls are made. The generator receives titles and URLs only.

For comparison, `DirectContextProvider` queries the NVB Evidence database directly and returns title, excerpt, and source URL for evidence items linked to the current inbox item.

Both providers return the same `NotionContext` interface. The verdict workflow does not distinguish between them at the prompt-injection step.

### Explicit: what each layer handles

| Operation | Layer | Why |
|---|---|---|
| Intake: create inbox item | Direct API | Must be deterministic, typed, idempotent |
| Context retrieval for generator | **MCP (preferred) / Direct fallback** | Workspace search is the MCP sweet spot |
| LLM calls (generator, auditor, clerk) | @nvb/llm | Not Notion-related |
| Write run record | Direct API | Structured write with typed properties |
| Write artifact page + block content | Direct API | Content structure must be exact |
| Status transitions (Running → Awaiting Review → Promoted) | Direct API | State machine, must be reliable |
| Board UI: query awaiting review | Direct API | Paginated, filtered query |
| Developer exploration of NVB databases | MCP (STDIO transport via editor) | Interactive, no code needed |

### Why not MCP for writes?

The MCP server exposes tools derived from the Notion API, but it's designed for interactive agent use. For deterministic state machine transitions and typed property writes (status, relations, numbers, dates), direct API calls via `@notionhq/client` are more reliable and easier to validate with Zod.

---

## Data flow

```
[User] → POST /api/intake
           │
           ▼
     runIntake()
           │ → creates NVB Inbox page (Status: Queued)
           ▼
     POST /api/run
           │
           ▼
     runVerdictWorkflow()
           │
           ├─ 1. updateInboxStatus(Running)        [direct API]
           │
           |- 2. resolveContextProvider().retrieve()
           |         -> FallbackContextProvider     [if MCP_SERVER_URL set]
           |               -> MCPContextProvider    [MCP server, attempted first]
           |               -> DirectContextProvider [direct API, on MCP failure]
           |         -> DirectContextProvider       [direct API, if MCP_SERVER_URL not set]
           │
           ├─ 3. callLLM(generator prompt)         [LLM]
           ├─ 4. callLLM(auditor prompt)            [LLM]
           ├─ 5. callLLM(clerk prompt)              [LLM]
           │
           ├─ 6. createRunRecord()                 [direct API → NVB Runs]
           └─ 7. updateInboxWithVerdict()           [direct API → NVB Inbox: Awaiting Review]

[Human] → opens NVB Inbox in Notion
           └─ sets Human Decision = Approve / Revise / Reject / Needs Evidence

[Human or UI] → POST /api/promote
           │
           ▼
     runPromoteWorkflow()
           │
           ├─ 1. getHumanDecision()               [direct API — confirms "approve"]
           ├─ 2. reads verdict from NVB Runs page [direct API]
           ├─ 3. createArtifactPage() + blocks     [direct API → NVB Artifacts]
           └─ 4. linkArtifactToInbox()             [direct API → NVB Inbox: Promoted]
```

---

## Package dependency graph

```
@nvb/schema        (no internal deps)
    │
    ├── @nvb/notion      (schema + @notionhq/client)
    ├── @nvb/llm         (schema + openai)
    ├── @nvb/prompts     (schema)
    └── @nvb/mcp         (schema + @notionhq/client + @modelcontextprotocol/sdk)
           │
           └── @nvb/workflows  (notion + llm + prompts + mcp + schema)
                      │
                      └── @nvb/web  (workflows + notion + mcp + schema)

@nvb/github  (schema + @octokit/rest — optional, not imported by default)
```

---

## MCP server setup (for runtime mode)

The official `@notionhq/notion-mcp-server` supports an HTTP transport mode that lets the workflow code connect to it programmatically:

```bash
# Start the MCP server on HTTP transport
npx @notionhq/notion-mcp-server --transport http --port 3001
```

Then in `.env`:
```
MCP_SERVER_URL=http://localhost:3001
```

When `MCP_SERVER_URL` is set, `resolveContextProvider()` returns a `FallbackContextProvider` that wraps `MCPContextProvider` as the primary and `DirectContextProvider` as the safety net. At runtime:
- MCP succeeds: `retrievedVia = "mcp"`
- MCP fails (server down, tool missing, network error): falls back to direct API, `retrievedVia = "mcp_fallback_to_direct"`
- `MCP_SERVER_URL` not set: direct API only, `retrievedVia = "direct"`

**Tool name note:** The official server version 2.x exposes tools via OpenAPI path naming. Run `pnpm demo` with `MCP_SERVER_URL` set and watch the `[MCP] Connected. Available tools:` log line to see the exact tool names on your version. `MCPContextProvider` tries common name patterns (`notion_post_v1_search`, `API-post-search`, `search`) and throws if none match, allowing `FallbackContextProvider` to catch the error and use the direct path.

---

## Editor MCP setup (dev tooling)

Copy `.mcp.json` to `.cursor/mcp.json` (Cursor) or the Claude Desktop config to browse NVB databases from your editor:

```json
{
  "mcpServers": {
    "notion-verdict-board": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": { "NOTION_TOKEN": "your-token" }
    }
  }
}
```

This is separate from the runtime MCP mode. Editor MCP uses STDIO transport. Runtime MCP uses HTTP transport.

---

## What is not built

- Notion webhook handler (Notion webhooks in private beta as of March 2026 — stubbed)
- Background job queue for pipeline runs (runs synchronously in HTTP request)
- Native Anthropic SDK (use OpenRouter as proxy)
- GitHub file artifact (issue creation is implemented, file upload is TODO)
- Streaming progress to the UI
- Pagination on board view (returns first 100 results)
- Full MCP search pagination (returns first 5 pages — sufficient for demo)
