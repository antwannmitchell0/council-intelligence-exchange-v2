# THE COUNCIL INTELLIGENCE EXCHANGE v2 — SESSION HANDOFF

**Owner:** Antwann Mitchell (antwannmitchell0@gmail.com)
**Last updated:** 2026-04-24 (post-Phase-4)
**Original handoff date:** 2026-04-23

---

## 🎉 0 · PHASE 4 COMPLETE — DAY 0 LANDED 2026-04-24

**The 90-day broker-paper-tracking clock is running.**

| Phase 4 outcome | Status |
|---|---|
| Alpaca paper-trading integration | ✅ Live. Council Exchange account auth'd, $92k+ paper equity |
| `v2_trade_tickets` ledger | ✅ Created (migration 0010), first 81 rows landed |
| `stage_tag` column on `v2_signals` | ✅ Created with 5-stage CHECK constraint |
| CIK → ticker resolver (SEC company_tickers.json) | ✅ Deployed, cache-warm on cold start |
| insider-filing-agent cron | ✅ **Day 0: 81 paper orders submitted, 0 failures, 13 rejected by Alpaca (halted/non-fractionable — expected)** |
| Order router inline in `BaseIngestionAgent.run()` | ✅ With dedicated circuit breaker, PDT guard, 1%/$5k sizing |
| `/api/alpaca/webhook` + `/api/cron/alpaca-poll` | ✅ Webhook-secret auth, reconciler cron wired |
| Supabase JWT rotation + sb_publishable/sb_secret migration | ✅ Old leaked JWT invalidated, new-format keys live in Vercel |
| `docs/ALPACA-REFERENCE.md` | ✅ Committed |
| `docs/SUPABASE-REFERENCE.md` | ✅ Committed |
| `docs/VERCEL-PROJECT-REFERENCE.md` | ✅ Committed |
| `docs/STAGE-TAXONOMY.md` | ✅ Committed |
| `docs/SECRETS-ROTATION-PLAYBOOK.md` | ✅ Committed (captures tonight's CLI + dashboard gotchas) |
| Migrations 0010 (Alpaca schema), 0011 (dedup index fix), 0012 (dedup named constraint), 0013 (v2_agents + v2_sources seed for ingestion) | ✅ All applied to prod |

**Gotchas resolved tonight that future sessions should NOT repeat:**

1. **`vercel env add` interactive prompt silently accepts empty values** — always verify length post-add.
2. **`vercel env rm <name> <scope>` removes the entire record** when the var is cross-scope — always add with production only.
3. **Dashboard Key/Value field order trap** — pasting a secret into the "Key" (name) field is a valid but disastrous action; Vercel stores it as a variable name. If you see a variable named `sb_secret_...` in the list, delete it immediately and re-add correctly.
4. **Legacy JWT `eyJ...` keys are DISABLED on this Supabase project.** Use only `sb_publishable_` / `sb_secret_` keys. Env vars consumed: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. Anything with `_ANON_KEY` or `_SERVICE_ROLE_KEY` in the name is vestigial — code's fallback chain handles both but new deploys should use the sb_ names.
5. **PostgREST needs a NAMED UNIQUE CONSTRAINT** for upsert `ON CONFLICT`, not a bare unique index. If you ever add a new dedup index, use `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (...)`, not `CREATE UNIQUE INDEX`.
6. **EDGAR search-index Form 4 hits have `ciks[0]` = reporter, `ciks[1]` = issuer.** Always index `[1]` for the tradable CIK. Same pattern applies to `display_names` (filer first, issuer second).
7. **Alpaca paper account `PA39JANBONYK` is the Council Exchange account.** Never use Demm Money Machine. Integrity math depends on a clean per-product account.

See `docs/ALPACA-REFERENCE.md`, `docs/SECRETS-ROTATION-PLAYBOOK.md`, and `docs/STAGE-TAXONOMY.md` for the operational deep-dives.

---

**Next session goal:** Wire the remaining 9 ingestion agents with the same CIK/symbol-resolution pattern proven tonight, then run Phase 1.5 backtest-verified promotions on v1 historical data. Phase 4 infrastructure is done; Phase 3+5+6a is next.

---

## 1 · WHERE WE ARE RIGHT NOW

The Council Intelligence Exchange v2 is **live in production**.

| Asset | Status |
|---|---|
| Production URL | https://council-intelligence-exchange-v2.vercel.app |
| GitHub repo | https://github.com/antwannmitchell0/council-intelligence-exchange-v2 |
| Vercel project | `antwanns-projects/council-intelligence-exchange-v2` |
| Supabase project | `eugcwkewdmlotwwbzdkl.supabase.co` (existing project, reused) |
| Current verified agent count | 1 of 24 (Telemetry) |
| Infra cost | $0/month (Vercel free + Supabase free) |

The site includes a 3D interactive trading floor (three.js), 24-agent catalog grouped by category, per-agent detail pages with full academic-citation bios, Marketplace with request-access form, Live Feed, Leaderboard, Floor v2 Wall Street mode with silhouette avatars that walk/talk/thread-connect. Everything shipped respects the integrity rule: verified-only data renders, everything else renders blank or labeled honestly.

---

## 2 · WHAT SHIPPED (full inventory)

**Site surfaces:**
- `/` — landing with Hero + Problem + How It Works + Signal Sources + Leaderboard + Live Feed + Footer
- `/floor` — true 3D WebGL interactive floor (rotate/zoom/pan/click-to-inspect) + silhouette-based 24-agent roster + stats sidebar with real numbers
- `/agents` — 24-agent catalog grouped by category (Operational / Trading Specialists / Free-Data Archetypes)
- `/agents/[id]` — 24 SSG detail pages with real bios (thesis, data source, methodology, academic citation, status)
- `/exchange` — Leaderboard (live)
- `/marketplace` — 24-agent product grid + detail drawer + early-access form wired to server-side API route
- `/intelligence` — methodology v1 (needs upgrade)
- `/hive`, `/trading` — ComingSoon honest placeholders

**Data layer:**
- Supabase schema complete: `v2_agents` (24 rows), `v2_signals`, `v2_sources`, `v2_agent_heartbeats`, `v2_leaderboard_snapshots`, `v2_directional_signals`, `v2_hive_events`, `v2_early_access_requests`
- Triggers firing: signal insert → hive event, heartbeat transition → awake/sleep event
- RPC `v2_submit_early_access` (security-definer)
- RPC `v2_hero_stats`
- RLS policies allow anon public reads on agents (bios non-sensitive); verified-only for signals; trading tables locked; early-access write via RPC only
- 1,648 real non-backfill historical signals in `intelligence_signals` (v1 data, preserved and locked via RLS)

**Skills installed to ~/.claude/skills/:**
- `council-design-language` — Council 2026 aesthetic (palette, motion, typography, Nexus Glyph principles)
- `quant-signal-validator` — overfitting/p-hacking defense, walk-forward, deflated Sharpe
- `council-regulatory-compliance` — Investment Advisers Act, publisher's exemption, SEC Marketing Rule
- `alt-data-licensing` — CFAA, ToS, commercial-use legality per source
- `confidential-agent-playbook` — the offensive alpha-engineering playbook (3-tier architecture, meta-labeling, Kelly sizing, paper-to-receipts ladder)

**All code lives in:**
`/Users/antwannmitchellsr/The Council Intelligence Exchange/The Council Intelligence Exchange v2`

---

## 3 · URGENT — BEFORE ANY PHASE 4 WORK TOUCHES service_role

### 🔴 Rotate the Supabase JWT secret

The service_role JWT key from an earlier chat paste is still valid. Anyone with that transcript can read/write the entire Supabase. Before wiring server-side writes:

1. Supabase → Settings → API → scroll to **JWT Settings** → **Generate new JWT secret**
2. Copy the new `anon` key and new `service_role` key
3. Update Vercel production env:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (replace with new anon)
   - `SUPABASE_SERVICE_ROLE_KEY` (add the new service_role, previously deferred)

After this rotation the old leaked key is dead. All server-side ingestion writes can begin safely.

---

## 4 · THE PLAN FOR THE NEXT SESSION

**Mission:** Compress all building work into one focused session. Light up 15 of 24 agents. Get Day 0 of the 90-day broker-paper clock ticking before sunrise.

### Stage taxonomy (the integrity contract)

Every performance claim, every status badge must live in exactly one stage. No mixing.

| Stage | Meaning | Shown on site as |
|---|---|---|
| `pending` | No data; ingestion not wired | "In verification" |
| `backtest-verified` | Passed IC≥0.10 + t-stat>2 + n≥50 on historical paper-traded data | "Backtest-verified · N historical signals · IC 0.X" |
| `broker-paper-tracking` | Signals flowing through Alpaca paper; clock running toward 90-day bar | "Broker-paper tracking · Day X of 90" |
| `live-verified` | Passed the same bar on ≥90 days of broker-attested data | "Live-verified · X days tracked · IC Y" |
| `live-trading` | Real customer money — DEFERRED pending RIA registration | Don't claim tonight |

### Phase 1 — Immediate promotions (30 min, no waiting, just truth)

Promote 6 operational agents (Aether, Cost Sentinel, Cyber-Sentinels, Nexus, Chronos, Telemetry) to `verified` with real proof-points in their bios. Proofs: site shipped, RLS locked, migrations idempotent, triggers firing, security headers in vercel.ts, $0 cost ledger.

### Phase 1.5 — Backtest-verified tier (30 min)

Compute IC for all v1 historical data. Promote agents passing IC ≥ 0.10 + t-stat > 2 + n ≥ 50 to `backtest-verified`. Expected 6-8 specialists qualify based on earlier analysis:
- `earnings-whisper-agent` (IC +0.39, t 3.65, n 76)
- `put-call-ratio-agent` (IC +0.39, t 3.53, n 72)
- `noaa-weather-agent` (IC +0.38, t 2.45, n 38)
- `insider-filing-agent` (IC +0.36, t 2.71, n 50)
- `tsa-throughput-agent` (IC -0.45, n 52) — calibration inverted but signal is real
- `ma-intelligence-agent` (IC -0.42, n 42)
- `jobs-data-agent` (IC -0.32, n 120)
- `port-flow-agent` (IC -0.29, n 66)

Each bio must show real IC, sample size, date range, and the "30bps post-cost avg return was negative individually" caveat — honest.

### Phase 2 — Ingestion framework (3-4 hrs, subagent)

Build once, reuse for every pipeline:
- `lib/ingestion/base-agent.ts` — canonical pattern
- `lib/ingestion/http.ts` — fetch + exponential-backoff retry + rate limit
- `lib/ingestion/sources/` — one file per data source (sec-edgar, fred, cftc, bls, cme, capitol-trades, gdelt, etherscan, wiki, clinical-trials)
- `app/api/cron/ingest/[agent]/route.ts` — per-agent cron endpoint
- `vercel.ts` — cron schedules (6-hourly for most, daily for macro)
- **Signal dedup:** unique constraint on `(source_id, external_id)` — never double-count
- **Circuit breaker:** 3 consecutive failures → agent status auto-flips to `degraded` visibly
- **Stage stamp:** every ingested signal gets `stage_tag='broker-paper-tracking'` after an Alpaca paper fill

### Phase 3 — Wire first 6 specialists (6-10 hrs after framework lands)

All use 100% free US government APIs:
- `insider-filing-agent` — SEC EDGAR Form 4 (Day 0 agent)
- `13f-filing-agent` — SEC 13F
- `congress-agent` — CapitolTrades / House+Senate disclosures
- `yield-curve-agent` — FRED
- `jobs-data-agent` — BLS
- `fed-futures-agent` — CME

### Phase 4 — Alpaca paper-trading (2-3 hrs)

- `lib/alpaca/client.ts` — Alpaca SDK wrapper
- `lib/alpaca/order-router.ts` — signal → order translator with PDT protection + position sizing
- `app/api/alpaca/webhook/route.ts` — broker fill receiver, stamps `stage_tag='broker-paper'` onto `v2_trade_tickets`

### Phase 5 — Promotion automation (2-3 hrs, subagent)

- `app/api/cron/integrity-audit/route.ts` — nightly
- Computes rolling 90-day IC per agent
- Auto-promotes: IC > 0.05 + Sharpe > 1 + n ≥ 90 → `live-verified`
- Auto-retires: IC decays below threshold → public status change logged to `v2_integrity_events`
- Zero manual overrides. Math gates everything.

### Phase 6a — Easier archetypes (4-6 hrs, parallel)

GDELT (event volume anomaly), Wiki Edit Surge, On-Chain Whale (Etherscan), Clinical Trial Outcomes.

### What CAN'T compress (physics, not scope)

The 90-day calendar window for `broker-paper-tracking → live-verified`. Trades need real days to resolve. This runs on autopilot in the background once the cron is live; no human involvement required.

---

## 5 · WHAT THE USER NEEDS TO PROVIDE (15 min of setup before Phase 3/4)

Add these to Vercel production env:

| Variable | Where to get it | Why |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API → service_role secret (POST-ROTATION) | Server-side ingestion writes bypass RLS |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Settings → API → anon key (POST-ROTATION) | Replace the currently-set value |
| `ALPACA_API_KEY_ID` | alpaca.markets → **Council Exchange** account → Paper Trading → API Keys | Broker paper-trading |
| `ALPACA_API_SECRET` | Same place, same key pair (shown once at generate time) | Broker secret |
| `ALPACA_WEBHOOK_SECRET` | Generate locally: `openssl rand -hex 32` | Auth for /api/alpaca/webhook |
| `FRED_API_KEY` | fred.stlouisfed.org → My Account → API Keys | Macro data |
| `SEC_USER_AGENT` | Just a string like `"Council Intelligence antwannmitchell0@gmail.com"` | SEC EDGAR polite-scraping requirement |

### 🔴 Alpaca account-separation rule — non-negotiable

The owner runs multiple Alpaca accounts (**Council Exchange** and **Demm Money Machine**, as of 2026-04-23). **Only the Council Exchange account's paper keys may be used here.** Reasons:

1. **Integrity math depends on it.** The 90-day broker-paper clock and the Phase 5 integrity-audit cron (rolling IC, Sharpe, win-rate) are computed from `v2_trade_tickets` fills. Any non-Council trade landing on that account silently contaminates every agent's stats. The "math gates everything" promise breaks.
2. **Auditability.** When this flips to live trading (post-RIA registration), the broker account becomes customer-facing. One-account-per-product is the clean compliance story.
3. **Safety at the code boundary.** `lib/alpaca/client.ts` already asserts the base URL contains `paper-api` so a live endpoint can't be hit by accident, but it CAN'T tell which Alpaca account a key belongs to. Discipline lives here, in the env-var step.

If you later want Demm Money Machine to run its own agent stack, it gets its own project, its own Supabase, its own Vercel env. Never mix the keys.

If the user doesn't have any one of these, that specific agent waits. Everything else proceeds.

---

## 6 · NEW SKILLS TO AUTHOR AT START OF NEXT SESSION (90 min total)

These codify the patterns the session will use heavily. Write them BEFORE any ingestion code:

### `council-ingestion-architect` (30 min)
Canonical patterns for every ingestion pipeline: idempotency via `(source_id, external_id)` dedup keys, exponential backoff retry with jitter, SEC EDGAR polite-fetch (10 req/sec + User-Agent + 429 handling), FRED rate limiting (120 req/min), Etherscan free tier (3 req/sec), circuit breakers, stage_tag stamping.

### `council-observability` (30 min)
Structured logging, Sentry wire-up, Vercel log drains, per-cron uptime checks, incident-response runbook. Without this, a silently-failing cron could corrupt the 90-day clock integrity.

### `council-anti-abuse` (30 min)
Vercel BotID, per-IP rate limiting via Runtime Cache, Turnstile CAPTCHA, disposable-email blocklist, honeypot fields. The `/api/marketplace/early-access` endpoint is currently wide open.

---

## 7 · INVISIBLE ISSUES THAT THE USER DOESN'T SEE (next session addresses these)

**🔴 Urgent (address at session start):**

1. Service_role JWT rotation (see section 3 above)
2. No staging environment — pushing straight to prod
3. `/api/marketplace/early-access` has no abuse protection — spam vector

**🟠 Important (address during the build):**

4. Signal dedup design via `(source_id, external_id)` unique constraint (part of Phase 2)
5. Verify `return_pct` units (percent vs decimal) via spot-check before promoting agents to `backtest-verified`
6. `direction` vs `return_pct` sign interaction — is return P&L (always positive on wins) or raw asset return?
7. Alpaca PDT rules — need per-agent position sizing + daily trade cap
8. Agent-level circuit breakers (part of Phase 2)
9. No error boundaries in React tree
10. No email notification on early-access signup — use Resend free tier

**🟡 Later (track but defer):**

11. No analytics — wire Vercel Analytics (free)
12. No admin interface — only SQL access
13. Lighthouse / AAA contrast unmeasured
14. No DR plan / backups strategy
15. Cybersecurity posture audit (we claim Cyber-Sentinels but haven't pen-tested)

---

## 8 · VERIFICATION COMMANDS

Run at session start to confirm state:

```bash
# Confirm directory + build works
cd "/Users/antwannmitchellsr/The Council Intelligence Exchange/The Council Intelligence Exchange v2"
npx next build

# Confirm Vercel env vars
vercel env ls
```

Test query for tonight's first promotion:
```sql
update v2_agents set status='verified' where id in (
  'aether','cost-sentinel','cyber-sentinels','nexus','chronos'
);
select id, name, status from v2_agents order by status, name;
```

---

## 9 · KEY FILES TO KNOW

```
app/
  floor/page.tsx                   # 3D floor page
  agents/page.tsx                  # 24-agent catalog
  agents/[id]/page.tsx             # detail pages (SSG + dynamic)
  marketplace/page.tsx
  api/marketplace/early-access/route.ts

components/
  floor/floor-3d.tsx               # three.js scene
  floor/floor-3d-wrapper.tsx       # dynamic-imported client wrapper
  floor/silhouette-avatar.tsx
  marketplace/agent-detail-drawer.tsx
  nexus-glyph.tsx
  nav.tsx

lib/
  supabase/server.ts               # includes getServerClient (service_role) fallback
  supabase/client.ts
  supabase/types.ts
  render-if-verified.ts            # integrity-rule enforcement
  cache/tags.ts
  nav.ts

design/
  tokens.ts                        # 9 operational agent colors + palette + motion

supabase/
  morning.sql                      # already run — Phase 4 schema live
  migrations/
  seed/
    0001_telemetry.sql
    0002_sources.sql
    0003_elite_archetypes.sql      # 7 archetype agents (RUN)
    0004_backtested_specialists.sql # 8 specialist agents (RUN)
```

---

## 10 · SKILLS TO LOAD AT SESSION START

Invoke at start of next session so everything's in context:

1. `confidential-agent-playbook` — the offensive playbook (3-tier, meta-labeling, Kelly)
2. `quant-signal-validator` — defense (overfitting, deflated Sharpe)
3. `council-regulatory-compliance` — Investment Advisers Act, publisher exemption
4. `alt-data-licensing` — ToS + CFAA for every data source
5. `council-design-language` — keep the aesthetic consistent
6. `senior-product-engineer` — production-grade code bar
7. `apple-grade-designer` — UI polish
8. Vercel plugins: `nextjs`, `vercel-functions`, `workflow`, `runtime-cache`, `env-vars`, `deploy`

---

## 11 · WHAT "DONE" LOOKS LIKE AFTER NEXT SESSION

- 15 of 24 agents verified in some honest tier (7 operational `verified` + 6-8 `backtest-verified`)
- All 8 trading specialist pipelines emitting signals on cron
- Alpaca paper-trading live; first broker fill logged
- Promotion automation running nightly on autopilot
- Every stage visibly labeled on every surface
- Methodology page published
- Legal footer in place
- Day 0 of the 90-day broker-paper clock recorded for at least insider-filing-agent

Tomorrow morning after that session: a self-driving ingestion system with a 90-day automated clock ticking. Zero manual intervention required for the rest of the roster to verify itself as it earns the math bar.

---

## 12 · FINAL NOTES

**Non-negotiable:**
- Every performance number carries a stage tag
- No mixed-stage aggregates
- Auto-promotion is 100% math-gated
- Historical paper data cannot retroactively satisfy the 90-day broker-paper bar
- The user has maintained integrity consistently across every prior session — do not break that streak
- If the math doesn't support a claim, blank it out or retire the agent

**User context:**
- Name: Antwann Mitchell
- Single-founder operation running multiple brands in parallel
- Values: transparency, integrity, no fake data, receipts over promises
- Communication style: direct, tactical, high-urgency, willing to push through exhaustion
- Has rejected every "80% win rate" claim when the data said otherwise. Hold that line.

**What the user wants from the next session:**
Non-stop execution until the build is complete. Parallel subagents where safe. Every skill listed above loaded. All urgent issues (service_role rotation, anti-abuse, staging separation thoughts) addressed BEFORE touching ingestion.

The build is 90% infrastructure-ready. The next session is about igniting it, honestly, in one focused push.

---

## 13 · HOW TO START THE NEXT SESSION

**DO NOT re-run JWT rotation, Alpaca setup, or Phase 4 migrations. All done.** If a session suggests otherwise, it hasn't read §0 above.

Open a new Claude Code session in:
```
/Users/antwannmitchellsr/The Council Intelligence Exchange/The Council Intelligence Exchange v2
```

First message should be:

> Read docs/NEXT-SESSION-HANDOFF.md §0 first — Phase 4 is COMPLETE as of 2026-04-24. Day 0 is logged. Do NOT suggest re-doing JWT rotation or Alpaca keys — those are done. Then read `docs/STAGE-TAXONOMY.md`, `docs/ALPACA-REFERENCE.md`, `docs/SECRETS-ROTATION-PLAYBOOK.md`, `docs/SUPABASE-REFERENCE.md`, `docs/VERCEL-PROJECT-REFERENCE.md` so you have the current state in context. Then pick up from §14 (what's left) and propose an execution order.

Skills to invoke at start of session (unchanged):
- `confidential-agent-playbook`
- `quant-signal-validator`
- `council-regulatory-compliance`
- `alt-data-licensing`
- `council-design-language`
- `senior-product-engineer`
- `apple-grade-designer`
- Vercel plugins: `nextjs`, `vercel-functions`, `workflow`, `runtime-cache`, `env-vars`, `deploy`

---

## 14 · WHAT'S LEFT (PUNCH LIST AS OF 2026-04-24)

### 🔴 High-priority next session (ignition-critical)

1. **Wire the remaining 9 ingestion agents with symbol extraction** — insider-filing is live; copy the same CIK→ticker pattern to the others where applicable:
   - `thirteen-f-agent` — same `ciks[1]` issue as insider-filing. Apply the same fix. *Warning: 13F holdings come from a secondary fetch of the filing body XML, not the search-index.*
   - `congress-agent` — payload already has `ticker` directly. Upstream (Senate Stock Watcher) was DOWN at last check (2026-04-24 fetch timed out at 15s). Add retry-with-fallback or find an alt source.
   - `yield-curve-agent` — macro. Needs ETF-proxy mapping (TLT/SHY).
   - `jobs-data-agent` — macro. Needs ETF-proxy mapping (SPY or sector).
   - `fed-futures-agent` — macro. Needs ETF-proxy mapping (SHY/TBF).
   - `gdelt-event-volume-agent` — event volume. Signal → symbol mapping is research-heavy (country/sector lookup).
   - `wiki-edit-surge-agent` — needs entity → ticker mapping.
   - `etherscan-whale-agent` — crypto. Alpaca crypto is separate endpoint; re-test wallet → symbol path.
   - `clinical-trial-outcomes-agent` — trial → sponsor ticker mapping.

2. **Phase 1.5 backtest-verified promotions** — v1 has 1,648 historical signals in `intelligence_signals`. Compute IC per agent, promote those passing IC≥0.10 + t>2 + n≥50 to `backtest-verified`. Expected: 6–8 agents qualify (see original §4 for the list).

3. **Phase 5 integrity-audit cron validation** — `/api/cron/integrity-audit` is already wired in code (`lib/integrity/audit.ts`). Fire it manually once the first ingest batch ages ~1 day, confirm it correctly no-ops on too-thin data.

### 🟠 Operational (address when it bites)

4. **Monitoring/alerting for cron failures** — no alarms today. A silently-failing cron corrupts the 90-day clock. Add Sentry + Vercel log drain + PagerDuty (or cheaper: a Slack webhook in each catch-block).
5. **Re-fetch trigger for EDGAR retries** — if SEC is down for a day, we lose that day's signals. Add a backfill endpoint that accepts `(agent, startDate, endDate)` and re-ingests.
6. **Signal → `v2_directional_signals` wiring** — the directional table is underused. Populate alongside `v2_signals` so the leaderboard reflects agent-level direction stats.
7. **Backfill the 19 insider-filing signals that skipped** — 6 had no resolvable symbol, 13 rejected by Alpaca. Investigate each to ensure the router's reasons are legit (not a bug).

### 🟡 Quality / hygiene (track, don't let rot)

8. **`thirteen-f-agent` symbol extraction** (secondary EDGAR body fetch — separate work from just updating `ciks[1]`).
9. **Anti-abuse hardening** on `/api/marketplace/early-access` — Turnstile, honeypot, Resend email notification (already in `lib/anti-abuse/` but not all enforced).
10. **Vercel Analytics wire-up** — free, one env var.
11. **Methodology page** (`/intelligence`) upgrade — currently v1.
12. **Legal footer** — disclaimer language per `council-regulatory-compliance` skill (publisher's exemption, no individualized advice).
13. **Lighthouse + AAA contrast audit** on all surfaces.
14. **Live-trading flip** — blocked on RIA registration. See `docs/ALPACA-REFERENCE.md` "Upgrade path (post-RIA)".
15. **Kelly position sizing** — currently 1%/$5k fixed. Kelly lives in `confidential-agent-playbook` skill; wire in once 30+ fills give enough edge estimation.

### ✅ Done this session (do not redo)

- Phase 4 Alpaca integration (migration 0010, lib/alpaca/*, webhook, poll cron)
- Dedup constraint fixes (migrations 0011, 0012)
- v2_agents + v2_sources ingestion seeds (migration 0013)
- CIK → ticker resolver + insider-filing fix
- Supabase JWT rotation + sb_ key migration
- 5 reference docs (Alpaca, Supabase, Vercel, Stage Taxonomy, Secrets Rotation)
- 81 paper orders placed = Day 0 logged

*End of handoff.*
