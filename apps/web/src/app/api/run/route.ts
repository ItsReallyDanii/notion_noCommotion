import { NextRequest, NextResponse } from "next/server";
import { runVerdictWorkflow } from "@nvb/workflows";
import { z, ZodError } from "zod";

const RunPayloadSchema = z.object({
  inbox_page_id: z.string().min(1),
  raw_request: z.string().min(1),
  request_type: z.string(),
  source_links: z.array(z.string()).default([]),
});

/**
 * POST /api/run
 *
 * Triggers the verdict pipeline for an existing inbox item.
 * Runs synchronously in the request — expect 15–45s latency for 3 LLM calls.
 *
 * Context retrieval mode is determined by env:
 *   MCP_SERVER_URL set → uses Notion MCP server for retrieval
 *   MCP_SERVER_URL not set → uses direct Notion API
 *
 * Returns: { verdict, runPageId, retrievedVia }
 *
 * TODO: Move to a background job queue for production to avoid HTTP timeouts.
 */
export async function POST(req: NextRequest) {
  try {
    const body = RunPayloadSchema.parse(await req.json());

    const result = await runVerdictWorkflow({
      inboxPageId: body.inbox_page_id,
      rawRequest: body.raw_request,
      requestType: body.request_type,
      sourceLinks: body.source_links,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: err.issues },
        { status: 400 }
      );
    }
    console.error("[/api/run]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

// Allow up to 120s for the 3 sequential LLM calls (Vercel Pro+)
export const maxDuration = 120;
