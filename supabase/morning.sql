-- ============================================================================
-- THE COUNCIL INTELLIGENCE EXCHANGE v2 — MORNING SQL BUNDLE
-- ============================================================================
-- Paste this entire file into Supabase SQL Editor → Run. One time. That's it.
--
-- Applies everything built overnight:
--   1. v2_hive_events table + triggers (Floor v2 live data feed)
--   2. Early-access RPC (security definer, bypasses the RLS issue cleanly)
--   3. (Optional cleanup) drops the permissive INSERT policy now that we're
--      using a server-side RPC instead of client-direct inserts
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. v2_hive_events (Floor v2)
-- ----------------------------------------------------------------------------

do $$ begin
  create type v2_hive_event_kind as enum (
    'signal-published',
    'signal-corroborated',
    'agent-awake',
    'agent-sleep',
    'message'
  );
exception when duplicate_object then null; end $$;

create table if not exists v2_hive_events (
  id uuid primary key default gen_random_uuid(),
  kind v2_hive_event_kind not null,
  from_agent text references v2_agents(id) on delete set null,
  to_agent text references v2_agents(id) on delete set null,
  signal_id uuid references v2_signals(id) on delete set null,
  payload jsonb default '{}',
  occurred_at timestamptz not null default now()
);

create index if not exists v2_hive_events_recent_idx
  on v2_hive_events (occurred_at desc);
create index if not exists v2_hive_events_kind_idx
  on v2_hive_events (kind, occurred_at desc);

alter table v2_hive_events enable row level security;

drop policy if exists "v2 public read hive events" on v2_hive_events;
create policy "v2 public read hive events" on v2_hive_events
  for select using (true);

-- Realtime for the Floor canvas
do $$ begin
  execute 'alter publication supabase_realtime add table v2_hive_events';
exception when duplicate_object then null; when others then null; end $$;

-- Trigger: verified-status signal INSERT → emit 'signal-published' event
create or replace function v2_emit_signal_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'verified' then
    insert into v2_hive_events (kind, from_agent, signal_id, occurred_at)
    values ('signal-published', new.agent_id, new.id, new.created_at);
  end if;
  return new;
end;
$$;

drop trigger if exists v2_signal_publish_event on v2_signals;
create trigger v2_signal_publish_event
  after insert on v2_signals
  for each row
  execute function v2_emit_signal_published();

-- Trigger: signal status UPDATE → 'verified' → emit 'signal-published' event
create or replace function v2_emit_signal_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'verified' and (old.status is distinct from 'verified') then
    insert into v2_hive_events (kind, from_agent, signal_id, occurred_at)
    values ('signal-published', new.agent_id, new.id, now());
  end if;
  return new;
end;
$$;

drop trigger if exists v2_signal_verified_event on v2_signals;
create trigger v2_signal_verified_event
  after update on v2_signals
  for each row
  execute function v2_emit_signal_verified();

-- Trigger: heartbeat online/offline transitions
create or replace function v2_emit_heartbeat_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'online' then
      insert into v2_hive_events (kind, from_agent, occurred_at)
      values ('agent-awake', new.agent_id, new.last_seen);
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status = 'online' and old.status <> 'online' then
      insert into v2_hive_events (kind, from_agent, occurred_at)
      values ('agent-awake', new.agent_id, new.last_seen);
    elsif new.status <> 'online' and old.status = 'online' then
      insert into v2_hive_events (kind, from_agent, occurred_at)
      values ('agent-sleep', new.agent_id, new.last_seen);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists v2_heartbeat_transition_event on v2_agent_heartbeats;
create trigger v2_heartbeat_transition_event
  after insert or update on v2_agent_heartbeats
  for each row
  execute function v2_emit_heartbeat_transition();

-- ----------------------------------------------------------------------------
-- 2. Early-access RPC (bypasses RLS via security definer)
-- ----------------------------------------------------------------------------

create or replace function v2_submit_early_access(
  p_email text,
  p_agent_id text default null,
  p_company text default null,
  p_use_case text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := trim(p_email);
begin
  if v_email is null
     or char_length(v_email) < 3
     or char_length(v_email) > 254
     or position('@' in v_email) < 2
     or position('.' in split_part(v_email, '@', 2)) < 1
  then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  if p_company is not null and char_length(p_company) > 200 then
    return jsonb_build_object('ok', false, 'error', 'company_too_long');
  end if;

  if p_use_case is not null and char_length(p_use_case) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'use_case_too_long');
  end if;

  insert into v2_early_access_requests (email, agent_id, company, use_case)
  values (v_email, nullif(trim(p_agent_id), ''), p_company, p_use_case)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function v2_submit_early_access(text, text, text, text)
  to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Optional cleanup — remove the permissive INSERT policy (now redundant)
--    Safe to keep it too; the RPC takes precedence.
-- ----------------------------------------------------------------------------

drop policy if exists "v2 public insert early access" on v2_early_access_requests;
drop policy if exists "v2 allow any insert" on v2_early_access_requests;

-- ----------------------------------------------------------------------------
-- Verification block — should all print 'ok' when this file lands cleanly
-- ----------------------------------------------------------------------------

do $$ begin
  raise notice 'v2_hive_events exists: %', (select to_regclass('public.v2_hive_events') is not null);
  raise notice 'v2_submit_early_access exists: %', (select count(*) > 0 from pg_proc where proname = 'v2_submit_early_access');
end $$;

select 'Done — Floor v2 and early-access RPC are live.' as status;
