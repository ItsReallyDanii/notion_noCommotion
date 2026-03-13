import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints.js";
import { type Verdict, type RunType, RUNS_PROPS } from "@nvb/schema";
import { getNotionClient, DB_IDS } from "./client.js";

export interface RunRecord {
  inboxPageId: string;
  runType: RunType;
  model: string;
  promptVersions: { generator: string; auditor: string; clerk: string };
  startedAt: string;
  finishedAt: string;
  verdict: Verdict;
  errorSummary?: string;
  /** Optional free-text notes — used to record context_retrieved_via, etc. */
  notes?: string;
}

/**
 * Creates a Run page in NVB Runs.
 * The raw JSON of the verdict is stored as a Rich Text property (truncated to 1900 chars).
 * Full verdicts are appended as page body blocks for longer content.
 * Returns the created run page ID.
 */
export async function createRunRecord(record: RunRecord): Promise<string> {
  const notion = getNotionClient();

  const rawJson = JSON.stringify(record.verdict, null, 2);
  // Notion rich_text property max is 2000 chars — truncate with marker
  const rawJsonTruncated =
    rawJson.length > 1900
      ? rawJson.slice(0, 1900) + "\n... [truncated — see page body]"
      : rawJson;

  const title = `${record.runType} — ${new Date(record.finishedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC`;

  const properties: CreatePageParameters["properties"] = {
    [RUNS_PROPS.TITLE]: {
      title: [{ text: { content: title } }],
    },
    [RUNS_PROPS.INBOX_ITEM]: {
      relation: [{ id: record.inboxPageId }],
    },
    [RUNS_PROPS.RUN_TYPE]: {
      select: { name: record.runType },
    },
    [RUNS_PROPS.MODEL]: {
      rich_text: [{ text: { content: record.model } }],
    },
    [RUNS_PROPS.PROMPT_VERSION]: {
      rich_text: [
        {
          text: {
            content: `gen:${record.promptVersions.generator} aud:${record.promptVersions.auditor} clk:${record.promptVersions.clerk}`,
          },
        },
      ],
    },
    [RUNS_PROPS.STARTED_AT]: {
      date: { start: record.startedAt },
    },
    [RUNS_PROPS.FINISHED_AT]: {
      date: { start: record.finishedAt },
    },
    [RUNS_PROPS.EXIT_STATUS]: {
      select: { name: record.verdict.exit_status },
    },
    [RUNS_PROPS.CONFIDENCE]: {
      number: record.verdict.confidence,
    },
    [RUNS_PROPS.RAW_JSON]: {
      rich_text: [{ text: { content: rawJsonTruncated } }],
    },
  };

  if (record.errorSummary) {
    properties[RUNS_PROPS.ERROR_SUMMARY] = {
      rich_text: [{ text: { content: record.errorSummary } }],
    };
  }

  if (record.notes) {
    properties[RUNS_PROPS.NOTES] = {
      rich_text: [{ text: { content: record.notes } }],
    };
  }

  const page = await notion.pages.create({
    parent: { database_id: DB_IDS.RUNS },
    properties,
  });

  // Append full verdict as page body when truncated
  if (rawJson.length > 1900) {
    await notion.blocks.children.append({
      block_id: page.id,
      children: [
        {
          object: "block",
          type: "code",
          code: {
            rich_text: [{ text: { content: rawJson.slice(0, 2000) } }],
            language: "json",
          },
        },
      ],
    });
  }

  return page.id;
}
