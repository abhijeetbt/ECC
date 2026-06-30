import { z } from "zod";

// The MVP ships a single AI capability: unit test generation. The schema is
// kept extensible (an `action` enum with one member) so Phase 2 capabilities
// can be added without reshaping the API contract.
export const SUPPORTED_LANGUAGES = ["python", "javascript"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const processRequestSchema = z.object({
  projectId: z.string().min(1),
  code: z.string().min(1, "Code is required").max(50_000, "Code is too large"),
  language: z.enum(SUPPORTED_LANGUAGES).default("python"),
  action: z.literal("generate_tests").default("generate_tests"),
});
export type ProcessRequest = z.infer<typeof processRequestSchema>;

export interface ProcessResponse {
  result: string;
  tokensUsed: number;
  success: boolean;
  error?: string;
}

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  language: z.enum(SUPPORTED_LANGUAGES).default("python"),
  code: z.string().max(50_000).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
  code: z.string().max(50_000).optional(),
});
