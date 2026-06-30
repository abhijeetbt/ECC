# TestForge — AI Unit Test Generation (MVP)

A Cursor-style AI assistant focused on **one capability**: generating unit tests
from a function. Paste Python or JavaScript code, get a runnable test suite
(pytest / Jest) covering happy paths, edge cases, and error handling.

This is the Week 1–5 scaffold for the MVP described in the project brief. It is
deliberately scoped to a single AI feature so it can be validated with real
users quickly.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Monaco Editor** for the code editor
- **Tailwind CSS** for styling
- **Prisma + PostgreSQL** for persistence
- **Clerk** for authentication
- **Stripe** for subscriptions (webhook-driven plan sync)
- **Anthropic Claude** (`claude-opus-4-8`) for test generation
- **Zod** for request validation

## Project layout

```
src/
  app/
    page.tsx                      Landing page
    sign-in / sign-up             Clerk auth pages
    dashboard/
      layout.tsx                  Nav + project sidebar
      page.tsx                    Usage overview
      [projectId]/page.tsx        Editor + output (main app)
    api/
      process/route.ts            POST — generate tests (the core endpoint)
      projects/route.ts           GET/POST projects
      projects/[id]/route.ts      GET/PUT/DELETE a project
      usage/route.ts              GET monthly token usage
      webhook/stripe/route.ts     POST — Stripe subscription events
  components/                     Editor, OutputPanel, ProcessButton, Sidebar, ...
  lib/
    anthropic.ts                  Claude wrapper (streaming + retries)
    prompts.ts                    System prompt + prompt builder
    db.ts                         Prisma client singleton
    stripe.ts                     Stripe client + price→plan mapping
    auth.ts                       Clerk → User row helper
    usage.ts                      Token accounting + plan limits
    types.ts                      Zod schemas + shared types
  middleware.ts                   Clerk route protection
prisma/schema.prisma             User / Project / Usage models
```

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — copy `.env.example` to `.env` and fill in:
   - `ANTHROPIC_API_KEY`
   - `DATABASE_URL` (PostgreSQL)
   - Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)
   - Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)

3. **Set up the database**

   ```bash
   npx prisma migrate dev --name init
   ```

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## How metering works

- Every `/api/process` call records the **actual** input + output tokens returned
  by the Claude API in the `Usage` table (not a length estimate).
- `lib/usage.ts` sums the trailing 30 days and compares against the plan's
  allowance (`FREE_TIER_TOKEN_LIMIT` / `PRO_TIER_TOKEN_LIMIT`). Requests over the
  limit return HTTP 429 before any tokens are spent.
- The Stripe webhook updates `User.plan` on subscription create/update/delete, so
  the allowance follows the customer's billing state.

## Stripe webhook (local)

```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

Pass the Clerk user id as `client_reference_id` when creating a Checkout Session
so the webhook can link the Stripe customer to the user.

## Choosing the model

`lib/anthropic.ts` defaults to `claude-opus-4-8`. To trade quality for cost,
set `ANTHROPIC_MODEL` (e.g. `claude-sonnet-4-6` or `claude-haiku-4-5`).

## Out of scope (Phase 2+)

Real-time collaboration, more languages, custom fine-tuning, VS Code extension,
team management, advanced analytics, streaming output to the UI.
