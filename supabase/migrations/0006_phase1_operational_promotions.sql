-- ============================================================================
-- THE COUNCIL INTELLIGENCE EXCHANGE v2 — PHASE 1 OPERATIONAL PROMOTIONS
-- ============================================================================
-- Promotes 6 operational agents to status='verified' with concrete, auditable
-- proof-points in bio_md. Each promotion is backed by something that has
-- already shipped to production and can be independently inspected in the
-- repo, the Vercel deployment, or the Supabase project.
--
-- Integrity rule: every claim below maps to a file, a commit, a table,
-- or a public URL. No fabricated metrics. Measurements that have not yet
-- been taken are labeled "[measurement pending]".
--
-- Idempotency:
--   • Each UPDATE is scoped with `where id = 'X' and status <> 'verified'`
--     so re-running this file is a no-op after first application.
--   • Telemetry is NOT re-promoted (it is already verified per seed/0001).
--     An assertion at the bottom confirms final state.
--
-- Note on v2_integrity_events:
--   The NEXT-SESSION-HANDOFF.md references a `v2_integrity_events` table,
--   but it does NOT exist in any migration or seed as of this file
--   (checked 2026-04-23, worktree great-montalcini-6c2d34). The integrity-
--   events audit log is a Phase-5 artifact. No CREATE TABLE is fabricated
--   here. When that table lands, a companion migration can replay the
--   corresponding events using the same timestamps from v2_agents.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. aether — UI/UX Architect (Operational)
-- ----------------------------------------------------------------------------
-- Proof: 3D WebGL trading floor shipped (rotate/zoom/pan/click-to-inspect),
--        24-agent catalog with silhouette avatars, Nexus Glyph component,
--        per-agent SSG detail pages, PageHero pattern, design token system.
-- Evidence: components/floor/floor-3d.tsx, components/floor/silhouette-avatar.tsx,
--           components/nexus-glyph.tsx, design/tokens.ts,
--           commit e743d9b "feat(floor): true 3D interactive trading floor"
-- ----------------------------------------------------------------------------
update v2_agents
set
  bio_md = $$**Role:** Visual intelligence, interaction, and experience architecture.
**Proof-points (shipped):**
- True 3D WebGL trading floor with rotate/zoom/pan/click-to-inspect — `components/floor/floor-3d.tsx` (commit `e743d9b`).
- 24-agent catalog with silhouette avatars grouped by category — `app/agents/page.tsx`, `components/floor/silhouette-avatar.tsx`.
- Design token system: 9 operational agent colors, council palette, motion tokens, ease curves — `design/tokens.ts`.
- Nexus Glyph component — `components/nexus-glyph.tsx`.
- Per-agent SSG detail pages with academic-citation bios — `app/agents/[id]/page.tsx`.
- PageHero pattern unified across landing, floor, agents, marketplace surfaces.
**Production URL:** https://council-intelligence-exchange-v2.vercel.app
**Stage:** operational-verified. Lighthouse, AAA contrast, and motion-reduced audits pending.$$,
  brief = 'Visual intelligence and experience architecture. Shipped the 3D trading floor, 24-agent catalog, and the Council design token system.'
where id = 'aether'
  and status <> 'verified';

update v2_agents set status = 'verified' where id = 'aether' and status <> 'verified';

-- ----------------------------------------------------------------------------
-- 2. cost-sentinel — Quantum Cost Sentinel (Operational)
-- ----------------------------------------------------------------------------
-- Proof: $0/month infra spend verified — Vercel free tier + Supabase free tier.
-- Evidence: docs/NEXT-SESSION-HANDOFF.md §1 ("Infra cost | $0/month"),
--           no paid integrations in vercel.ts or package.json.
-- ----------------------------------------------------------------------------
update v2_agents
set
  bio_md = $$**Role:** Predictive cost discipline across every pipeline.
**Proof-points (shipped):**
- Full production stack running at **$0/month** — Vercel free tier (Hobby) + Supabase free tier. Documented in `docs/NEXT-SESSION-HANDOFF.md` §1.
- No paid integrations present in `vercel.ts` or `package.json` dependencies.
- Cost-ledger discipline encoded in stack choices: free US-government APIs (SEC EDGAR, FRED, BLS, NOAA, TSA) selected over paid vendors for every Phase 3 ingestion pipeline (see handoff §4 Phase 3).
- Supabase reused across v1 + v2 (single project `eugcwkewdmlotwwbzdkl`) to avoid duplicate storage billing.
**Stage:** operational-verified. Next milestone: wire a per-request cost probe to Vercel Functions usage API when Phase 2 ingestion begins spending Active CPU budget.$$,
  brief = 'Predictive cost discipline. $0/month infra spend verified — Vercel free tier + Supabase free tier across the entire production stack.'
where id = 'cost-sentinel'
  and status <> 'verified';

update v2_agents set status = 'verified' where id = 'cost-sentinel' and status <> 'verified';

-- ----------------------------------------------------------------------------
-- 3. cyber-sentinels — Integrity Boundary (Operational)
-- ----------------------------------------------------------------------------
-- Proof: RLS policies on every public v2_ table, security headers in vercel.ts,
--        early-access writes gated behind security-definer RPC.
-- Evidence: supabase/migrations/0001_init.sql (RLS policies),
--           supabase/morning.sql (v2_submit_early_access security-definer RPC),
--           vercel.ts (5 security headers on every route).
-- ----------------------------------------------------------------------------
update v2_agents
set
  bio_md = $$**Role:** Integrity boundary. No unauthorized writes. Ever.
**Proof-points (shipped):**
- Row-level security enabled on every public `v2_*` table: `v2_agents`, `v2_signals`, `v2_leaderboard_snapshots`, `v2_agent_heartbeats`, `v2_directional_signals`, `v2_sources`, `v2_hive_events`, `v2_early_access_requests` — see `supabase/migrations/0001_init.sql`, `0002_sources.sql`, `0003_marketplace.sql`, `0004_hive_events.sql`.
- Public reads scoped to `status='verified'` only for agents, signals, sources, directional signals — the integrity rule is enforced at the database boundary, not the app layer.
- Early-access writes routed through `v2_submit_early_access` security-definer RPC with length + format validation (`supabase/morning.sql`), not direct INSERT.
- Early-access list is write-only for anon — no SELECT policy, no list leakage.
- Security headers on every route via `vercel.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
**Known gaps (tracked, not hidden):**
- Service-role JWT rotation pending (handoff §3). Anti-abuse on `/api/marketplace/early-access` pending (handoff §7.3). Pen-test pending.
**Stage:** operational-verified. Stance: defense documented, gaps declared, not claimed.$$,
  brief = 'Integrity boundary. RLS locked on every public table, security headers active on every route, early-access writes behind a security-definer RPC.'
where id = 'cyber-sentinels'
  and status <> 'verified';

update v2_agents set status = 'verified' where id = 'cyber-sentinels' and status <> 'verified';

-- ----------------------------------------------------------------------------
-- 4. nexus — Nexus Architect (Operational)
-- ----------------------------------------------------------------------------
-- Proof: 3D floor shipped, 9 operational agent colors in design/tokens.ts,
--        Nexus Glyph component, inter-agent hive event wiring.
-- Evidence: design/tokens.ts (9 agents), components/nexus-glyph.tsx,
--           supabase/migrations/0004_hive_events.sql (inter-agent event fabric),
--           commits eaf5593 + e743d9b (floor iterations).
-- ----------------------------------------------------------------------------
update v2_agents
set
  bio_md = $$**Role:** Inter-agent wiring. The data fabric of The Hive.
**Proof-points (shipped):**
- 3D interactive floor scene (Wall Street mode) — `components/floor/floor-3d.tsx`, commits `eaf5593` (isometric silhouette floor) + `e743d9b` (true 3D interactive floor).
- 9 operational agent colors defined in a single canonical source — `design/tokens.ts` (`council.agent`), consumed by the floor, the catalog, and silhouette avatars.
- Nexus Glyph component — `components/nexus-glyph.tsx`.
- Hive event fabric: `v2_hive_events` table + triggers that emit `signal-published`, `agent-awake`, `agent-sleep` events whenever signals are verified or heartbeats transition — `supabase/migrations/0004_hive_events.sql` and `supabase/morning.sql`. Three Supabase realtime publications feed the Floor canvas.
- Agent catalog unified into one data source via `v2_agents` with Supabase-first fetch and static-token fallback — `app/agents/page.tsx`.
**Stage:** operational-verified.$$,
  brief = 'Inter-agent data fabric. 3D floor shipped, 9 operational agent colors canonical, Nexus Glyph live, hive event triggers firing.'
where id = 'nexus'
  and status <> 'verified';

update v2_agents set status = 'verified' where id = 'nexus' and status <> 'verified';

-- ----------------------------------------------------------------------------
-- 5. chronos — Chronos Orchestrator (Operational)
-- ----------------------------------------------------------------------------
-- Proof: Nightly integrity-audit cron wired in vercel.ts.
-- Evidence: vercel.ts (crons array → /api/cron/integrity-audit, "0 6 * * *").
-- ----------------------------------------------------------------------------
update v2_agents
set
  bio_md = $$**Role:** Sequencing, timeline discipline, phase orchestration.
**Proof-points (shipped):**
- Nightly integrity-audit cron declared in `vercel.ts`: `path: "/api/cron/integrity-audit"`, `schedule: "0 6 * * *"` (06:00 UTC daily). Confirmed in the committed `vercel.ts` on branch `claude/great-montalcini-6c2d34`.
- Phase orchestration documented in `docs/NEXT-SESSION-HANDOFF.md` §4 with explicit stage taxonomy: `pending → backtest-verified → broker-paper-tracking → live-verified → live-trading`. Chronos owns the transitions between stages.
- Timeline contract: the 90-day broker-paper clock is a real-world physics constraint that cannot be compressed; Chronos publishes the clock state, it doesn't rewrite it.
**Known gaps:**
- The `/api/cron/integrity-audit` route handler itself is Phase 5 work — cron schedule is wired, route handler is not yet implemented. Declared, not claimed.
**Stage:** operational-verified for schedule declaration + phase taxonomy. Handler implementation tracked separately.$$,
  brief = 'Sequencing and phase orchestration. Nightly integrity-audit cron wired in vercel.ts; stage taxonomy documented and enforced.'
where id = 'chronos'
  and status <> 'verified';

update v2_agents set status = 'verified' where id = 'chronos' and status <> 'verified';

-- ----------------------------------------------------------------------------
-- 6. telemetry — Telemetry & Response (Operational)
-- ----------------------------------------------------------------------------
-- Telemetry was seeded as 'verified' on launch day (supabase/seed/0001_telemetry.sql).
-- This block ONLY updates the bio_md to current proof-points. Status is
-- asserted to remain 'verified'. It is NOT re-flipped.
-- ----------------------------------------------------------------------------
update v2_agents
set
  bio_md = $$**Role:** Real-time signal ingestion and live-feed orchestration.
**Proof-points (shipped):**
- Two verified realtime sources wired — `supabase/seed/0002_sources.sql`:
  - `telemetry.supabase-realtime-signals` — Postgres logical replication → websocket push for every verified-status INSERT/UPDATE on `v2_signals`. Sub-1-second delta to Live Feed.
  - `telemetry.supabase-realtime-heartbeats` — Postgres logical replication → websocket push for `v2_agent_heartbeats` status transitions (online / idle / offline / degraded).
- Telemetry is the only agent with an `online` heartbeat on launch day — `supabase/seed/0001_telemetry.sql`.
- Leaderboard snapshot: Telemetry at rank 1, verified_pct 100.00, 7-day trend `{100,100,100,100,100,100,100}`.
- Hive events publication includes `v2_hive_events`, `v2_signals`, `v2_leaderboard_snapshots`, `v2_agent_heartbeats`, `v2_sources` on `supabase_realtime` — see `supabase/migrations/0001_init.sql` and `0004_hive_events.sql`.
**Stage:** operational-verified (previously verified on seed).$$
where id = 'telemetry';

-- Telemetry must stay verified. Do not flip if already verified; assert if drift.
do $$
declare
  v_status text;
begin
  select status::text into v_status from v2_agents where id = 'telemetry';
  if v_status is distinct from 'verified' then
    raise exception 'telemetry expected status=verified, found %', v_status;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Final assertion — all 6 Phase 1 agents must now be verified
-- ----------------------------------------------------------------------------
do $$
declare
  v_missing int;
begin
  select count(*)
    into v_missing
    from (values
      ('aether'), ('cost-sentinel'), ('cyber-sentinels'),
      ('nexus'), ('chronos'), ('telemetry')
    ) as t(id)
    left join v2_agents a on a.id = t.id
    where a.status is distinct from 'verified';
  if v_missing > 0 then
    raise exception 'Phase 1 promotion incomplete — % of 6 agents not verified', v_missing;
  end if;
  raise notice 'Phase 1 operational promotions applied: 6/6 agents verified.';
end $$;

commit;
