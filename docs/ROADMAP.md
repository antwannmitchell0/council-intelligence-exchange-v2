# Roadmap — The Council Intelligence Exchange v2

> Master punch list. Every known piece of work lives here with a target phase. Nothing is dropped; nothing is hand-waved.

**Document version:** 1.0 (2026-04-24)

---

## Phase map

| Phase | Theme | Status |
|---|---|---|
| **Phase 0** | Foundation (site, 24-agent catalog, integrity rule) | ✅ Complete |
| **Phase 1** | Operational agent promotions | ✅ Complete (6 agents verified) |
| **Phase 1.5** | Backtest-verified tier | ⏳ Pending (needs v1 IC computation) |
| **Phase 2** | Ingestion framework | ✅ Complete |
| **Phase 3** | Trading specialist pipelines | 🟡 1 of 10 wired |
| **Phase 4** | Alpaca paper-trading | ✅ Complete (Day 0 landed 2026-04-24) |
| **Phase 5** | Promotion automation | 🟡 Code exists, needs live validation |
| **Phase 6a** | Archetype agents | 🟡 Partially wired |
| **Phase A** | Ingestion coverage completion | ⏳ Next 2-3 sessions |
| **Phase B** | Automation hardening | ⏳ Scheduled |
| **Phase C** | Site + UX + legal polish | ⏳ Scheduled |
| **Phase D** | Revenue plumbing (auth + RBAC + Stripe) | ⏳ When ready to hire / charge |
| **Phase E** | 90-day clock matures | ⏳ Physics — 60-90 calendar days from Day 0 |
| **Phase F** | Live trading flip | ⏳ Blocked on RIA registration |

---

## Phase A — Ingestion coverage (next 2-3 sessions)

**Goal:** every wired agent emits tradable signals + starts a broker-paper clock.

### Done

- **A5** — Macro env keys wired (FRED_API_KEY + BLS_API_KEY in Vercel prod). yield-curve-agent / fed-futures-agent / jobs-data-agent all returned 200 + ingested > 0 on first manual trigger (300 / 100 / 30 signals). Shipped 2026-04-24, Session 2.
- **A3** — Congress-agent upstream swapped from the dead senatestockwatcher.com community mirror to the official Senate eFDSearch system (CSRF + cookie-jar + DataTables JSON + per-PTR HTML parse). Cron re-enabled at 07:30 UTC. First trigger ingested 1 PTR transaction (Banks / SBUX, 04/15/2026). Shipped 2026-04-24, Session 2.

| # | Item | Effort | Blocker | Target |
|---|---|---|---|---|
| A1 | ADR fallback resolver (`company_tickers_exchange.json`) | 15 min | — | Tonight |
| A2 | EDGAR pagination (+ lower per-order sizing 1% → 0.25%) | 30 min | — | Tonight |
| A4 | Thirteen-f-agent CUSIP→ticker (OpenFIGI API) | 2-3 hr | OpenFIGI free-tier signup | Session 2-3 |
| A6 | GDELT entity → ticker mapping | 2 hr | Research for canonical mapping | Session 3 |
| A7 | Wiki-edit-surge entity → ticker mapping | 2 hr | Same | Session 3 |
| A8 | Etherscan-whale crypto routing via Alpaca Crypto API | 1-2 hr | — | Session 3 |
| A9 | Clinical-trial-outcomes sponsor → ticker | 1-2 hr | Mapping source choice | Session 3 |
| A10 | Phase 1.5 backtest-verified IC computation on v1 data | 1 hr | v1 `intelligence_signals` access | Session 2 |

---

## Phase B — Automation hardening

**Goal:** system operates unattended with confidence.

| # | Item | Effort | Target |
|---|---|---|---|
| B1 | `/api/health` endpoint + external uptime monitor | 30 min | Tonight |
| B2 | Slack webhook on cron failures | 30 min | Session 2 |
| B3 | Sentry SDK + error tracking | 1 hr | Session 2-3 |
| B4 | Backfill endpoint (`POST /api/admin/backfill`) | 2 hr | Session 3 |
| B5 | Staging Supabase project | 2 hr | Session 3 |
| B6 | Automated test suite (Vitest unit + Playwright e2e starter) | 4-6 hr | Session 3-4 |
| B7 | Anti-abuse enforcement on all public endpoints | 1 hr | Session 4 |
| B8 | `v2_directional_signals` wiring | 1 hr | Session 4 |
| B9 | Supabase types auto-generation in CI | 30 min | Session 3 |
| B10 | Sign Supabase + Vercel + Alpaca DPAs | 30 min (mostly ops) | Session 4 |
| B11 | Quarterly DR test runbook + first exercise | 1 hr | Session 4 |
| B12 | Anti-abuse: extend `v2_abuse_events` logic, Turnstile, disposable-email blocklist | 2 hr | Session 4 |
| B13 | Resend integration for waitlist notification emails | 30 min | Session 2 |

---

## Phase C — Site + UX + legal polish

**Goal:** buyer-ready site quality.

| # | Item | Effort | Target |
|---|---|---|---|
| C1 | Legal footer on every page + `/legal/*` routes | 45 min | Tonight |
| C2 | Vercel Analytics wire-up | 5 min | Tonight |
| C3 | Methodology page (`/intelligence`) v2 upgrade | 2 hr | Session 5 |
| C4 | Counsel review of Privacy Policy + Terms of Service | (lawyer) | Operator action |
| C5 | Lighthouse audit (perf + SEO + a11y) on all surfaces | 2 hr | Session 5 |
| C6 | WCAG 2.1 AA contrast audit | 1 hr | Session 5 |
| C7 | Fix 6 pre-contract `verified` agents: re-label or re-audit | 1 hr | Session 5 |
| C8 | `docs/HANDOVER-CHECKLIST.md` (detailed close-day runbook) | 1 hr | Session 5 |
| C9 | `v2_signals.body` → typed jsonb with GIN index | 2 hr | Session 6 |
| C10 | Refactor `lib/ingestion/registry.ts` auto-discovery | 30 min | Session 6 |

---

## Phase D — Revenue plumbing (when ready to hire / charge)

**Goal:** flip from pre-revenue public exchange to subscription business.

| # | Item | Effort | Target |
|---|---|---|---|
| D1 | Clerk install + identity flow | 2 hr | Phase D kickoff |
| D2 | `/admin/*` routes with middleware role guards | 3 hr | Phase D |
| D3 | `/app/*` subscriber routes | 3 hr | Phase D |
| D4 | Supabase RLS policies for each role (per `docs/ROLE-MODEL.md`) | 3 hr | Phase D |
| D5 | Employee invite + onboarding flow | 2 hr | Phase D |
| D6 | Admin dashboard (agents + users + audit + billing views) | 6-8 hr | Phase D |
| D7 | Stripe installation via Vercel marketplace integration | 2 hr | Phase D |
| D8 | Subscription tier design + pricing | 2 hr (+ product decision) | Phase D |
| D9 | Signup flow with ToS + PP acceptance | 1 hr | Phase D |
| D10 | Data Subject Request workflow (GDPR access/deletion) | 2 hr | Phase D |
| D11 | Customer portal (managed by Stripe) | 30 min | Phase D |
| D12 | `v2_subscribers`, `v2_user_actions`, `v2_staff_data_access`, `v2_financial_records` tables | 1 hr | Phase D |
| D13 | Support contact flow + in-app feedback | 1 hr | Phase D |
| D14 | Organization multi-tenancy (for B2B) | 3 hr | Phase D v2 |
| D15 | Customer API v1 + rate limiting | 3 hr | Phase D v2 |
| D16 | Mobile-responsive admin dashboard | 2 hr | Phase D polish |

**Pre-launch must:**
- D9-D10 must ship before first paid subscriber
- D1-D8 must ship before first paid subscriber
- D14-D16 can ship after

---

## Phase E — The 90-day wait (parallel to everything else)

**Goal:** accumulate enough broker-paper data that agents can earn `live-verified`.

- Physics. Cannot compress.
- Day 0 = 2026-04-24. Earliest possible live-verified: 2026-07-23 (90 calendar days).
- Actual `live-verified` promotions depend on each agent's math gate (IC ≥ 0.05, Sharpe ≥ 1, t-stat > 2) — some will pass, some won't, some will retire.
- Nothing to do here except let the crons run. Phases A-D compress around it.

---

## Phase F — Live trading flip (blocked on RIA)

**Goal:** accept real customer money with the full live-verified intelligence behind it.

| # | Item | Effort | Blocker |
|---|---|---|---|
| F1 | RIA registration (Form ADV, compliance review, state filings) | 60-90 days | External (counsel + regulators) |
| F2 | Swap `ALPACA_BASE_URL` to live | 5 min | F1 |
| F3 | Remove paper-URL assertion in `lib/alpaca/client.ts` | 5 min | F1 |
| F4 | Add Kelly position sizing (replace fixed 1%) | 2 hr | 30+ fills per agent for edge estimation |
| F5 | Customer trade-mirroring infrastructure (if that's the business model) | TBD | Product decision |
| F6 | Legal + compliance docs updated to reflect RIA status | 2 hr | F1 |
| F7 | SOC 2 Type II engagement | 6-12 months | $500k ARR threshold |

---

## Known items with no phase yet

These are tracked but awaiting a product decision:

- Mobile app (iOS/Android) — Phase post-revenue, needs PMF data
- Customer API for programmatic access — Phase D v2 or v3
- International expansion (GDPR-scale compliance) — Phase after first EU customer
- Multi-currency support — Phase after first non-USD-base customer
- Internal admin audit log separation (separate DB for audit events) — Phase E or later, compliance-driven
- Own SOC 2 Type II certification — Phase F (revenue-gated)
- HackerOne bug bounty — Phase post-revenue

---

## Ownership

All items default to operator (Antwann Mitchell, Demm LLC) until delegated. When roles exist (Phase D), items get reassigned per the role's responsibility area.

---

## Updating this roadmap

- When an item ships: move to "Done" section at top of its phase with PR link + date
- When a new gap is discovered: add to the appropriate phase with effort estimate
- When a phase completes: update `docs/NEXT-SESSION-HANDOFF.md` §14 to match
- Never remove items without archiving to `docs/roadmap-archive/` — history matters

---

*Cross-references: `docs/OPERATING-MANUAL.md` §9 • `docs/KNOWN-LIMITATIONS.md` • `docs/NEXT-SESSION-HANDOFF.md` §14*
