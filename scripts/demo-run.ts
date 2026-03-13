#!/usr/bin/env tsx
/**
 * demo-run.ts
 *
 * End-to-end demo runner for the happy path.
 * Runs the full pipeline locally without the web UI.
 *
 * Run: pnpm demo
 * Run: pnpm demo --promote    (also promotes to artifact)
 *
 * (dotenv-cli injects .env before tsx runs this script)
 *
 * MCP mode:
 *   If MCP_SERVER_URL is set in .env, context retrieval uses the Notion MCP server.
 *   Start the server first: npx @notionhq/notion-mcp-server --transport http --port 3001
 *   Then set: MCP_SERVER_URL=http://localhost:3001 in .env
 */

import { runIntake } from "@nvb/workflows";
import { runVerdictWorkflow } from "@nvb/workflows";
import { runPromoteWorkflow } from "@nvb/workflows";
import { getNotionClient } from "@nvb/notion";
import { INBOX_PROPS, HUMAN_DECISION_VALUES } from "@nvb/schema";

const shouldPromote = process.argv.includes("--promote");

const DEMO_REQUEST = {
  title: "Should I use Zod or Yup for runtime validation in a new TypeScript project?",
  raw_request: `I'm starting a new TypeScript monorepo and need to pick a validation library.
I've used Yup before but heard Zod is better for TypeScript. What are the actual tradeoffs?
Consider: bundle size, TypeScript inference quality, error messages, ecosystem support,
and migration complexity if I start with one and want to switch.`,
  request_type: "question" as const,
  priority: "medium" as const,
  source_links: ["https://zod.dev", "https://github.com/jquense/yup"],
  notes: "Demo run via scripts/demo-run.ts",
};

const mcpMode = !!process.env["MCP_SERVER_URL"];

console.log("\n╔═══════════════════════════════════════════════════════════╗");
console.log("║         Notion Verdict Board — Demo Run                   ║");
console.log(`║         Context mode: ${mcpMode ? "MCP (Notion MCP server)      " : "Direct (Notion API)          "} ║`);
console.log("╚═══════════════════════════════════════════════════════════╝\n");

if (mcpMode) {
  console.log(`  MCP server: ${process.env["MCP_SERVER_URL"]}`);
  console.log("  The verdict pipeline will use Notion MCP for context retrieval.\n");
} else {
  console.log("  MCP_SERVER_URL not set — using direct Notion API for context retrieval.");
  console.log("  To enable MCP mode: set MCP_SERVER_URL=http://localhost:3001 in .env\n");
}

// ─── Step 1: Intake ───────────────────────────────────────────────────────────

console.log("▶ Step 1: Intake");
const { inboxPageId, requestId } = await runIntake(DEMO_REQUEST);
console.log(`  Request ID: ${requestId}`);
console.log(`  Inbox page: https://www.notion.so/${inboxPageId.replace(/-/g, "")}`);

// ─── Step 2: Verdict pipeline ─────────────────────────────────────────────────

console.log("\n▶ Step 2: Verdict pipeline (context → generator → auditor → clerk)");
console.log("  This takes ~20–45 seconds depending on LLM latency…\n");

const { verdict, runPageId, retrievedVia } = await runVerdictWorkflow({
  inboxPageId,
  rawRequest: DEMO_REQUEST.raw_request,
  requestType: DEMO_REQUEST.request_type,
  sourceLinks: DEMO_REQUEST.source_links,
});

const retrievedViaLabel: Record<string, string> = {
  mcp: "mcp (Notion MCP server)",
  direct: "direct (Notion API)",
  mcp_fallback_to_direct: "mcp_fallback_to_direct (MCP attempted, fell back to direct API)",
};
console.log(`  Context via:   ${retrievedViaLabel[retrievedVia] ?? retrievedVia}`);
console.log(`  Exit status:   ${verdict.exit_status}`);
console.log(`  Confidence:    ${(verdict.confidence * 100).toFixed(0)}%`);
console.log(`  Artifact type: ${verdict.recommended_artifact}`);
console.log(`  Run page:      https://www.notion.so/${runPageId.replace(/-/g, "")}`);
console.log(`\n  Unified answer (first 400 chars):`);
console.log(`  "${verdict.unified_answer.slice(0, 400)}…"`);

if (verdict.disagreements.length > 0) {
  console.log(`\n  Disagreements flagged: ${verdict.disagreements.length}`);
  for (const d of verdict.disagreements) {
    console.log(`    [${d.severity}] ${d.claim}`);
  }
}

if (verdict.missing_evidence.length > 0) {
  console.log(`\n  Missing evidence:`);
  for (const m of verdict.missing_evidence) {
    console.log(`    - ${m}`);
  }
}

// ─── Step 3: Promote (optional) ───────────────────────────────────────────────

if (shouldPromote) {
  console.log("\n▶ Step 3: Promote to artifact");
  console.log("  Setting Human Decision = Approve in Notion…");

  const notion = getNotionClient();
  await notion.pages.update({
    page_id: inboxPageId,
    properties: {
      [INBOX_PROPS.HUMAN_DECISION]: {
        select: { name: HUMAN_DECISION_VALUES.APPROVE },
      },
    },
  });

  const { artifactPageId, notionUrl } = await runPromoteWorkflow({
    inbox_page_id: inboxPageId,
    create_github_artifact: false,
  });

  console.log(`  ✓ Artifact created!`);
  console.log(`  Artifact ID:  ${artifactPageId}`);
  console.log(`  Notion URL:   ${notionUrl}`);
} else {
  console.log("\n  To promote this item manually:");
  console.log("    1. Open the inbox item in Notion, set Human Decision = Approve");
  console.log(`    2. POST http://localhost:3000/api/promote`);
  console.log(`       Body: { "inbox_page_id": "${inboxPageId}", "create_github_artifact": false }`);
  console.log("\n  Or run `pnpm demo --promote` for a fresh end-to-end run (new item + promote).");
}

console.log("\n╔═══════════════════════════════════════════════════════════╗");
console.log("║         Demo complete.                                    ║");
console.log("╚═══════════════════════════════════════════════════════════╝\n");
