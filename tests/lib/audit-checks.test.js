/**
 * Tests for the AI cost-audit checks (scripts/lib/audit/checks.js).
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runChecks, loadClaudeSettings, loadMcpServerCount } = require('../../scripts/lib/audit/checks');

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

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-cost-audit-'));
}

function writeFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function findResult(results, id) {
  return results.find(entry => entry.id === id);
}

function runTests() {
  console.log('\n=== Testing audit checks ===\n');

  let passed = 0;
  let failed = 0;

  if (test('flags every default when no .claude config exists', () => {
    const root = makeTempProject();
    try {
      const results = runChecks({ projectRoot: root });
      assert.strictEqual(findResult(results, 'model-default').status, 'warn');
      assert.strictEqual(findResult(results, 'max-thinking-tokens').status, 'warn');
      assert.strictEqual(findResult(results, 'subagent-model').status, 'warn');
      assert.strictEqual(findResult(results, 'mcp-server-count').status, 'pass');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('passes Claude Code configuration checks when tuned', () => {
    const root = makeTempProject();
    try {
      writeFile(
        root,
        '.claude/settings.json',
        JSON.stringify({ model: 'sonnet', env: { MAX_THINKING_TOKENS: '10000', CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' } })
      );
      const results = runChecks({ projectRoot: root });
      assert.strictEqual(findResult(results, 'model-default').status, 'pass');
      assert.strictEqual(findResult(results, 'max-thinking-tokens').status, 'pass');
      assert.strictEqual(findResult(results, 'subagent-model').status, 'pass');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('warns on more than 10 configured MCP servers', () => {
    const root = makeTempProject();
    try {
      const servers = {};
      for (let i = 0; i < 12; i += 1) servers[`server-${i}`] = { command: 'noop' };
      writeFile(root, '.mcp.json', JSON.stringify({ mcpServers: servers }));
      const results = runChecks({ projectRoot: root });
      assert.strictEqual(findResult(results, 'mcp-server-count').status, 'warn');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('passes source-code checks when no LLM API calls exist', () => {
    const root = makeTempProject();
    try {
      writeFile(root, 'src/index.js', 'module.exports = () => 1 + 1;\n');
      const results = runChecks({ projectRoot: root });
      assert.strictEqual(findResult(results, 'hardcoded-expensive-model').status, 'pass');
      assert.strictEqual(findResult(results, 'missing-prompt-caching').status, 'pass');
      assert.strictEqual(findResult(results, 'no-budget-tracking').status, 'pass');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('flags hardcoded expensive model with no routing logic', () => {
    const root = makeTempProject();
    try {
      writeFile(root, 'src/client.js', 'const model = "claude-opus-4-5";\n');
      const results = runChecks({ projectRoot: root });
      const finding = findResult(results, 'hardcoded-expensive-model');
      assert.strictEqual(finding.status, 'warn');
      assert.ok(finding.detail.includes('src/client.js') || finding.detail.includes(path.join('src', 'client.js')));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('passes hardcoded-expensive-model check when routing logic is present', () => {
    const root = makeTempProject();
    try {
      writeFile(root, 'src/client.js', 'const model = "claude-opus-4-5";\nfunction selectModel() { return model; }\n');
      const results = runChecks({ projectRoot: root });
      assert.strictEqual(findResult(results, 'hardcoded-expensive-model').status, 'pass');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('flags missing prompt caching when API calls exist without cache_control', () => {
    const root = makeTempProject();
    try {
      writeFile(root, 'src/client.js', 'await client.messages.create({ model, messages });\n');
      const results = runChecks({ projectRoot: root });
      assert.strictEqual(findResult(results, 'missing-prompt-caching').status, 'warn');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('flags retry logic without error-type differentiation', () => {
    const root = makeTempProject();
    try {
      writeFile(root, 'src/client.js', 'const maxRetries = 3;\nfor (let i = 0; i < maxRetries; i++) { try { call(); break; } catch (e) {} }\n');
      const results = runChecks({ projectRoot: root });
      assert.strictEqual(findResult(results, 'retry-without-differentiation').status, 'warn');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('flags missing budget tracking when LLM calls exist', () => {
    const root = makeTempProject();
    try {
      writeFile(root, 'src/client.js', 'await client.messages.create({ model, messages });\n');
      const results = runChecks({ projectRoot: root });
      assert.strictEqual(findResult(results, 'no-budget-tracking').status, 'warn');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('loadClaudeSettings merges settings.json and settings.local.json, local wins', () => {
    const root = makeTempProject();
    try {
      writeFile(root, '.claude/settings.json', JSON.stringify({ model: 'opus', env: { A: '1' } }));
      writeFile(root, '.claude/settings.local.json', JSON.stringify({ model: 'sonnet', env: { B: '2' } }));
      const settings = loadClaudeSettings(root);
      assert.strictEqual(settings.model, 'sonnet');
      assert.deepStrictEqual(settings.env, { A: '1', B: '2' });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  if (test('loadMcpServerCount returns 0 for missing or malformed .mcp.json', () => {
    const root = makeTempProject();
    try {
      assert.strictEqual(loadMcpServerCount(root), 0);
      writeFile(root, '.mcp.json', 'not json');
      assert.strictEqual(loadMcpServerCount(root), 0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
