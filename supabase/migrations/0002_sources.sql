-- v2 Signal Sources — the real data feeds each agent listens to.
-- Integrity rule: a source only appears publicly when its status is 'verified'.

do $$ begin
  create type v2_source_kind as enum (
    'realtime',   -- websocket / postgres changefeed
    'api',        -- REST/GraphQL poll
    'feed',       -- RSS, Atom, or structured feed
    'scrape',     -- browser-based extraction
    'filing',     -- regulatory filings
    'on-chain',   -- blockchain indexer
    'webhook',    -- inbound webhook
    'database'    -- internal database read
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type v2_source_category as enum (
    'markets',
    'regulatory',
    'infrastructure',
    'geopolitics',
    'science',
    'private-capital',
    'on-chain',
    'language',
    'internal'
  );
exception when duplicate_object then null; end $$;

create table if not exists v2_sources (
  id text primary key,
  agent_id text references v2_agents(id) on delete cascade,
  name text not null,
  kind v2_source_kind not null,
  category v2_source_category not null,
  description text,
  cadence text,                     -- '30s', 'daily', 'on-change', etc.
  endpoint_public boolean default false,   -- if true, endpoint is published
  endpoint text,                    -- may be redacted unless endpoint_public
  status v2_verification_status not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists v2_sources_agent_idx on v2_sources (agent_id);
create index if not exists v2_sources_category_idx on v2_sources (category);

-- RLS: anon can see only verified sources; endpoint field hidden unless endpoint_public.
alter table v2_sources enable row level security;

drop policy if exists "v2 public read verified sources" on v2_sources;
create policy "v2 public read verified sources" on v2_sources
  for select using (status = 'verified');

-- Realtime for live source-state changes
do $$ begin
  execute 'alter publication supabase_realtime add table v2_sources';
exception when duplicate_object then null; when others then null; end $$;
