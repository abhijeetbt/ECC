'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Reuses the same costs.jsonl schema the `stop:cost-tracker` hook writes and
// the /cost-report command reads (one cumulative snapshot per session-stop).
// Optional: only included in the report when the file exists, so this module
// works standalone against a client machine that never enabled the tracker.
function homeDir(env) {
  return env.HOME || env.USERPROFILE || os.homedir() || '.';
}

function loadCurrentSpendSummary(env = process.env) {
  const costsPath = path.join(homeDir(env), '.claude', 'metrics', 'costs.jsonl');
  if (!fs.existsSync(costsPath)) return null;

  let rows;
  try {
    rows = fs
      .readFileSync(costsPath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return null;
  }

  const bySession = new Map();
  for (const row of rows) {
    const key = row.session_id || row.transcript_path || row.timestamp;
    const previous = bySession.get(key);
    if (!previous || String(row.timestamp) > String(previous.timestamp)) bySession.set(key, row);
  }
  const latest = [...bySession.values()];
  if (latest.length === 0) return null;

  const totalCostUsd = latest.reduce((sum, row) => sum + (Number(row.estimated_cost_usd) || 0), 0);
  const byModel = new Map();
  for (const row of latest) {
    const model = row.model || '(unknown)';
    byModel.set(model, (byModel.get(model) || 0) + (Number(row.estimated_cost_usd) || 0));
  }

  return {
    sessionCount: latest.length,
    totalCostUsd: Number(totalCostUsd.toFixed(4)),
    byModel: [...byModel.entries()].sort((a, b) => b[1] - a[1]).map(([model, costUsd]) => ({ model, costUsd: Number(costUsd.toFixed(4)) }))
  };
}

const STATUS_LABEL = { warn: 'FINDING', pass: 'OK', 'not-applicable': 'N/A' };

function summarize(results) {
  return results.reduce(
    (summary, entry) => {
      if (entry.status === 'warn') summary.findings += 1;
      else if (entry.status === 'pass') summary.passed += 1;
      else summary.notApplicable += 1;
      return summary;
    },
    { findings: 0, passed: 0, notApplicable: 0 }
  );
}

function groupByCategory(results) {
  const groups = new Map();
  for (const entry of results) {
    const bucket = groups.get(entry.category) || [];
    bucket.push(entry);
    groups.set(entry.category, bucket);
  }
  return groups;
}

function renderMarkdownReport(results, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const generatedAt = options.generatedAt || new Date().toISOString();
  const summary = summarize(results);
  const groups = groupByCategory(results);
  const spend = options.currentSpend;

  const lines = [];
  lines.push('# AI Cost Audit Report');
  lines.push('');
  lines.push(`Project: \`${projectRoot}\``);
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  lines.push('> Heuristic, grep-based first pass — a signal for manual review, not a definitive audit.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **${summary.findings}** finding(s) worth acting on`);
  lines.push(`- **${summary.passed}** check(s) already in good shape`);
  if (summary.notApplicable > 0) lines.push(`- **${summary.notApplicable}** check(s) not applicable`);
  lines.push('');

  if (spend) {
    lines.push('## Current Spend (from local cost tracker)');
    lines.push('');
    lines.push(`- Sessions tracked: ${spend.sessionCount}`);
    lines.push(`- Total tracked cost: $${spend.totalCostUsd.toFixed(4)}`);
    if (spend.byModel.length > 0) {
      lines.push('- By model:');
      for (const entry of spend.byModel) {
        lines.push(`  - ${entry.model}: $${entry.costUsd.toFixed(4)}`);
      }
    }
    lines.push('');
  }

  for (const [category, entries] of groups) {
    lines.push(`## ${category}`);
    lines.push('');
    for (const entry of entries) {
      const label = STATUS_LABEL[entry.status] || entry.status.toUpperCase();
      lines.push(`### [${label}] ${entry.title}`);
      lines.push('');
      lines.push(entry.detail);
      if (entry.recommendation) {
        lines.push('');
        lines.push(`**Recommendation:** ${entry.recommendation}`);
      }
      lines.push('');
    }
  }

  lines.push('## Reference');
  lines.push('');
  lines.push('- `skills/cost-aware-llm-pipeline/SKILL.md` — model routing, budget tracking, retry logic, prompt caching patterns');
  lines.push('- `docs/token-optimization.md` — Claude Code settings and context-management practices');

  return `${lines.join('\n')}\n`;
}

module.exports = {
  renderMarkdownReport,
  loadCurrentSpendSummary,
  summarize
};
