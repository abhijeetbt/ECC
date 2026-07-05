# AI Cost Audit Playbook

A repeatable, one-time paid engagement for small companies that use (or want
to use) Claude/GPT-family models but are watching every dollar. Built on
`scripts/audit-cost.js` and the `/cost-audit` command — the tool does the
scanning, you do the judgment call and the pitch.

See [`docs/business/ai-cost-audit-one-pager.md`](ai-cost-audit-one-pager.md)
for the client-facing pitch this playbook backs — send that, run this.

## Who this is for

Small teams already paying for AI API usage (or about to start) who don't
have anyone dedicated to watching the bill. They don't need a subscription
product; they need someone to point out what's wasting money once, fix it,
and leave.

## The offer

**"AI Cost Audit" — flat fee, one-time, 2–4 hours of your time.**

1. Run the audit against their codebase and Claude Code config:
   ```bash
   node scripts/audit-cost.js /path/to/their/project --out report.md
   ```
2. Review every finding manually — the tool is a heuristic first pass
   (grep-based pattern matching), not a certified verdict. Drop anything
   that's a false positive before it reaches the client.
3. If they have the `stop:cost-tracker` hook enabled, the report already
   includes their actual tracked spend by model — lead with that number,
   it's concrete and theirs.
4. Turn the surviving findings into a short client-facing summary: what's
   costing money, why, the fix, and a rough expected savings range. Order by
   dollar impact, not report order.
5. Hand over the full Markdown report + the summary. Offer implementing the
   fixes as a **separate**, explicitly scoped follow-up — the audit is the
   trust-building step, not the whole engagement.

## Pricing starting points

| Package | Price | Scope |
|---------|-------|-------|
| Audit only | $500–1,000 flat | Run the tool, manually verify findings, deliver report + written summary |
| Audit + fix | $1,000–2,500 flat | Audit, plus implementing the config/code changes (`.claude/settings.json`, prompt caching, model routing) |
| Audit + fix + 30-day check-in | +$300–500 | One follow-up session after a month of real usage to confirm savings landed |

Adjust for market and client size — these are starting points, not a floor.

## What the tool actually checks

Two categories, eight checks, all in `scripts/lib/audit/checks.js`:

- **Claude Code configuration**: default model, `MAX_THINKING_TOKENS`,
  `CLAUDE_CODE_SUBAGENT_MODEL`, MCP server count
- **Source code patterns**: hardcoded expensive models without
  complexity-based routing, missing prompt caching, retry logic that doesn't
  distinguish transient vs. permanent failures, missing cost/budget tracking

Every finding links back to `skills/cost-aware-llm-pipeline/SKILL.md` or
`docs/token-optimization.md` for the concrete implementation pattern — pull
the code snippet from there when you write up the fix, don't reinvent it.

## Why this is a good first offer

- **Fast to deliver**: the tool runs in seconds; your time goes into
  verification and the write-up, not building anything new per client.
- **Concrete ROI pitch**: "we found $X/month you're leaving on the table" is
  an easy yes for a budget-conscious buyer, unlike a subscription pitch.
- **Trust builder**: a good audit earns the follow-up work (fixes, ongoing
  monitoring) without you having to sell it separately.

## Extending this

The check list is a plain array (`CHECKS` in `scripts/lib/audit/checks.js`)
— add a new `{ id, title, category, run(ctx) }` entry and it shows up in
every future report automatically. Natural next checks: language-specific
patterns (LangChain, LlamaIndex), streaming vs. non-streaming API usage,
batch API eligibility, provider-specific pricing tier mismatches.

## Where this leads

Once a client has paid for an audit and the fix, the natural upsell is
ongoing visibility: point them at the control-pane Token Monitor dashboard
(`docs/token-optimization.md#token-monitoring-dashboard`) as a paid
setup-and-maintain package, so the savings from the audit don't quietly
erode as their usage grows.
