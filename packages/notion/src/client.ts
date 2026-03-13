import { Client } from "@notionhq/client";

/**
 * Singleton Notion client.
 *
 * Auth: Internal integration token (NOTION_TOKEN).
 * This token starts with "ntn_" and is obtained from
 * https://www.notion.so/profile/integrations
 *
 * The integration must be explicitly connected to each database
 * via the "Connect to integration" option in the Notion UI.
 *
 * API version: 2022-06-28 (pinned — do not change without regression testing).
 * As of 2026-03-11, the latest is 2026-03-11 but the SDK pins its own version.
 * We pin via the client notionVersion option for determinism.
 */

let _client: Client | null = null;

export function getNotionClient(): Client {
  if (_client) return _client;

  const token = process.env["NOTION_TOKEN"];
  if (!token) {
    throw new Error(
      "NOTION_TOKEN is not set. " +
        "Create an internal integration at https://www.notion.so/profile/integrations " +
        "and set the token in your .env file."
    );
  }

  _client = new Client({
    auth: token,
    notionVersion: "2022-06-28",
  });

  return _client;
}

/**
 * Helper to get a required database ID from env.
 * Throws a clear error if the env var is missing.
 */
export function requireDbId(envKey: string): string {
  const id = process.env[envKey];
  if (!id) {
    throw new Error(
      `${envKey} is not set. ` +
        "Copy your database ID from the Notion database URL and set it in .env. " +
        "The ID is the 32-char string before the '?' in the URL."
    );
  }
  // Notion accepts IDs with or without hyphens. Normalize to no hyphens.
  return id.replace(/-/g, "");
}

export const DB_IDS = {
  get INBOX() {
    return requireDbId("NOTION_DB_INBOX");
  },
  get EVIDENCE() {
    return requireDbId("NOTION_DB_EVIDENCE");
  },
  get RUNS() {
    return requireDbId("NOTION_DB_RUNS");
  },
  get ARTIFACTS() {
    return requireDbId("NOTION_DB_ARTIFACTS");
  },
} as const;
