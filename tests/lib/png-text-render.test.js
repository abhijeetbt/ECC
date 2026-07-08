/**
 * Tests for scripts/lib/png-text-render.js
 *
 * Run with: node tests/lib/png-text-render.test.js
 */

const assert = require('assert');
const { renderTextToPng, estimateImageTokens, estimateTextTokens, wordWrap } = require('../../scripts/lib/png-text-render');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

function runTests() {
  console.log('\n=== Testing png-text-render ===\n');

  let passed = 0;
  let failed = 0;

  if (
    test('wordWrap keeps lines under the requested width', () => {
      const lines = wordWrap('the quick brown fox jumps over the lazy dog', 10);
      for (const line of lines) {
        assert.ok(line.length <= 10 || !line.includes(' '), `line "${line}" exceeds width`);
      }
      assert.strictEqual(lines.join(' ').replace(/\s+/g, ' '), 'the quick brown fox jumps over the lazy dog');
    })
  )
    passed++;
  else failed++;

  if (
    test('renderTextToPng produces a real, valid PNG signature', () => {
      const { png } = renderTextToPng('the quick brown fox');
      const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      assert.ok(PNG_SIGNATURE.equals(png.subarray(0, 8)));
    })
  )
    passed++;
  else failed++;

  if (
    test('renderTextToPng dimensions match declared width/height in IHDR', () => {
      const { png, width, height } = renderTextToPng('the quick brown fox jumps over the lazy dog');
      assert.strictEqual(png.readUInt32BE(16), width);
      assert.strictEqual(png.readUInt32BE(20), height);
    })
  )
    passed++;
  else failed++;

  if (
    test('longer text produces more pixels (taller or wider)', () => {
      const short = renderTextToPng('dog');
      const long = renderTextToPng('the quick brown fox jumps over the lazy dog '.repeat(10));
      assert.ok(long.width * long.height > short.width * short.height);
    })
  )
    passed++;
  else failed++;

  if (
    test('image token estimate exceeds text token estimate for a full sentence', () => {
      const text = 'the quick brown fox jumps over the lazy dog '.repeat(10).trim();
      const { width, height } = renderTextToPng(text);
      const imageTokens = estimateImageTokens(width, height);
      const textTokens = estimateTextTokens(text);
      // Documents the actual tradeoff: legible-text images cost more tokens than plain text,
      // not less — see scripts/render-cost-demo.js for the full comparison.
      assert.ok(imageTokens > textTokens, `image tokens (${imageTokens}) should exceed text tokens (${textTokens})`);
    })
  )
    passed++;
  else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
