/**
 * Tests for scripts/audit-cost.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'audit-cost.js');

function runCli(args, options = {}) {
  const fakeHome = options.fakeHome || fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-cost-audit-home-'));
  const result = spawnSync('node', [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || process.cwd(),
    env: {
      ...process.env,
      HOME: fakeHome,
      USERPROFILE: fakeHome
    }
  });
  if (!options.fakeHome) fs.rmSync(fakeHome, { recursive: true, force: true });
  return result;
}

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-cost-audit-project-'));
}

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
  console.log('\n=== Testing audit-cost.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('prints usage and exits 0 with --help', () => {
    const result = runCli(['--help']);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('Usage:'));
  })) passed++; else failed++;

  if (test('exits 1 with an error for a missing path', () => {
    const result = runCli(['/definitely-not-a-real-path-xyz']);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('Path not found'));
  })) passed++; else failed++;

  if (test('runs against a project path and prints a Markdown report to stdout', () => {
    const root = makeTempProject();
    try {
      const result = runCli([root]);
      assert.strictEqual(result.status, 0);
      assert.ok(result.stdout.includes('# AI Cost Audit Report'));
      assert.ok(result.stdout.includes(root));
      assert.ok(!result.stdout.includes('Current Spend'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('defaults to the current working directory when no path is given', () => {
    const root = makeTempProject();
    try {
      const result = runCli([], { cwd: root });
      assert.strictEqual(result.status, 0);
      assert.ok(result.stdout.includes(root));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('--json prints parseable JSON with all check results', () => {
    const root = makeTempProject();
    try {
      const result = runCli([root, '--json']);
      assert.strictEqual(result.status, 0);
      const payload = JSON.parse(result.stdout);
      assert.strictEqual(payload.projectRoot, root);
      assert.ok(Array.isArray(payload.results));
      assert.ok(payload.results.length >= 8);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('--out writes the report to a file instead of stdout', () => {
    const root = makeTempProject();
    const outPath = path.join(root, 'report.md');
    try {
      const result = runCli([root, '--out', outPath]);
      assert.strictEqual(result.status, 0);
      assert.ok(result.stdout.includes('Report written to'));
      assert.ok(fs.existsSync(outPath));
      assert.ok(fs.readFileSync(outPath, 'utf8').includes('# AI Cost Audit Report'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
