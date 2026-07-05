'use strict';

// Heuristic AI-cost audit checks. Each check is a first-pass signal for a
// human to verify, not a definitive finding — grep-based source scanning has
// false positives/negatives. Checks are plain data (id/title/category/run)
// so the list can grow without touching the runner or the report renderer.

const fs = require('fs');
const path = require('path');

const SOURCE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.mjs', '.cjs']);
const IGNORED_DIR_NAMES = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'vendor', '__pycache__', '.venv', 'venv']);
const MAX_SOURCE_FILES = 2000;
const MAX_FILE_BYTES = 512 * 1024;

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function loadClaudeSettings(projectRoot) {
  const candidates = [path.join(projectRoot, '.claude', 'settings.json'), path.join(projectRoot, '.claude', 'settings.local.json')];
  let merged = {};
  for (const candidate of candidates) {
    const parsed = readJsonSafe(candidate);
    if (!parsed || typeof parsed !== 'object') continue;
    merged = { ...merged, ...parsed, env: { ...(merged.env || {}), ...(parsed.env || {}) } };
  }
  return merged;
}

function loadMcpServerCount(projectRoot) {
  const parsed = readJsonSafe(path.join(projectRoot, '.mcp.json'));
  if (!parsed || typeof parsed !== 'object') return 0;
  const servers = parsed.mcpServers || parsed.servers || {};
  return Object.keys(servers).length;
}

function listSourceFiles(projectRoot) {
  const files = [];
  const stack = [projectRoot];

  while (stack.length && files.length < MAX_SOURCE_FILES) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (files.length >= MAX_SOURCE_FILES) break;
      if (entry.name.startsWith('.') && entry.name !== '.claude') continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIR_NAMES.has(entry.name)) stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function readSourceCorpus(projectRoot) {
  const files = listSourceFiles(projectRoot);
  const matches = [];

  for (const filePath of files) {
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    if (stat.size > MAX_FILE_BYTES) continue;

    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    matches.push({ filePath: path.relative(projectRoot, filePath), content });
  }

  return matches;
}

function findMatchingFiles(corpus, pattern) {
  return corpus.filter(entry => pattern.test(entry.content)).map(entry => entry.filePath);
}

function buildContext(projectRoot) {
  return {
    projectRoot,
    settings: loadClaudeSettings(projectRoot),
    mcpServerCount: loadMcpServerCount(projectRoot),
    sourceCorpus: readSourceCorpus(projectRoot)
  };
}

function result(id, title, category, status, detail, recommendation) {
  return { id, title, category, status, detail, recommendation };
}

const CHECKS = [
  {
    id: 'model-default',
    title: 'Default model is not the cheapest viable option',
    category: 'Claude Code Configuration',
    run(ctx) {
      const model = ctx.settings.model;
      if (!model) {
        return result(this.id, this.title, this.category, 'warn', 'No `model` set in .claude/settings.json — Claude Code defaults to Opus.', 'Set `"model": "sonnet"` as the default; use `/model opus` only for complex reasoning tasks.');
      }
      if (String(model).toLowerCase() === 'opus') {
        return result(this.id, this.title, this.category, 'warn', 'Default model is explicitly set to Opus.', 'Switch the default to `sonnet` (handles most coding tasks) and reserve Opus for `/model opus` on demand.');
      }
      return result(this.id, this.title, this.category, 'pass', `Default model is "${model}".`, null);
    }
  },
  {
    id: 'max-thinking-tokens',
    title: 'Extended thinking budget is unbounded or high',
    category: 'Claude Code Configuration',
    run(ctx) {
      const raw = ctx.settings.env && ctx.settings.env.MAX_THINKING_TOKENS;
      const value = Number(raw);
      if (!raw) {
        return result(this.id, this.title, this.category, 'warn', 'MAX_THINKING_TOKENS is unset — defaults to 31,999 output tokens reserved for reasoning per request.', 'Set `MAX_THINKING_TOKENS=10000` (or lower for simple tasks) in .claude/settings.json.');
      }
      if (Number.isFinite(value) && value > 15000) {
        return result(this.id, this.title, this.category, 'warn', `MAX_THINKING_TOKENS is set to ${value}, well above the recommended 10,000 default.`, 'Lower MAX_THINKING_TOKENS unless the team regularly does complex architectural work.');
      }
      return result(this.id, this.title, this.category, 'pass', `MAX_THINKING_TOKENS is ${raw}.`, null);
    }
  },
  {
    id: 'subagent-model',
    title: 'Subagents inherit the expensive main model',
    category: 'Claude Code Configuration',
    run(ctx) {
      const value = ctx.settings.env && ctx.settings.env.CLAUDE_CODE_SUBAGENT_MODEL;
      if (!value) {
        return result(this.id, this.title, this.category, 'warn', 'CLAUDE_CODE_SUBAGENT_MODEL is unset — subagents (Task tool) run on the main model.', 'Set `CLAUDE_CODE_SUBAGENT_MODEL=haiku`; it is ~80% cheaper and sufficient for exploration/file reading.');
      }
      if (String(value).toLowerCase() !== 'haiku') {
        return result(this.id, this.title, this.category, 'warn', `CLAUDE_CODE_SUBAGENT_MODEL is set to "${value}", not the cheapest tier.`, 'Consider haiku for subagent exploration tasks unless subagents do complex reasoning.');
      }
      return result(this.id, this.title, this.category, 'pass', 'Subagents run on haiku.', null);
    }
  },
  {
    id: 'mcp-server-count',
    title: 'Too many MCP servers enabled',
    category: 'Claude Code Configuration',
    run(ctx) {
      if (ctx.mcpServerCount > 10) {
        return result(this.id, this.title, this.category, 'warn', `${ctx.mcpServerCount} MCP servers configured in .mcp.json.`, 'Each enabled MCP server adds tool definitions to every request\'s context window. Trim to under 10 per project; prefer CLI tools where available.');
      }
      return result(this.id, this.title, this.category, 'pass', `${ctx.mcpServerCount} MCP server(s) configured.`, null);
    }
  },
  {
    id: 'hardcoded-expensive-model',
    title: 'Expensive model hardcoded without complexity-based routing',
    category: 'Source Code Patterns',
    run(ctx) {
      const expensiveModelFiles = findMatchingFiles(ctx.sourceCorpus, /["'`](claude-opus|gpt-4(?!o-mini)|o1-preview)/i);
      if (expensiveModelFiles.length === 0) {
        return result(this.id, this.title, this.category, 'pass', 'No hardcoded expensive-model references found.', null);
      }
      const routingFiles = findMatchingFiles(ctx.sourceCorpus, /select_model|selectModel|route_model|routeModel|model_router|modelRouter/);
      if (routingFiles.length === 0) {
        return result(
          this.id,
          this.title,
          this.category,
          'warn',
          `Found expensive model references with no model-routing logic in: ${expensiveModelFiles.slice(0, 5).join(', ')}`,
          'Add complexity-based model routing (cheap model by default, expensive model only above a threshold) — see skills/cost-aware-llm-pipeline/SKILL.md.'
        );
      }
      return result(this.id, this.title, this.category, 'pass', 'Expensive model references found alongside routing logic.', null);
    }
  },
  {
    id: 'missing-prompt-caching',
    title: 'LLM API calls without prompt caching',
    category: 'Source Code Patterns',
    run(ctx) {
      const apiCallFiles = findMatchingFiles(ctx.sourceCorpus, /messages\.create\s*\(|client\.messages/);
      if (apiCallFiles.length === 0) {
        return result(this.id, this.title, this.category, 'pass', 'No direct Anthropic Messages API calls found.', null);
      }
      const cacheFiles = findMatchingFiles(ctx.sourceCorpus, /cache_control/);
      if (cacheFiles.length === 0) {
        return result(
          this.id,
          this.title,
          this.category,
          'warn',
          `API calls found in ${apiCallFiles.length} file(s) with no \`cache_control\` usage anywhere in the codebase.`,
          'Add prompt caching (`cache_control: { type: "ephemeral" }`) for system prompts/context reused across calls — see skills/cost-aware-llm-pipeline/SKILL.md.'
        );
      }
      return result(this.id, this.title, this.category, 'pass', 'Prompt caching (cache_control) is in use.', null);
    }
  },
  {
    id: 'retry-without-differentiation',
    title: 'Retry logic may retry on permanent failures',
    category: 'Source Code Patterns',
    run(ctx) {
      const retryFiles = findMatchingFiles(ctx.sourceCorpus, /max_retries|maxRetries|retry_count|retryCount/);
      if (retryFiles.length === 0) {
        return result(this.id, this.title, this.category, 'pass', 'No retry-loop patterns found around API calls.', null);
      }
      const differentiatedFiles = findMatchingFiles(ctx.sourceCorpus, /RateLimitError|APIConnectionError|InternalServerError|ECONNRESET|status\s*===?\s*429|status\s*===?\s*5\d\d/);
      if (differentiatedFiles.length === 0) {
        return result(
          this.id,
          this.title,
          this.category,
          'warn',
          `Retry logic found in ${retryFiles.slice(0, 5).join(', ')} with no visible error-type filtering.`,
          'Retry only on transient errors (rate limit, connection, 5xx); fail fast on auth/validation errors to avoid wasting budget on permanent failures.'
        );
      }
      return result(this.id, this.title, this.category, 'pass', 'Retry logic appears to filter by error type.', null);
    }
  },
  {
    id: 'no-budget-tracking',
    title: 'No cost/budget tracking around LLM calls',
    category: 'Source Code Patterns',
    run(ctx) {
      const apiCallFiles = findMatchingFiles(ctx.sourceCorpus, /messages\.create\s*\(|client\.messages|openai\.chat\.completions/i);
      if (apiCallFiles.length === 0) {
        return result(this.id, this.title, this.category, 'pass', 'No direct LLM API calls found.', null);
      }
      const budgetFiles = findMatchingFiles(ctx.sourceCorpus, /cost_usd|costUsd|budget_limit|budgetLimit|CostTracker|track_cost|trackCost/);
      if (budgetFiles.length === 0) {
        return result(
          this.id,
          this.title,
          this.category,
          'warn',
          `LLM API calls found in ${apiCallFiles.length} file(s) with no cost/budget tracking detected.`,
          'Track cumulative spend per run/batch and fail fast when a budget limit is exceeded — see skills/cost-aware-llm-pipeline/SKILL.md.'
        );
      }
      return result(this.id, this.title, this.category, 'pass', 'Cost/budget tracking detected.', null);
    }
  }
];

function runChecks(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const ctx = buildContext(projectRoot);
  return CHECKS.map(check => check.run(ctx));
}

module.exports = {
  CHECKS,
  runChecks,
  buildContext,
  loadClaudeSettings,
  loadMcpServerCount,
  listSourceFiles,
  readSourceCorpus,
  findMatchingFiles
};
