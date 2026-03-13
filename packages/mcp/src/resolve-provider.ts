import type { ContextProvider, ContextProviderOptions, NotionContext } from "./provider.js";
import { MCPContextProvider } from "./mcp-client.js";
import { DirectContextProvider } from "./direct-provider.js";

/**
 * ─── Provider Resolution ──────────────────────────────────────────────────────
 *
 * Returns a ContextProvider based on environment configuration.
 *
 * Behavior:
 *
 *   MCP_SERVER_URL is NOT set:
 *     → Returns DirectContextProvider immediately.
 *       No MCP connection is attempted.
 *
 *   MCP_SERVER_URL IS set:
 *     → Returns a FallbackContextProvider that wraps MCPContextProvider.
 *       At retrieve() time, it first attempts MCPContextProvider.
 *       If that throws (server unreachable, tool not found, network error),
 *       it logs a warning and retries with DirectContextProvider.
 *       The retrievedVia field in the returned NotionContext will be:
 *         "mcp"                    — MCP succeeded
 *         "mcp_fallback_to_direct" — MCP failed, direct was used
 *
 * Auditability:
 *   The verdict workflow writes retrievedVia into the Run record notes,
 *   so every run has a machine-readable record of which path actually ran.
 *   "mcp_fallback_to_direct" is distinguishable from "direct" (never tried MCP)
 *   and from "mcp" (MCP succeeded).
 */
export function resolveContextProvider(): ContextProvider {
  const mcpUrl = process.env["MCP_SERVER_URL"];

  if (!mcpUrl) {
    console.log("[context] MCP_SERVER_URL not set — using direct Notion API provider");
    return new DirectContextProvider();
  }

  const authToken = process.env["MCP_AUTH_TOKEN"];
  console.log(`[context] MCP_SERVER_URL set — attempting MCPContextProvider at ${mcpUrl}`);
  return new FallbackContextProvider(
    new MCPContextProvider(mcpUrl, authToken),
    new DirectContextProvider()
  );
}

/**
 * ─── FallbackContextProvider ─────────────────────────────────────────────────
 *
 * Tries the primary provider. If it throws, logs a warning and falls back
 * to the secondary provider. Stamps retrievedVia = "mcp_fallback_to_direct"
 * on the result so the Run record honestly reflects what happened.
 *
 * Not exported from the package — only resolveContextProvider() should
 * construct this. Callers receive a ContextProvider and don't need to
 * know which concrete type they have.
 */
class FallbackContextProvider implements ContextProvider {
  constructor(
    private readonly primary: ContextProvider,
    private readonly secondary: ContextProvider
  ) {}

  async retrieve(options: ContextProviderOptions): Promise<NotionContext> {
    try {
      return await this.primary.retrieve(options);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[context] MCPContextProvider failed: ${msg}\n` +
          `[context] Falling back to DirectContextProvider. ` +
          `Run record will show retrievedVia=mcp_fallback_to_direct.`
      );

      const fallbackResult = await this.secondary.retrieve(options);

      // Override retrievedVia so the Run record distinguishes this case
      // from a clean "direct" run where MCP was never attempted.
      return {
        ...fallbackResult,
        retrievedVia: "mcp_fallback_to_direct",
      };
    }
  }
}
