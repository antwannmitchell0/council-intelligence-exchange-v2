# Architecture — The Council Intelligence Exchange v2

> Layer-by-layer walkthrough of how the system is built. Read `docs/OPERATING-MANUAL.md` §2 first for the executive view; this doc is the depth.

**Document version:** 1.0 (2026-04-24)

---

## 1 · The five layers

```
╔══════════════════════════════════════════════════════════════════╗
║ 5. Public surface           (Next.js pages, 3D floor, leaderboard) ║
║ 4. API + cron handlers      (Route handlers, bearer auth)         ║
║ 3. Business logic           (Ingestion, routing, integrity math)  ║
║ 2. Data layer               (Supabase Postgres + RLS + realtime)  ║
║ 1. External sources         (SEC, FRED, BLS, Alpaca, etc.)        ║
╚══════════════════════════════════════════════════════════════════╝
```

Each layer has ONE responsibility and exposes a contract to the layer above. This is the rule.

- Layer 1 does not know about stages.
- Layer 2 does not know about EDGAR or Alpaca.
- Layer 3 does not know about HTTP.
- Layer 4 does not know about business math.
- Layer 5 does not know about where data originated.

Violations are bugs. If you find one, it gets fixed, not worked around.

---

## 2 · Layer-by-layer detail

### 2.1 Layer 1 — External sources

Every upstream is documented: source ID, base URL, rate limit, ToS posture, auth requirement. See `docs/SUPABASE-REFERENCE.md` `v2_sources` table for the canonical registry.

| Source ID | Agent | Base URL | Auth | Rate limit |
|---|---|---|---|---|
| `sec-edgar-form4` | insider-filing-agent | `https://efts.sec.gov/LATEST/search-index` | SEC_USER_AGENT header | 10 req/s |
| `sec-edgar-13fhr` | thirteen-f-agent | same | same | same |
| `senate-stock-watcher` | congress-agent | `https://senatestockwatcher.com/api/v1/transactions` | none | community (currently offline) |
| `fred-yield-curve` | yield-curve-agent | `https://api.stlouisfed.org/fred/series/observations` | FRED_API_KEY | 120 req/min |
| `fred-fedfunds-proxy` | fed-futures-agent | same | same | same |
| `bls-jobs-report` | jobs-data-agent | `https://api.bls.gov/publicAPI/v2/timeseries/data` | BLS key optional | 500/day unreg, 500/user reg |
| `gdelt-doc-timelinevolraw` | gdelt-event-volume-agent | `https://api.gdeltproject.org/api/v2/doc/doc` | none | unpublished |
| `wikimedia-pageviews` | wiki-edit-surge-agent | `https://wikimedia.org/api/rest_v1` | none | 200 req/s |
| `etherscan-txlist` | etherscan-whale-agent | `https://api.etherscan.io/api` | ETHERSCAN_API_KEY | 3 req/s free |
| `clinicaltrials-gov-studies` | clinical-trial-outcomes-agent | `https://clinicaltrials.gov/api/v2/studies` | none | unpublished |
| (separate) Alpaca | order router + poll | `https://paper-api.alpaca.markets` | APCA-API-KEY-ID + APCA-API-SECRET-KEY | 200 req/min |
| (separate) SEC CIK map | sec-cik-ticker resolver | `https://www.sec.gov/files/company_tickers.json` | SEC_USER_AGENT | 10 req/s shared |

All fetches pass through `lib/ingestion/http.ts::fetchWithRetry` for exponential backoff + jitter + `Retry-After` respect. Per-source throttling via `lib/ingestion/http.ts::RateLimiter` token bucket.

Licensing posture per source: see `alt-data-licensing` skill (`~/.claude/skills/`).

### 2.2 Layer 2 — Data layer (Supabase Postgres)

**Schema inventory** in `docs/SUPABASE-REFERENCE.md`. Highlights:

| Table | Role | Write path | Read path |
|---|---|---|---|
| `v2_agents` | Agent catalog | Service role (migrations) | Anon (RLS: `status='verified'`) |
| `v2_signals` | Every ingested signal | Service role (ingestion) | Anon (RLS: `status='verified'`) |
| `v2_trade_tickets` | Broker orders + fills | Service role (router + webhook + poll) | Anon (RLS: filled/partial only) |
| `v2_integrity_events` | **Append-only audit log** | Service role + triggers | Anon (all rows) |
| `v2_agent_heartbeats` | Agent online state | Service role (base-agent + breaker) | Anon (all) |
| `v2_leaderboard_snapshots` | Ranked agent snapshots | Service role (cron) | Anon (all) |
| `v2_sources` | Upstream source registry | Service role (migration 0013) | Anon (RLS: `status='verified'`) |
| `v2_hive_events` | Hive stream | DB triggers | Anon (RLS: verified only) |
| `v2_early_access_requests` | Waitlist | RPC `v2_submit_early_access` (SECURITY DEFINER) | None (private) |
| `v2_abuse_events` | Anti-abuse log | Rate-limit middleware | None (private) |
| `v2_directional_signals` | Bull/bear/neutral calls | Manual / future | Anon (verified only) |

**Defense-in-depth:**
- Layer 2a — RLS policies (per-table, enforced by Postgres)
- Layer 2b — PostgREST constraints (unique constraints for ON CONFLICT; service-role required for write paths)
- Layer 2c — code-level guards (`lib/supabase/server.ts` chooses the right client role; `lib/render-if-verified.ts` filters reads)

**Triggers:**
- `v2_agents_status_change_trigger` → writes to `v2_integrity_events`
- `v2_trade_tickets_updated_at_trigger` → maintains `updated_at`
- Signal insert → hive event (migration 0004)
- Heartbeat transition → awake/sleep (migration 0004)

**Realtime publication** (`supabase_realtime`):
- `v2_signals`, `v2_agent_heartbeats`, `v2_leaderboard_snapshots`, `v2_trade_tickets`

**Migrations** in strict numeric order, all idempotent (`IF NOT EXISTS`). See `docs/SUPABASE-REFERENCE.md` §"Migrations — the truth in order".

### 2.3 Layer 3 — Business logic

Three sub-modules, each with ONE responsibility:

#### 2.3.1 Ingestion (`lib/ingestion/`)

**Canonical lifecycle** in `BaseIngestionAgent.run()`:

```typescript
async run(): Promise<IngestionResult> {
  // 1. Check circuit breaker (in-memory, 3-strike)
  if (breaker.is_open) return skipped

  // 2. Fetch from upstream
  const raw = await this.fetch()

  // 3. Parse to NormalizedSignal[]
  const normalized = this.parse(raw)

  // 4. In-memory dedup by external_id
  const deduped = dedupeByExternalId(normalized)

  // 5. Upsert to v2_signals (ON CONFLICT DO NOTHING via named constraint)
  const persisted = await supabase.upsert(deduped)

  // 6. Order router (Phase 4) — translates persisted signals to paper orders
  await routeOrders(persisted)

  // 7. Heartbeat + breaker success
  await recordSuccess(agent_id)

  return result
}
```

Ten concrete agents extend `BaseIngestionAgent`:
- `insider-filing-agent`, `thirteen-f-agent`, `congress-agent`
- `yield-curve-agent`, `jobs-data-agent`, `fed-futures-agent`
- `gdelt-event-volume-agent`, `wiki-edit-surge-agent`, `etherscan-whale-agent`, `clinical-trial-outcomes-agent`

Each agent provides `fetch()` + `parse()` and nothing else. The lifecycle is in the base. New agents are added by creating a new file in `lib/ingestion/agents/` and registering it in `lib/ingestion/registry.ts`.

**Circuit breaker** (`lib/ingestion/circuit-breaker.ts`):
- 3 consecutive failures → trip, `heartbeat.status = 'degraded'`
- 1 success → reset, `heartbeat.status = 'online'`
- In-memory state; survives within a function container (Fluid Compute reuses containers)

**Dedup** (`lib/ingestion/dedup.ts`):
- `buildExternalId([segments])` — deterministic hash
- Upsert uses `(source_id, external_id)` unique constraint
- `ignoreDuplicates: true` — no overwrites; previously-stored rows stay as they are

#### 2.3.2 Order routing (`lib/alpaca/`)

**Entry:** `routeOrders(PersistedSignal[])` — called inline from `BaseIngestionAgent.run()` after successful upsert.

**Flow:**
1. Check own circuit breaker (`alpaca-router` key, separate from ingestion breakers)
2. If no `ALPACA_*` env vars → log + no-op (ingestion stays green)
3. Fetch account once per batch (equity, PDT state)
4. PDT guard (`lib/alpaca/pdt-guard.ts` — FINRA 4210)
5. For each signal:
   - Skip if no symbol / no side
   - Size via `lib/alpaca/position-sizing.ts` (1% NAV, $5k cap)
   - POST `/v2/orders` with `client_order_id = signal.id` (idempotent)
   - On success: upsert `v2_trade_tickets`, promote signal to `stage_tag='broker-paper-tracking'`, write integrity event
   - On Alpaca rejection (422): write `order_rejected` integrity event; no ticket row
   - On exception: trip router breaker; return without failing ingestion

**Idempotency key:** `client_order_id = v2_signals.id` (UUID). Alpaca returns 409 on duplicate; router treats as success and fetches the existing order.

**Safety guards:**
- Base URL MUST contain `paper-api.` — `alpacaClient()` returns null otherwise (live trading refused at code boundary)
- Dedicated breaker isolates Alpaca failures from ingestion
- Every outcome writes to `v2_integrity_events` for auditability

#### 2.3.3 Integrity math (`lib/integrity/`)

**Pure math** in `lib/integrity/math.ts` — no I/O, no framework. Constants:

```typescript
export const LIVE_VERIFIED_GATE = {
  minDays: 90, minIC: 0.05, minSharpe: 1, minTStat: 2
}
export const RETIRE_GATE = {
  minDays: 30, icFloor: 0.02, tstatFloor: 1.5
}
```

Functions: `pearsonIC`, `tStatFromIC`, `annualizedSharpe`, `passesGate`, `shouldRetire`.

**Audit logic** in `lib/integrity/audit.ts`:
- Iterates every agent in tracked stages
- Computes rolling metrics from `v2_trade_tickets` fills
- Decides promote / retire / noop per gate
- Writes `phase_promotion` or `math_gate_fail` or no-op to `v2_integrity_events`

**Cron entrypoint:** `app/api/cron/integrity-audit/route.ts` (06:00 UTC daily).

### 2.4 Layer 4 — API + cron handlers

All `/api/*` routes are Next.js App Router Route Handlers, running on Node.js Fluid Compute.

**Auth patterns:**
- Cron routes: `Authorization: Bearer $CRON_SECRET` (verified against Vercel env)
- Webhook: `x-webhook-secret: $ALPACA_WEBHOOK_SECRET` header
- Public endpoints (marketplace): anti-abuse middleware + RPC call with security-definer

**Route inventory:** see `docs/OPERATING-MANUAL.md` §13.

**Runtime config:**
- `export const runtime = 'nodejs'` — Fluid Compute
- `export const dynamic = 'force-dynamic'` — no static generation for API routes
- `export const maxDuration = 60` or 300 depending on expected workload

**Error contract:**
- 2xx: success (with optional `warnings: string[]`)
- 207: partial success
- 400: client error
- 401: auth failure
- 404: unknown agent / resource
- 500: server exception
- 503: misconfiguration (missing env var)

### 2.5 Layer 5 — Public surface

**Next.js App Router** pages (SSG where possible, SSR for realtime-driven surfaces):

- `/` — landing (SSG)
- `/floor` — 3D three.js canvas (client component inside an SSG shell)
- `/agents`, `/agents/[id]` — SSG via `generateStaticParams()`
- `/exchange`, `/marketplace` — SSR with realtime subscriptions
- `/intelligence`, `/hive`, `/trading` — SSG (placeholders / methodology)

**Rendering gate:** `lib/render-if-verified.ts`. Every performance claim flows through this utility, which returns verified content OR blank. No filler.

**Design system:** `design/tokens.ts` (palette, motion curves, typography scale). The 2026 exotic futuristic aesthetic encoded in `council-design-language` skill.

**Realtime:** Supabase subscriptions on `v2_signals`, `v2_agent_heartbeats`, `v2_leaderboard_snapshots` deliver deltas to the Live Feed, Floor, and Leaderboard under 1 second.

---

## 3 · Cross-cutting concerns

### 3.1 Observability

Every route handler emits single-line structured JSON to stdout via the shared `logEvent()` pattern. Log format:

```json
{"event":"cron.ingest.finish","at":"2026-04-24T16:52:00Z","agent_id":"insider-filing-agent","status":"success","ingested":100,"deduped":0,"errors":0,"duration_ms":2057,"http":200}
```

**Vercel log drains** (free) capture to file. Grep-friendly. No runtime cost.

Scheduled for Phase B: Sentry SDK + Slack webhook on `error` / `failed` events.

### 3.2 Secrets management

Three tiers:

| Tier | Examples | Storage | Rotation cadence |
|---|---|---|---|
| Frontend-visible | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel env (bundled at build) | On JWT rotation |
| Server-only | `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `ALPACA_*`, `SEC_USER_AGENT` | Vercel env (server-runtime only) | Every 6 months OR on compromise |
| Generated | `ALPACA_WEBHOOK_SECRET` | `openssl rand -hex 32`, set in Vercel | Same as server-only |

Full rotation runbook: `docs/SECRETS-ROTATION-PLAYBOOK.md`.

### 3.3 Dependency philosophy

Minimal dependencies. Every package in `package.json` has a purpose:

- **UI runtime:** `react`, `react-dom`, `next`, `three`, `@react-three/fiber`, `@react-three/drei`, `framer-motion`
- **Styling:** `tailwindcss` (v4), `class-variance-authority`, `clsx`, `tailwind-merge`
- **UI primitives:** `@base-ui/react`, `lucide-react` (icons)
- **Data:** `@supabase/supabase-js`, `@tanstack/react-virtual`
- **Platform:** `@vercel/config`, `@vercel/functions`
- **Safety:** `server-only` (prevents server modules from bundling to client)

**No Alpaca SDK** — we use `fetch` directly against their REST API. Same with SEC, FRED, etc. Smaller bundle, no surprise SDK breaking changes.

### 3.4 Type safety

- TypeScript throughout (`tsconfig.json`)
- Supabase types manually maintained in `lib/supabase/types.ts` (regenerated via `supabase gen types` periodically)
- Strict `"server-only"` boundary enforced at module level

### 3.5 Build + deploy

- `npx next build` type-checks + produces production bundle
- `vercel --prod` deploys `main` branch to production
- Vercel Git integration auto-deploys on push to `main`
- Preview deployments on every PR
- Rollback via Vercel dashboard → previous deployment → Promote

---

## 4 · Data flow — end-to-end example

**Scenario:** SEC publishes a Form 4 filing at 9:15 AM ET. The filing is Apple CFO buying 1000 shares of AAPL.

**Timeline:**

1. **09:15 AM ET** — SEC EDGAR indexes the filing; it appears in `https://efts.sec.gov/LATEST/search-index?forms=4`
2. **Next day, 03:00 AM ET (07:00 UTC)** — Vercel cron `/api/cron/ingest/insider-filing-agent` fires
3. `insider-filing-agent.fetch()`:
   - `preloadTickerMap()` starts in parallel
   - GET request to EDGAR search-index with date range
   - Returns ~100 hits, one of which is the Apple CFO filing
4. `insider-filing-agent.parse()`:
   - For each hit: extract `ciks[1]` (issuer CIK) — for this filing, CIK `320193`
   - Resolve via `lookupTicker('320193')` → returns `'AAPL'`
   - Construct `NormalizedSignal` with `symbol='AAPL'`, `side='buy'`, body JSON with filing metadata
5. `BaseIngestionAgent.run()` continues:
   - `dedupeByExternalId()` in-memory
   - `upsert` to `v2_signals` (ON CONFLICT (source_id, external_id) DO NOTHING)
   - Returns newly-inserted signal IDs
6. `routeOrders([signal])`:
   - Check Alpaca router breaker — closed
   - Fetch account: equity $92,686, PDT=false
   - Compute notional: 1% × $92,686 = $926.86, capped at $5000
   - POST `/v2/orders` with `symbol='AAPL', side='buy', type='market', time_in_force='day', notional='926.86', client_order_id=<signal.id>`
   - Alpaca responds 200 with order object, status='accepted'
   - Upsert `v2_trade_tickets` with order details
   - UPDATE `v2_signals SET stage_tag='broker-paper-tracking' WHERE id=<signal.id>`
   - Insert `v2_integrity_events` (actor='trigger:alpaca-router', event_type='order_submitted', context={symbol, alpaca_order_id})
7. **Later that day** — Alpaca fills the order at market open:
   - Alpaca internal state updates to filled
   - Our `/api/cron/alpaca-poll` cron fires (or webhook — same code path via different entry)
   - Listing `/v2/orders?after=<yesterday>`, matches `client_order_id`
   - UPDATE `v2_trade_tickets SET order_status='filled', filled_avg_price=X, filled_at=Y`
   - Insert `v2_integrity_events` (actor='cron:alpaca-poll' or 'trigger:alpaca-webhook', event_type='order_filled')
8. **Next morning, 06:00 UTC** — `/api/cron/integrity-audit` runs:
   - For insider-filing-agent: aggregate `v2_trade_tickets` fills over trailing 90 days
   - Compute IC, Sharpe, t-stat
   - If (n≥90 days AND IC≥0.05 AND Sharpe≥1 AND t>2): promote agent to `live-verified`, write integrity event
   - Else: no-op (insufficient days yet)

**Every step is traceable** via:
- `v2_signals` row (inputs)
- `v2_trade_tickets` row (broker proof)
- `v2_integrity_events` rows (decision trail)
- Vercel logs (infrastructure trail)

This is what "math-gated" means in practice. Nothing is a claim. Everything is a record.

---

## 5 · Where to look when something breaks

| Symptom | Likely cause | Where to look |
|---|---|---|
| Cron returns 401 | Wrong or missing CRON_SECRET | Vercel env + `docs/VERCEL-PROJECT-REFERENCE.md` |
| Cron returns 500 `upsert_failed: No suitable key` | Missing unique constraint for ON CONFLICT | Migrations `0011`, `0012` already fix this; verify via information_schema |
| Cron returns 500 `upsert_failed: Legacy API keys are disabled` | Using JWT instead of `sb_secret_` | Replace `SUPABASE_SERVICE_ROLE_KEY` with `SUPABASE_SECRET_KEY` (sb_secret_ format) |
| `symbol=null` in v2_signals for Form 4 | EDGAR didn't resolve or we're reading ciks[0] | Check `lib/ingestion/agents/insider-filing.ts` is using `ciks[1]` + `sec-cik-ticker.ts` is importing |
| Order rejected by Alpaca | Halted symbol / non-fractionable / low buying power | Check `v2_integrity_events` with `event_type='order_rejected'` + `context.alpaca` |
| Signal in `broker-paper-tracking` but no ticket | Router crashed mid-route | Check Vercel logs for `alpaca.router.order_threw`; check router breaker state |
| Integrity audit never promotes | Insufficient days or math gate failing | `select * from v2_integrity_events where event_type='math_gate_fail'` — gate context shows which metric failed |

Full troubleshooting runbook: `docs/ONBOARDING.md` §6 "Debugging a failing pipeline".

---

*For questions not covered here, see `docs/OPERATING-MANUAL.md` §14 for the full document index.*
