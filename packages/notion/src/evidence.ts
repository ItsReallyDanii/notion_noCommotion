import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints.js";
import { type Citation, EVIDENCE_PROPS, EVIDENCE_TYPE_VALUES } from "@nvb/schema";
import { getNotionClient, DB_IDS } from "./client.js";

export interface EvidenceRecord {
  inboxPageId: string;
  citation: Citation;
  evidenceType: keyof typeof EVIDENCE_TYPE_VALUES;
  relevance: string;
  confidence: number;
  retrievedBy: "generator" | "auditor" | "user";
}

/**
 * Creates an Evidence page in NVB Evidence.
 * Called by the auditor and generator to record sources used.
 */
export async function createEvidenceRecord(
  record: EvidenceRecord
): Promise<string> {
  const notion = getNotionClient();

  const title = record.citation.label.slice(0, 200);

  const properties: CreatePageParameters["properties"] = {
    [EVIDENCE_PROPS.TITLE]: {
      title: [{ text: { content: title } }],
    },
    [EVIDENCE_PROPS.INBOX_ITEM]: {
      relation: [{ id: record.inboxPageId }],
    },
    [EVIDENCE_PROPS.EVIDENCE_TYPE]: {
      select: { name: EVIDENCE_TYPE_VALUES[record.evidenceType] },
    },
    [EVIDENCE_PROPS.RELEVANCE]: {
      rich_text: [{ text: { content: record.relevance } }],
    },
    [EVIDENCE_PROPS.CONFIDENCE]: {
      number: record.confidence,
    },
    [EVIDENCE_PROPS.RETRIEVED_BY]: {
      select: { name: record.retrievedBy },
    },
  };

  if (record.citation.url) {
    properties[EVIDENCE_PROPS.SOURCE_URL] = {
      url: record.citation.url,
    };
  }

  if (record.citation.excerpt) {
    properties[EVIDENCE_PROPS.EXCERPT] = {
      rich_text: [
        { text: { content: record.citation.excerpt.slice(0, 2000) } },
      ],
    };
  }

  const page = await notion.pages.create({
    parent: { database_id: DB_IDS.EVIDENCE },
    properties,
  });

  return page.id;
}

/**
 * Queries evidence items related to an inbox item.
 * Used by the context retrieval step before running the verdict pipeline.
 */
export async function getEvidenceForInboxItem(
  inboxPageId: string
): Promise<Array<{ title: string; excerpt: string | null; sourceUrl: string | null }>> {
  const notion = getNotionClient();

  const response = await notion.databases.query({
    database_id: DB_IDS.EVIDENCE,
    filter: {
      property: EVIDENCE_PROPS.INBOX_ITEM,
      relation: { contains: inboxPageId },
    },
  });

  return response.results
    .filter((p) => "properties" in p)
    .map((p) => {
      if (!("properties" in p)) return null;
      const titleProp = p.properties[EVIDENCE_PROPS.TITLE];
      const excerptProp = p.properties[EVIDENCE_PROPS.EXCERPT];
      const urlProp = p.properties[EVIDENCE_PROPS.SOURCE_URL];

      const title =
        titleProp?.type === "title" && titleProp.title[0]
          ? titleProp.title[0].plain_text
          : "";
      const excerpt =
        excerptProp?.type === "rich_text" && excerptProp.rich_text[0]
          ? excerptProp.rich_text[0].plain_text
          : null;
      const sourceUrl =
        urlProp?.type === "url" ? (urlProp.url ?? null) : null;

      return { title, excerpt, sourceUrl };
    })
    .filter(Boolean) as Array<{
    title: string;
    excerpt: string | null;
    sourceUrl: string | null;
  }>;
}
