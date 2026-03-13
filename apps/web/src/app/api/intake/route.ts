import { NextRequest, NextResponse } from "next/server";
import { runIntake } from "@nvb/workflows";
import { ZodError } from "zod";

/**
 * POST /api/intake
 *
 * Accepts an IntakePayload, validates it, creates a Notion inbox item.
 * Returns { inboxPageId, requestId }.
 *
 * Does NOT run the verdict pipeline — that is a separate call to /api/run.
 * This separation allows the UI to show a "submitted" state immediately
 * while the slower pipeline runs.
 */
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const result = await runIntake(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request payload", issues: err.issues },
        { status: 400 }
      );
    }
    console.error("[/api/intake]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
