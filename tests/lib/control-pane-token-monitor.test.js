/**
 * Tests for the control-pane token-monitoring projection.
 */

const assert = require('assert');

const { buildTokenMonitorSnapshot } = require('../../scripts/lib/control-pane/token-monitor');

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

const SAMPLE_SESSIONS = [
  {
    id: 'lead-hermes',
    task: 'Coordinate release work',
    harness: 'claude',
    updatedAt: '2026-06-03T10:15:00Z',
    createdAt: '2026-06-03T10:00:00Z',
    metrics: { inputTokens: 1200, outputTokens: 800, tokensUsed: 2000, toolCalls: 19, costUsd: 0.42 }
  },
  {
    id: 'worker-kb',
    task: 'Index operator memory',
    harness: 'codex',
    updatedAt: '2026-06-03T10:14:00Z',
    createdAt: '2026-06-03T10:05:00Z',
    metrics: { inputTokens: 300, outputTokens: 200, tokensUsed: 500, toolCalls: 4, costUsd: 0.07 }
  },
  {
    id: 'worker-old',
    task: 'Yesterday cleanup',
    harness: 'codex',
    updatedAt: '2026-06-02T09:00:00Z',
    createdAt: '2026-06-02T08:50:00Z',
    metrics: { inputTokens: 100, outputTokens: 50, tokensUsed: 150, toolCalls: 2, costUsd: 0.01 }
  }
];

function runTests() {
  console.log('\n=== Testing control-pane token-monitor ===\n');

  let passed = 0;
  let failed = 0;

  if (test('sums totals across all sessions', () => {
    const snapshot = buildTokenMonitorSnapshot(SAMPLE_SESSIONS);
    assert.strictEqual(snapshot.totals.totalTokens, 2650);
    assert.strictEqual(snapshot.totals.inputTokens, 1600);
    assert.strictEqual(snapshot.totals.outputTokens, 1050);
    assert.strictEqual(snapshot.totals.costUsd, 0.5);
  })) passed++; else failed++;

  if (test('ranks top sessions by tokens used, descending', () => {
    const snapshot = buildTokenMonitorSnapshot(SAMPLE_SESSIONS);
    assert.deepStrictEqual(snapshot.topSessions.map(s => s.id), ['lead-hermes', 'worker-kb', 'worker-old']);
    assert.strictEqual(snapshot.topSessions[0].tokensUsed, 2000);
  })) passed++; else failed++;

  if (test('respects the limit option', () => {
    const snapshot = buildTokenMonitorSnapshot(SAMPLE_SESSIONS, { limit: 1 });
    assert.strictEqual(snapshot.topSessions.length, 1);
    assert.strictEqual(snapshot.topSessions[0].id, 'lead-hermes');
  })) passed++; else failed++;

  if (test('buckets daily usage by updatedAt date, newest first', () => {
    const snapshot = buildTokenMonitorSnapshot(SAMPLE_SESSIONS);
    assert.deepStrictEqual(snapshot.dailyUsage.map(d => d.day), ['2026-06-03', '2026-06-02']);
    assert.strictEqual(snapshot.dailyUsage[0].tokensUsed, 2500);
    assert.strictEqual(snapshot.dailyUsage[0].sessionCount, 2);
  })) passed++; else failed++;

  if (test('handles an empty session list', () => {
    const snapshot = buildTokenMonitorSnapshot([]);
    assert.strictEqual(snapshot.totals.totalTokens, 0);
    assert.deepStrictEqual(snapshot.topSessions, []);
    assert.deepStrictEqual(snapshot.dailyUsage, []);
  })) passed++; else failed++;

  if (test('tolerates sessions with missing metrics', () => {
    const snapshot = buildTokenMonitorSnapshot([{ id: 'no-metrics', updatedAt: '2026-06-03T00:00:00Z' }]);
    assert.strictEqual(snapshot.totals.totalTokens, 0);
    assert.strictEqual(snapshot.topSessions[0].tokensUsed, 0);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
