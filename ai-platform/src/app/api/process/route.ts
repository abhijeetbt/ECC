import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateTests } from "@/lib/anthropic";
import { getUsageSummary, recordUsage } from "@/lib/usage";
import { processRequestSchema, type ProcessResponse } from "@/lib/types";

function fail(error: string, status: number): NextResponse<ProcessResponse> {
  return NextResponse.json(
    { result: "", tokensUsed: 0, success: false, error },
    { status },
  );
}

export async function POST(req: NextRequest) {
  // 1. Authn — and make sure we have a User row for usage/billing.
  const user = await getOrCreateUser();
  if (!user) return fail("Unauthorized", 401);

  // 2. Validate the request body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }
  const parsed = processRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid request", 400);
  }
  const { projectId, code, language, action } = parsed.data;

  // 3. Authorize — the project must belong to the caller.
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return fail("Project not found", 404);
  if (project.userId !== user.id) return fail("Forbidden", 403);

  // 4. Enforce the monthly token allowance before spending more.
  const usage = await getUsageSummary(user.id, user.plan);
  if (usage.exceeded) {
    return fail(
      "Monthly token limit reached. Upgrade your plan to continue.",
      429,
    );
  }

  // 5. Call Claude. The wrapper handles retries/streaming; we translate any
  //    failure into a clean JSON error rather than leaking a stack trace.
  let result: string;
  let tokensUsed: number;
  try {
    const generation = await generateTests(code, language);
    result = generation.text;
    tokensUsed = generation.tokensUsed;
  } catch (err) {
    console.error("[process] generation failed", err);
    const message =
      err instanceof Error ? err.message : "Processing failed. Please retry.";
    return fail(message, 502);
  }

  // 6. Record usage and cache the result on the project (best-effort — never
  //    fail the user's request because a write hiccupped).
  try {
    await recordUsage(user.id, tokensUsed, action, projectId);
    await db.project.update({
      where: { id: projectId },
      data: { code, language, lastResult: result },
    });
  } catch (err) {
    console.error("[process] post-generation persistence failed", err);
  }

  const response: ProcessResponse = { result, tokensUsed, success: true };
  return NextResponse.json(response);
}
