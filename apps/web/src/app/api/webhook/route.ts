import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/webhook
 *
 * Notion webhook endpoint — for auto-triggering promotion when
 * Human Decision changes to "Approve" in Notion without opening the UI.
 *
 * STATUS: STUB — Notion webhooks are in private beta (as of early 2026).
 * Notion has not publicly documented a stable webhook API for database property changes.
 *
 * When Notion webhooks become generally available, implement:
 * 1. Verify the request signature using WEBHOOK_SECRET
 * 2. Parse the event payload to identify which page changed
 * 3. Check if the changed property is "Human Decision" → "Approve"
 * 4. Call runPromoteWorkflow({ inbox_page_id: pageId, create_github_artifact: false })
 *
 * Alternative (available now):
 * Use a polling script that checks for newly-approved items every 60s.
 * See scripts/demo-run.ts for a manual trigger pattern.
 *
 * References:
 * - https://developers.notion.com (search "webhooks" — check current availability)
 * - https://github.com/makenotion/notion-mcp-server (for MCP-based polling alternative)
 */

export async function POST(req: NextRequest) {
  // TODO: verify WEBHOOK_SECRET when Notion webhooks become available
  // const signature = req.headers.get("x-notion-signature");
  // if (!verifySignature(signature, WEBHOOK_SECRET, await req.text())) {
  //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  // }

  const body: unknown = await req.json();
  console.log("[webhook] received event:", JSON.stringify(body, null, 2));

  // Stubbed response — return 200 so Notion doesn't retry
  return NextResponse.json({ received: true }, { status: 200 });
}
