/**
 * Tests for the AI cost-audit Markdown report renderer.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { renderMarkdownReport, loadCurrentSpendSummary, summarize } = require('../../scripts/lib/audit/report');

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS ${name}`);
    return true;
  } catch (error) {
    console.log(`  FAIL ${name}`);
    console.log(`    Error: ${error.message}`);
    return false;
  }
}

const SAMPLE_RESULTS = [
  { id: 'model-default', title: 'Default model', category: 'Claude Code Configuration', status: 'warn', detail: 'No model set.', recommendation: 'Set sonnet.' },
  { id: 'mcp-server-count', title: 'MCP servers', category: 'Claude Code Configuration', status: 'pass', detail: '1 configured.', recommendation: null },
  { id: 'missing-prompt-caching', title: 'Prompt caching', category: 'Source Code Patterns', status: 'warn', detail: 'No cache_control found.', recommendation: 'Add caching.' }
];

function runTests() {
  console.log('\n=== Testing audit report renderer ===\n');

  let passed = 0;
  let failed = 0;

  if (test('summarize counts findings, passes, and not-applicable entries', () => {
    const summary = summarize(SAMPLE_RESULTS);
    assert.strictEqual(summary.findings, 2);
    assert.strictEqual(summary.passed, 1);
    assert.strictEqual(summary.notApplicable, 0);
  })) passed++; else failed++;

  if (test('renders a Markdown report with summary, findings, and reference section', () => {
    const report = renderMarkdownReport(SAMPLE_RESULTS, { projectRoot: '/repo/client', generatedAt: '2026-07-05T00:00:00Z' });
    assert.ok(report.includes('# AI Cost Audit Report'));
    assert.ok(report.includes('/repo/client'));
    assert.ok(report.includes('**2** finding(s) worth acting on'));
    assert.ok(report.includes('**1** check(s) already in good shape'));
    assert.ok(report.includes('[FINDING] Default model'));
    assert.ok(report.includes('[OK] MCP servers'));
    assert.ok(report.includes('**Recommendation:** Set sonnet.'));
    assert.ok(report.includes('## Claude Code Configuration'));
    assert.ok(report.includes('## Source Code Patterns'));
    assert.ok(report.includes('skills/cost-aware-llm-pipeline/SKILL.md'));
  })) passed++; else failed++;

  if (test('omits the current-spend section when no spend summary is provided', () => {
    const report = renderMarkdownReport(SAMPLE_RESULTS, { projectRoot: '/repo/client' });
    assert.ok(!report.includes('Current Spend'));
  })) passed++; else failed++;

  if (test('includes the current-spend section when a spend summary is provided', () => {
    const report = renderMarkdownReport(SAMPLE_RESULTS, {
      projectRoot: '/repo/client',
      currentSpend: { sessionCount: 3, totalCostUsd: 1.5, byModel: [{ model: 'sonnet', costUsd: 1.5 }] }
    });
    assert.ok(report.includes('## Current Spend (from local cost tracker)'));
    assert.ok(report.includes('Sessions tracked: 3'));
    assert.ok(report.includes('sonnet: $1.5000'));
  })) passed++; else failed++;

  if (test('loadCurrentSpendSummary returns null when costs.jsonl does not exist', () => {
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-cost-audit-home-'));
    try {
      assert.strictEqual(loadCurrentSpendSummary({ HOME: fakeHome }), null);
    } finally {
      fs.rmSync(fakeHome, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
