import { NextRequest, NextResponse } from "next/server";
import { runPromoteWorkflow } from "@nvb/workflows";
import { ZodError } from "zod";

/**
 * POST /api/promote
 *
 * Accepts { inbox_page_id, create_github_artifact } as JSON or form data.
 * Confirms Human Decision === "Approve" in Notion before proceeding.
 * Creates the artifact page and links it back to the inbox item.
 *
 * If called from the board's HTML form (form POST), redirects back to /board.
 * If called as JSON API, returns the artifact result.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let payload: Record<string, unknown>;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      payload = {
        inbox_page_id: formData.get("inbox_page_id"),
        create_github_artifact: formData.get("create_github_artifact") === "true",
      };
    } else {
      payload = (await req.json()) as Record<string, unknown>;
    }

    const result = await runPromoteWorkflow(payload);

    // HTML form submission — redirect back to board with success indicator
    if (contentType.includes("application/x-www-form-urlencoded")) {
      return NextResponse.redirect(
        new URL(`/board?promoted=${result.artifactPageId}`, req.url)
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: err.issues },
        { status: 400 }
      );
    }
    console.error("[/api/promote]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
