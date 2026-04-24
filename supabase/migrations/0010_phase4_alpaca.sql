-- ============================================================================
-- THE COUNCIL INTELLIGENCE EXCHANGE v2 — PHASE 4: ALPACA PAPER-TRADING
-- ============================================================================
-- Wires broker attestation into the integrity contract. Ingested signals that
-- carry (symbol, side) are routed to Alpaca paper; fills land on
-- v2_trade_tickets and trip a stage_tag promotion from 'pending' to
-- 'broker-paper-tracking' — starting the 90-day clock toward 'live-verified'.
--
-- The stage_tag column lives on v2_signals (not a separate table) so the
-- integrity-audit cron can compute rolling IC per stage with a single filter.
--
-- Idempotent: every statement guarded with IF NOT EXISTS / do-block. Safe
-- to re-run.
-- ============================================================================

-- ---------- 1. Extend v2_signals ------------------------------------------

alter table v2_signals
  add column if not exists symbol text;

alter table v2_signals
  add column if not exists side text;

do $$ begin
  alter table v2_signals
    add constraint v2_signals_side_check
    check (side is null or side in ('buy','sell'));
exception when duplicate_object then null; end $$;

alter table v2_signals
  add column if not exists target_weight numeric(6,4);

do $$ begin
  alter table v2_signals
    add constraint v2_signals_target_weight_range
    check (
      target_weight is null
      or (target_weight >= 0 and target_weight <= 1)
    );
exception when duplicate_object then null; end $$;

alter table v2_signals
  add column if not exists stage_tag text not null default 'pending';

do $$ begin
  alter table v2_signals
    add constraint v2_signals_stage_tag_check
    check (stage_tag in (
      'pending',
      'backtest-verified',
      'broker-paper-tracking',
      'live-verified',
      'live-trading'
    ));
exception when duplicate_object then null; end $$;

create index if not exists v2_signals_stage_idx
  on v2_signals (stage_tag, created_at desc);

create index if not exists v2_signals_symbol_idx
  on v2_signals (symbol, created_at desc)
  where symbol is not null;

-- ---------- 2. v2_trade_tickets -------------------------------------------
-- One row per broker order. Upserted by the Alpaca webhook and the
-- /api/cron/alpaca-poll reconciler, both keyed on client_order_id
-- (= v2_signals.id). That one key makes every write idempotent.

create table if not exists v2_trade_tickets (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references v2_signals(id) on delete restrict,
  agent_id text not null references v2_agents(id) on delete restrict,
  alpaca_order_id text,
  client_order_id text not null,
  symbol text not null,
  side text not null,
  qty numeric,
  notional numeric,
  filled_avg_price numeric,
  order_status text not null,
  submitted_at timestamptz,
  filled_at timestamptz,
  broker text not null default 'alpaca-paper',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table v2_trade_tickets
    add constraint v2_trade_tickets_side_check
    check (side in ('buy','sell'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table v2_trade_tickets
    add constraint v2_trade_tickets_status_check
    check (order_status in (
      'submitted',
      'accepted',
      'filled',
      'partially_filled',
      'canceled',
      'rejected',
      'expired'
    ));
exception when duplicate_object then null; end $$;

create unique index if not exists v2_trade_tickets_client_order_id_uidx
  on v2_trade_tickets (client_order_id);

create unique index if not exists v2_trade_tickets_alpaca_order_id_uidx
  on v2_trade_tickets (alpaca_order_id)
  where alpaca_order_id is not null;

create index if not exists v2_trade_tickets_agent_idx
  on v2_trade_tickets (agent_id, created_at desc);

create index if not exists v2_trade_tickets_status_idx
  on v2_trade_tickets (order_status, created_at desc);

-- Keep updated_at fresh on every row mutation.
create or replace function v2_trade_tickets_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$ begin
  create trigger v2_trade_tickets_updated_at_trigger
    before update on v2_trade_tickets
    for each row
    execute function v2_trade_tickets_touch_updated_at();
exception when duplicate_object then null; end $$;

-- RLS: public reads only filled tickets (same integrity rule as v2_signals —
-- unverified/pending orders stay private until the broker attests a fill).
-- Service-role writes bypass RLS so no INSERT/UPDATE policy is needed.
alter table v2_trade_tickets enable row level security;

drop policy if exists "v2 public read filled tickets" on v2_trade_tickets;
create policy "v2 public read filled tickets" on v2_trade_tickets
  for select using (order_status = 'filled' or order_status = 'partially_filled');

-- Realtime for the future trading-floor surface.
do $$ begin
  execute 'alter publication supabase_realtime add table v2_trade_tickets';
exception when duplicate_object then null; when others then null; end $$;

-- ---------- 3. Notes on v2_integrity_events --------------------------------
-- No schema changes needed — the table already exists (migration 0008) and
-- its `actor` and `event_type` are free-text. Phase 4 will write rows with
--   actor      = 'trigger:alpaca-webhook'
--   event_type = 'order_submitted' | 'order_filled' | 'order_rejected'
--                | 'stage_change'
-- The append-only guarantee (no UPDATE/DELETE policies) still holds.
