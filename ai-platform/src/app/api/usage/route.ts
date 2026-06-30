import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { getUsageSummary } from "@/lib/usage";

// GET /api/usage — the caller's trailing-30-day token usage and plan limits.
export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await getUsageSummary(user.id, user.plan);
  return NextResponse.json(summary);
}
