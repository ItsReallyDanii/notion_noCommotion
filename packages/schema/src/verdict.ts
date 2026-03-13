import { z } from "zod";

// ─── Exit status ──────────────────────────────────────────────────────────────

export const ExitStatusSchema = z.enum([
  "approve",
  "revise",
  "reject",
  "needs_evidence",
]);

export type ExitStatus = z.infer<typeof ExitStatusSchema>;

// ─── Artifact type ────────────────────────────────────────────────────────────

export const ArtifactTypeSchema = z.enum([
  "doc",
  "issue",
  "spec",
  "summary",
  "none",
]);

export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

// ─── Run type ─────────────────────────────────────────────────────────────────

export const RunTypeSchema = z.enum(["generator", "auditor", "clerk", "full"]);

export type RunType = z.infer<typeof RunTypeSchema>;

// ─── Citation ─────────────────────────────────────────────────────────────────

export const CitationSchema = z.object({
  label: z.string().describe("Short human-readable label for this source"),
  url: z.string().url().optional().describe("Source URL if available"),
  excerpt: z.string().optional().describe("Relevant excerpt from the source"),
});

export type Citation = z.infer<typeof CitationSchema>;

// ─── Disagreement ─────────────────────────────────────────────────────────────

export const DisagreementSchema = z.object({
  claim: z.string().describe("The claim being flagged"),
  reason: z.string().describe("Why this claim is unsupported or ambiguous"),
  severity: z
    .enum(["low", "medium", "high"])
    .describe("How blocking this disagreement is"),
});

export type Disagreement = z.infer<typeof DisagreementSchema>;

// ─── Generator output ─────────────────────────────────────────────────────────

export const GeneratorOutputSchema = z.object({
  draft_answer: z
    .string()
    .describe("The full candidate response or plan text"),
  key_claims: z
    .array(z.string())
    .describe("Bullet list of specific claims made in this answer"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Self-assessed confidence that this answer is correct and useful"),
  citations: z
    .array(CitationSchema)
    .describe("Sources used or referenced in the draft"),
  notes: z.string().optional().describe("Generator-internal notes or caveats"),
});

export type GeneratorOutput = z.infer<typeof GeneratorOutputSchema>;

// ─── Auditor output ───────────────────────────────────────────────────────────

export const AuditorOutputSchema = z.object({
  disagreements: z
    .array(DisagreementSchema)
    .describe("Claims or sections the auditor disputes or flags"),
  missing_evidence: z
    .array(z.string())
    .describe("Specific evidence items that would strengthen or verify claims"),
  ambiguities: z
    .array(z.string())
    .describe("Vague or underspecified parts of the draft that need clarity"),
  overall_assessment: z
    .enum(["pass", "pass_with_caveats", "needs_revision", "reject"])
    .describe("Auditor's overall judgment of the draft quality"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Auditor's confidence in its own assessment (not in the draft's correctness)"
    ),
  notes: z.string().optional(),
});

export type AuditorOutput = z.infer<typeof AuditorOutputSchema>;

// ─── Verdict (clerk output — the canonical structured result) ─────────────────

export const VerdictSchema = z.object({
  /**
   * The clerk's recommended disposition for this request.
   * - approve: ready to promote to artifact
   * - revise: needs another pass with specific changes
   * - reject: not viable; archive this request
   * - needs_evidence: cannot proceed without external evidence
   */
  exit_status: ExitStatusSchema,

  /** Clean, normalized answer or plan text. This is what gets promoted. */
  unified_answer: z.string(),

  /**
   * Final confidence score synthesized from generator + auditor signals.
   * 0.0 = no confidence, 1.0 = high confidence.
   */
  confidence: z.number().min(0).max(1),

  /** Disagreements carried forward from auditor (may be resolved or escalated) */
  disagreements: z.array(DisagreementSchema),

  /** Evidence items still needed before this can be approved */
  missing_evidence: z.array(z.string()),

  /** What artifact type the clerk recommends creating if approved */
  recommended_artifact: ArtifactTypeSchema,

  /** Sources that support claims in unified_answer */
  citations: z.array(CitationSchema),

  /** Free-text notes for the human reviewer */
  notes: z.string().optional(),

  /** ISO timestamp when this verdict was generated */
  generated_at: z.string().datetime(),

  /** Prompt versions used — for reproducibility */
  prompt_versions: z.object({
    generator: z.string(),
    auditor: z.string(),
    clerk: z.string(),
  }),
});

export type Verdict = z.infer<typeof VerdictSchema>;

// ─── Intake request ───────────────────────────────────────────────────────────

export const RequestTypeSchema = z.enum([
  "idea",
  "claim",
  "task",
  "question",
  "repo_task",
  "other",
]);

export type RequestType = z.infer<typeof RequestTypeSchema>;

export const PrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export type Priority = z.infer<typeof PrioritySchema>;

export const IntakePayloadSchema = z.object({
  title: z.string().min(1).max(200).describe("Short title for this request"),
  raw_request: z
    .string()
    .min(1)
    .describe("The full unedited request text from the user"),
  request_type: RequestTypeSchema,
  priority: PrioritySchema.default("medium"),
  source_links: z
    .array(z.string().url())
    .optional()
    .describe("URLs the user wants the system to consider"),
  notes: z.string().optional().describe("Optional submitter notes"),
});

export type IntakePayload = z.infer<typeof IntakePayloadSchema>;

// ─── Human decision ───────────────────────────────────────────────────────────
//
// IMPORTANT: These values must match HUMAN_DECISION_VALUES in notion-properties.ts
// (which stores what Notion actually persists in the select property).
// We normalize Notion's capitalized values to lowercase here.
//
export const HumanDecisionSchema = z.enum([
  "pending",
  "approve",
  "revise",
  "reject",
  "needs_evidence",
]);

export type HumanDecision = z.infer<typeof HumanDecisionSchema>;

/**
 * Normalizes a raw Notion select value to the HumanDecision enum.
 * Notion stores "Approve", "Pending", etc. (capitalized).
 * Our schema uses lowercase. This function bridges that gap.
 *
 * Returns null if the value is not a valid HumanDecision.
 */
export function parseHumanDecision(raw: string | null | undefined): HumanDecision | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/\s+/g, "_") as HumanDecision;
  const result = HumanDecisionSchema.safeParse(normalized);
  return result.success ? result.data : null;
}

// ─── Promote request ──────────────────────────────────────────────────────────

export const PromotePayloadSchema = z.object({
  inbox_page_id: z
    .string()
    .describe("Notion page ID of the approved inbox item"),
  create_github_artifact: z
    .boolean()
    .default(false)
    .describe("Whether to also create a GitHub issue or doc"),
});

export type PromotePayload = z.infer<typeof PromotePayloadSchema>;
