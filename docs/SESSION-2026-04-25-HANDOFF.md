# Session handoff — 2026-04-25 (Day 1 of 90)

This is the resume-here doc for the operator after the 2026-04-24 → 2026-04-25 build sessions. Read this first before doing anything else.

## ⏰ Time-sensitive context

- **Day 1 of the 90-day broker-paper verification window.** Day 0 was 2026-04-24.
- **Earliest live-verified eligibility:** 2026-07-23.
- **Today is Saturday** — SEC EDGAR, FRED, BLS, Senate eFD don't publish on weekends. Quiet day for the agents is normal.

## 🟢 Production state

- **URL:** https://council-intelligence-exchange-v2.vercel.app
- **Admin:** `/admin` — password `9InKq1HdxqwF0pY2`
- **GitHub:** https://github.com/antwannmitchell0/council-intelligence-exchange-v2
- **Vercel:** https://vercel.com/antwanns-projects/council-intelligence-exchange-v2

### Watching the system

- **UptimeRobot:** monitor #802919772 polls `/api/health` every 5 min, alerts via email + SMS + voice on 503
- **Discord webhook:** `Council's server > #general` — Council Cron bot posts on cron failures
- **Sentry:** https://demm.sentry.io/issues/?project=4511278262386688 — uncaught exceptions with stack traces

## 📦 What shipped tonight (Day 0 → Day 1)

### Merged to `main`

- **PR #11–14** — Phase A (FRED/BLS/eFDSearch/OpenFIGI), cron path fix, baseline docs
- **PR #15** — health hardening + admin command center + 13F diff agent + Discord cron alerts

### Open on GitHub, deployed to prod, awaiting merge

- **PR #16** (`feat/sentry`) — Sentry error tracking + admin Security & monitoring section
- **PR #17** (`feat/revenue-v1`) — Revenue MVP. Includes:
  - $49/mo Stripe Payment Link integration (pricing page + webhook + subscriber table)
  - Resend daily digest cron at 14:00 UTC (9 AM ET)
  - Welcome email on Stripe checkout completion
  - Admin Revenue panel (MRR, active subs, growth, churn)
  - `/hive` rebuilt with live ops + 11-agent roster + verification timeline
  - `/trading` rebuilt with broker-paper rollup + integrity panel
  - `/exchange` filtered to the 11 trading agents only
  - Sentry hydration fix (replay integration disabled)
  - Lifetime-signal display fix (was showing 0 sig/24h on weekends)
  - Nav CTA points at `/pricing`; Pricing menu item added
  - 10 outreach DM templates in `docs/OUTREACH-DMS.md`

## ⏳ Five operator pastes to ship first dollar

These are the ONLY things blocking the revenue ship. Everything else is wired.

1. **Apply migration 0016** in Supabase SQL editor (creates `v2_subscribers` table) — paste from `supabase/migrations/0016_subscribers.sql`
2. **Stripe Payment Link URL** — `https://buy.stripe.com/...`
3. **Stripe secret key** — `sk_test_...` or `sk_live_...`
4. **Stripe webhook signing secret** — `whsec_...` (point endpoint at `/api/webhooks/stripe`, events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`)
5. **Resend API key** — `re_...`

Optional: Discord static invite URL for the welcome email.

After paste: I run a $49 test purchase against your card → verify subscriber lands in `/admin` Revenue panel + welcome email lands → refund the test → hand you the DM templates.

## 🟡 Known issues / deferred work

| Item | Why deferred | Effort to fix |
|---|---|---|
| 13F historical backfill | EDGAR returns 100 most-recent only; needs paginated date-window iteration | ~30 min refactor |
| Sentry hydration error #2 | Disabled replay integration as workaround; root cause may still exist in time-formatting | 30 min investigation |
| GDELT entity → ticker mapping | Original Phase A6 — not started | ~2 hr |
| Wiki-edit-surge entity → ticker | Phase A7 | ~2 hr |
| Etherscan whale → Alpaca crypto | Phase A8 — needs Alpaca crypto enabled on paper account | 1-2 hr |
| Clinical trials sponsor → ticker | Phase A9 — needs hand-curated sponsor map | 1-2 hr |
| Floor UI (your pet project) | Design-gated — needs your design input | TBD |

## 🛠️ Codebase shape (what's where)

- `lib/ingestion/agents/` — 11 trading specialists
- `lib/ingestion/openfigi-cusip.ts` — CUSIP→ticker resolver (used by 13F)
- `lib/ingestion/sec-cik-ticker.ts` — CIK→ticker resolver (used by insider-filing)
- `lib/admin/auth.ts` — HMAC-cookie session auth
- `lib/admin/status.ts` — admin page data fetchers (health, fleet, revenue)
- `lib/public/operations.ts` — public-page data fetchers (`/hive`, `/trading`, `/exchange`)
- `lib/email/resend.ts` — Resend client
- `lib/email/templates/welcome.ts` + `digest.ts` — email templates
- `lib/notifications/webhook.ts` — Slack/Discord auto-detecting alert sender
- `app/api/webhooks/stripe/route.ts` — Stripe webhook handler
- `app/api/cron/daily-digest/route.ts` — 14:00 UTC subscriber digest
- `app/api/admin/login/route.ts` + `logout/route.ts` — admin auth endpoints
- `app/admin/page.tsx` — operator command center
- `app/pricing/page.tsx` — $49 Early Access pricing page
- `app/hive/page.tsx`, `app/trading/page.tsx` — public live-ops pages
- `instrumentation.ts` + `instrumentation-client.ts` — Sentry server + client init

## 📚 Migrations status

| # | What | Applied? |
|---|---|---|
| 0014 | Senate eFDSearch source rename | ✅ Applied 2026-04-24 |
| 0015 | thirteen-f-diff-agent v2_agents row | ✅ Applied 2026-04-24 |
| 0016 | v2_subscribers table | ⏳ NOT APPLIED — operator must run before first paid subscriber |

## 🗓️ Cron schedule (all UTC)

```
0 6  * * *  → /api/cron/integrity-audit
0 7  * * *  → /api/cron/ingest/insider-filing-agent
15 7 * * *  → /api/cron/ingest/thirteen-f-agent
30 7 * * *  → /api/cron/ingest/congress-agent
45 7 * * *  → /api/cron/ingest/thirteen-f-diff-agent
0 8  * * *  → /api/cron/ingest/yield-curve-agent
15 8 * * *  → /api/cron/ingest/jobs-data-agent
30 8 * * *  → /api/cron/ingest/fed-futures-agent
30 9 * * *  → /api/cron/ingest/wiki-edit-surge-agent
0 10 * * *  → /api/cron/ingest/gdelt-event-volume-agent
0 11 * * *  → /api/cron/ingest/etherscan-whale-agent
0 12 * * *  → /api/cron/ingest/clinical-trial-outcomes-agent
0 14 * * *  → /api/cron/daily-digest             (NEW — needs subscribers to fire)
0 21 * * *  → /api/cron/alpaca-poll
```

## 🎯 Resume point

When you sit back down, the literal next action is:

1. Open https://supabase.com/dashboard → SQL Editor → paste the v2_subscribers migration → Run
2. Open https://dashboard.stripe.com/register → create the $49/mo product + Payment Link + webhook
3. Open https://resend.com/signup → get API key
4. Tell me "ready"
5. I wire all 5 envs into Vercel, run a test purchase, and hand you the DM templates from `docs/OUTREACH-DMS.md`

Total time from "ready" to "first DM out the door" is ~25 min if everything works.
