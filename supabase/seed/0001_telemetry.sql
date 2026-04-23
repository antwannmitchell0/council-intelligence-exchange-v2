-- Seed the 9-agent roster. Only Telemetry is 'verified' on launch day;
-- the other eight stay 'pending' until each agent's ingestion pipeline ships.

insert into v2_agents (id, name, hex, brief, status) values
  ('aether', 'Aether UI/UX Architect', '#7C5CFF',
   'Visual intelligence, interaction, and experience architecture.', 'pending'),
  ('telemetry', 'Telemetry & Response', '#29E6D1',
   'Real-time signal ingestion and live-feed orchestration.', 'verified'),
  ('cost-sentinel', 'Quantum Cost Sentinel', '#F5A524',
   'Predictive cost discipline across every pipeline.', 'pending'),
  ('oracle', 'Oracle Grant Seeker', '#4ADE80',
   'Opportunity detection — grants, partnerships, capital.', 'pending'),
  ('cyber-sentinels', 'Cyber-Sentinels', '#FF4D6D',
   'Integrity boundary. No unauthorized writes. Ever.', 'pending'),
  ('nexus', 'Nexus Architect', '#60A5FA',
   'Inter-agent wiring. The data fabric of The Hive.', 'pending'),
  ('chronos', 'Chronos Orchestrator', '#C084FC',
   'Sequencing, timeline discipline, phase orchestration.', 'pending'),
  ('momentum', 'Momentum Marketing Conduit', '#FB923C',
   'Outreach, activation, targeted amplification.', 'pending'),
  ('evolutionary', 'Evolutionary Architect', '#E879F9',
   'Future-proofing. Modular upgrade paths.', 'pending')
on conflict (id) do update set
  name = excluded.name,
  hex = excluded.hex,
  brief = excluded.brief;

-- Heartbeat: Telemetry is online, rest offline
insert into v2_agent_heartbeats (agent_id, status, last_seen) values
  ('telemetry', 'online', now())
on conflict (agent_id) do update set status = excluded.status, last_seen = excluded.last_seen;

-- Initial leaderboard snapshot so the table renders something real on first load.
-- Only Telemetry gets a verified snapshot; others remain absent (blank per integrity rule).
insert into v2_leaderboard_snapshots (agent_id, rank, signals_24h, verified_pct, trend_7d, status)
values ('telemetry', 1, 0, 100.00, '{100,100,100,100,100,100,100}', 'verified')
on conflict (agent_id) do update set
  rank = excluded.rank,
  signals_24h = excluded.signals_24h,
  verified_pct = excluded.verified_pct,
  trend_7d = excluded.trend_7d,
  captured_at = now();
