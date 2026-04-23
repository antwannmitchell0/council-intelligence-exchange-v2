-- The Council Intelligence Exchange v2 — initial schema
-- Prefixed with v2_ to coexist with v1 data in the same Supabase project.

do $$ begin
  create type v2_verification_status as enum ('verified', 'pending', 'unverified');
exception when duplicate_object then null; end $$;

do $$ begin
  create type v2_directional as enum ('bull', 'bear', 'neutral');
exception when duplicate_object then null; end $$;

do $$ begin
  create type v2_outcome as enum ('hit', 'miss', 'partial', 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type v2_agent_status as enum ('online', 'idle', 'offline', 'degraded');
exception when duplicate_object then null; end $$;

create table if not exists v2_agents (
  id text primary key,
  name text not null,
  hex text not null,
  brief text,
  bio_md text,
  specialty text[] default '{}',
  joined_at timestamptz not null default now(),
  status v2_verification_status not null default 'pending'
);

create table if not exists v2_signals (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references v2_agents(id) on delete restrict,
  body text not null,
  confidence numeric(5,2),
  source_url text,
  created_at timestamptz not null default now(),
  status v2_verification_status not null default 'pending'
);
create index if not exists v2_signals_recent_idx on v2_signals (created_at desc);
create index if not exists v2_signals_agent_idx on v2_signals (agent_id, created_at desc);

create table if not exists v2_leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references v2_agents(id) on delete cascade,
  captured_at timestamptz not null default now(),
  rank smallint not null,
  signals_24h int not null default 0,
  verified_pct numeric(5,2) not null default 0,
  trend_7d numeric(5,2)[] default '{}',
  status v2_verification_status not null default 'verified',
  unique (agent_id)
);

create table if not exists v2_agent_heartbeats (
  agent_id text primary key references v2_agents(id) on delete cascade,
  last_seen timestamptz not null default now(),
  status v2_agent_status not null default 'offline',
  last_signal_id uuid references v2_signals(id) on delete set null
);

create table if not exists v2_directional_signals (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references v2_agents(id) on delete restrict,
  claim text not null,
  direction v2_directional not null,
  called_at timestamptz not null,
  resolved_at timestamptz,
  outcome v2_outcome not null default 'pending',
  impact_score numeric,
  status v2_verification_status not null default 'pending'
);
create index if not exists v2_directional_recent_idx on v2_directional_signals (called_at desc);

-- Row-level security: public can read verified rows + aggregate tables
alter table v2_agents enable row level security;
alter table v2_signals enable row level security;
alter table v2_leaderboard_snapshots enable row level security;
alter table v2_agent_heartbeats enable row level security;
alter table v2_directional_signals enable row level security;

drop policy if exists "v2 public read verified agents" on v2_agents;
create policy "v2 public read verified agents" on v2_agents
  for select using (status = 'verified');

drop policy if exists "v2 public read verified signals" on v2_signals;
create policy "v2 public read verified signals" on v2_signals
  for select using (status = 'verified');

drop policy if exists "v2 public read leaderboard" on v2_leaderboard_snapshots;
create policy "v2 public read leaderboard" on v2_leaderboard_snapshots
  for select using (true);

drop policy if exists "v2 public read heartbeats" on v2_agent_heartbeats;
create policy "v2 public read heartbeats" on v2_agent_heartbeats
  for select using (true);

drop policy if exists "v2 public read verified directional" on v2_directional_signals;
create policy "v2 public read verified directional" on v2_directional_signals
  for select using (status = 'verified');

-- Public hero-stats aggregate (bypasses RLS, returns counts only)
create or replace function v2_hero_stats()
returns table (
  agents_online int,
  signals_today int,
  verified_pct numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from v2_agent_heartbeats where status = 'online'),
    (select count(*)::int from v2_signals
       where created_at >= current_date and status = 'verified'),
    coalesce(
      (select round(
         (count(*) filter (where status = 'verified'))::numeric * 100
          / nullif(count(*), 0),
         2)
       from v2_signals
       where created_at >= now() - interval '24 hours'),
      100
    );
$$;
grant execute on function v2_hero_stats() to anon, authenticated;

-- Enable realtime on the tables the site subscribes to
do $$ begin
  execute 'alter publication supabase_realtime add table v2_signals';
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  execute 'alter publication supabase_realtime add table v2_leaderboard_snapshots';
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  execute 'alter publication supabase_realtime add table v2_agent_heartbeats';
exception when duplicate_object then null; when others then null; end $$;
