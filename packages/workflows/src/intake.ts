import { nanoid } from "nanoid";
import {
  type IntakePayload,
  IntakePayloadSchema,
} from "@nvb/schema";
import { createInboxItem } from "@nvb/notion";

/**
 * ─── Intake Workflow ──────────────────────────────────────────────────────────
 *
 * Inputs:  Raw intake payload from the web form or API
 * Outputs: { inboxPageId, requestId }
 *
 * Steps:
 * 1. Validate payload with Zod
 * 2. Generate a short unique Request ID
 * 3. Create a page in NVB Inbox with Status = "Queued"
 * 4. Return the Notion page ID for downstream use
 *
 * Human intervention: None at this step.
 * The inbox item sits in "Queued" until the verdict workflow runs.
 */

export interface IntakeResult {
  inboxPageId: string;
  requestId: string;
}

export async function runIntake(rawPayload: unknown): Promise<IntakeResult> {
  // 1. Validate input
  const payload = IntakePayloadSchema.parse(rawPayload);

  // 2. Generate request ID
  // Format: NVB-{8 chars} — short enough to fit in titles, unique enough for MVP
  const requestId = `NVB-${nanoid(8).toUpperCase()}`;

  // 3. Create Notion inbox item
  const inboxPageId = await createInboxItem(payload, requestId);

  return { inboxPageId, requestId };
}
