import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ContextProvider, ContextProviderOptions, NotionContext } from "./provider.js";

/**
 * --- MCP Context Provider ----------------------------------------------------
 *
 * Retrieves Notion context for the verdict pipeline via the
 * @notionhq/notion-mcp-server running on HTTP (Streamable HTTP) transport.
 *
 * What this actually does:
 * 1. Connects to the MCP server over HTTP
 * 2. Calls the server's search tool with the user's raw request text
 * 3. Parses the search results (page IDs, titles, URLs)
 * 4. Formats titles and URLs as evidenceContext for the generator prompt
 *
 * What it does NOT do:
 * - Does NOT fetch page body content (no block children call)
 * - Does NOT perform multi-step retrieval or re-ranking
 * - Returns at most 5 pages (page_size: 5 in the search call)
 *
 * The generator receives page titles and URLs as its context window.
 * That is the full extent of MCP-sourced context in this implementation.
 * DirectContextProvider retrieves from the NVB Evidence database instead
 * (different source, same ContextProvider interface).
 *
 * Transport: Streamable HTTP (MCP spec 2024-11-05+)
 * Start the server: npx @notionhq/notion-mcp-server --transport http --port 3001
 *
 * Fallback: If this provider throws for any reason (server unreachable,
 * tool not found, parse error), FallbackContextProvider in resolve-provider.ts
 * retries with DirectContextProvider and records retrievedVia =
 * "mcp_fallback_to_direct" in the Run record.
 *
 * Environment variables:
 *   MCP_SERVER_URL -- e.g. http://localhost:3001 (required to activate MCP mode)
 *   MCP_AUTH_TOKEN -- Optional bearer token if server uses --auth-token
 *
 * NOTE on tool names:
 * The official server exposes tools via OpenAPI path naming (varies by version).
 * We try: ["notion_post_v1_search", "API-post-search", "search"] in order.
 * listTools() is called on connect and names are logged so you can verify
 * which one matched on your installed version.
 */

export class MCPContextProvider implements ContextProvider {
  private serverUrl: string;
  private authToken: string | undefined;

  constructor(serverUrl: string, authToken?: string) {
    this.serverUrl = serverUrl;
    this.authToken = authToken;
  }

  async retrieve(options: ContextProviderOptions): Promise<NotionContext> {
    const client = new Client({ name: "nvb-workflow", version: "0.1.0" });

    const headers: Record<string, string> = {};
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const transport = new StreamableHTTPClientTransport(
      new URL(this.serverUrl),
      { requestInit: { headers } }
    );

    try {
      await client.connect(transport);

      // Log available tools on first connect (useful for debugging tool name differences)
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);
      console.log("[MCP] Connected. Available tools:", toolNames.join(", "));

      // Step 1: Search Notion workspace for pages related to this request
      const searchResult = await this.searchNotion(client, options.rawRequest);

      // Step 2: Format results as evidence context
      const evidenceContext = formatSearchResultsAsContext(searchResult);
      const evidenceItems = extractEvidenceItems(searchResult);

      return {
        evidenceContext,
        evidenceItems,
        retrievedVia: "mcp",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`MCP context retrieval failed: ${msg}`);
    } finally {
      await client.close();
    }
  }

  /**
   * Searches the Notion workspace for pages related to the request.
   *
   * NOTE: The exact tool name depends on the MCP server version.
   * The official @notionhq/notion-mcp-server exposes search via the
   * Notion API path: POST /v1/search
   *
   * Tool name pattern: notion_{method}_{path_with_slashes_as_underscores}
   * We try the most common names and fall back gracefully.
   */
  private async searchNotion(
    client: Client,
    query: string
  ): Promise<SearchResult[]> {
    const tools = await client.listTools();
    const toolNames = tools.tools.map((t) => t.name);

    // Try known tool name patterns for the official MCP server
    const searchToolCandidates = [
      "notion_post_v1_search",   // newer official server naming
      "API-post-search",          // some versions use this pattern
      "search",                   // generic fallback
    ];

    const searchTool = searchToolCandidates.find((name) =>
      toolNames.includes(name)
    );

    if (!searchTool) {
      console.warn(
        "[MCP] No search tool found. Available tools:", toolNames.join(", "),
        "\nFalling through with empty context."
      );
      return [];
    }

    const result = await client.callTool({
      name: searchTool,
      arguments: {
        query,
        filter: { value: "page", property: "object" },
        page_size: 5,
      },
    });

    return parseSearchResults(result.content);
  }
}

// --- Result parsing ----------------------------------------------------------

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string | null;
}

function parseSearchResults(content: unknown): SearchResult[] {
  // MCP tool results come back as an array of content objects.
  // The Notion MCP server returns JSON text content.
  if (!Array.isArray(content)) return [];

  const results: SearchResult[] = [];

  for (const item of content) {
    if (
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      item.type === "text" &&
      "text" in item
    ) {
      try {
        const parsed = JSON.parse(item.text as string);
        const pages = parsed?.results ?? [];

        for (const page of pages) {
          if (typeof page !== "object" || page === null) continue;

          // Extract title from various property structures
          let title = "(untitled)";
          const props = page.properties ?? {};
          const titleProp =
            props.title ?? props.Title ?? props.Name ?? props.name;
          if (titleProp?.title?.[0]?.plain_text) {
            title = titleProp.title[0].plain_text;
          }

          results.push({
            id: page.id ?? "",
            title,
            url: page.url ?? "",
            snippet: null,
          });
        }
      } catch {
        // Non-JSON text content — skip
      }
    }
  }

  return results;
}

function formatSearchResultsAsContext(results: SearchResult[]): string {
  if (results.length === 0) return "";

  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}${r.url ? `\n   URL: ${r.url}` : ""}${r.snippet ? `\n   "${r.snippet}"` : ""}`
    )
    .join("\n\n");
}

function extractEvidenceItems(
  results: SearchResult[]
): NotionContext["evidenceItems"] {
  return results.map((r) => ({
    title: r.title,
    excerpt: r.snippet,
    sourceUrl: r.url || null,
  }));
}
