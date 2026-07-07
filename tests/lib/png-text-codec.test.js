/**
 * Tests for scripts/lib/png-text-codec.js
 *
 * Run with: node tests/lib/png-text-codec.test.js
 */

const assert = require('assert');
const { encodeTextToPng, decodePngToText, getEncodingStats } = require('../../scripts/lib/png-text-codec');

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
  console.log('\n=== Testing png-text-codec ===\n');

  let passed = 0;
  let failed = 0;

  if (
    test('round-trips plain text', () => {
      const text = 'hello world';
      const png = encodeTextToPng(text);
      assert.strictEqual(decodePngToText(png), text);
    })
  )
    passed++;
  else failed++;

  if (
    test('round-trips empty string', () => {
      const png = encodeTextToPng('');
      assert.strictEqual(decodePngToText(png), '');
    })
  )
    passed++;
  else failed++;

  if (
    test('round-trips unicode text', () => {
      const text = '日本語のテキスト 🎉 café';
      const png = encodeTextToPng(text);
      assert.strictEqual(decodePngToText(png), text);
    })
  )
    passed++;
  else failed++;

  if (
    test('round-trips long repetitive text', () => {
      const text = 'the quick brown fox jumps over the lazy dog. '.repeat(500);
      const png = encodeTextToPng(text);
      assert.strictEqual(decodePngToText(png), text);
    })
  )
    passed++;
  else failed++;

  if (
    test('output is a valid PNG signature', () => {
      const png = encodeTextToPng('signature check');
      const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      assert.ok(PNG_SIGNATURE.equals(png.subarray(0, 8)));
    })
  )
    passed++;
  else failed++;

  if (
    test('decodePngToText rejects non-PNG input', () => {
      assert.throws(() => decodePngToText(Buffer.from('not a png')), /bad signature/);
    })
  )
    passed++;
  else failed++;

  if (
    test('getEncodingStats reports pixel count and comparison to plain gzip', () => {
      const text = 'lorem ipsum dolor sit amet '.repeat(50);
      const stats = getEncodingStats(text);
      assert.ok(stats.pixelCount > 0);
      assert.strictEqual(stats.height, 1);
      assert.strictEqual(stats.width, stats.pixelCount);
      assert.ok(stats.pngBytes > 0);
      assert.ok(stats.plainGzipBytes > 0);
      // Documents the actual tradeoff: the PNG container is never smaller than plain gzip.
      assert.ok(stats.pngBytes >= stats.plainGzipBytes);
    })
  )
    passed++;
  else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
