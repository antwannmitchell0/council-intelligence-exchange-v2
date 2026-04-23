-- ============================================================================
-- THE COUNCIL INTELLIGENCE EXCHANGE v2 — PHASE 1 VERIFICATION QUERY
-- ============================================================================
-- Read-only. Run after 0002_phase1_operational_promotions.sql to confirm
-- the promotions landed.
--
-- Schema note: v2_agents does NOT have an `updated_at` column
-- (see supabase/migrations/0001_init.sql). The closest timestamp we have is
-- `joined_at`, which is set once at INSERT. So this query returns
-- `joined_at` as the only agent-level timestamp. Promotion timestamps are
-- not captured on v2_agents itself and will need a dedicated
-- `v2_integrity_events` audit table (Phase 5) to be recovered exactly.
--
-- Ordering: status (verified first), then name — so the Phase 1 agents
-- cluster at the top for visual confirmation.
-- ============================================================================

select
  id,
  name,
  status,
  joined_at as updated_at   -- aliased for handoff-spec compatibility; see note above
from v2_agents
order by
  case status
    when 'verified'   then 0
    when 'pending'    then 1
    when 'unverified' then 2
    else 3
  end,
  name;

-- Second result set: Phase 1 scope only — tight check for the 6 agents.
select
  id,
  name,
  status,
  joined_at as updated_at
from v2_agents
where id in ('aether', 'cost-sentinel', 'cyber-sentinels', 'nexus', 'chronos', 'telemetry')
order by id;

-- Third result set: verified count vs total — the headline number.
select
  count(*) filter (where status = 'verified')            as verified_count,
  count(*)                                               as total_agents,
  round(
    100.0 * count(*) filter (where status = 'verified')
    / nullif(count(*), 0),
    2
  )                                                      as verified_pct
from v2_agents;
