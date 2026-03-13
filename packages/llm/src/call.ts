import type OpenAI from "openai";
import { getLLMClient } from "./client.js";

export interface LLMCallOptions {
  model?: string;
  systemPrompt: string;
  userMessage: string;
  /**
   * If true, instructs the model to respond in JSON.
   * Parse the result yourself — do not rely on structured outputs being valid
   * without Zod validation.
   */
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCallResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Thin wrapper around OpenAI-compatible chat completion.
 * Returns raw string content + metadata.
 * Callers are responsible for parsing and validating with Zod.
 */
export async function callLLM(options: LLMCallOptions): Promise<LLMCallResult> {
  const { client, config } = getLLMClient();

  const model = options.model ?? config.defaultModel;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: options.systemPrompt },
    { role: "user", content: options.userMessage },
  ];

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 4096,
    response_format: options.jsonMode ? { type: "json_object" } : undefined,
  });

  const choice = response.choices[0];
  if (!choice || !choice.message.content) {
    throw new Error(`LLM returned empty content. Model: ${model}`);
  }

  return {
    content: choice.message.content,
    model: response.model,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
}

/**
 * Calls the LLM and parses the JSON response.
 * Uses Zod for runtime validation — throws if the response
 * doesn't match the expected schema.
 */
export async function callLLMJson<T>(
  options: LLMCallOptions,
  parser: (raw: unknown) => T
): Promise<{ result: T; model: string }> {
  const { content, model } = await callLLM({
    ...options,
    jsonMode: true,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(
      `LLM returned invalid JSON.\nModel: ${model}\nContent: ${content.slice(0, 500)}`
    );
  }

  const result = parser(parsed);
  return { result, model };
}
