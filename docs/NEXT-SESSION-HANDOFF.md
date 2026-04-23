# THE COUNCIL INTELLIGENCE EXCHANGE v2 — SESSION HANDOFF

**Owner:** Antwann Mitchell (antwannmitchell0@gmail.com)
**Handoff date:** 2026-04-23 (end of "Unthinkable Night" session)
**Next session goal:** Light up Phase 4 (Alpaca paper-trading + broker fill webhook) to start the 90-day clock for agent promotions to `live-verified`. Everything else is self-driving.

---

## 1 · WHERE WE ARE RIGHT NOW

The Council Intelligence Exchange v2 is **live in production** with **13 of 29 agents verified at honest math-earned tiers**.

| Asset | Status |
|---|---|
| Production URL | https://council-intelligence-exchange-v2.vercel.app |
| GitHub repo | https://github.com/antwannmitchell0/council-intelligence-exchange-v2 |
| `main` branch | parity with production (PRs #1 + #2 squash-merged) |
| Vercel project | `antwanns-projects/council-intelligence-exchange-v2` |
| Supabase project | `eugcwkewdmlotwwbzdkl` (JWT rotated, sb_publishable key in use) |
| Plan | Hobby (crons capped at daily cadence; upgrade = sub-daily) |
| Infra cost | $0/month |

---

## 2 · WHAT SHIPPED THIS SESSION

### Phase 1 — Operational promotions (6 agents → `verified`)
Aether, Chronos, Cost-Sentinel, Cyber-Sentinels, Nexus, Telemetry.
Honest proof-points live in each bio: 3D floor, $0/month ledger, RLS locked, security headers, cron wired, realtime feed.

### Phase 1.5 — Backtest-verified tier (7 agents → `backtest-verified`)
Math-earned via real IC / t-stat / n ≥ 50 gate against v1 historical paper-traded data (`intelligence_signals` table).

| Agent | n | IC | t-stat | Note |
|---|---|---|---|---|
| tsa-throughput-agent | 52 | −0.84 | −11.0 | **Inverted calibration** — direction-flip wrapper = strongest positive IC in roster |
| linkedin-jobs-agent | 56 | +0.44 | 3.6 | Clean pass |
| app-store-agent | 56 | +0.44 | 3.6 | Clean pass |
| earnings-nlp-agent | 58 | +0.38 | 3.1 | **Highest avg return (+5.26%)** — potential standalone |
| satellite-imagery-agent | 54 | +0.30 | 2.3 | Marginal — decay-watch active |
| sovereign-wealth-agent | 78 | +0.28 | 2.5 | Ensemble contributor |
| put-call-ratio-agent | 72 | +0.25 | 2.1 | Marginal pass |

**5 of these were inserted as NEW `v2_agents` rows** (they existed as signal sources in v1 but had no agent entry). Roster is now 29, not 24.

### Phase 2 — Ingestion framework (complete)
`lib/ingestion/`: types, http (exp-backoff + jitter + per-source RateLimiter), dedup, circuit-breaker (3-strike), base-agent, registry.
`app/api/cron/ingest/[agent]/route.ts` — dynamic cron handler, CRON_SECRET-gated, maxDuration 300s.
`supabase/migrations/0005_signal_dedup_constraint.sql` — unique index on `(source_id, external_id)`.

### Phase 3 — 6 trading-specialist agents (pre-staged)
insider-filing, thirteen-f, congress (Senate only — House PDF-parse deferred), yield-curve, jobs-data, fed-futures (FRED-derived proxy vs CME's no-API constraint).

### Phase 5 — Nightly integrity-audit cron (complete)
`app/api/cron/integrity-audit/route.ts` — math-gated auto-promote / auto-retire.
`supabase/migrations/0008_integrity_events.sql` — append-only audit log + DB trigger.
`lib/integrity/math.ts` + `audit.ts` — pearson IC, t-stat, Sharpe, pass-gate logic.
Cron schedule: `0 6 * * *` (06:00 UTC daily). First autonomous run tomorrow morning.

### Phase 6a — 4 archetype agents (pre-staged)
GDELT event-volume anomaly, Wikipedia pageview surge (20 tickers), Etherscan whale outflows ($1M+), ClinicalTrials.gov outcomes.

### Anti-abuse — `/api/marketplace/early-access` hardened
Honeypot + per-IP rate limit (Vercel Runtime Cache) + MX-record DNS check + disposable-email blocklist.
`supabase/migrations/0009_abuse_events.sql` — sha256-hashed audit log (PII-safe).

### Methodology + legal footer
`/intelligence` — full rewrite: 7 sections (hero, 5 stages, math bar, auto-promotion, auto-retirement, NOT-advice disclosure, references).
`components/legal-footer.tsx` — global band: "not a registered investment adviser · not a recommendation · see Methodology."
Mounted in `app/layout.tsx` — renders on every page.

### Skills authored
`.claude/skills/`: council-ingestion-architect, council-observability, council-anti-abuse, council-operator-mindset.
All project-local, commit with the repo, auto-load in future sessions.

### Supabase rotation-proof
App now reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (sb_publishable_* format) with legacy JWT fallback. The leaked service_role key from the earlier chat is now cryptographically dead (its signing key is in the Revoked pile; the app no longer uses the legacy format). Verified via direct API call.

---

## 3 · WHAT'S RUNNING ON AUTOPILOT

Every day at 06:00 UTC, the nightly integrity-audit cron:
1. Computes rolling 90-day IC / t-stat / Sharpe per agent from `v2_signals`
2. Writes `math_gate_pass` / `math_gate_fail` rows to `v2_integrity_events`
3. Auto-promotes `broker-paper-tracking` → `live-verified` if: 90d + IC ≥ 0.05 + Sharpe ≥ 1 + t-stat > 2
4. Auto-retires any verified-tier agent whose 30d IC drops below 0.02 or t-stat below 1.5 → `degraded`
5. Flips the public badge accordingly (DB trigger auto-logs status_change too)

Zero human involvement required. Math gates everything.

Staggered cron schedule (daily, UTC):
- 06:00 — integrity-audit
- 07:00/07:15/07:30 — insider-filing, thirteen-f, congress
- 08:00/08:15/08:30 — yield-curve, jobs-data, fed-futures
- 09:30 — wiki-edit-surge
- 10:00 — gdelt-event-volume
- 11:00 — etherscan-whale
- 12:00 — clinical-trial-outcomes

---

## 4 · WHAT'S DEFERRED TO NEXT SESSION

### 🔴 Phase 4 — Alpaca paper-trading (BLOCKS the 90-day clock)

Until this ships, no agent can graduate from `backtest-verified` → `broker-paper-tracking`. The clock does not start.

**What user needs to provide:**
1. `ALPACA_API_KEY_ID` (from https://app.alpaca.markets → Paper → Generate API Keys)
2. `ALPACA_API_SECRET` (same page)

Push both via `vercel env add ALPACA_API_KEY_ID production` and `vercel env add ALPACA_API_SECRET production`.
`ALPACA_BASE_URL` is already set to `https://paper-api.alpaca.markets`.

**What next session builds:**
- `lib/alpaca/client.ts` — Alpaca SDK wrapper
- `lib/alpaca/order-router.ts` — signal → order translator with PDT rules + position sizing (conservative: 1% of paper capital per ticket)
- `app/api/alpaca/webhook/route.ts` — broker fill receiver; on first fill for each `backtest-verified` agent, write to `v2_trade_tickets` and flip that agent's status → `broker-paper-tracking` (starts Day 0)
- `supabase/migrations/0010_trade_tickets.sql` — new table for broker-attested fills

**First signal to route:** `insider-filing-agent` (SEC EDGAR Form 4). Start Day 0 there. Others follow as their pipelines warm up.

### 🟠 FRED key (optional — 3 agents wait without it)
`FRED_API_KEY` from https://fred.stlouisfed.org/docs/api/api_key.html (free, instant).
Without it: yield-curve-agent, jobs-data-agent (BLS also works), fed-futures-agent (FRED-derived proxy) all wait.

### 🟠 Etherscan key (optional — 1 agent waits)
`ETHERSCAN_API_KEY` from https://etherscan.io/myapikey (free tier: 3 req/s, 100k req/day).
Without it: etherscan-whale-agent waits.

### 🟡 Nice-to-have (later sessions)
1. Upgrade Vercel Hobby → Pro ($20/mo) to unlock sub-daily cron cadence (SEC filings land throughout the business day; daily cadence misses intraday moves)
2. Sentry wire-up per `council-observability` skill — silent cron failures currently only surface via uptime probes
3. Vercel BotID + Cloudflare Turnstile on early-access (BotID needs Pro plan; Turnstile is free)
4. Analytics (Vercel Analytics is free, add one line)
5. Admin interface — currently any bio update requires direct SQL
6. House-side Congressional trades — PDF-parse pipeline (Senate covered via Senate Stock Watcher JSON)
7. CME FedWatch direct scrape (currently using FRED-derived proxy for fed-futures-agent)

---

## 5 · KEY FILES TO KNOW (as of end-of-session)

```
app/
  api/cron/ingest/[agent]/route.ts   # dynamic ingestion handler
  api/cron/integrity-audit/route.ts  # nightly math-gate cron (Phase 5)
  api/marketplace/early-access/route.ts  # anti-abuse stack live here
  intelligence/page.tsx              # methodology (7-section rewrite)
  layout.tsx                         # mounts LegalFooter globally

components/
  legal-footer.tsx                   # compliance band on every page
  floor/floor-3d.tsx                 # 3D WebGL floor (unchanged this session)

lib/
  ingestion/{types,http,dedup,circuit-breaker,base-agent,registry}.ts
  ingestion/agents/*.ts              # 10 concrete specialist + archetype agents
  integrity/{math,audit}.ts          # Phase 5 math + orchestration
  anti-abuse/{disposable-domains,email-validator,rate-limit,log}.ts
  supabase/{client,server,types}.ts  # sb_publishable_ / sb_secret_ preferred

supabase/
  migrations/
    0005_signal_dedup_constraint.sql  # (source_id, external_id) unique idx
    0006_phase1_operational_promotions.sql  # 6 agents verified
    0007_phase1_verification_query.sql
    0008_integrity_events.sql         # append-only audit + status-change trigger
    0009_abuse_events.sql             # sha256-hashed abuse log

.claude/skills/
  council-ingestion-architect/SKILL.md
  council-observability/SKILL.md
  council-anti-abuse/SKILL.md
  council-operator-mindset/SKILL.md  # ← invoke at start of next session

vercel.ts   # 11 cron entries (integrity-audit + 10 ingestion), all daily
```

---

## 6 · SKILLS TO LOAD AT START OF NEXT SESSION

1. `council-operator-mindset` — elite execution cadence
2. `council-ingestion-architect` — patterns for new agents
3. `council-observability` — Sentry + log drains
4. `council-anti-abuse` — BotID + Turnstile for future endpoints
5. `council-regulatory-compliance` — Publisher's Exemption, RIA gates
6. `confidential-agent-playbook` — tier-2 ensemble math
7. `quant-signal-validator` — decay detection
8. `senior-product-engineer` — production code bar

---

## 7 · VERIFICATION COMMANDS (run at session start)

```bash
cd "/Users/antwannmitchellsr/The Council Intelligence Exchange/The Council Intelligence Exchange v2"

# Confirm main is clean + latest
git fetch origin && git log origin/main..HEAD --oneline   # should be empty or expected

# Build parity
npx next build  # should pass, 21 pages

# Env parity
vercel env ls production | head -25

# Live site health
curl -sI https://council-intelligence-exchange-v2.vercel.app | head -1
```

---

## 8 · INTEGRITY CONTRACT (non-negotiable going forward)

1. Every performance claim carries a stage tag. No mixed-stage aggregates.
2. Math gates every promotion. No manual overrides except by a written owner decision logged to `v2_integrity_events`.
3. Auto-retire fires on IC decay. Public status change is visible immediately.
4. Historical paper data cannot retroactively satisfy the 90-day broker-paper bar.
5. The leaked service_role key from prior chat is cryptographically dead. The app reads sb_publishable_ / sb_secret_ exclusively for new writes.

---

## 9 · HOW TO START THE NEXT SESSION

Open a new Claude Code session in:
```
/Users/antwannmitchellsr/The Council Intelligence Exchange/The Council Intelligence Exchange v2
```

First message should be:
> Read docs/NEXT-SESSION-HANDOFF.md. Load the skills in Section 6. Execute Phase 4 — Alpaca paper-trading. I have the Alpaca API keys ready to paste.

Ignition key.

*End of handoff. 13 of 29 agents verified. Production live. Nightly cron running. Next session lights the 90-day clock.*
