-- AI Cost Audit SaaS schema (Supabase / Postgres).
-- Run this once in the Supabase SQL editor after creating a new project.

create extension if not exists pgcrypto;

-- One row per signed-up customer. Auto-provisioned by the trigger below
-- whenever someone signs up through Supabase Auth on the dashboard.
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  name text,
  email text not null,
  created_at timestamptz not null default now()
);

-- Long-lived keys the local agent (scripts/audit-cost.js --push) authenticates
-- with. Only the sha256 hash is ever stored; the raw key is shown once, at
-- creation time, and never persisted anywhere.
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  key_hash text not null unique,
  label text not null default 'default',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- One row per `audit-cost.js --push` run. `results` is the same JSON array
-- the CLI's --json flag prints locally, so the dashboard and the CLI report
-- always show identical data.
create table if not exists audit_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  project_root text,
  generated_at timestamptz not null,
  findings_count integer not null default 0,
  passed_count integer not null default 0,
  results jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists audit_runs_account_created_idx
  on audit_runs (account_id, created_at desc);

alter table accounts enable row level security;
alter table api_keys enable row level security;
alter table audit_runs enable row level security;

-- Dashboard reads go through Supabase Auth + RLS. Writes to api_keys and
-- audit_runs only ever happen server-side via the service-role key (which
-- bypasses RLS), from saas/api/*.js — never directly from the browser.
create policy "read own account" on accounts
  for select using (auth_user_id = auth.uid());

create policy "read own api keys" on api_keys
  for select using (
    account_id in (select id from accounts where auth_user_id = auth.uid())
  );

create policy "read own audit runs" on audit_runs
  for select using (
    account_id in (select id from accounts where auth_user_id = auth.uid())
  );

-- Auto-create an account row whenever someone signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.accounts (auth_user_id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email), new.email);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
