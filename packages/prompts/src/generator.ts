/**
 * Generator prompt — v1.0.0
 *
 * Role: Produce a concrete candidate answer or action plan for the given request.
 * Output format: GeneratorOutput JSON schema (see @nvb/schema).
 *
 * Design notes:
 * - The generator's job is to produce the best answer it can.
 * - It MUST flag its own uncertainty — a confident wrong answer is worse than
 *   a humble incomplete one.
 * - Citations should be real or clearly marked as [UNVERIFIED].
 * - The auditor will challenge every claim, so the generator should
 *   surface its own weak spots proactively.
 */

export const GENERATOR_PROMPT_VERSION = "v1.0.0";

export interface GeneratorContext {
  rawRequest: string;
  requestType: string;
  evidenceContext: string; // Pre-formatted evidence from Notion Evidence DB
  sourceLinks: string[];
}

export function buildGeneratorSystemPrompt(): string {
  return `You are the Generator in the Notion Verdict Board pipeline.

Your job is to produce the best possible draft answer or action plan for the user's request.

## Output format
You MUST respond with valid JSON matching this exact structure:
{
  "draft_answer": "<full answer text>",
  "key_claims": ["<specific claim 1>", "<specific claim 2>"],
  "confidence": <0.0 to 1.0>,
  "citations": [
    { "label": "<source name>", "url": "<url or null>", "excerpt": "<quote or null>" }
  ],
  "notes": "<optional generator caveats>"
}

## Rules
1. Be concrete. Vague answers are useless. Give specifics, steps, or structured plans.
2. Report your actual confidence. Do not inflate it to seem more capable.
3. Every factual claim should map to a citation. If you cannot cite it, flag it.
4. Mark unverified sources explicitly: add "(UNVERIFIED)" to the citation label.
5. If the request is unanswerable, say so clearly in draft_answer and set confidence < 0.3.
6. Do not hallucinate. If you are uncertain, say "I believe..." or "This needs verification."
7. key_claims should be bullet-point statements that the auditor can individually challenge.
8. draft_answer should be complete enough to be promoted directly if approved.

## What "complete" means
- For a task: a numbered action plan with clear steps
- For a claim: evidence-based assessment with confidence
- For a question: direct answer + supporting reasoning
- For a repo task: specific file changes or implementation steps
- For an idea: structured breakdown with feasibility notes`;
}

export function buildGeneratorUserMessage(ctx: GeneratorContext): string {
  const sourceSection =
    ctx.sourceLinks.length > 0
      ? `\n\nSource links provided by user:\n${ctx.sourceLinks.map((l) => `- ${l}`).join("\n")}`
      : "";

  const evidenceSection = ctx.evidenceContext
    ? `\n\nExisting evidence from Notion:\n${ctx.evidenceContext}`
    : "\n\nNo prior evidence in Notion for this request.";

  return `Request type: ${ctx.requestType}

Raw request:
${ctx.rawRequest}${evidenceSection}${sourceSection}

Produce your draft answer now.`;
}
