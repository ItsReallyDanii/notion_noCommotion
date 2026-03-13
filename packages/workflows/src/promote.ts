import {
  PromotePayloadSchema,
  INBOX_STATUS,
  INBOX_PROPS,
  RUNS_PROPS,
  VerdictSchema,
} from "@nvb/schema";
import {
  getHumanDecision,
  linkArtifactToInbox,
  createArtifactPage,
  getNotionClient,
  DB_IDS,
} from "@nvb/notion";

/**
 * ─── Promotion Workflow ───────────────────────────────────────────────────────
 *
 * Inputs:
 *   - inbox_page_id: Notion page ID of the approved inbox item
 *   - create_github_artifact: boolean (optional)
 *
 * Outputs:
 *   - artifactPageId: Notion page ID of the created artifact
 *   - notionUrl: direct URL to the artifact in Notion
 *   - githubUrl: GitHub URL if artifact created (or null)
 *
 * Steps:
 * 1. Validate the PromotePayload
 * 2. Confirm Human Decision is "approve" — reject if not
 * 3. Retrieve the inbox page title and latest run link
 * 4. Retrieve the Run page and parse the verdict JSON
 * 5. Create artifact page in NVB Artifacts with full block content
 * 6. Link artifact back to inbox item (Status → Promoted)
 * 7. Optionally create GitHub issue (if GITHUB_TOKEN is set)
 *
 * Human intervention: This workflow is triggered BY human approval.
 * The human sets Human Decision = "Approve" in Notion, then either:
 *   a) clicks the Promote button in the /board UI, or
 *   b) calls POST /api/promote directly.
 *
 * NOTE: getHumanDecision() normalizes Notion's "Approve" → "approve"
 * so this comparison is case-safe.
 *
 * IDEMPOTENCY: Calling twice creates duplicate artifacts. The UI and
 * /api/promote handler should check Status !== "Promoted" first.
 */

export interface PromoteResult {
  artifactPageId: string;
  notionUrl: string;
  githubUrl: string | null;
}

export async function runPromoteWorkflow(
  rawPayload: unknown
): Promise<PromoteResult> {
  const payload = PromotePayloadSchema.parse(rawPayload);

  // 2. Confirm human decision (normalized to lowercase by getHumanDecision)
  const decision = await getHumanDecision(payload.inbox_page_id);
  if (decision !== "approve") {
    throw new Error(
      `Promotion blocked: Human Decision is "${decision ?? "unset"}", expected "approve". ` +
        `Set Human Decision = "Approve" in the Notion inbox item before promoting.`
    );
  }

  // 3. Retrieve inbox page
  const notion = getNotionClient();
  const inboxPage = await notion.pages.retrieve({
    page_id: payload.inbox_page_id,
  });

  if (!("properties" in inboxPage)) {
    throw new Error("Inbox page not found or inaccessible.");
  }

  const titleProp = inboxPage.properties[INBOX_PROPS.TITLE];
  const title =
    titleProp?.type === "title" && titleProp.title[0]
      ? titleProp.title[0].plain_text
      : "Untitled Artifact";

  // 4. Get the latest run relation
  const latestRunProp = inboxPage.properties[INBOX_PROPS.LATEST_RUN];
  if (
    !latestRunProp ||
    latestRunProp.type !== "relation" ||
    !latestRunProp.relation[0]
  ) {
    throw new Error(
      "No run found for this inbox item. Run the verdict workflow first."
    );
  }
  const runPageId = latestRunProp.relation[0].id;

  // Retrieve the run to get the verdict JSON
  const runPage = await notion.pages.retrieve({ page_id: runPageId });
  if (!("properties" in runPage)) {
    throw new Error("Run page not found.");
  }

  const rawJsonProp = runPage.properties[RUNS_PROPS.RAW_JSON];
  const rawJson =
    rawJsonProp?.type === "rich_text" && rawJsonProp.rich_text[0]
      ? rawJsonProp.rich_text[0].plain_text
      : null;

  if (!rawJson) {
    throw new Error(
      "Run page has no Raw JSON property. Cannot promote without a verdict. " +
        "Re-run the verdict pipeline first."
    );
  }

  let verdict;
  try {
    // Strip the truncation marker appended when JSON exceeded 1900 chars
    const cleaned = rawJson.replace(/\n\.\.\. \[truncated.*$/, "");
    const parsed = JSON.parse(cleaned);
    verdict = VerdictSchema.parse(parsed);
  } catch {
    throw new Error(
      "Failed to parse verdict from Run page. The JSON is likely truncated. " +
        "Check the Run page body blocks for the full JSON and fix Raw JSON manually, " +
        "or re-run the verdict pipeline."
    );
  }

  // 5. Create artifact page
  const { pageId: artifactPageId, notionUrl } = await createArtifactPage({
    title: `Artifact: ${title}`,
    sourceInboxPageId: payload.inbox_page_id,
    artifactType:
      verdict.recommended_artifact === "none"
        ? "doc"
        : verdict.recommended_artifact,
    verdict,
    githubUrl: undefined,
  });

  // 6. Link artifact to inbox + update status to Promoted
  await linkArtifactToInbox(payload.inbox_page_id, artifactPageId);

  // 7. GitHub integration (optional)
  let githubUrl: string | null = null;
  if (payload.create_github_artifact && process.env["GITHUB_TOKEN"]) {
    // TODO: wire packages/github/src/index.ts createGitHubIssue() here
    // Requires: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO in .env
    console.warn(
      "[promote] GitHub artifact creation is not yet wired. " +
        "See packages/github/src/index.ts."
    );
  }

  return { artifactPageId, notionUrl, githubUrl };
}
