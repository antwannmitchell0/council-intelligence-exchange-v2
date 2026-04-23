-- Seed only the sources that are actually operational today.
-- Telemetry has one real, wired source: Supabase Realtime on the v2_signals table.
-- Every other agent's sources stay blank until each one ships — per the integrity rule.

insert into v2_sources
  (id, agent_id, name, kind, category, description, cadence, endpoint_public, status, verified_at)
values
  (
    'telemetry.supabase-realtime-signals',
    'telemetry',
    'Supabase Realtime — v2_signals changefeed',
    'realtime',
    'internal',
    'Websocket subscription to Postgres logical replication for the v2_signals table. Every verified-status INSERT or UPDATE pushes a delta to the Live Feed under ~1 second.',
    'on-change',
    true,
    'verified',
    now()
  ),
  (
    'telemetry.supabase-realtime-heartbeats',
    'telemetry',
    'Supabase Realtime — v2_agent_heartbeats changefeed',
    'realtime',
    'internal',
    'Websocket subscription to the v2_agent_heartbeats table. Agent online/idle/offline/degraded transitions push to the Floor instantly.',
    'on-change',
    true,
    'verified',
    now()
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  verified_at = excluded.verified_at;
