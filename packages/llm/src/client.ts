import OpenAI from "openai";

/**
 * Provider-agnostic LLM client for NVB.
 *
 * Priority order for provider selection:
 *   1. OPENAI_API_KEY  → api.openai.com
 *   2. ANTHROPIC_API_KEY → routed through OpenAI-compat endpoint
 *      TODO: Add @anthropic-ai/sdk for native Anthropic support
 *   3. OPENROUTER_API_KEY → openrouter.ai (proxy for 100+ models)
 *
 * All three use the OpenAI-compatible chat completions interface,
 * so a single client handles all three. Only the baseURL and auth change.
 *
 * For production or non-OpenAI models, replace this with a proper
 * multi-provider adapter (Vercel AI SDK is a good fit for Next.js).
 */

export type LLMProvider = "openai" | "anthropic" | "openrouter";

export interface LLMClientConfig {
  provider: LLMProvider;
  apiKey: string;
  defaultModel: string;
}

function detectProvider(): LLMClientConfig {
  if (process.env["OPENAI_API_KEY"]) {
    return {
      provider: "openai",
      apiKey: process.env["OPENAI_API_KEY"],
      defaultModel: process.env["LLM_GENERATOR_MODEL"] ?? "gpt-4o",
    };
  }
  if (process.env["OPENROUTER_API_KEY"]) {
    return {
      provider: "openrouter",
      apiKey: process.env["OPENROUTER_API_KEY"],
      defaultModel:
        process.env["LLM_GENERATOR_MODEL"] ?? "openai/gpt-4o",
    };
  }
  // TODO: native Anthropic client for full feature support (streaming, vision, etc.)
  if (process.env["ANTHROPIC_API_KEY"]) {
    throw new Error(
      "Native Anthropic support is not yet implemented. " +
        "Use OPENROUTER_API_KEY with model=anthropic/claude-3-5-sonnet, " +
        "or add @anthropic-ai/sdk to packages/llm."
    );
  }
  throw new Error(
    "No LLM provider configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY in .env."
  );
}

let _client: OpenAI | null = null;
let _config: LLMClientConfig | null = null;

export function getLLMClient(): { client: OpenAI; config: LLMClientConfig } {
  if (_client && _config) return { client: _client, config: _config };

  _config = detectProvider();

  const baseURL =
    _config.provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : undefined; // OpenAI default

  _client = new OpenAI({
    apiKey: _config.apiKey,
    baseURL,
    defaultHeaders:
      _config.provider === "openrouter"
        ? {
            "HTTP-Referer": process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000",
            "X-Title": "Notion Verdict Board",
          }
        : undefined,
  });

  return { client: _client, config: _config };
}
