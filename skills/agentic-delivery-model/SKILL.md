---
name: agentic-delivery-model
description: Designs and audits AI-native business/delivery models against agent-core architecture, catching legacy IT-services patterns (Wipro/TCS-style billable-headcount consulting) disguised as AI offerings. Produces a keep/flag/replace verdict per pillar with agentic alternatives.
metadata:
  origin: ECC
---

# Agentic Delivery Model

Use this skill when designing, pitching, or auditing a business or delivery model that claims to be "AI-native" — a consulting alternative, a services product, an internal delivery org — and the real test is whether it scales through agents or through people.

## When to Activate

- Someone is drafting a business model, pricing model, SOW, or org chart for an AI-based company or offering.
- The pitch is explicitly positioned against traditional IT services / consulting firms (e.g. Wipro, TCS, Accenture, Infosys-style delivery).
- A proposed plan says "we'll scale by adding more [analysts/reviewers/consultants/support staff]" and someone needs a second opinion on whether that's actually an AI-native design.
- Reviewing whether a capability being built is a reusable skill/agent or a one-off script tied to a single client/task.

**Do not use for:** auditing the internal reliability of an already-built agent system (`agent-architecture-audit`), engineering process design for AI-assisted coding teams (`ai-first-engineering`), or inventorying which automations are currently live (`automation-audit-ops`).

## The Four Pillars

Every model gets scored against these. Each pillar has a concrete legacy failure mode to flag.

| # | Pillar | Legacy-services version | Agentic version |
|---|--------|--------------------------|------------------|
| 1 | Scaling lever | Add headcount (analysts, offshore staff, reviewers) as volume grows | Add agents/capabilities; headcount grows only for judgment calls agents can't make |
| 2 | Capability packaging | Bespoke SOW work, rebuilt per client/engagement | Modular, documented, reusable skill/agent — used across every engagement |
| 3 | Engineering depth | Generalist bench pitched as broad coverage | Narrow, specialized, high-quality solutions per problem domain |
| 4 | Architecture | AI chatbot/copilot bolted onto an existing ticketing or SOW pipeline | Structured outputs, tool-calling, memory/context, and observability designed in from the start |

## Legacy vs Agentic Delivery Model

| Dimension | Wipro/TCS-style consulting | Agentic delivery model |
|---|---|---|
| Revenue unit | Billable hour / FTE on a project | Outcome, usage, or subscription against a skills platform |
| Margin trajectory | Flat or declining (wage inflation, bench cost) | Improves over time (skill/agent reused across clients at near-zero marginal cost) |
| IP location | Tribal knowledge in individual consultants' heads | Versioned, testable skills/agents in a shared library |
| Org shape | Pyramid: partners → managers → analysts → offshore staff | Flat: agent fleet + narrow specialist reviewers for exceptions |
| Quality control | Manual QA/review layers scaled with volume | Agent self-evaluation + audit skills; humans sign off on exceptions only |
| Client interface | Statements of work, change orders, status decks | Tool-calling interfaces, structured outputs, live observability |
| Growth story | "We'll staff up" | "We'll add agents/skills, and expand what each one can already do" |

## Audit Workflow

### 1. Scope

Identify what's being evaluated: a business model doc, an org chart, a pricing sheet, a specific SOW, or a proposed architecture.

### 2. Score each pillar

For each of the four pillars, classify the artifact as:

- **agent-core** — scales by adding agent capability, no headcount dependency for volume growth
- **hybrid** — agent-assisted but still headcount-scaled for a load-bearing part of delivery
- **legacy** — the AI is cosmetic; the actual delivery mechanism is people

### 3. Name the red flags

Common tells that a "legacy" or "hybrid" score is hiding:

- "We'll add more reviewers/analysts as volume grows" → headcount-scaled, not agent-scaled (pillar 1)
- The same integration, parser, or workflow gets rebuilt per client instead of pulled from a shared library (pillar 2)
- The pitch leads with "full-stack generalist team/bench" instead of naming the specific narrow problem solved best-in-class (pillar 3)
- AI output is free text pasted into an existing manual pipeline, with no structured schema, tool contract, or decision log (pillar 4)
- Pricing is time-and-materials or per-seat-of-consultant rather than tied to outcomes or agent usage
- "Add more people later" appears anywhere in the growth plan

### 4. Verdict

For each pillar, return one of: **keep** (already agent-core), **fix-next** (hybrid, has a clear agentic path), **replace** (legacy pattern, needs a redesign before scaling).

## Anti-Patterns to Flag Explicitly

- Positioning "AI-augmented consulting" where the augmentation is a chatbot layered on the same billable-hour SOW — this is legacy delivery wearing an AI label, not an agentic business.
- Designing a support/review function to "scale with a bigger team later" instead of a bigger or better-evaluated agent.
- Treating every client integration as bespoke rather than checking whether an existing skill/agent already covers 80% of it.
- Pricing that rewards hours spent instead of outcomes delivered — this incentivizes the wrong scaling lever even if the delivery mechanism is agentic underneath.

## Output Format

```text
SCOPE
- artifact reviewed (business model / org chart / SOW / architecture)

PILLAR SCORES
- scaling lever: agent-core | hybrid | legacy — evidence
- capability packaging: agent-core | hybrid | legacy — evidence
- engineering depth: agent-core | hybrid | legacy — evidence
- architecture: agent-core | hybrid | legacy — evidence

RED FLAGS
- quote or reference the specific line/decision that triggered each flag

VERDICT PER PILLAR
- keep / fix-next / replace, with the concrete agentic alternative

NEXT MOVE
- the single highest-leverage change to make the model more agent-core
```

## Related Skills

- `ai-first-engineering` — engineering process and review standards once the model is agent-core
- `automation-audit-ops` — inventory what automation is actually live before claiming a model is agentic
- `agent-architecture-audit` — audit the technical reliability of an already-built agent system
- `enterprise-agent-ops` — operate agent workloads at production scale
- `team-agent-orchestration` — when part of the delivery org is genuinely a multi-agent team, not a headcount pyramid
