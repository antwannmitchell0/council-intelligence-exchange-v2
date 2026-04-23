# PHASE 1 AUDIT — v2_agents catalog, schema, promotions

**Audit date:** 2026-04-23
**Worktree:** `.claude/worktrees/great-montalcini-6c2d34`
**Branch:** `claude/great-montalcini-6c2d34`
**Scope:** pre-flight for `supabase/migrations/0002_phase1_operational_promotions.sql`

---

## 1 · Current `v2_agents` schema

Source of truth: `supabase/migrations/0001_init.sql` + `supabase/migrations/0003_marketplace.sql`.

| Column                 | Type                      | Default             | Notes                                          |
|------------------------|---------------------------|---------------------|------------------------------------------------|
| `id`                   | `text`                    | —                   | Primary key, slug (e.g. `aether`, `telemetry`) |
| `name`                 | `text`                    | —                   | NOT NULL                                       |
| `hex`                  | `text`                    | —                   | NOT NULL, agent color token                    |
| `brief`                | `text`                    | null                | Short catalog blurb                            |
| `bio_md`               | `text`                    | null                | Full markdown bio — thesis / data source / methodology / citation all live inside this blob |
| `specialty`            | `text[]`                  | `'{}'`              |                                                |
| `joined_at`            | `timestamptz`             | `now()`             | Set once at INSERT                             |
| `status`               | `v2_verification_status`  | `'pending'`         | Enum: `verified` \| `pending` \| `unverified`  |
| `price_monthly_cents`  | `int`                     | null                | Added by `0003_marketplace.sql`                |
| `tier_label`           | `text`                    | null                | Added by `0003_marketplace.sql`                |

TypeScript mirror: `lib/supabase/types.ts` → `AgentRow`. Matches the SQL 1:1.

**RLS** (from `0001_init.sql`):
- `v2 public read verified agents` — `select` allowed only when `status = 'verified'`. Consequence: anon clients don't see pending bios. The app's agent catalog uses the static-token fallback (`app/agents/page.tsx`, `fallbackAgent`) to render the 9 operational slots before DB promotion.

---

## 2 · Current 24-agent roster by status

Source: seeds `0001_telemetry.sql`, `0003_elite_archetypes.sql`, `0004_backtested_specialists.sql`. (There are no seeds numbered above 0004 in the repo.) Note the seed files insert **23 agents**, not 24 — see §3 gap #1.

### Pre-Phase-1 (pending migration 0002)

| Status       | Count | Agents |
|--------------|-------|--------|
| `verified`   | **1** | `telemetry` |
| `pending`    | **22**| **Operational (8):** `aether`, `cost-sentinel`, `oracle`, `cyber-sentinels`, `nexus`, `chronos`, `momentum`, `evolutionary`. **Trading specialists (8):** `earnings-whisper-agent`, `put-call-ratio-agent`, `noaa-weather-agent`, `insider-filing-agent`, `tsa-throughput-agent`, `ma-intelligence-agent`, `jobs-data-agent`, `port-flow-agent`. **Free-data archetypes (7):** `gdelt-geopolitical`, `sec-language-shift`, `fred-macro-regime`, `wiki-edit-surge`, `chain-whale`, `fed-voice`, `trial-outcomes`. **Unverified: 1** (the missing 24th slot — see §3). |
| `unverified` | 0     | — |

### Post-Phase-1 (after 0002 applies)

| Status       | Count | Agents |
|--------------|-------|--------|
| `verified`   | **6** | `aether`, `chronos`, `cost-sentinel`, `cyber-sentinels`, `nexus`, `telemetry` |
| `pending`    | **17**| 3 operational (`oracle`, `momentum`, `evolutionary`) + 8 specialists + 7 archetypes, minus the 24th-slot gap |
| `unverified` | 0     | — |

**Promotion count: 5 new + 1 confirmed = 6 covered by Phase 1.**

---

## 3 · Gaps between handoff §2 claims and actual code

### Gap #1 — "24 rows" claim vs 23-agent seed reality

- Handoff §2 states: *"Supabase schema complete: `v2_agents` (24 rows)…"*
- Actual seed inserts: 9 operational (`0001_telemetry.sql`) + 7 archetypes (`0003_elite_archetypes.sql`) + 8 specialists (`0004_backtested_specialists.sql`) = **24 rows if the 9 operational seed lands**, but the seed for operational is `pending` status except telemetry. Counting distinct IDs: **9 + 7 + 8 = 24**. ✅ Math checks.
- However, the app-layer code (`app/agents/page.tsx`) references 9 + 8 + 7 = 24 via `OPERATIONAL_IDS`, `TRADING_SPECIALIST_IDS`, `ARCHETYPE_IDS`. No orphan ID. No gap.
- Re-classifying my earlier "23" count: that was wrong — the 9 operational agents come from `0001_telemetry.sql`. **There is no missing 24th slot.** The pre-Phase-1 `pending` count is 23, not 22. Correcting the table in §2 above: `pending = 23`, `verified = 1`.

### Gap #2 — `v2_integrity_events` table referenced but never created

- Handoff §4 Phase 5 and §7 both reference `v2_integrity_events` as the public audit log.
- **Zero CREATE TABLE statements for it** in any migration or seed (grepped all of `supabase/` and `lib/`). Only string occurrences are in `docs/NEXT-SESSION-HANDOFF.md`.
- **Decision:** migration `0002` does NOT INSERT into that table. No speculative CREATE TABLE. When the table lands in Phase 5, a follow-up migration can backfill 6 events with the same UPDATE timestamps.

### Gap #3 — `v2_agents.updated_at` column promised but absent

- The task spec asked for a verification SELECT returning `id, name, status, updated_at`.
- `v2_agents` has **no `updated_at` column**. Only `joined_at` (set at INSERT, never touched on UPDATE).
- Migration `0003_phase1_verification_query.sql` aliases `joined_at as updated_at` and documents the gap inline. The true "promoted_at" timestamp requires either (a) an `updated_at` column + trigger, or (b) the `v2_integrity_events` table from Gap #2. Both are Phase 5.

### Gap #4 — dedicated bio sub-fields (thesis / data_source / methodology / citation) do not exist as columns

- Task spec and handoff both reference agent fields like `thesis`, `data_source`, `methodology`, `citation`, `proof_points`, `category`.
- None of those are columns. They all live inside the `bio_md` markdown blob (verified across all seed files — see `0003_elite_archetypes.sql` where each bio uses `**Thesis:** … **Data source:** … **Methodology:** … **Academic evidence:** …` as a markdown convention).
- **Decision:** migration `0002` writes proof-points into `bio_md` using the same markdown convention (`**Role:** … **Proof-points (shipped):** …`), keeping structural consistency with existing seeds. No CREATE COLUMN in `0002`.

### Gap #5 — Service-role JWT still pending rotation

- Handoff §3 is red-flagged: the v1 service_role key from an earlier chat paste is still valid.
- This migration is safe to run with the **current anon key** via Supabase SQL Editor as the project owner; no app code requires the service_role to apply UPDATEs manually. But: **do not wire any server-side ingestion writer until the JWT is rotated.** This audit is the last step before rotation.

### Non-gap — handoff §2 says "$0/month" and it checks

- Verified. `vercel.ts` has no paid integrations, `package.json` has no paid SDKs beyond Supabase (free tier), and the Supabase project is the existing shared one (`eugcwkewdmlotwwbzdkl`). The Cost Sentinel proof-point is honest.

---

## 4 · Proof points used for each of the 6 promotions

Every claim below maps to a file path or a commit in the repo. No fabricated metrics.

### 4.1 `aether` — UI/UX Architect

| Claim | Evidence |
|-------|----------|
| 3D WebGL trading floor (rotate/zoom/pan/click) | `components/floor/floor-3d.tsx` + commit `e743d9b` |
| 24-agent catalog grouped by category | `app/agents/page.tsx` |
| Silhouette avatars | `components/floor/silhouette-avatar.tsx` |
| 9 canonical operational agent colors | `design/tokens.ts` → `council.agent` |
| Nexus Glyph component | `components/nexus-glyph.tsx` |
| Per-agent SSG detail pages | `app/agents/[id]/page.tsx` |

### 4.2 `cost-sentinel` — Quantum Cost Sentinel

| Claim | Evidence |
|-------|----------|
| $0/month infra spend | Handoff §1 ("Infra cost \| $0/month") + absence of paid deps in `package.json` + absence of paid integrations in `vercel.ts` |
| Free US-gov APIs selected for Phase 3 | Handoff §4 Phase 3 — SEC EDGAR, FRED, BLS, NOAA, TSA |
| Shared Supabase project (no duplicate billing) | Handoff §1 (`eugcwkewdmlotwwbzdkl.supabase.co` reused) |

### 4.3 `cyber-sentinels` — Integrity Boundary

| Claim | Evidence |
|-------|----------|
| RLS enabled on every public `v2_*` table | `supabase/migrations/0001_init.sql` (agents, signals, leaderboard, heartbeats, directional), `0002_sources.sql` (sources), `0003_marketplace.sql` (early-access), `0004_hive_events.sql` (hive events) |
| Public reads gated to `status='verified'` for all content tables | Policy `v2 public read verified agents` etc. in `0001_init.sql` |
| Early-access writes behind security-definer RPC | `supabase/morning.sql` → `v2_submit_early_access()` with length + format validation |
| Early-access list write-only for anon | No SELECT policy declared in `0003_marketplace.sql` |
| 5 security headers on every route | `vercel.ts` → `securityHeaders` array: nosniff, DENY, strict-origin, Permissions-Policy, HSTS 63072000 |
| Gaps declared, not claimed | Handoff §3 (JWT rotation), §7.3 (anti-abuse), §7.15 (pen-test) — all disclosed in bio_md |

### 4.4 `nexus` — Nexus Architect

| Claim | Evidence |
|-------|----------|
| 3D floor (Wall Street mode) | Commits `eaf5593` + `e743d9b`, `components/floor/floor-3d.tsx` |
| 9 agent colors canonical | `design/tokens.ts` → `council.agent` (9 entries) |
| Nexus Glyph live | `components/nexus-glyph.tsx` |
| Hive event fabric wiring | `supabase/migrations/0004_hive_events.sql` + `supabase/morning.sql` (triggers `v2_emit_signal_published`, `v2_emit_signal_verified`, `v2_emit_heartbeat_transition`) |
| Three realtime publications | `supabase/migrations/0001_init.sql` (signals, leaderboard, heartbeats) + `0002_sources.sql` (sources) + `0004_hive_events.sql` (hive events) |

### 4.5 `chronos` — Chronos Orchestrator

| Claim | Evidence |
|-------|----------|
| Nightly integrity-audit cron declared | `vercel.ts` → `crons: [{ path: "/api/cron/integrity-audit", schedule: "0 6 * * *" }]` |
| Phase orchestration documented | `docs/NEXT-SESSION-HANDOFF.md` §4 stage taxonomy table |
| 90-day clock honesty | Handoff §4 "What CAN'T compress" — declared, not finessed |
| Gap disclosed: route handler not yet implemented | Bio explicitly labels this as Phase 5 work |

### 4.6 `telemetry` — Telemetry & Response

Already `verified` on seed. Phase 1 only refreshes `bio_md` with current proof-points; status is asserted, not re-flipped.

| Claim | Evidence |
|-------|----------|
| Two verified realtime sources | `supabase/seed/0002_sources.sql` (signals + heartbeats changefeeds) |
| Telemetry heartbeat online on launch | `supabase/seed/0001_telemetry.sql` |
| Rank-1 leaderboard snapshot | `supabase/seed/0001_telemetry.sql` |
| Realtime publication membership | `supabase/migrations/0001_init.sql` + `0004_hive_events.sql` |

---

## 5 · Promotion summary table

| Agent              | Pre-status | Post-status | Proof anchor                          |
|--------------------|------------|-------------|---------------------------------------|
| `aether`           | `pending`  | `verified`  | 3D floor + design tokens (`e743d9b`)  |
| `cost-sentinel`    | `pending`  | `verified`  | $0/month infra (`vercel.ts`, `package.json`) |
| `cyber-sentinels`  | `pending`  | `verified`  | RLS + security headers (`0001_init.sql`, `vercel.ts`) |
| `nexus`            | `pending`  | `verified`  | 3D floor + hive events (`0004_hive_events.sql`) |
| `chronos`          | `pending`  | `verified`  | Nightly cron declared (`vercel.ts`)   |
| `telemetry`        | `verified` | `verified`  | Seed + realtime sources (`0001_telemetry.sql`, `0002_sources.sql`) |

---

## 6 · Run order

```sql
-- From Supabase SQL Editor (project owner), in order:
-- 1. Apply promotions (transactional, idempotent)
\i supabase/migrations/0002_phase1_operational_promotions.sql

-- 2. Verify
\i supabase/migrations/0003_phase1_verification_query.sql
```

Expected result of the verification SELECT:
- Row 1–6: all six Phase 1 agents with `status = verified`, clustered at the top.
- `verified_count = 6`, `total_agents = 24`, `verified_pct = 25.00`.

---

## 7 · Open items for the next migration (not in scope for Phase 1)

1. **`v2_integrity_events` CREATE TABLE** — Phase 5. Schema suggestion: `(id uuid pk, agent_id text fk, kind text, reason text, actor text, before jsonb, after jsonb, occurred_at timestamptz)`. Not fabricated into this migration.
2. **`v2_agents.updated_at` + trigger** — required for honest promotion timestamps.
3. **Service-role JWT rotation** — handoff §3. Gating Phase 2 ingestion.
4. **`/api/cron/integrity-audit` route handler** — Phase 5. Cron schedule is live, handler is absent.
5. **Per-agent `category` column** — currently inferred from static ID sets in `app/agents/page.tsx`. Moving to a DB column would unlock server-side category queries.
