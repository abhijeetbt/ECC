import type { Language } from "./types";

const FRAMEWORK: Record<Language, string> = {
  python: "pytest",
  javascript: "Jest",
};

export const SYSTEM_PROMPT = [
  "You are an expert software engineer who writes thorough, idiomatic unit tests.",
  "You are given a snippet of source code. Generate a complete, runnable unit test file for it.",
  "",
  "Requirements:",
  "- Cover the happy path, edge cases, and error/exception handling.",
  "- Use clear, descriptive test names.",
  "- Include only the test code plus any imports it needs — no prose, no explanation.",
  "- Do not invent functions that are not present in the provided code.",
  "- If the code has no testable behavior, return a single comment explaining why.",
  "- Return the test file inside one fenced code block and nothing else.",
].join("\n");

export function buildTestGenerationPrompt(code: string, language: Language): string {
  const framework = FRAMEWORK[language];
  return [
    `Language: ${language}`,
    `Test framework: ${framework}`,
    "",
    "Generate unit tests for the following code:",
    "",
    "```" + language,
    code,
    "```",
  ].join("\n");
}
