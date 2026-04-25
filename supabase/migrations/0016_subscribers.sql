-- 2026-04-25 — v2_subscribers table for the Early Access tier.
--
-- Pre-Phase-D minimum-viable subscriber persistence. No Clerk, no auth,
-- no admin role guards yet — just a flat table that the Stripe webhook
-- writes into when a customer pays, and that the daily-digest cron reads
-- to know who to email.
--
-- Phase D will lift this into a richer model with user accounts, role-
-- based access, and links to v2_user_actions / v2_staff_data_access.
-- Today: just enough to ship the lean revenue MVP.

create table if not exists v2_subscribers (
  id uuid primary key default gen_random_uuid(),

  -- Identity (provided by Stripe Checkout)
  email text not null unique,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,

  -- Lifecycle
  status text not null default 'active'
    check (status in ('active', 'paused', 'canceled', 'past_due')),
  tier text not null default 'early-access',
  current_period_end timestamptz,

  -- Audit
  source text default 'stripe-payment-link', -- where they came from
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Operator notes (manual onboarding, edge cases, etc.)
  notes text
);

create index if not exists v2_subscribers_status_idx
  on v2_subscribers (status);

create index if not exists v2_subscribers_email_idx
  on v2_subscribers (email);

-- RLS: anon can never read this. Server-side only.
alter table v2_subscribers enable row level security;

-- No policies = effectively locked down for anon. Service-role bypasses RLS
-- so the webhook + cron can read/write.

-- Trigger to auto-update updated_at on changes.
create or replace function v2_subscribers_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists v2_subscribers_set_updated_at_trg on v2_subscribers;
create trigger v2_subscribers_set_updated_at_trg
  before update on v2_subscribers
  for each row execute function v2_subscribers_set_updated_at();
