import {
  GeneratorOutputSchema,
  AuditorOutputSchema,
  VerdictSchema,
  type Verdict,
  INBOX_STATUS,
} from "@nvb/schema";
import {
  updateInboxWithVerdict,
  updateInboxStatus,
  createRunRecord,
} from "@nvb/notion";
import { resolveContextProvider } from "@nvb/mcp";
import { callLLMJson } from "@nvb/llm";
import {
  buildGeneratorSystemPrompt,
  buildGeneratorUserMessage,
  buildAuditorSystemPrompt,
  buildAuditorUserMessage,
  buildClerkSystemPrompt,
  buildClerkUserMessage,
  GENERATOR_PROMPT_VERSION,
  AUDITOR_PROMPT_VERSION,
  CLERK_PROMPT_VERSION,
} from "@nvb/prompts";

/**
 * ─── Verdict Workflow ─────────────────────────────────────────────────────────
 *
 * Inputs:
 *   - inboxPageId: Notion page ID of the inbox item to process
 *   - rawRequest: the original user request text
 *   - requestType: from the intake form
 *   - sourceLinks: URLs provided by user (optional)
 *
 * Outputs:
 *   - verdict: final Verdict object
 *   - runPageId: Notion page ID of the created Run record
 *   - retrievedVia: "mcp" | "direct" | "mcp_fallback_to_direct" — which path ran
 *
 * Steps:
 * 1. Set inbox Status → "Running"
 * 2. Retrieve context via resolveContextProvider()
 *    → MCP_SERVER_URL not set: DirectContextProvider runs directly
 *    → MCP_SERVER_URL set: MCPContextProvider is attempted first;
 *       if it fails (server down, tool missing, network error),
 *       FallbackContextProvider retries with DirectContextProvider.
 *       retrievedVia will be "mcp", "direct", or "mcp_fallback_to_direct".
 * 3. Call Generator → GeneratorOutput
 * 4. Call Auditor → AuditorOutput
 * 5. Call Clerk → Verdict
 * 6. Write Run record to NVB Runs (includes retrievedVia in notes)
 * 7. Update Inbox → Status: "Awaiting Review"
 *
 * Human intervention: After step 7.
 * Human sets Human Decision in Notion to Approve / Revise / Reject / Needs Evidence.
 */

export interface VerdictWorkflowInput {
  inboxPageId: string;
  rawRequest: string;
  requestType: string;
  sourceLinks: string[];
}

export interface VerdictWorkflowResult {
  verdict: Verdict;
  runPageId: string;
  /** Mirrors NotionContext.retrievedVia — see packages/mcp/src/provider.ts for values. */
  retrievedVia: "mcp" | "direct" | "mcp_fallback_to_direct";
}

export async function runVerdictWorkflow(
  input: VerdictWorkflowInput
): Promise<VerdictWorkflowResult> {
  const startedAt = new Date().toISOString();

  // 1. Mark as running
  await updateInboxStatus(input.inboxPageId, INBOX_STATUS.RUNNING);

  // 2. Retrieve context — MCP if available, direct API otherwise
  const contextProvider = resolveContextProvider();
  const context = await contextProvider.retrieve({
    inboxPageId: input.inboxPageId,
    rawRequest: input.rawRequest,
    requestType: input.requestType,
  });

  console.log(`[verdict] Context retrieved via: ${context.retrievedVia} (${context.evidenceItems.length} items)`);

  const promptVersions = {
    generator: GENERATOR_PROMPT_VERSION,
    auditor: AUDITOR_PROMPT_VERSION,
    clerk: CLERK_PROMPT_VERSION,
  };

  let generatorModel = "";
  let verdict: Verdict;

  try {
    // 3. Generator pass
    const { result: generatorOutput, model: genModel } = await callLLMJson(
      {
        model: process.env["LLM_GENERATOR_MODEL"],
        systemPrompt: buildGeneratorSystemPrompt(),
        userMessage: buildGeneratorUserMessage({
          rawRequest: input.rawRequest,
          requestType: input.requestType,
          evidenceContext: context.evidenceContext,
          sourceLinks: input.sourceLinks,
        }),
        jsonMode: true,
        temperature: 0.4,
      },
      (raw) => GeneratorOutputSchema.parse(raw)
    );
    generatorModel = genModel;

    // 4. Auditor pass
    const { result: auditorOutput } = await callLLMJson(
      {
        model: process.env["LLM_AUDITOR_MODEL"],
        systemPrompt: buildAuditorSystemPrompt(),
        userMessage: buildAuditorUserMessage({
          rawRequest: input.rawRequest,
          generatorDraft: generatorOutput.draft_answer,
          keyClaims: generatorOutput.key_claims,
        }),
        jsonMode: true,
        temperature: 0.2,
      },
      (raw) => AuditorOutputSchema.parse(raw)
    );

    // 5. Clerk synthesis
    const { result: rawVerdict } = await callLLMJson(
      {
        model: process.env["LLM_CLERK_MODEL"],
        systemPrompt: buildClerkSystemPrompt(),
        userMessage: buildClerkUserMessage({
          rawRequest: input.rawRequest,
          generatorDraft: generatorOutput.draft_answer,
          generatorConfidence: generatorOutput.confidence,
          auditorAssessment: JSON.stringify(auditorOutput, null, 2),
          promptVersions,
        }),
        jsonMode: true,
        temperature: 0.1,
      },
      (raw) => {
        // Inject prompt_versions and generated_at if clerk omitted them
        const obj = raw as Record<string, unknown>;
        if (!obj["generated_at"]) {
          obj["generated_at"] = new Date().toISOString();
        }
        if (!obj["prompt_versions"]) {
          obj["prompt_versions"] = promptVersions;
        }
        return VerdictSchema.parse(obj);
      }
    );

    verdict = rawVerdict;
  } catch (error) {
    // On pipeline failure: reset inbox status so human can retry
    await updateInboxStatus(input.inboxPageId, INBOX_STATUS.QUEUED);
    throw error;
  }

  const finishedAt = new Date().toISOString();

  // 6. Write run record — includes retrievedVia in notes
  const runPageId = await createRunRecord({
    inboxPageId: input.inboxPageId,
    runType: "full",
    model: generatorModel,
    promptVersions,
    startedAt,
    finishedAt,
    verdict,
    errorSummary: undefined,
    // Store retrieval method in notes for auditability
    notes: `context_retrieved_via: ${context.retrievedVia}`,
  });

  // 7. Update inbox with verdict results
  await updateInboxWithVerdict(input.inboxPageId, verdict, runPageId);

  return { verdict, runPageId, retrievedVia: context.retrievedVia };
}
