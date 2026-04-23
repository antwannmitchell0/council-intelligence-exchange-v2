-- Marketplace upgrade: price field on agents + early-access requests table.

-- Optional monthly price per agent. Null = "not yet priced" (blank per integrity rule).
alter table v2_agents
  add column if not exists price_monthly_cents int;

alter table v2_agents
  add column if not exists tier_label text;

-- Early-access requests submitted from the Marketplace form.
create table if not exists v2_early_access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  agent_id text references v2_agents(id) on delete set null,
  use_case text,
  company text,
  created_at timestamptz not null default now()
);

create index if not exists v2_early_access_created_idx
  on v2_early_access_requests (created_at desc);

alter table v2_early_access_requests enable row level security;

-- Public (anon) CAN insert — the Marketplace form submits directly from the browser.
drop policy if exists "v2 public insert early access" on v2_early_access_requests;
create policy "v2 public insert early access" on v2_early_access_requests
  for insert with check (
    email is not null
    and char_length(email) < 254
    and position('@' in email) > 1
  );

-- Public (anon) CANNOT select — we don't leak the early-access list.
-- Only service_role (server-side) can read it.
