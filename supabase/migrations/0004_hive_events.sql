-- Hive events — the feed that powers Floor v2 (Wall Street mode).
-- Every verified signal publish, every corroboration, every heartbeat emits an event.
-- The Floor subscribes to this stream and animates each event as it lands.

do $$ begin
  create type v2_hive_event_kind as enum (
    'signal-published',     -- an agent just pushed a verified signal
    'signal-corroborated',  -- agent B confirmed agent A's signal
    'agent-awake',          -- heartbeat transition offline→online
    'agent-sleep',          -- heartbeat transition online→offline
    'message'               -- generic inter-agent message (future use)
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

-- Realtime for the Floor
do $$ begin
  execute 'alter publication supabase_realtime add table v2_hive_events';
exception when duplicate_object then null; when others then null; end $$;

-- Trigger: every verified signal INSERT emits a 'signal-published' event
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

-- Trigger: signal status flipping to 'verified' also emits
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

-- Trigger: heartbeat transitions emit awake/sleep events
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
