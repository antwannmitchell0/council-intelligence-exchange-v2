# The Council Intelligence Exchange v2 — Operating Manual

> The complete technical and operational manual for The Council Intelligence Exchange v2. A buyer, engineer, or operator should be able to read this document and everything it links to, then run the system end-to-end with no prior knowledge of its construction.

**Document version:** 1.0 (2026-04-24)
**Product status:** Production, Phase 4 complete (Day 0 of broker-paper-tracking clock logged 2026-04-24)
**Owning entity:** Demm LLC
**Founder / operator:** Antwann Mitchell

---

## 0 · How to read this manual

- This is the **spine document**. It summarizes every subsystem and links to the detailed reference doc for each.
- Every detailed reference lives in `docs/`. When you see a `docs/X.md` link, open it — the detail lives there.
- Every code path referenced is an actual file in the repo. File paths are canonical.
- Known unknowns are captured in `docs/KNOWN-LIMITATIONS.md`. Nothing here is hand-waved.

**If you're a prospective acquirer:** read §1, §2, §3, §4 first, then `docs/DUE-DILIGENCE.md`, then `docs/ARCHITECTURE.md`. After that you'll have enough to scope the deal.

**If you're a new engineer:** read §1, §2, §3, then go to `docs/ONBOARDING.md` for the day-1 walkthrough.

**If you're the operator (Antwann or a successor):** §5 (operations) and `docs/ROADMAP.md` are where you spend most of your time.

---

## 1 · Executive summary — what this is

The Council Intelligence Exchange v2 is a publicly auditable intelligence exchange where every performance claim is enforced by code, not marketing.

**The thesis in one paragraph:** Every trading signal, every agent, every performance claim on the site passes through a five-stage integrity contract (`pending → backtest-verified → broker-paper-tracking → live-verified → live-trading`). Promotion between stages is math-gated (IC, Sharpe, t-stat, calendar days) and the decision is logged in an append-only audit table. An observer — a customer, a regulator, an acquirer — can independently verify every number the site shows by running one of ~15 SQL queries documented in this manual.

**What makes it different from every other fintech product:** it refuses to show unverified numbers. The `lib/render-if-verified.ts` gate blanks the UI rather than fills it with fake or stage-contaminated data. Integrity over polish, consistently, in code.

**What the product does TODAY:**
- Ingests 10 live data streams (SEC EDGAR Form 4, Senate disclosures*, FRED, BLS, CME, GDELT, Wikipedia, Etherscan, ClinicalTrials.gov, plus 13F archive)
- Generates trading signals with a canonical stage tag
- Routes qualifying signals to Alpaca paper-trading (broker-attested fills)
- Publishes agent bios, a live feed, a leaderboard, a 3D floor visualization, and a marketplace waitlist
- Runs a nightly integrity-audit cron that promotes or retires agents based on rolling math

*congress-agent is currently disabled pending a replacement upstream — see `docs/NEXT-SESSION-HANDOFF.md` §14.

**What the product does NOT do yet (by design):**
- No user accounts / authentication (Phase D)
- No paid subscriptions (Phase D, Stripe)
- No live trading with real money (Phase F, blocked on RIA registration)
- Most trading-specialist agents are in `pending` stage awaiting broker-paper math

**Why this matters for an acquirer:** the integrity architecture and the 90-day clock are the product's moat. A competitor can copy the UI overnight. They cannot copy a ledger of broker-attested fills. The manual below describes exactly how to operate the moat.

---

## 2 · System at a glance

**Live production URL:** https://council-intelligence-exchange-v2.vercel.app
**GitHub:** https://github.com/antwannmitchell0/council-intelligence-exchange-v2
**Primary stack:** Next.js 16 App Router + Supabase Postgres + Vercel + Alpaca paper-trading

Full architecture diagrams and layer-by-layer walkthrough: **`docs/ARCHITECTURE.md`**

### High-level data flow

```
  External sources (SEC, FRED, BLS, etc.)
          │
          ▼  (cron-triggered ingestion, daily cadence on Hobby)
  lib/ingestion/agents/*.ts
          │
          ▼  (normalize + dedup + insert)
  v2_signals  (Supabase, RLS-protected)
          │
          ▼  (inline in BaseIngestionAgent.run() when signals have symbol+side)
  lib/alpaca/order-router.ts
          │
          ▼  (REST POST /v2/orders with client_order_id = signal.id)
  Alpaca paper account (PA39JANBONYK — Council Exchange)
          │
          ▼  (poll cron reconciles fills OR webhook fires)
  v2_trade_tickets  (append-updated ledger)
          │
          ▼  (nightly cron — 06:00 UTC)
  /api/cron/integrity-audit
          │
          ▼  (rolling IC, Sharpe, t-stat, calendar days)
  v2_signals.stage_tag transitions + v2_integrity_events rows
          │
          ▼  (realtime channel: supabase_realtime)
  Frontend (Next.js App Router) renders ONLY verified content
```

### Component inventory

| Layer | Technology | Owner | Cost/mo |
|---|---|---|---|
| Hosting / edge | Vercel (Hobby plan) | Demm LLC | $0 |
| Database + auth + realtime + storage | Supabase (Free tier) | Demm LLC | $0 |
| Broker (paper, moving to live post-RIA) | Alpaca Markets | Demm LLC (Council Exchange account) | $0 |
| Domain | (pending — operator handles) | Demm LLC | ~$12/yr |
| Source code | GitHub (public repo) | antwannmitchell0 | $0 |
| Monitoring | Vercel Log Drain (free) + Supabase dashboard | Demm LLC | $0 |
| Total operating cost | | | **$0/month** |

Everything is on free tiers. The product ships with zero burn rate. Paid tiers unlock only when traffic or feature needs justify.

**Full hosting + env inventory: `docs/VERCEL-PROJECT-REFERENCE.md`**
**Full database schema + RLS + migrations: `docs/SUPABASE-REFERENCE.md`**
**Full broker integration details: `docs/ALPACA-REFERENCE.md`**

---

## 3 · The integrity contract (the product's moat)

Every agent's performance claim lives in exactly one stage. Never two. Never mixed.

| Stage | Meaning | UI label | Math gate to enter |
|---|---|---|---|
| `pending` | No data; ingestion not yet yielding tradable signals | "In verification" | Default state |
| `backtest-verified` | Passed IC≥0.10 + t-stat>2 + n≥50 on historical paper-traded data | "Backtest-verified · N historical signals" | Manual SQL (Phase 1.5) |
| `broker-paper-tracking` | Signals flowing through Alpaca paper; 90-day clock running | "Broker-paper tracking · Day X of 90" | Auto (first Alpaca paper order submitted) |
| `live-verified` | Passed IC≥0.05 + Sharpe≥1 + t-stat>2 on ≥90 days of broker-attested data | "Live-verified · X days tracked · IC Y" | Auto (nightly cron) |
| `live-trading` | Real customer money — **deferred pending RIA registration** | Never claimed until unblocked | Manual + compliance approval |

The gate constants live in ONE file, imported everywhere: `lib/integrity/math.ts`.

**Full stage taxonomy + math + where each is enforced in code: `docs/STAGE-TAXONOMY.md`**

### Audit trail

Every stage transition, every order outcome, every admin action writes a row to `v2_integrity_events`. This table has NO `UPDATE` or `DELETE` policy — rows are immutable once written. Public anonymous users can `SELECT` the entire history. Transparency is a property of the exchange, not an afterthought.

Typical actors:
- `trigger:alpaca-router` — order submitted or rejected at placement time
- `trigger:alpaca-webhook` — broker fill event
- `cron:alpaca-poll` — reconciliation sweep
- `cron:integrity-audit` — stage promotion or retirement
- `trigger:v2_agents_status_change` — any DB UPDATE to agent status

### What the UI is allowed to claim

| Stage | Site may say | Site must NOT say |
|---|---|---|
| `pending` | "In verification" | Any IC, Sharpe, win-rate, return |
| `backtest-verified` | "Backtest-verified · IC X · n Y · date range Z" with cost caveat | "Verified" unqualified |
| `broker-paper-tracking` | "Broker-paper tracking · Day X of 90" + rolling stats | "Verified" unqualified |
| `live-verified` | "Live-verified · X days tracked · IC Y · Sharpe Z" | Trading advice (blocked on RIA) |
| `live-trading` | (not applicable yet) | Anything at all |

The `lib/render-if-verified.ts` utility is the canonical rendering gate. Callers pass a row + a stage; it returns either the verified value or blank. Bios rendered through this gate have no filler.

---

## 4 · What is true right now (as of 2026-04-24)

| Fact | Value | Source of truth |
|---|---|---|
| Ingestion agents wired | 10 | `lib/ingestion/agents/*.ts` |
| Ingestion agents live + trading | 1 (insider-filing) | `v2_trade_tickets` |
| Paper orders placed total | 83 | `select count(*) from v2_trade_tickets` |
| Orders filled | ≥5 (confirmed sample; full count is a SQL query) | `v2_trade_tickets where order_status='filled'` |
| Agents in `broker-paper-tracking` stage | ~81 signals (1 agent) | `v2_signals where stage_tag='broker-paper-tracking'` |
| Agents in `verified` legacy status | 6 operational (Aether, Cost Sentinel, Cyber-Sentinels, Nexus, Chronos, Telemetry) | `v2_agents where status='verified'` |
| Day 0 of 90-day clock logged | 2026-04-24 | `v2_integrity_events where actor='trigger:alpaca-router' and event_type='order_submitted' order by created_at asc limit 1` |
| Alpaca paper equity | ~$92,686 | Alpaca `/v2/account` |
| Operating cost | $0/month | All services on free tier |
| Revenue | $0/month | No paid subscribers yet — Phase D |

---

## 5 · Operations runbook

The day-to-day of running the system. Every task here has a dedicated detailed runbook linked.

### 5.1 Daily
- Cron runs automatically at 06:00-12:00 UTC — no action required if green
- Check Vercel logs for `cron.ingest.finish` events: `status: "success"` means the agent ran cleanly
- If `cron.ingest.finish` shows `status: "failed"`, the agent's circuit breaker trips at 3 consecutive failures and `v2_agent_heartbeats.status` goes to `degraded`

### 5.2 Weekly
- Pull a snapshot of `v2_trade_tickets` fill rate — should hover around 85% (13 rejections per 100 orders is normal)
- Check `v2_integrity_events` for `circuit_open` or `math_gate_fail` rows — indicates an agent needs attention

### 5.3 Monthly
- Audit the integrity log for unexpected `manual:*` actor entries (indicates someone did a manual SQL change)
- Confirm Supabase JWT still valid; if approaching a year old, rotate (see `docs/SECRETS-ROTATION-PLAYBOOK.md`)
- Review Alpaca paper account equity; if it drifts outside $80k-$120k range, investigate sizing or check for stuck orders

### 5.4 As-needed — full runbooks

| Task | Runbook |
|---|---|
| Rotate a secret (Alpaca, Supabase, CRON) | `docs/SECRETS-ROTATION-PLAYBOOK.md` |
| Add a new ingestion agent | `docs/ONBOARDING.md` §3 |
| Apply a database migration | `docs/SUPABASE-REFERENCE.md` §"Running a migration" |
| Manually trigger a cron | `docs/VERCEL-PROJECT-REFERENCE.md` §"Manually triggering a cron" |
| Investigate a failed cron | `docs/VERCEL-PROJECT-REFERENCE.md` §"Logs + observability" |
| Deploy a code change | `docs/VERCEL-PROJECT-REFERENCE.md` §"Deployments" |
| Hire an employee + grant access | `docs/ROLE-MODEL.md` §"Onboarding a new employee" (currently design-only, ships with Phase D) |
| Handle a security incident | `docs/SECURITY.md` §"Incident response" |
| Respond to a legal subpoena or DMCA | `docs/LEGAL/TERMS-OF-SERVICE.md` §"Legal process" |

---

## 6 · Access model (current + planned)

### 6.1 Today (Phase 4)
- Single operator (Antwann Mitchell) holds all credentials
- No user accounts on the product itself
- Public readers see verified-only content (enforced by Supabase RLS on anon role)
- Backend writes run as service_role (sb_secret_) via `lib/supabase/server.ts`

### 6.2 After Phase D (employee hires + paid subscribers)

Roles, table access matrix, auth provider choice, and RBAC implementation are fully designed in: **`docs/ROLE-MODEL.md`**

Short version: Clerk for identity, Supabase RLS gated by role claim, `/admin/*` routes for employees, `/app/*` routes for subscribers. No employee ever touches the Supabase dashboard — they operate via the admin app with a role-scoped token.

### 6.3 Sensitive data architecture

Payment data, secrets, and authentication credentials are **not** in the main Supabase project by design:

| Data type | Storage | Why not Supabase |
|---|---|---|
| Credit cards | Stripe (PCI vault) | Never store PAN, PCI compliance outsourced |
| Secrets (API keys) | Vercel env | Encrypted at rest, access-controlled by Vercel team |
| Auth credentials | Clerk (post-Phase D) OR Supabase's `auth.*` schema | Isolated from app-level queries |
| Agent bios + signals + orders + audit | **Supabase** (with RLS) | Operational data — right tool for the job |
| Financial books (revenue, taxes) | QuickBooks (post-Phase D) | Accounting-native, better audit tools |

---

## 7 · Legal + compliance posture

### 7.1 Regulatory frame
The Council operates under a **publisher's exemption** analysis (Investment Advisers Act of 1940, §202(a)(11)(D) — bona fide publishers, not investment advisers). Live-trading customer money would shift this analysis to RIA-registered advisor territory. That flip is Phase F and blocked on RIA registration.

See `council-regulatory-compliance` skill in `~/.claude/skills/` for the full legal analysis.

### 7.2 Documents
- `docs/LEGAL/TERMS-OF-SERVICE.md` — template, pending counsel review before public posting
- `docs/LEGAL/PRIVACY-POLICY.md` — template, pending counsel review
- `docs/LEGAL/DATA-PROCESSING-AGREEMENT.md` — template for B2B customers

### 7.3 Data licensing
Every upstream data source has a documented licensing posture:
- SEC EDGAR: public US-government data, unrestricted commercial use
- FRED: public, free attribution
- BLS: public, free
- GDELT: CC BY 4.0
- Wikipedia: CC BY-SA
- Senate Stock Watcher: was community API, now dead — re-source needed
- Etherscan: free tier permits commercial use with attribution
- ClinicalTrials.gov: public US-government data

See `alt-data-licensing` skill in `~/.claude/skills/` for the per-source CFAA/ToS analysis.

---

## 8 · Due diligence (investor / acquirer packet)

**`docs/DUE-DILIGENCE.md`** — every question from the standard investor security checklist answered in one of four states:
- ✅ Done (with file path evidence)
- 🟡 Shipping (with PR #)
- 🔵 Scheduled (with specific phase)
- ⚪ Not applicable (with honest explanation)

Nothing is skipped. Nothing is "we'll add that." Everything has a home.

---

## 9 · Roadmap

**`docs/ROADMAP.md`** is the master punch list. Every piece of known work lives there, phased A-F with target sessions.

Phases at a glance:
- **A** — Ingestion coverage (wire the remaining 9 agents)
- **B** — Automation hardening (monitoring, backfills, anti-abuse)
- **C** — Site + UX polish (methodology, legal footer, analytics)
- **D** — Revenue plumbing (Clerk auth, Stripe, admin dashboard, RBAC live)
- **E** — The 90-day wait (physics — cannot compress)
- **F** — Live trading flip (blocked on RIA)

---

## 10 · Known limitations

Honest tech debt + known gaps: **`docs/KNOWN-LIMITATIONS.md`**

Top items as of this document:
- `congress-agent` upstream dead; needs replacement
- Only 1 of 10 ingestion agents actually trading; the other 9 wired but not resolving tradable symbols yet
- EDGAR default pagination caps at 100 Form 4 hits per cron (fix scheduled)
- Per-order sizing at 1% ($925) caps daily orders at ~83 before buying power exhausts (fix scheduled)
- No user authentication — entire access story is "public site" (correct for current stage, becomes a gap at Phase D)
- No production-grade monitoring/alerting (Vercel logs only — scheduled)
- 6 operational agents marked `verified` predate the strict stage contract — acceptable legacy but should be re-audited next session

---

## 11 · Onboarding

**`docs/ONBOARDING.md`** — day-1 walkthrough for a new engineer. From cloning the repo to running a cron locally to shipping a first PR.

---

## 12 · Commercial posture (for acquirers)

### 12.1 What you would be buying
- The source code (MIT/proprietary license at your election)
- The `council-intelligence-exchange-v2` GitHub repo + history
- The Vercel project + domain (whichever is provisioned by closing date)
- The Supabase project with all data + migrations + RLS
- Six Claude Agent Skills stored in `~/.claude/skills/` — `confidential-agent-playbook`, `quant-signal-validator`, `council-regulatory-compliance`, `alt-data-licensing`, `council-design-language`, `council-anti-abuse` (proprietary integrity frameworks)
- The brand + 24-agent catalog with bios
- Audit trail of Day 0 onward (the 90-day clock's first entries)

### 12.2 What you would NOT be buying (must replace)
- Alpaca paper account `PA39JANBONYK` — create a new one under buyer's entity
- Third-party API keys (SEC_USER_AGENT — set your own contact; FRED, BLS, Etherscan — register free keys)
- Claude Code session history / Anthropic API credits — buyer provisions their own

### 12.3 Post-close operator checklist
A 30-minute run-through at close to hand over operations cleanly:

1. Transfer Vercel project ownership to buyer's team
2. Transfer Supabase project ownership (or export + re-import under buyer's Supabase account)
3. Transfer GitHub repo to buyer's org
4. Buyer sets up new Alpaca paper account + rotates all `ALPACA_*` env vars
5. Buyer rotates Supabase JWT + updates Vercel env
6. Buyer registers own `SEC_USER_AGENT` string
7. Update `docs/VERCEL-PROJECT-REFERENCE.md` with new ownership + contact info
8. Final smoke test: fire `/api/cron/ingest/insider-filing-agent` with new credentials; confirm `v2_trade_tickets` receives a new row

Documented in detail: `docs/HANDOVER-CHECKLIST.md` (to be written in Phase C closeout).

### 12.4 Why buy now (before 90-day clock matures)

The infrastructure is done. The moat is the infrastructure, not the specific 81 orders on the clock today. A buyer gets:
- A complete, live, production-deployed integrity-first trading-intelligence platform at $0/mo operating cost
- 13 Supabase migrations, 15 reference docs, 10 wired ingestion pipelines, full broker integration
- Proprietary "skills" that encode the integrity thesis — legally defensible IP
- First-mover position in the "math-gated intelligence publisher" category
- ~120 days of total build time compressed into a zero-dependency handover

The 90-day wait is elapsed-time only. A buyer inheriting the Day 0 clock starts Day-1 as the new operator and the clock keeps ticking — they don't restart.

---

## 13 · Full file-by-file index (for the paranoid engineer)

### `app/` — Next.js App Router routes
| Path | Purpose |
|---|---|
| `app/page.tsx` | Landing page (Hero / Problem / How It Works / Signal Sources / Leaderboard / Live Feed / Footer) |
| `app/floor/page.tsx` | 3D WebGL trading floor (three.js) |
| `app/agents/page.tsx` | 24-agent catalog |
| `app/agents/[id]/page.tsx` | 24 SSG detail pages with bios |
| `app/exchange/page.tsx` | Leaderboard |
| `app/marketplace/page.tsx` | Marketplace + request-access form |
| `app/intelligence/page.tsx` | Methodology (v1 — upgrade scheduled Phase C) |
| `app/hive/page.tsx`, `app/trading/page.tsx` | Honest ComingSoon placeholders |
| `app/api/marketplace/early-access/route.ts` | POST handler for waitlist signup |
| `app/api/cron/ingest/[agent]/route.ts` | Ingestion cron entrypoint (bearer-authed) |
| `app/api/cron/integrity-audit/route.ts` | Nightly audit cron |
| `app/api/cron/alpaca-poll/route.ts` | Fill reconciliation cron |
| `app/api/alpaca/webhook/route.ts` | Broker event receiver |

### `lib/` — Shared code
| Path | Purpose |
|---|---|
| `lib/supabase/server.ts`, `client.ts`, `types.ts` | Supabase client factories + typed schema |
| `lib/ingestion/base-agent.ts` | Canonical ingestion lifecycle (every agent extends) |
| `lib/ingestion/http.ts` | `fetchWithRetry` + `RateLimiter` + `politeUserAgent` |
| `lib/ingestion/dedup.ts` | `buildExternalId` + in-memory dedup |
| `lib/ingestion/circuit-breaker.ts` | Per-agent in-memory breaker, DB-mirrored |
| `lib/ingestion/registry.ts` | Agent registry (maps id → factory) |
| `lib/ingestion/types.ts` | Shared ingestion types |
| `lib/ingestion/sec-cik-ticker.ts` | SEC CIK → ticker resolver (new 2026-04-24) |
| `lib/ingestion/agents/*.ts` | 10 concrete agents |
| `lib/alpaca/client.ts` | Paper-only REST wrapper |
| `lib/alpaca/order-router.ts` | Signal → paper order translator |
| `lib/alpaca/pdt-guard.ts` | FINRA 4210 guard |
| `lib/alpaca/position-sizing.ts` | 1% NAV, $5k cap |
| `lib/integrity/math.ts` | Pure math — IC, t-stat, Sharpe, gate constants |
| `lib/integrity/audit.ts` | Nightly audit logic |
| `lib/anti-abuse/*.ts` | Rate limiting, bot detection, honeypot, IP hashing |
| `lib/render-if-verified.ts` | UI gate — blanks unverified content |
| `lib/cache/tags.ts`, `lib/nav.ts` | Misc utilities |

### `supabase/` — Database
| Path | Purpose |
|---|---|
| `supabase/migrations/0001_init.sql` | Base schema (v2_agents, v2_signals, etc.) |
| `supabase/migrations/0002_sources.sql` | `v2_sources` registry |
| `supabase/migrations/0003_marketplace.sql` | Early-access + RPC |
| `supabase/migrations/0004_hive_events.sql` | Hive stream |
| `supabase/migrations/0005_signal_dedup_constraint.sql` | `source_id`, `external_id` columns (partial index, superseded) |
| `supabase/migrations/0006_phase1_operational_promotions.sql` | 6 operational agents → verified |
| `supabase/migrations/0007_phase1_verification_query.sql` | Helper queries |
| `supabase/migrations/0008_integrity_events.sql` | Append-only audit log |
| `supabase/migrations/0009_abuse_events.sql` | Anti-abuse log |
| `supabase/migrations/0010_phase4_alpaca.sql` | `v2_trade_tickets` + `stage_tag` |
| `supabase/migrations/0011_fix_dedup_constraint.sql` | Partial→full unique index |
| `supabase/migrations/0012_dedup_unique_constraint.sql` | Unique index → named constraint (PostgREST) |
| `supabase/migrations/0013_seed_ingestion_sources.sql` | Agent + source seeding |
| `supabase/seed/0001_telemetry.sql` | Telemetry agent + source |
| `supabase/seed/0002_sources.sql` | Telemetry sources |
| `supabase/seed/0003_elite_archetypes.sql` | 7 archetype agents |
| `supabase/seed/0004_backtested_specialists.sql` | 8 specialist agents (legacy naming) |

### `docs/` — This manual + all references
All documents cross-linked from this file.

### `design/tokens.ts`
Design system tokens (palette, motion, typography) — feeds the UI layer.

### `vercel.ts`
Vercel project config: headers, caching, cron schedules.

### `.env.example`
Complete env var inventory (names only — values live in Vercel prod env).

---

## 14 · Document index

| Doc | Purpose |
|---|---|
| **This doc** — `docs/OPERATING-MANUAL.md` | Spine — start here |
| `docs/NEXT-SESSION-HANDOFF.md` | Current status + what's left + session ignition |
| `docs/DUE-DILIGENCE.md` | Investor Q&A |
| `docs/ARCHITECTURE.md` | System diagrams + layer walkthrough |
| `docs/ROLE-MODEL.md` | RBAC design + table sensitivity matrix |
| `docs/SECURITY.md` | Public security posture |
| `docs/KNOWN-LIMITATIONS.md` | Tech debt + gaps |
| `docs/ONBOARDING.md` | New-engineer day-1 walkthrough |
| `docs/ROADMAP.md` | Master punch list by phase |
| `docs/ALPACA-REFERENCE.md` | Broker integration details |
| `docs/SUPABASE-REFERENCE.md` | Database details |
| `docs/VERCEL-PROJECT-REFERENCE.md` | Hosting + env + cron |
| `docs/STAGE-TAXONOMY.md` | Stage contract + math gates |
| `docs/SECRETS-ROTATION-PLAYBOOK.md` | Key rotation runbook |
| `docs/LEGAL/PRIVACY-POLICY.md` | Privacy policy template |
| `docs/LEGAL/TERMS-OF-SERVICE.md` | ToS template |
| `docs/LEGAL/DATA-PROCESSING-AGREEMENT.md` | DPA template |
| `docs/FLOOR-V2-SPEC.md` | 3D floor design spec |
| `docs/PAGE-PLANS.md` | Per-page design notes |
| `docs/PHASE-3-HANDOFF.md` | Phase 3 historical handoff |
| `docs/PHASE1-AUDIT.md` | Phase 1 verification |

---

## 15 · Contacts

- **Owner / operator:** Antwann Mitchell, Demm LLC
- **Technical contact:** antwannmitchell0@gmail.com
- **Support:** (configure `support@<domain>` — documented in `docs/VERCEL-PROJECT-REFERENCE.md` once domain is live)
- **Legal / notices:** (via owner email until counsel of record is appointed)
- **Security incidents / responsible disclosure:** See `docs/SECURITY.md`

---

*This document is authoritative. If another doc contradicts it, this document wins and the other doc gets fixed.*

*Version history: 1.0 — 2026-04-24 — initial release, post Phase 4 completion.*
