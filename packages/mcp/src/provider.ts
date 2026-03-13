/**
 * ─── Context Provider Interface ───────────────────────────────────────────────
 *
 * This is the abstraction that separates how the verdict pipeline retrieves
 * Notion context from the mechanism used to retrieve it.
 *
 * Two concrete implementations:
 *
 * 1. MCPContextProvider (packages/mcp/src/mcp-client.ts)
 *    Connects to @notionhq/notion-mcp-server over HTTP transport.
 *    Calls the server's search tool with the user's raw request text.
 *    Returns matching page titles and URLs, formatted as evidenceContext.
 *    Does NOT read page body content — search results only.
 *
 * 2. DirectContextProvider (packages/mcp/src/direct-provider.ts)
 *    Queries the NVB Evidence database directly via @notionhq/client.
 *    Returns items that have a relation to the current inbox item.
 *
 * Selection: resolveContextProvider() picks MCPContextProvider if MCP_SERVER_URL
 * is set, otherwise DirectContextProvider.
 *
 * Fallback: If MCP_SERVER_URL is set but the MCP server fails at runtime,
 * resolveContextProvider() catches the error, logs a warning, and retries
 * with DirectContextProvider. The retrievedVia value in that case is
 * "mcp_fallback_to_direct" so the Run record reflects what actually happened.
 */

export interface NotionContext {
  /**
   * Pre-formatted evidence string for the generator prompt.
   * Contains evidence items from NVB Evidence, plus any related Notion pages
   * found via search.
   */
  evidenceContext: string;

  /**
   * Raw evidence items for writing back to NVB Evidence if new evidence was found.
   */
  evidenceItems: Array<{
    title: string;
    excerpt: string | null;
    sourceUrl: string | null;
  }>;

  /**
   * Which provider actually ran — stored in the Run record notes.
   *
   * Values:
   *   "mcp"                  — MCPContextProvider ran successfully
   *   "direct"               — DirectContextProvider ran (MCP_SERVER_URL not set)
   *   "mcp_fallback_to_direct" — MCP was attempted but failed; fell back to direct
   */
  retrievedVia: "mcp" | "direct" | "mcp_fallback_to_direct";
}

export interface ContextProviderOptions {
  inboxPageId: string;
  rawRequest: string;
  requestType: string;
}

/**
 * Interface that both MCPContextProvider and DirectContextProvider implement.
 */
export interface ContextProvider {
  retrieve(options: ContextProviderOptions): Promise<NotionContext>;
}
