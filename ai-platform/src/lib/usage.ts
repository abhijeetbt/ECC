import { db } from "./db";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function tokenLimitForPlan(plan: string): number {
  if (plan === "pro") {
    return Number(process.env.PRO_TIER_TOKEN_LIMIT ?? 1_000_000);
  }
  if (plan === "team") {
    return Number(process.env.TEAM_TIER_TOKEN_LIMIT ?? 5_000_000);
  }
  return Number(process.env.FREE_TIER_TOKEN_LIMIT ?? 100_000);
}

export interface UsageSummary {
  used: number;
  limit: number;
  remaining: number;
  plan: string;
  /** True when the user has already hit their monthly allowance. */
  exceeded: boolean;
}

/** Tokens consumed by a user over the trailing 30 days. */
export async function getMonthlyTokens(userId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * MS_PER_DAY);
  const agg = await db.usage.aggregate({
    where: { userId, createdAt: { gte: since } },
    _sum: { tokens: true },
  });
  return agg._sum.tokens ?? 0;
}

export async function getUsageSummary(
  userId: string,
  plan: string,
): Promise<UsageSummary> {
  const used = await getMonthlyTokens(userId);
  const limit = tokenLimitForPlan(plan);
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    plan,
    exceeded: used >= limit,
  };
}

/** Record token spend for a processed request. */
export async function recordUsage(
  userId: string,
  tokens: number,
  feature: string,
  projectId?: string,
): Promise<void> {
  await db.usage.create({
    data: { userId, tokens, feature, projectId },
  });
}
