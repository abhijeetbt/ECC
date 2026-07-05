#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { runChecks } = require('./lib/audit/checks');
const { renderMarkdownReport, loadCurrentSpendSummary } = require('./lib/audit/report');

function usage() {
  return [
    'Usage:',
    '  node scripts/audit-cost.js [path] [--json] [--out <file>]',
    '',
    'Runs a heuristic AI-cost audit against a project: Claude Code settings',
    '(model, thinking-token budget, subagent model, MCP server count) and',
    'source-code patterns (model routing, prompt caching, retry logic, budget',
    'tracking). Produces a client-ready report, not a definitive verdict.',
    '',
    'Options:',
    '  --json          Print raw JSON results instead of a Markdown report',
    '  --out <file>    Write the report to a file instead of stdout',
    '  --help          Show this help'
  ].join('\n');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const help = args.includes('--help') || args.includes('-h');
  const json = args.includes('--json');
  const outIndex = args.indexOf('--out');
  const out = outIndex >= 0 ? args[outIndex + 1] : null;
  const positional = args.filter((value, index) => {
    if (value.startsWith('-')) return false;
    if (outIndex >= 0 && index === outIndex + 1) return false;
    return true;
  });
  const projectRoot = positional[0] || process.cwd();
  return { help, json, out, projectRoot };
}

function main(argv = process.argv) {
  const args = parseArgs(argv);

  if (args.help) {
    console.log(usage());
    return;
  }

  const projectRoot = path.resolve(args.projectRoot);
  if (!fs.existsSync(projectRoot)) {
    console.error(`Path not found: ${projectRoot}`);
    process.exitCode = 1;
    return;
  }

  const results = runChecks({ projectRoot });
  const generatedAt = new Date().toISOString();

  if (args.json) {
    console.log(JSON.stringify({ projectRoot, generatedAt, results }, null, 2));
    return;
  }

  const currentSpend = loadCurrentSpendSummary();
  const report = renderMarkdownReport(results, { projectRoot, generatedAt, currentSpend });

  if (args.out) {
    fs.writeFileSync(args.out, report);
    console.log(`Report written to ${args.out}`);
  } else {
    console.log(report);
  }
}

module.exports = { parseArgs, usage, main };

if (require.main === module) {
  main();
}
