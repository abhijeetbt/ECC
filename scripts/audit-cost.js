#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');

const { runChecks } = require('./lib/audit/checks');
const { renderMarkdownReport, loadCurrentSpendSummary } = require('./lib/audit/report');

function usage() {
  return [
    'Usage:',
    '  node scripts/audit-cost.js [path] [--json] [--out <file>]',
    '  node scripts/audit-cost.js [path] --push <url> --key <api-key>',
    '',
    'Runs a heuristic AI-cost audit against a project: Claude Code settings',
    '(model, thinking-token budget, subagent model, MCP server count) and',
    'source-code patterns (model routing, prompt caching, retry logic, budget',
    'tracking). Produces a client-ready report, not a definitive verdict.',
    '',
    'Options:',
    '  --json            Print raw JSON results instead of a Markdown report',
    '  --out <file>      Write the report to a file instead of stdout',
    '  --push <url>      POST the results JSON to a hosted ingest endpoint',
    '                    (see saas/README.md) — only findings are sent, never',
    '                    source code',
    '  --key <api-key>   API key to authenticate the --push request (required',
    '                    with --push)',
    '  --help            Show this help'
  ].join('\n');
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? { index, value: args[index + 1] } : null;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const help = args.includes('--help') || args.includes('-h');
  const json = args.includes('--json');
  const out = valueAfter(args, '--out');
  const push = valueAfter(args, '--push');
  const key = valueAfter(args, '--key');
  const valueIndexes = new Set([out, push, key].filter(Boolean).map(entry => entry.index + 1));
  const positional = args.filter((value, index) => !value.startsWith('-') && !valueIndexes.has(index));

  return {
    help,
    json,
    out: out ? out.value : null,
    push: push ? push.value : null,
    key: key ? key.value : null,
    projectRoot: positional[0] || process.cwd()
  };
}

function pushResults(targetUrl, apiKey, payload) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(targetUrl);
    } catch {
      reject(new Error(`Invalid --push URL: ${targetUrl}`));
      return;
    }

    const client = url.protocol === 'http:' ? http : https;
    const body = JSON.stringify(payload);
    const request = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'http:' ? 80 : 443),
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'x-api-key': apiKey
        }
      },
      response => {
        let data = '';
        response.on('data', chunk => {
          data += chunk;
        });
        response.on('end', () => resolve({ statusCode: response.statusCode, body: data }));
      }
    );
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

async function main(argv = process.argv) {
  const args = parseArgs(argv);

  if (args.help) {
    console.log(usage());
    return;
  }

  if (args.push && !args.key) {
    console.error('--push requires --key <api-key>');
    process.exitCode = 1;
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

  if (args.push) {
    try {
      const response = await pushResults(args.push, args.key, { projectRoot, generatedAt, results });
      if (response.statusCode >= 200 && response.statusCode < 300) {
        console.log(`Pushed results to ${args.push}`);
        console.log(response.body);
      } else {
        console.error(`Push failed (${response.statusCode}): ${response.body}`);
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(`Push failed: ${error.message}`);
      process.exitCode = 1;
    }
    return;
  }

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

module.exports = { parseArgs, usage, main, pushResults };

if (require.main === module) {
  main().catch(error => {
    console.error(`[audit-cost] ${error.message}`);
    process.exit(1);
  });
}
