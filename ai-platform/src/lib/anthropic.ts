import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildTestGenerationPrompt } from "./prompts";
import type { Language } from "./types";

// `max_retries` covers 429 + 5xx + connection errors with exponential backoff,
// so we don't hand-roll a retry loop. `timeout` is in milliseconds in the TS SDK.
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 4,
  timeout: 120_000,
});

// Default to the latest, most capable model. Override per-deployment via env if
// you want to trade quality for cost (e.g. claude-sonnet-4-6 / claude-haiku-4-5).
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export interface GenerationResult {
  text: string;
  tokensUsed: number;
}

/**
 * Generate unit tests for a snippet of code.
 *
 * We stream and call `finalMessage()` rather than a plain non-streaming create:
 * it gives the same single-object result while protecting against HTTP idle
 * timeouts on larger outputs. Token usage is read straight from the API
 * response (input + output) for accurate metering rather than estimating from
 * string length.
 */
export async function generateTests(
  code: string,
  language: Language,
): Promise<GenerationResult> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildTestGenerationPrompt(code, language) },
    ],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("The request was declined by the safety system.");
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const usage = message.usage;
  const tokensUsed =
    (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0);

  return { text, tokensUsed };
}
