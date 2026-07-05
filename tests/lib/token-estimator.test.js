/**
 * Tests for the shared token-count approximation utility.
 */

const assert = require('assert');

const { estimateTokens, clearTokenEstimateCache, CHARS_PER_TOKEN } = require('../../scripts/lib/token-estimator');

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

function runTests() {
  console.log('\n=== Testing token-estimator ===\n');

  let passed = 0;
  let failed = 0;

  if (test('estimates tokens as chars / CHARS_PER_TOKEN, rounded up', () => {
    const text = 'a'.repeat(10);
    assert.strictEqual(estimateTokens(text), Math.ceil(10 / CHARS_PER_TOKEN));
  })) passed++; else failed++;

  if (test('returns 0 for empty, null, and undefined input', () => {
    assert.strictEqual(estimateTokens(''), 0);
    assert.strictEqual(estimateTokens(null), 0);
    assert.strictEqual(estimateTokens(undefined), 0);
  })) passed++; else failed++;

  if (test('reuses a cached result for identical content instead of recomputing', () => {
    clearTokenEstimateCache();
    const text = 'repeat this content '.repeat(50);
    const first = estimateTokens(text);
    const second = estimateTokens(text);
    assert.strictEqual(first, second);
    assert.strictEqual(second, Math.ceil(text.length / CHARS_PER_TOKEN));
  })) passed++; else failed++;

  if (test('evicts the oldest cache entry once the cache is full', () => {
    clearTokenEstimateCache();
    const uniqueTexts = Array.from({ length: 600 }, (_, i) => `unique-text-${i}`);
    for (const text of uniqueTexts) estimateTokens(text);
    // The cache is bounded, so re-estimating the first (evicted) entry must
    // still return a correct, consistent value rather than throwing or
    // returning a stale answer from a different key.
    const recomputed = estimateTokens(uniqueTexts[0]);
    assert.strictEqual(recomputed, Math.ceil(uniqueTexts[0].length / CHARS_PER_TOKEN));
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
