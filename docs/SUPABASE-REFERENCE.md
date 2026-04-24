# Supabase — Council Intelligence Exchange v2

> Reference card for the data layer.

**Project URL:** `https://eugcwkewdmlotwwbzdkl.supabase.co`
**Dashboard:** https://supabase.com/dashboard/project/eugcwkewdmlotwwbzdkl
**Region:** (existing project, reused from v1)
**Tier:** Free

This Supabase project is shared with v1 (legacy Council data lives in `intelligence_signals` and friends). The v2 build uses the `v2_*` prefix to coexist.

## 🔴 Urgent — service_role JWT rotation (not yet done)

An early-session paste leaked the service_role JWT into chat history. **Rotate before any server-side writes with the service role run in prod.** Procedure:

1. Dashboard → **Settings → API → JWT Settings → Generate new JWT secret**
2. Copy the new `anon` key AND the new `service_role` key
3. Update Vercel prod env:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → new anon
   - `SUPABASE_SERVICE_ROLE_KEY` → new service_role (currently NOT set in Vercel — add it this rotation)
4. Redeploy: `vercel --prod`
5. Old key dies on rotation. No grace window.

Until this is done, any write path that would use the service role should be treated as best-effort. After rotation, `lib/supabase/server.ts` (`getServerClient`) can be fully trusted for RLS-bypassing writes.

## Schema — `v2_*` tables

| Table | Purpose | Write actor |
|---|---|---|
| `v2_agents` | 24-agent catalog (bios, hex, specialty, status) | manual / migration |
| `v2_signals` | Every ingested signal. Now carries `symbol`, `side`, `target_weight`, `stage_tag` | ingestion agents |
| `v2_leaderboard_snapshots` | Rolling leaderboard | cron / manual |
| `v2_agent_heartbeats` | Last-seen + online/degraded | ingestion + circuit breaker |
| `v2_directional_signals` | Directional calls (bull/bear/neutral) with resolution | manual / ingestion |
| `v2_sources` | Upstream data-source registry | migration |
| `v2_hive_events` | Hive stream (awake/sleep, signal-published) | triggers on signals + heartbeats |
| `v2_early_access_requests` | Marketplace waitlist | RPC `v2_submit_early_access` |
| `v2_abuse_events` | Rate-limit + bot events from anti-abuse | `/api/marketplace/early-access` |
| `v2_integrity_events` | **Append-only** audit log | service role only |
| `v2_trade_tickets` | Alpaca paper orders + fills (Phase 4) | `/api/alpaca/webhook` + `/api/cron/alpaca-poll` + order router |

## Enums

| Type | Values |
|---|---|
| `v2_verification_status` | `verified` / `pending` / `unverified` |
| `v2_agent_status` | `online` / `idle` / `offline` / `degraded` |
| `v2_directional` | `bull` / `bear` / `neutral` |
| `v2_outcome` | `hit` / `miss` / `partial` / `pending` |
| `stage_tag` (text check) | `pending` / `backtest-verified` / `broker-paper-tracking` / `live-verified` / `live-trading` |
| `side` (text check) | `buy` / `sell` / null |

## RLS posture — the integrity rule in one sentence

**Anon role reads only verified-tier rows.** Everything else is locked, and server-side writes go through the service role which bypasses RLS.

| Table | Anon can read |
|---|---|
| `v2_agents` | `where status = 'verified'` |
| `v2_signals` | `where status = 'verified'` |
| `v2_trade_tickets` | `where order_status in ('filled','partially_filled')` |
| `v2_directional_signals` | `where status = 'verified'` |
| `v2_integrity_events` | all rows (transparency — integrity log is public) |
| `v2_leaderboard_snapshots`, `v2_agent_heartbeats` | all rows (aggregate, no PII) |
| `v2_abuse_events`, `v2_early_access_requests` | none (service-role only) |
| `v2_sources`, `v2_hive_events` | verified rows only |

## Migrations — the truth in order

Every migration is idempotent (`IF NOT EXISTS` throughout). Safe to re-run.

| # | File | Landed |
|---|---|---|
| 0001 | `0001_init.sql` | Base schema: agents, signals, heartbeats, directional, hero_stats RPC, realtime |
| 0002 | `0002_sources.sql` | `v2_sources` registry |
| 0003 | `0003_marketplace.sql` | `v2_early_access_requests` + RPC |
| 0004 | `0004_hive_events.sql` | Hive stream table + triggers |
| 0005 | `0005_signal_dedup_constraint.sql` | `external_id`, `source_id`, unique index for ingestion dedup |
| 0006 | `0006_phase1_operational_promotions.sql` | Promote 6 operational agents to verified |
| 0007 | `0007_phase1_verification_query.sql` | Verification query helpers |
| 0008 | `0008_integrity_events.sql` | Append-only audit log + status-change trigger |
| 0009 | `0009_abuse_events.sql` | Anti-abuse event log |
| **0010** | **`0010_phase4_alpaca.sql`** | **Phase 4: stage_tag, symbol/side/target_weight on v2_signals, v2_trade_tickets table** |

**0010 is NOT YET APPLIED to the live Supabase.** Run it before the first ingest after deploying Phase 4.

### Seeds

| File | Purpose |
|---|---|
| `0001_telemetry.sql` | Seed the Telemetry agent |
| `0002_sources.sql` | Seed the data-source registry |
| `0003_elite_archetypes.sql` | 7 archetype agents |
| `0004_backtested_specialists.sql` | 8 specialist agents |

## Running a migration (safe procedure)

1. Read the migration SQL end-to-end. Confirm it's idempotent.
2. Open Supabase Dashboard → **SQL Editor → New query**
3. Paste the migration file content
4. Run it
5. Verify — depends on the migration. For 0010:
   ```sql
   \d v2_signals         -- confirm symbol, side, target_weight, stage_tag columns
   \d v2_trade_tickets   -- confirm new table
   ```
6. Re-run the same migration once more to confirm idempotency (should be 0 rows affected).

## Service-role client

`lib/supabase/server.ts` exports `getServerClient()` which falls back through:
```
SUPABASE_SECRET_KEY
  → SUPABASE_SERVICE_ROLE_KEY
    → NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      → NEXT_PUBLIC_SUPABASE_ANON_KEY
```

For server-side writes (ingestion, webhook, cron), the service_role key is the only one that bypasses RLS. Without it, writes to `v2_signals`, `v2_integrity_events`, `v2_trade_tickets`, and `v2_agent_heartbeats` will silently fail the policy check.

**After the JWT rotation, set `SUPABASE_SERVICE_ROLE_KEY` in Vercel prod.**

## Realtime

The following tables are on `supabase_realtime` publication:
- `v2_signals`
- `v2_leaderboard_snapshots`
- `v2_agent_heartbeats`
- `v2_trade_tickets` (added in 0010)

Frontend subscribes via the anon client — RLS applies. Only verified/filled rows reach the browser.

## Triggers live in DB

- `v2_agents_status_change_trigger` — any status change writes `v2_integrity_events` (migration 0008)
- `v2_trade_tickets_updated_at_trigger` — auto-bumps `updated_at` on every row update (0010)
- Signal insert → hive event, heartbeat transition → awake/sleep event (0004)

## Env vars (Vercel prod)

| Variable | Role |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL for both clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key, subject to RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **NOT SET** — add during JWT rotation |

## Related docs

- `docs/NEXT-SESSION-HANDOFF.md` §3 — JWT rotation backstory
- `docs/VERCEL-PROJECT-REFERENCE.md` — env var registry
- `docs/STAGE-TAXONOMY.md` — what `stage_tag` means and who writes each value
