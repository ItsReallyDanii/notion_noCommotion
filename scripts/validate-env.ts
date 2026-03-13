#!/usr/bin/env tsx
/**
 * validate-env.ts
 *
 * Validates that all required environment variables are set and
 * that the Notion databases are accessible with the configured token.
 *
 * Run: pnpm validate-env
 * (dotenv-cli injects .env before tsx runs this script)
 */

import { Client } from "@notionhq/client";

const REQUIRED = [
  "NOTION_TOKEN",
  "NOTION_DB_INBOX",
  "NOTION_DB_EVIDENCE",
  "NOTION_DB_RUNS",
  "NOTION_DB_ARTIFACTS",
] as const;

// ANTHROPIC_API_KEY is intentionally excluded.
// packages/llm/src/client.ts throws if only ANTHROPIC_API_KEY is set —
// native Anthropic support is not implemented. Use OPENROUTER_API_KEY
// with model=anthropic/claude-3-5-sonnet instead.
const REQUIRED_LLM_ONE_OF = [
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
];

console.log("\n── Notion Verdict Board: Environment Validation ─────────────────\n");

let hasErrors = false;

// Check required vars
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`  ✗ MISSING: ${key}`);
    hasErrors = true;
  } else {
    const val = process.env[key]!;
    const masked =
      val.length > 8 ? val.slice(0, 4) + "…" + val.slice(-4) : "***";
    console.log(`  ✓ ${key} = ${masked}`);
  }
}

// Check at least one LLM key
const hasLLM = REQUIRED_LLM_ONE_OF.some((k) => !!process.env[k]);
if (!hasLLM) {
  console.error(
    `  ✗ MISSING: At least one of ${REQUIRED_LLM_ONE_OF.join(", ")} must be set`
  );
  console.error(
    "    Note: ANTHROPIC_API_KEY alone will not work — native Anthropic support is not implemented."
  );
  console.error(
    "    To use Claude: set OPENROUTER_API_KEY and LLM_GENERATOR_MODEL=anthropic/claude-3-5-sonnet"
  );
  hasErrors = true;
} else {
  const found = REQUIRED_LLM_ONE_OF.find((k) => !!process.env[k])!;
  console.log(`  ✓ LLM provider: ${found}`);
}

// Check MCP (optional but noteworthy)
if (process.env["MCP_SERVER_URL"]) {
  console.log(`  ✓ MCP_SERVER_URL = ${process.env["MCP_SERVER_URL"]} (MCP mode active)`);
} else {
  console.log(`  ℹ MCP_SERVER_URL not set — context retrieval will use direct Notion API`);
  console.log(`    To enable MCP mode: start the server and set MCP_SERVER_URL in .env`);
}

if (hasErrors) {
  console.error("\n  Validation failed. Copy .env.example to .env and fill in missing values.\n");
  process.exit(1);
}

// Verify Notion access
console.log("\n── Verifying Notion access ──────────────────────────────────────\n");

const notion = new Client({
  auth: process.env["NOTION_TOKEN"]!,
  notionVersion: "2022-06-28",
});

const dbEnvKeys = [
  "NOTION_DB_INBOX",
  "NOTION_DB_EVIDENCE",
  "NOTION_DB_RUNS",
  "NOTION_DB_ARTIFACTS",
] as const;

for (const key of dbEnvKeys) {
  const dbId = process.env[key]!.replace(/-/g, "");
  try {
    const db = await notion.databases.retrieve({ database_id: dbId });
    const name =
      "title" in db ? db.title.map((t) => t.plain_text).join("") : "(untitled)";
    console.log(`  ✓ ${key}: "${name}"`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${key} (${dbId}): ${msg}`);
    console.error(
      `    Make sure the integration is connected to this database in Notion.`
    );
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error("\n  Database access check failed.\n");
  process.exit(1);
} else {
  console.log("\n  All checks passed. Ready to run.\n");
}
