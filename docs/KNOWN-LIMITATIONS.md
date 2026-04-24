# Known Limitations — The Council Intelligence Exchange v2

> The honest tech-debt and scope-gap inventory. Everything here is tracked in `docs/ROADMAP.md` with a target phase. Nothing is ignored; nothing is hidden.

**Document version:** 1.0 (2026-04-24)

---

## 🔴 Product gaps (user-visible)

### Only 1 of 10 ingestion agents currently trading
- **What:** insider-filing-agent is live and has placed 83 paper orders. The other 9 (`thirteen-f`, `congress`, `yield-curve`, `jobs-data`, `fed-futures`, `gdelt-event-volume`, `wiki-edit-surge`, `etherscan-whale`, `clinical-trial-outcomes`) are wired but don't resolve tradable symbols yet.
- **Why:** each has a unique symbol-extraction problem. insider-filing solved its CIK→ticker lookup first; the rest need similar work.
- **Target:** Phase A sessions 2-3.
- **Roadmap:** `docs/ROADMAP.md` §Phase A.

### congress-agent upstream permanently dead
- **What:** `senatestockwatcher.com` domain no longer resolves as of 2026-04-24. The community-run JSON mirror we depended on is gone.
- **Why:** community project sunset.
- **Impact:** congress-agent cron is disabled in `vercel.ts`. No senator stock disclosure signals until we wire a replacement.
- **Mitigation options:**
  1. Build a direct scraper against `efdsearch.senate.gov` (CAPTCHA-gated, fragile)
  2. Find a maintained data-mirror on GitHub (`senate-stock-watcher-data` repo may still publish)
  3. Switch to Quiver Quant paid API (~$10-20/mo per user)
  4. Shift focus to `disclosures-clerk.house.gov` (House, PDF-based, needs PDF extraction pipeline)
- **Target:** Phase A, decision required.

### EDGAR search-index caps at 100 hits per call
- **What:** EDGAR returns max 100 Form 4 filings per search-index query regardless of date range. We don't paginate, so we miss filings when >100/day happen.
- **Impact:** Caps insider-filing-agent at ~100 signals/run. Typical Form 4 volume is 150-300/day during earnings season.
- **Fix:** Add pagination loop (from=0, from=100, from=200, ...) until `hits.total.value` is exhausted.
- **Blocker:** need to lower per-order sizing from 1% ($925) to 0.25% ($232) simultaneously; otherwise we'd blow the $77k buying power.
- **Target:** Phase A next session.

### Per-order sizing too large for high-volume days
- **What:** 1% of NAV per order × ~80 orders/day = 80% of buying power exhausted daily.
- **Impact:** Later orders in a batch get rejected with "insufficient buying power".
- **Fix:** Drop to 0.25% NAV (~$232/order) allowing ~300 orders/day.
- **Target:** Phase A next session (paired with EDGAR pagination).

### 6 agents in `verified` status predate the strict stage contract
- **What:** Aether, Cost Sentinel, Cyber-Sentinels, Nexus, Chronos, Telemetry were promoted to `verified` via migration 0006 before the 5-stage taxonomy was formalized.
- **Impact:** These 6 show "verified" on the site without being `live-verified` per the current contract.
- **Acceptable:** they're operational agents (site uptime, cost monitoring, etc.), not trading agents, so the stage taxonomy doesn't perfectly apply. But the labeling is inconsistent.
- **Fix:** rename the status or introduce a separate operational-tier badge.
- **Target:** Phase C (UX polish).

### 13F agent fundamentally underdesigned
- **What:** `thirteen-f-agent` is in the code but needs a CUSIP→ticker resolver (not CIK→ticker like insider-filing) because 13F filings list holdings by CUSIP. SEC doesn't provide a free CUSIP mapping.
- **Options:** OpenFIGI API (25 req/min free), or commercial CUSIP subscription (~$thousands/mo).
- **Target:** Phase A session 3.

### etherscan-whale-agent not yet using Alpaca crypto
- **What:** Agent ingests on-chain whale transactions but Alpaca crypto is a separate API path we haven't integrated.
- **Fix:** Add crypto-order variant to `lib/alpaca/order-router.ts`.
- **Target:** Phase A.

---

## 🟠 Operational / observability gaps

### No production-grade monitoring
- **What:** Vercel log drains are free and grep-friendly, but there's no active alerting. A silently-failing cron could go unnoticed for days.
- **Fix:** Slack webhook in every catch-block; later, Sentry for stack traces.
- **Target:** Phase B.

### No uptime monitoring
- **What:** If the site goes down, no one is notified.
- **Fix:** Add `/api/health` endpoint returning JSON with DB + broker + source connectivity checks; point UptimeRobot (free) or Better Uptime at it.
- **Target:** Phase B next session.

### No backfill endpoint for missed ingestion
- **What:** If a cron fails for 3 consecutive days, we lose 3 days of signals. No way to re-run over an arbitrary date range.
- **Fix:** `POST /api/admin/backfill` endpoint accepting `{agent, startDate, endDate}`.
- **Target:** Phase B.

### No Slack / email alerts on cron failures
- **Target:** Phase B.

### No staging environment
- **What:** Code ships directly from `main` to production. Preview deploys exist but they hit the same Supabase, which is risky for migrations.
- **Fix:** Create a separate Supabase project for staging; update env var precedence.
- **Target:** Phase B/C.

### No quarterly DR test
- **Fix:** Runbook in `docs/SECURITY.md` §6.3 covers the procedure; needs to be exercised on schedule.
- **Target:** Phase B.

---

## 🟡 Legal / compliance gaps

### Privacy Policy + Terms of Service are templates, not counsel-reviewed
- **Fix:** Engage counsel before Phase D goes public.
- **Target:** Phase D.

### No Data Processing Agreement signed with any vendor
- **What:** Supabase, Vercel, Alpaca all have standard DPAs available. We haven't executed them.
- **Fix:** Request + countersign each vendor's DPA.
- **Target:** Phase B.

### Publisher's exemption is an analysis, not a filing
- **What:** The Council operates under the publisher's exemption to the Investment Advisers Act. This is a legal analysis (`council-regulatory-compliance` skill), not a registered exemption. A regulator disagreeing could force an enforcement action.
- **Mitigation:** Full legal framework encoded in the skill; reasonable-faith compliance posture documented.
- **Target:** Legal review before Phase D go-live; RIA registration before Phase F.

### No formal SOC 2
- **What:** Rely on vendors' SOC 2 Type II. Our own SOC 2 is a 6-12 month audit process costing ~$30-60k.
- **Fix:** Engage SOC 2 auditor at $500k ARR.
- **Target:** Phase E/F revenue threshold.

### No bug bounty program
- **Fix:** Responsible-disclosure policy in `docs/SECURITY.md` §5 is the minimal version. Formal bounty via HackerOne when customer count justifies.
- **Target:** Post-revenue.

---

## 🔵 Architectural debt

### `v2_signals` body column is opaque JSON
- **What:** Each agent's signal payload is stored as a JSON string in `v2_signals.body`. Querying specific fields requires JSONB casting.
- **Fix:** Migrate to structured typed columns per agent, OR switch to `jsonb` type with GIN index.
- **Target:** Phase C.

### Agent registry is hand-maintained
- **What:** `lib/ingestion/registry.ts` is a switch statement that maps agent ID to constructor. Adding an agent requires editing this file.
- **Fix:** Auto-discover via filename convention OR decorator pattern.
- **Target:** Phase B (minor nice-to-have).

### `v2_agents` has 37 rows but only 10 are wired
- **What:** The seeded agent catalog includes archetypes and specialists beyond what the ingestion framework supports today. Extra rows are honest "pending" placeholders.
- **Fix:** Either wire them all OR retire them honestly (integrity rule).
- **Target:** Phase A + Phase C.

### No automated tests
- **What:** No unit tests, no integration tests, no CI test suite.
- **Fix:** Vitest for unit tests, Playwright for e2e. Start with ingestion pipeline + order router.
- **Target:** Phase B.

### Supabase types manually maintained
- **What:** `lib/supabase/types.ts` is a hand-written mirror of the schema. Drifts from reality after each migration.
- **Fix:** Run `supabase gen types typescript` in CI; fail on drift.
- **Target:** Phase B.

### No admin SQL dashboard
- **What:** Operator (Antwann) opens Supabase SQL editor directly for queries. No in-product interface.
- **Fix:** `/admin/sql` page with saved queries + role gates. Better: an "Audit" view that surfaces common queries without raw SQL.
- **Target:** Phase D.

---

## ⚪ Deferred by design (not a limitation, just chronology)

### No live trading
- **Why:** Blocked on RIA registration per `docs/OPERATING-MANUAL.md` §7.1.
- **Target:** Phase F.

### No paid subscriptions
- **Why:** Stripe integration is Phase D.

### No user accounts
- **Why:** Phase D. The public product is intentionally public.

### No mobile app
- **Why:** Product-market fit first. Mobile is a Phase post-revenue conversation.

### No API for customers
- **Why:** Phase D decision (is the product the site, the API, or both?).

---

## 📊 Summary by phase

| Phase | Limitations addressed |
|---|---|
| **A** (next 2-3 sessions) | 9 ingestion agents wired; EDGAR pagination; sizing fix; ADR resolver; congress source replacement |
| **B** | Monitoring/alerting; backfill endpoint; staging env; anti-abuse on all endpoints; DPAs signed; vendor SOC 2 reliance docs; Supabase types auto-gen |
| **C** | Methodology polish; legal review of ToS/PP; Lighthouse + AAA audit; stage taxonomy consistency across legacy verified agents |
| **D** | Auth + RBAC + Stripe + admin dashboard + privacy/DPA workflows + customer API |
| **E** | 90-day clock matures; first `live-verified` agents; SOC 2 scoping |
| **F** | RIA registration; live trading flip; SOC 2 Type II certification |

---

*Everything listed here has a home in `docs/ROADMAP.md`. If you find something that should be on this list but isn't, flag it — the list grows, nothing disappears.*
