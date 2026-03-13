#!/usr/bin/env tsx
/**
 * seed-notion.ts
 *
 * Seeds the NVB databases with one example inbox item and run record
 * so you can verify the schema is correct without running the full pipeline.
 *
 * Run: pnpm seed
 * (dotenv-cli injects .env before tsx runs this script)
 *
 * This script is safe to run multiple times — it always creates new pages.
 * To clean up: archive seeded items manually in Notion.
 */

import { createInboxItem } from "@nvb/notion";
import { createRunRecord } from "@nvb/notion";
import type { Verdict } from "@nvb/schema";

console.log("\n── NVB Seed Script ──────────────────────────────────────────────\n");

// ─── Seed inbox item ──────────────────────────────────────────────────────────

const seedPayload = {
  title: "[SEED] Is TypeScript worth learning in 2025?",
  raw_request:
    "I keep hearing TypeScript is essential but I've been doing fine with plain JS. Is it actually worth the added complexity for a solo dev working on small projects?",
  request_type: "question" as const,
  priority: "medium" as const,
  source_links: [],
  notes: "Seeded by scripts/seed-notion.ts",
};

console.log("Creating inbox item…");
const inboxPageId = await createInboxItem(seedPayload, "NVB-SEED001");
console.log(`  ✓ Inbox item created: ${inboxPageId}`);
console.log(`    https://www.notion.so/${inboxPageId.replace(/-/g, "")}`);

// ─── Seed verdict and run ─────────────────────────────────────────────────────

const seedVerdict: Verdict = {
  exit_status: "approve",
  unified_answer:
    "For a solo developer on small projects, TypeScript adds meaningful value even at small scale. " +
    "The primary benefit is editor autocomplete and inline error catching, which reduces debugging time. " +
    "The learning curve is approximately 1–2 weeks for a competent JS developer. " +
    "The added complexity (tsconfig, type errors at build time) is offset by reduced runtime errors " +
    "and better IDE tooling. Recommendation: adopt TypeScript for any project that will be maintained " +
    "longer than 2 weeks or shared with others. For throwaway scripts, plain JS is fine.",
  confidence: 0.82,
  disagreements: [],
  missing_evidence: [
    "Specific data on TypeScript adoption rates among solo developers",
  ],
  recommended_artifact: "summary",
  citations: [
    {
      label: "State of JS 2023 — TypeScript usage stats",
      url: "https://2023.stateofjs.com/en-US/other-tools/#javascript_flavors",
    },
  ],
  notes:
    "This is a well-studied topic with strong community consensus. Confidence is high. " +
    "The only caveat is that 'solo dev on small projects' is underspecified — scale matters.",
  generated_at: new Date().toISOString(),
  prompt_versions: {
    generator: "v1.0.0",
    auditor: "v1.0.0",
    clerk: "v1.0.0",
  },
};

console.log("Creating run record…");
const runPageId = await createRunRecord({
  inboxPageId,
  runType: "full",
  model: "gpt-4o",
  promptVersions: { generator: "v1.0.0", auditor: "v1.0.0", clerk: "v1.0.0" },
  startedAt: new Date(Date.now() - 20000).toISOString(),
  finishedAt: new Date().toISOString(),
  verdict: seedVerdict,
  notes: "context_retrieved_via: seed (no pipeline ran)",
});
console.log(`  ✓ Run record created: ${runPageId}`);
console.log(`    https://www.notion.so/${runPageId.replace(/-/g, "")}`);

console.log(`
Seed complete. Next steps:
  1. Open NVB Inbox in Notion → find "[SEED] Is TypeScript worth learning in 2025?"
  2. Set Human Decision = "Approve"
  3. Run: curl -X POST http://localhost:3000/api/promote \\
       -H "Content-Type: application/json" \\
       -d '{"inbox_page_id":"${inboxPageId}","create_github_artifact":false}'
  4. Check NVB Artifacts — a new page should appear with the verdict content.
`);
