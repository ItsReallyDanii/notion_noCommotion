import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints.js";
import {
  type IntakePayload,
  type Verdict,
  type HumanDecision,
  parseHumanDecision,
  INBOX_PROPS,
  INBOX_STATUS,
  HUMAN_DECISION_VALUES,
} from "@nvb/schema";
import { getNotionClient, DB_IDS } from "./client.js";

/**
 * Creates a new page in NVB Inbox when a request is submitted.
 * Returns the created page ID.
 */
export async function createInboxItem(
  payload: IntakePayload,
  requestId: string
): Promise<string> {
  const notion = getNotionClient();

  const properties: CreatePageParameters["properties"] = {
    [INBOX_PROPS.TITLE]: {
      title: [{ text: { content: payload.title } }],
    },
    [INBOX_PROPS.REQUEST_ID]: {
      rich_text: [{ text: { content: requestId } }],
    },
    [INBOX_PROPS.REQUEST_TYPE]: {
      select: { name: payload.request_type },
    },
    [INBOX_PROPS.RAW_REQUEST]: {
      rich_text: [{ text: { content: payload.raw_request.slice(0, 2000) } }],
    },
    [INBOX_PROPS.STATUS]: {
      status: { name: INBOX_STATUS.QUEUED },
    },
    [INBOX_PROPS.PRIORITY]: {
      select: { name: payload.priority },
    },
    [INBOX_PROPS.HUMAN_DECISION]: {
      select: { name: HUMAN_DECISION_VALUES.PENDING },
    },
    [INBOX_PROPS.CREATED_AT]: {
      date: { start: new Date().toISOString() },
    },
  };

  // Add source links if provided
  if (payload.source_links && payload.source_links.length > 0) {
    properties[INBOX_PROPS.SOURCE_LINKS] = {
      url: payload.source_links[0] ?? null,
    };
  }

  if (payload.notes) {
    properties[INBOX_PROPS.NOTES] = {
      rich_text: [{ text: { content: payload.notes } }],
    };
  }

  const response = await notion.pages.create({
    parent: { database_id: DB_IDS.INBOX },
    properties,
  });

  return response.id;
}

/**
 * Updates the inbox item with the results of a verdict run.
 * Sets Status to "Awaiting Review" and writes confidence + latest run ref.
 */
export async function updateInboxWithVerdict(
  pageId: string,
  verdict: Verdict,
  runPageId: string
): Promise<void> {
  const notion = getNotionClient();

  await notion.pages.update({
    page_id: pageId,
    properties: {
      [INBOX_PROPS.STATUS]: {
        status: { name: INBOX_STATUS.AWAITING_REVIEW },
      },
      [INBOX_PROPS.CONFIDENCE]: {
        number: verdict.confidence,
      },
      [INBOX_PROPS.LATEST_RUN]: {
        relation: [{ id: runPageId }],
      },
    },
  });
}

/**
 * Reads the current Human Decision value from an inbox item.
 *
 * Notion stores capitalized values ("Approve", "Pending", etc.).
 * We normalize these to lowercase via parseHumanDecision() so the
 * promote workflow can compare against the HumanDecision schema.
 *
 * Returns null if not set or unrecognized.
 */
export async function getHumanDecision(
  pageId: string
): Promise<HumanDecision | null> {
  const notion = getNotionClient();
  const page = await notion.pages.retrieve({ page_id: pageId });

  if (!("properties" in page)) return null;

  const prop = page.properties[INBOX_PROPS.HUMAN_DECISION];
  if (!prop || prop.type !== "select" || !prop.select) return null;

  // Normalize: "Approve" → "approve", "Needs Evidence" → "needs_evidence"
  return parseHumanDecision(prop.select.name);
}

/**
 * Updates the Status field on an inbox item.
 * Used when promoting to Artifact or archiving.
 */
export async function updateInboxStatus(
  pageId: string,
  status: (typeof INBOX_STATUS)[keyof typeof INBOX_STATUS]
): Promise<void> {
  const notion = getNotionClient();

  await notion.pages.update({
    page_id: pageId,
    properties: {
      [INBOX_PROPS.STATUS]: {
        status: { name: status },
      },
    },
  });
}

/**
 * Updates the Final Artifact relation on an inbox item after promotion.
 */
export async function linkArtifactToInbox(
  inboxPageId: string,
  artifactPageId: string
): Promise<void> {
  const notion = getNotionClient();

  await notion.pages.update({
    page_id: inboxPageId,
    properties: {
      [INBOX_PROPS.FINAL_ARTIFACT]: {
        relation: [{ id: artifactPageId }],
      },
      [INBOX_PROPS.STATUS]: {
        status: { name: INBOX_STATUS.PROMOTED },
      },
    },
  });
}

/**
 * Queries inbox items that are Awaiting Review (for the board UI).
 */
export async function queryAwaitingReview(): Promise<
  Array<{ id: string; title: string; confidence: number | null; created: string }>
> {
  const notion = getNotionClient();

  const response = await notion.databases.query({
    database_id: DB_IDS.INBOX,
    filter: {
      property: INBOX_PROPS.STATUS,
      status: { equals: INBOX_STATUS.AWAITING_REVIEW },
    },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });

  return response.results
    .filter((p) => "properties" in p)
    .map((p) => {
      if (!("properties" in p)) return null;
      const titleProp = p.properties[INBOX_PROPS.TITLE];
      const confProp = p.properties[INBOX_PROPS.CONFIDENCE];
      const title =
        titleProp?.type === "title" && titleProp.title[0]
          ? titleProp.title[0].plain_text
          : "(untitled)";
      const confidence =
        confProp?.type === "number" ? (confProp.number ?? null) : null;
      return { id: p.id, title, confidence, created: p.created_time };
    })
    .filter(Boolean) as Array<{
    id: string;
    title: string;
    confidence: number | null;
    created: string;
  }>;
}
