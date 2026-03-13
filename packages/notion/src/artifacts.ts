import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints.js";
import { type Verdict, type ArtifactType, ARTIFACTS_PROPS, ARTIFACT_STATUS } from "@nvb/schema";
import { getNotionClient, DB_IDS } from "./client.js";

export interface ArtifactRecord {
  title: string;
  sourceInboxPageId: string;
  artifactType: ArtifactType;
  verdict: Verdict;
  githubUrl?: string;
}

/**
 * Creates an Artifact page in NVB Artifacts.
 * The unified_answer is written as the page body (blocks), not just a property.
 * Returns { pageId, notionUrl }.
 */
export async function createArtifactPage(
  record: ArtifactRecord
): Promise<{ pageId: string; notionUrl: string }> {
  const notion = getNotionClient();

  const properties: CreatePageParameters["properties"] = {
    [ARTIFACTS_PROPS.TITLE]: {
      title: [{ text: { content: record.title } }],
    },
    [ARTIFACTS_PROPS.SOURCE_INBOX_ITEM]: {
      relation: [{ id: record.sourceInboxPageId }],
    },
    [ARTIFACTS_PROPS.ARTIFACT_TYPE]: {
      select: { name: record.artifactType },
    },
    [ARTIFACTS_PROPS.STATUS]: {
      select: { name: ARTIFACT_STATUS.PUBLISHED },
    },
    [ARTIFACTS_PROPS.SUMMARY]: {
      rich_text: [
        {
          text: {
            content: record.verdict.unified_answer.slice(0, 2000),
          },
        },
      ],
    },
    [ARTIFACTS_PROPS.PUBLISHED_AT]: {
      date: { start: new Date().toISOString() },
    },
  };

  if (record.githubUrl) {
    properties[ARTIFACTS_PROPS.GITHUB_URL] = {
      url: record.githubUrl,
    };
  }

  const page = await notion.pages.create({
    parent: { database_id: DB_IDS.ARTIFACTS },
    properties,
  });

  // Write the full artifact content as structured page blocks
  const bodyBlocks = buildArtifactBlocks(record.verdict);
  await notion.blocks.children.append({
    block_id: page.id,
    children: bodyBlocks,
  });

  // Update the Notion URL property now that we have the page ID
  const notionUrl = `https://www.notion.so/${page.id.replace(/-/g, "")}`;
  await notion.pages.update({
    page_id: page.id,
    properties: {
      [ARTIFACTS_PROPS.NOTION_URL]: { url: notionUrl },
    },
  });

  return { pageId: page.id, notionUrl };
}

/**
 * Builds the Notion block content for an artifact page.
 * Creates a structured layout: answer, citations, disagreements.
 */
function buildArtifactBlocks(
  verdict: Verdict
): CreatePageParameters["children"] {
  const blocks: NonNullable<CreatePageParameters["children"]> = [];

  // Main answer heading
  blocks.push({
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ text: { content: "Verdict" } }],
    },
  });

  // Split unified_answer into paragraphs (max 2000 chars per block)
  const chunks = chunkText(verdict.unified_answer, 2000);
  for (const chunk of chunks) {
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ text: { content: chunk } }],
      },
    });
  }

  // Confidence callout
  blocks.push({
    object: "block",
    type: "callout",
    callout: {
      rich_text: [
        {
          text: {
            content: `Confidence: ${(verdict.confidence * 100).toFixed(0)}%  |  Exit status: ${verdict.exit_status}`,
          },
        },
      ],
      icon: { type: "emoji", emoji: "📊" },
    },
  });

  // Citations section
  if (verdict.citations.length > 0) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [{ text: { content: "Citations" } }],
      },
    });

    for (const citation of verdict.citations) {
      const text = citation.url
        ? `${citation.label} — ${citation.url}`
        : citation.label;
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ text: { content: text } }],
        },
      });
    }
  }

  // Notes
  if (verdict.notes) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [{ text: { content: "Notes" } }],
      },
    });
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ text: { content: verdict.notes } }],
      },
    });
  }

  return blocks;
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}
