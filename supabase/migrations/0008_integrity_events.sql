-- ============================================================================
-- THE COUNCIL INTELLIGENCE EXCHANGE v2 — PHASE 5 INTEGRITY EVENTS
-- ============================================================================
-- Append-only audit log for every integrity-relevant transition in the
-- system. Written by:
--   • the nightly /api/cron/integrity-audit route (actor='cron:integrity-audit')
--   • the v2_agents_status_change_trigger (actor='trigger:v2_agents_status_change')
--   • future Phase 4 broker webhooks (actor='trigger:alpaca-webhook')
--   • manual admin actions (actor='manual:<user>')
--
-- Contract: NO updates, NO deletes. Rows are immutable once written.
-- Service-role writes only. Public read (anonymous) is allowed for
-- transparency — integrity is a public property of this exchange.
--
-- Idempotent: every create uses IF NOT EXISTS. Safe to re-run.
-- ============================================================================

create table if not exists v2_integrity_events (
  id bigserial primary key,
  agent_id text,                       -- nullable for global events
  signal_id uuid,
  event_type text not null,            -- 'status_change'|'stage_change'|'circuit_open'|'circuit_reset'|'math_gate_pass'|'math_gate_fail'|'phase_promotion'
  old_value text,
  new_value text,
  reason text,
  actor text not null,                 -- 'cron:integrity-audit'|'manual:<user>'|'trigger:<name>'
  context jsonb,                       -- structured detail (IC, t-stat, n, etc.)
  created_at timestamptz not null default now()
);

create index if not exists v2_integrity_events_agent_idx
  on v2_integrity_events (agent_id, created_at desc);

create index if not exists v2_integrity_events_type_idx
  on v2_integrity_events (event_type, created_at desc);

alter table v2_integrity_events enable row level security;

-- Public read (anonymous). Writes are via service_role which bypasses RLS.
-- Intentionally no INSERT/UPDATE/DELETE policies — keeps the table
-- append-only for any non-service-role caller.
drop policy if exists "v2 public read integrity events" on v2_integrity_events;
create policy "v2 public read integrity events" on v2_integrity_events
  for select using (true);

-- ----------------------------------------------------------------------------
-- Trigger: v2_agents_status_change_trigger
-- Fires AFTER UPDATE on v2_agents when NEW.status IS DISTINCT FROM OLD.status.
-- Emits a status_change row so the audit log captures every transition —
-- including ones performed by manual SQL or by the cron via the same path.
-- ----------------------------------------------------------------------------
create or replace function v2_log_agent_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into v2_integrity_events (
      agent_id,
      event_type,
      old_value,
      new_value,
      reason,
      actor,
      context
    ) values (
      new.id,
      'status_change',
      old.status::text,
      new.status::text,
      'v2_agents.status UPDATE',
      'trigger:v2_agents_status_change',
      jsonb_build_object('agent_name', new.name)
    );
  end if;
  return new;
end;
$$;

do $$ begin
  create trigger v2_agents_status_change_trigger
    after update on v2_agents
    for each row
    when (new.status is distinct from old.status)
    execute function v2_log_agent_status_change();
exception when duplicate_object then null; end $$;

-- Note: v2_trade_tickets (broker-paper fills from Alpaca) is populated by
-- Phase 4 Alpaca webhook. This migration does not create that table;
-- the cron handler defensively checks for its existence at query time.
