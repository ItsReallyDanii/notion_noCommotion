# NVB Build Order (3-Day MVP Sprint)

Risk levels: 🔴 High · 🟡 Medium · 🟢 Low

---

## Day 1 — Repo + Schema + Notion + UI Shell

**Goal:** Repo runs locally. Notion databases are live. `pnpm seed` works. `pnpm dev` starts.

### Block 1.1 — Repo bootstrap (45 min)
- [ ] `git init notion-verdict-board`
- [ ] Copy all files from this scaffold into the repo
- [ ] `pnpm install`
- [ ] Verify `turbo build` passes (no TS errors in packages/schema)
- **Done:** `turbo build` exits 0, `@nvb/schema` compiles cleanly

### Block 1.2 — Notion database setup (60 min) 🟡
- [ ] Open Notion → create a new page called "NVB Workspace"
- [ ] Create 4 databases inside it (full-page views) using exact schema from `docs/notion-schema.md`
  - NVB Inbox: add every property in exact order
  - NVB Evidence: add every property
  - NVB Runs: add every property
  - NVB Artifacts: add every property
- [ ] Create internal integration at https://www.notion.so/profile/integrations
  - Name: "NVB Integration"
  - Capabilities: Read content, Update content, Insert content
- [ ] Connect integration to all 4 databases
- [ ] Copy 4 database IDs to `.env` (from database URLs)
- **Done:** `pnpm validate-env` passes all checks, prints ✓ for all 4 databases

**Risk:** Property type mismatches break the adapter. Use `docs/notion-schema.md` exactly.
**If blocked:** The Status property must be "status" type (not "select") — this is a Notion-specific type with built-in workflow grouping.

### Block 1.3 — LLM key + seed (30 min) 🟢
- [ ] Set `OPENAI_API_KEY` (or `OPENROUTER_API_KEY`) in `.env`
- [ ] Run `pnpm seed`
- [ ] Verify seed item appears in NVB Inbox and NVB Runs in Notion
- **Done:** Two pages appear in Notion with correct properties

### Block 1.4 — Next.js dev start (30 min) 🟢
- [ ] `cd apps/web && pnpm dev`
- [ ] Visit http://localhost:3000 — submit form renders
- [ ] Visit http://localhost:3000/board — board renders (may show empty state)
- **Done:** Both pages load without runtime errors

---

## Day 2 — Verdict Pipeline + Notion Writes + Demo Flow

**Goal:** Full end-to-end pipeline runs. `pnpm demo` produces a verdict in Notion.

### Block 2.1 — Build packages (60 min) 🟡
- [ ] `turbo build` — all packages compile
- [ ] Fix any import errors (workspace protocol issues, NodeNext module resolution)
- [ ] Add `nanoid` to `packages/workflows` dependencies: `pnpm --filter @nvb/workflows add nanoid`
- **Done:** All packages build, no TS errors

### Block 2.2 — Pipeline dry run (60 min) 🔴
- [ ] Run `pnpm demo`
- [ ] Watch for errors in each stage: intake → generator → auditor → clerk
- **Common errors:**
  - LLM returns valid JSON but fails Zod parse → check prompt output format
  - `NOTION_DB_RUNS` property name mismatch → compare against notion-properties.ts
  - `nanoid` import fails → check module type in workflows package.json
- [ ] Fix any runtime errors before proceeding
- **Done:** `pnpm demo` prints final verdict without errors, page appears in NVB Inbox + NVB Runs

### Block 2.3 — API routes test (45 min) 🟡
- [ ] POST /api/intake with curl: `curl -X POST http://localhost:3000/api/intake -H "Content-Type: application/json" -d '{"title":"test","raw_request":"Is React still worth learning?","request_type":"question","priority":"medium"}'`
- [ ] Verify new page in NVB Inbox
- [ ] POST /api/run with the returned `inboxPageId`
- [ ] Verify run completes and NVB Runs has a new page
- **Done:** Two API calls work, Notion has the correct pages

### Block 2.4 — Board page (30 min) 🟢
- [ ] Visit /board — items show up after pipeline runs
- [ ] Verify confidence score displays correctly
- **Done:** Board shows awaiting-review items

---

## Day 3 — Human Loop + Promotion + Polish + Demo Screenshot

**Goal:** Full happy path: submit → verdict → Notion review → promote → artifact page.

### Block 3.1 — Human approval + promotion (60 min) 🟡
- [ ] Open NVB Inbox in Notion → find a queued item
- [ ] Set `Human Decision = Approve`
- [ ] POST /api/promote: `curl -X POST http://localhost:3000/api/promote -H "Content-Type: application/json" -d '{"inbox_page_id":"PAGE_ID","create_github_artifact":false}'`
- [ ] Verify NVB Artifacts has a new page with content blocks
- [ ] Verify NVB Inbox item status = "Promoted" and Final Artifact is linked
- **Done:** Full loop closed in Notion

### Block 3.2 — UI promote button (30 min) 🟢
- [ ] Test the "Promote →" button on /board
- [ ] Verify redirect back to /board after promotion
- [ ] Add "promoted" success banner if `?promoted=` query param is present
- **Done:** Board promote button works end-to-end

### Block 3.3 — Polish for demo (60 min) 🟢
- [ ] Submit form: add loading state, disable double-submit
- [ ] Board: show confidence color coding (green/yellow/red)
- [ ] Take screenshot sequence for DEV.to post or challenge submission:
  1. Submit form filled out
  2. NVB Inbox in Notion (Awaiting Review status)
  3. NVB Runs page with verdict JSON
  4. Human Decision dropdown in Notion
  5. NVB Artifacts page with promoted content
  6. Board view

### Block 3.4 — README + submission (30 min) 🟢
- [ ] Verify README has working setup instructions
- [ ] Push to GitHub
- [ ] Record 90-second demo video (optional but recommended for challenge)
- **Done:** Repo is public, README is accurate, demo path works

---

## Dependency order summary

```
Block 1.1 (repo) → Block 1.2 (Notion setup) → Block 1.3 (seed) → Block 1.4 (dev start)
                                                     ↓
Block 2.1 (build) → Block 2.2 (pipeline) → Block 2.3 (API routes) → Block 2.4 (board)
                                                     ↓
Block 3.1 (approval) → Block 3.2 (UI) → Block 3.3 (polish) → Block 3.4 (submit)
```

---

## Where risk is highest

1. **Notion property type mismatches** — The `status` property type is different from `select`. If you create the Status field as `select`, the API writes will fail with a type error. Double-check each field type against `notion-schema.md`.

2. **LLM Zod parse failures** — LLMs sometimes return JSON that's almost right but fails Zod's strict parsing. The most common failure: missing required fields, numeric values as strings. If this happens, log the raw LLM output and fix the schema match.

3. **Notion API Rich Text 2000-char limit** — All rich_text properties cap at 2000 chars. Long requests or verdicts will silently truncate. The code handles this by writing overflow to page body blocks. Make sure this doesn't break the promote workflow's JSON parse of Raw JSON.

4. **nanoid ESM/CJS conflict** — nanoid v5+ is ESM-only. If you see `require() of ES Module` errors, add `"type": "module"` to the workflows package or use `nanoid/non-secure` with a compatible version.
