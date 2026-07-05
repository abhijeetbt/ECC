---
description: Run a heuristic AI-cost audit against a project and summarize the findings for a client-ready handoff.
argument-hint: [path]
---

# Cost Audit

Run `scripts/audit-cost.js` against a project and turn the raw findings into
a short, client-ready summary — this is the deliverable for a paid "AI cost
audit" engagement (see `docs/business/ai-cost-audit-playbook.md`).

**Input**: $ARGUMENTS (a path to the target project; defaults to the current
directory if empty)

## What this command does

1. Run the audit:

```bash
node scripts/audit-cost.js "${ARGUMENTS:-.}"
```

2. Read the Markdown report the command prints. It covers two categories:
   - **Claude Code Configuration** — model defaults, thinking-token budget,
     subagent model, MCP server count
   - **Source Code Patterns** — hardcoded expensive models without routing,
     missing prompt caching, undifferentiated retry logic, missing budget
     tracking
3. Every check is a heuristic first pass (grep-based), not a definitive
   verdict — say so plainly and note which findings need a closer manual
   look before being presented as fact.
4. Summarize for the client in plain language: what's costing them money
   today, the fix, and the expected impact (tokens/cost saved). Order
   findings by likely dollar impact, not the order they appear in the report.
5. If a finding references `skills/cost-aware-llm-pipeline/SKILL.md` or
   `docs/token-optimization.md`, pull the concrete pattern from that file
   into the summary — don't just cite the filename.
6. Offer to write the fixes (e.g. update `.claude/settings.json`, add
   `cache_control` to API calls) as a follow-up, since that is typically a
   separate paid step from the audit itself.

## Notes

- This reads the client's project, not this ECC repo — pass the target path
  as `$ARGUMENTS`.
- Save the full report (`node scripts/audit-cost.js <path> --out report.md`)
  as the artifact you hand to the client alongside the summary.
