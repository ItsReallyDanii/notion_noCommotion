import { Client } from "@notionhq/client";
import type { ContextProvider, ContextProviderOptions, NotionContext } from "./provider.js";

/**
 * ─── Direct Context Provider ─────────────────────────────────────────────────
 *
 * Fallback context provider that queries Notion directly via @notionhq/client
 * when the MCP server is not available (MCP_SERVER_URL not set or unreachable).
 *
 * This is functionally equivalent to the original getEvidenceForInboxItem()
 * call in the verdict workflow, but wrapped in the ContextProvider interface
 * so the workflow code stays the same regardless of which provider is active.
 *
 * In practice: if you haven't started the MCP server, this is what runs.
 * If the MCP server is running at MCP_SERVER_URL, MCPContextProvider runs instead.
 */
export class DirectContextProvider implements ContextProvider {
  async retrieve(options: ContextProviderOptions): Promise<NotionContext> {
    const token = process.env["NOTION_TOKEN"];
    if (!token) {
      throw new Error("NOTION_TOKEN is not set.");
    }

    const notion = new Client({ auth: token, notionVersion: "2022-06-28" });

    const dbId = process.env["NOTION_DB_EVIDENCE"]?.replace(/-/g, "");
    if (!dbId) {
      // If Evidence DB isn't set, return empty context rather than crashing
      return { evidenceContext: "", evidenceItems: [], retrievedVia: "direct" };
    }

    const response = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: "Inbox Item",
        relation: { contains: options.inboxPageId },
      },
    });

    const items = response.results
      .filter((p) => "properties" in p)
      .map((p) => {
        if (!("properties" in p)) return null;

        const titleProp = p.properties["Title"];
        const excerptProp = p.properties["Excerpt"];
        const urlProp = p.properties["Source URL"];

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

    const evidenceContext =
      items.length > 0
        ? items
            .map(
              (e, i) =>
                `[${i + 1}] ${e.title}` +
                (e.excerpt ? `\n   "${e.excerpt}"` : "") +
                (e.sourceUrl ? `\n   URL: ${e.sourceUrl}` : "")
            )
            .join("\n\n")
        : "";

    return {
      evidenceContext,
      evidenceItems: items,
      retrievedVia: "direct",
    };
  }
}
