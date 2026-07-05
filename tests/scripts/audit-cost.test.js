/**
 * Tests for scripts/audit-cost.js
 */

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

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

// spawnSync blocks this process's event loop for the child's entire
// lifetime, so it cannot be used for --push tests: the in-process mock
// ingest server below would never get to run its request handler while
// the parent is blocked waiting on the child, and both sides would hang
// forever. Use async spawn instead so the event loop stays free.
function runCliAsync(args, options = {}) {
  const fakeHome = options.fakeHome || fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-cost-audit-home-'));
  return new Promise((resolve, reject) => {
    const child = spawn('node', [SCRIPT, ...args], {
      cwd: options.cwd || process.cwd(),
      env: {
        ...process.env,
        HOME: fakeHome,
        USERPROFILE: fakeHome
      }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', status => {
      if (!options.fakeHome) fs.rmSync(fakeHome, { recursive: true, force: true });
      resolve({ status, stdout, stderr });
    });
  });
}

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-cost-audit-project-'));
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS ${name}`);
    return true;
  } catch (error) {
    console.log(`  FAIL ${name}`);
    console.log(`    Error: ${error.message}`);
    return false;
  }
}

function startMockIngestServer(handler) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        handler(req, res, body ? JSON.parse(body) : {});
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/api/ingest` });
    });
  });
}

function closeServer(server) {
  return new Promise(resolve => server.close(resolve));
}

async function runTests() {
  console.log('\n=== Testing audit-cost.js ===\n');

  let passed = 0;
  let failed = 0;

  if (await test('prints usage and exits 0 with --help', () => {
    const result = runCli(['--help']);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('Usage:'));
  })) passed++; else failed++;

  if (await test('exits 1 with an error for a missing path', () => {
    const result = runCli(['/definitely-not-a-real-path-xyz']);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('Path not found'));
  })) passed++; else failed++;

  if (await test('runs against a project path and prints a Markdown report to stdout', () => {
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

  if (await test('defaults to the current working directory when no path is given', () => {
    const root = makeTempProject();
    try {
      const result = runCli([], { cwd: root });
      assert.strictEqual(result.status, 0);
      assert.ok(result.stdout.includes(root));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (await test('--json prints parseable JSON with all check results', () => {
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

  if (await test('--out writes the report to a file instead of stdout', () => {
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

  if (await test('--push without --key exits 1 with an error', () => {
    const root = makeTempProject();
    try {
      const result = runCli([root, '--push', 'http://127.0.0.1:1/api/ingest']);
      assert.strictEqual(result.status, 1);
      assert.ok(result.stderr.includes('--push requires --key'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (await test('--push posts results (not source code) to the ingest endpoint', async () => {
    const root = makeTempProject();
    let received = null;
    const { server, url } = await startMockIngestServer((req, res, body) => {
      received = { headers: req.headers, body };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, findingsCount: 1, passedCount: 7 }));
    });
    try {
      const result = await runCliAsync([root, '--push', url, '--key', 'test-api-key']);
      assert.strictEqual(result.status, 0);
      assert.ok(result.stdout.includes(`Pushed results to ${url}`));
      assert.ok(result.stdout.includes('"findingsCount":1'));
      assert.strictEqual(received.headers['x-api-key'], 'test-api-key');
      assert.strictEqual(received.body.projectRoot, root);
      assert.ok(Array.isArray(received.body.results));
      assert.ok(received.body.results.length >= 8);
      assert.ok(!JSON.stringify(received.body).includes('module.exports'));
    } finally {
      await closeServer(server);
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (await test('--push surfaces a non-2xx response as a failure', async () => {
    const root = makeTempProject();
    const { server, url } = await startMockIngestServer((req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Invalid or revoked API key' }));
    });
    try {
      const result = await runCliAsync([root, '--push', url, '--key', 'bad-key']);
      assert.strictEqual(result.status, 1);
      assert.ok(result.stderr.includes('Push failed (401)'));
      assert.ok(result.stderr.includes('Invalid or revoked API key'));
    } finally {
      await closeServer(server);
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
