# AI Cost Audit — Hosted Dashboard

A self-serve SaaS wrapper around `scripts/audit-cost.js`: clients run the
audit locally and push only the findings (never source code) to a hosted
dashboard you control. This is a separate deployable product — it is not
part of the ECC plugin and does not ship in the `ecc-universal` npm package.

## Architecture

- **Database + Auth**: Supabase (Postgres, magic-link auth, row-level security)
- **API + dashboard hosting**: Vercel (serverless functions in `api/`, static
  site in `public/`)
- **Client agent**: `scripts/audit-cost.js --push` (already in this repo) —
  runs the audit locally, POSTs only the results JSON

```
client machine                    your infrastructure
┌──────────────────┐   results    ┌─────────────┐   ┌──────────┐
│ audit-cost.js     │ ───JSON───► │ /api/ingest │──►│ Supabase │
│ (their code stays │              └─────────────┘   │ Postgres │
│  on their machine)│                                 └────┬─────┘
└──────────────────┘                                       │
                                    ┌─────────────┐         │
                          browser ──► dashboard ───┴─────────┘ (RLS-scoped reads)
```

## Deploy it

### 1. Create the Supabase project

1. Create a free project at supabase.com.
2. Open the SQL editor and run `saas/schema.sql` once.
3. Under **Authentication > URL Configuration**, add your Vercel deployment
   URL (once you have it) as a redirect URL.
4. Under **Project Settings > API**, note down:
   - `Project URL` → `SUPABASE_URL`
   - `anon` `public` key → goes in `public/index.html` (client-side, safe to expose)
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server-side only, never expose this**)

### 2. Deploy to Vercel

1. Push this repo (or just the `saas/` directory) to GitHub.
2. Import it into Vercel, setting **Root Directory** to `saas/`.
3. Add environment variables in the Vercel project settings:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy. Vercel auto-detects `api/*.js` as serverless functions and serves
   `public/` as the static site.

### 3. Wire the dashboard to your Supabase project

Edit `public/index.html` and replace:

```js
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
```

with your project's actual URL and `anon` key (the anon key is safe to ship
client-side — it only grants what RLS policies allow, which is "read your
own rows", nothing else). Redeploy.

### 4. Onboard a client

**Self-serve (recommended):** they visit your dashboard URL, enter their
email, click the magic link, then click "Generate new key" — a fresh API
key tied to their account, generated via `api/create-key.js`.

**Manual (fallback):** run `node saas/scripts/generate-api-key.js`, give the
client the raw key, and insert the printed SQL into Supabase's SQL editor
against their `account_id` (find it in the `accounts` table after they've
signed up at least once, since accounts are auto-created on signup).

### 5. The client runs the agent

```bash
node scripts/audit-cost.js /path/to/their/project \
  --push https://your-dashboard.vercel.app/api/ingest \
  --key <their-api-key>
```

Their code never leaves their machine — only the findings array (the same
JSON `--json` prints locally) is sent. Results show up in their dashboard
immediately.

## What ships where

| Path | Purpose | Deployed? |
|------|---------|-----------|
| `saas/schema.sql` | Postgres schema + RLS policies | Run once in Supabase |
| `saas/api/ingest.js` | Receives pushed audit results | Vercel serverless function |
| `saas/api/create-key.js` | Self-serve API key issuance | Vercel serverless function |
| `saas/public/index.html` | Login + API key + audit history UI | Vercel static site |
| `saas/scripts/generate-api-key.js` | Manual key issuance fallback | Run locally by you |

## Security notes

- The `service_role` key bypasses RLS entirely — it must only ever live in
  Vercel's server-side environment variables, never in `public/`.
- API keys are stored as sha256 hashes only (`api_keys.key_hash`); the raw
  key is shown exactly once, at creation.
- `audit_runs.results` never contains source code — only the check
  id/title/category/status/detail/recommendation fields `audit-cost.js`
  already produces locally.

## Not built yet (by design — validate demand first)

- Billing (Stripe). Invoice manually until you have a few paying clients.
- Key revocation UI (the `api_keys.revoked_at` column exists; set it via SQL
  for now).
- Multi-project accounts (currently one flat list of runs per account).
