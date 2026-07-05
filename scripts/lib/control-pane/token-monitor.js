'use strict';

// Aggregates the per-session token/cost metrics that state.js already reads
// from ecc2.db into a token-monitoring view: running totals, the heaviest
// sessions, and a daily breakdown. No new data source — this projects what
// buildControlPaneSnapshot() already fetches so the dashboard can surface it.

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildTokenMonitorSnapshot(sessions = [], options = {}) {
  const topLimit = Math.max(1, Math.min(toNumber(options.limit) || 8, 50));

  const totals = { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 };
  for (const session of sessions) {
    const metrics = session.metrics || {};
    totals.inputTokens += toNumber(metrics.inputTokens);
    totals.outputTokens += toNumber(metrics.outputTokens);
    totals.totalTokens += toNumber(metrics.tokensUsed);
    totals.costUsd += toNumber(metrics.costUsd);
  }
  totals.costUsd = Number(totals.costUsd.toFixed(6));

  const topSessions = [...sessions]
    .sort((left, right) => toNumber(right.metrics && right.metrics.tokensUsed) - toNumber(left.metrics && left.metrics.tokensUsed))
    .slice(0, topLimit)
    .map(session => {
      const metrics = session.metrics || {};
      return {
        id: session.id,
        task: session.task,
        harness: session.harness,
        inputTokens: toNumber(metrics.inputTokens),
        outputTokens: toNumber(metrics.outputTokens),
        tokensUsed: toNumber(metrics.tokensUsed),
        costUsd: Number(toNumber(metrics.costUsd).toFixed(6)),
        toolCalls: toNumber(metrics.toolCalls),
        updatedAt: session.updatedAt || null
      };
    });

  const dailyBuckets = new Map();
  for (const session of sessions) {
    const day = String(session.updatedAt || session.createdAt || '').slice(0, 10);
    if (!day) continue;
    const metrics = session.metrics || {};
    const bucket = dailyBuckets.get(day) || { day, tokensUsed: 0, costUsd: 0, sessionCount: 0 };
    bucket.tokensUsed += toNumber(metrics.tokensUsed);
    bucket.costUsd += toNumber(metrics.costUsd);
    bucket.sessionCount += 1;
    dailyBuckets.set(day, bucket);
  }
  const dailyUsage = Array.from(dailyBuckets.values())
    .map(bucket => ({ ...bucket, costUsd: Number(bucket.costUsd.toFixed(6)) }))
    .sort((left, right) => right.day.localeCompare(left.day))
    .slice(0, 14);

  return { totals, topSessions, dailyUsage };
}

module.exports = {
  buildTokenMonitorSnapshot
};
