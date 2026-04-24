# Vercel Project — Council Intelligence Exchange v2

> Reference card for hosting, CI/CD, env vars, and crons.

**Project slug:** `antwanns-projects/council-intelligence-exchange-v2`
**Prod URL:** https://council-intelligence-exchange-v2.vercel.app
**Dashboard:** https://vercel.com/antwanns-projects/council-intelligence-exchange-v2
**Linked repo:** https://github.com/antwannmitchell0/council-intelligence-exchange-v2
**Framework:** Next.js 16.2.4 (App Router, Turbopack)
**Runtime:** Node.js 24 LTS (Fluid Compute default)
**Plan:** Hobby

## Production env vars

| Variable | Purpose | Source / Rotation |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase key (RLS-bound) | Rotate with JWT — see `SUPABASE-REFERENCE.md` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Not set yet** — server-side writes | Add post-JWT-rotation |
| `CRON_SECRET` | Bearer-auth for every `/api/cron/*` route | Random 32+ char string |
| `SEC_USER_AGENT` | SEC EDGAR polite-UA compliance | Format: `"Name contact@example.com"` |
| `ALPACA_API_KEY_ID` | Alpaca Council Exchange paper Key ID | See `ALPACA-REFERENCE.md` |
| `ALPACA_API_SECRET` | Alpaca paper Secret | Same — rotate at Alpaca |
| `ALPACA_WEBHOOK_SECRET` | `POST /api/alpaca/webhook` auth | `openssl rand -hex 32` |
| `ALPACA_BASE_URL` | `https://paper-api.alpaca.markets` (default) | Only paper URLs accepted by code |

### Env-var discipline

- **Production scope only** for any secret that can cost money or touch prod data. Preview deploys inheriting Alpaca / Supabase service-role keys would fire real paper orders and mutate prod state.
- **Never prefix secrets with `NEXT_PUBLIC_`** — that exposes them to the browser bundle.
- **Never commit env files.** `.env*.local` and `.env*` are both in `.gitignore` — belt-and-suspenders.

### Vercel CLI gotcha (learned 2026-04-23)

`vercel env rm <name> <scope>` removes the **entire record** when a var was stored with multiple scopes in one entry. There's no partial-scope removal via CLI. Workaround: always `vercel env add <name> production` (single scope) so `rm production` removes cleanly.

## Managing env vars

```bash
# From project root (NOT the worktree — env commands are project-linked)
cd "/Users/antwannmitchellsr/The Council Intelligence Exchange/The Council Intelligence Exchange v2"

# List all
vercel env ls

# List for one scope
vercel env ls production

# Add (prompts for value via stdin — doesn't land in shell history)
vercel env add ALPACA_API_KEY_ID production

# Remove
vercel env rm ALPACA_API_KEY_ID production --yes

# Pull (creates a local .env — DELETE after use)
vercel env pull .env.tmp --environment=production
# ...use it...
rm .env.tmp
```

## Cron schedule (all auth via `Authorization: Bearer $CRON_SECRET`)

Defined in `vercel.ts`. On Hobby, each cron fires **once per day** (limit). UTC is the scheduling timezone; conversions to US/Eastern shown for operational clarity.

| Path | Schedule (UTC) | ET equivalent | Purpose |
|---|---|---|---|
| `/api/cron/integrity-audit` | `0 6 * * *` | 02:00 ET (01:00 EDT) | Nightly IC/Sharpe audit + auto-promotion |
| `/api/cron/ingest?agent=insider-filing-agent` | `0 7 * * *` | 03:00 ET | SEC EDGAR Form 4 |
| `/api/cron/ingest?agent=thirteen-f-agent` | `15 7 * * *` | 03:15 ET | SEC 13F |
| `/api/cron/ingest?agent=congress-agent` | `30 7 * * *` | 03:30 ET | Senate Stock Watcher |
| `/api/cron/ingest?agent=yield-curve-agent` | `0 8 * * *` | 04:00 ET | FRED |
| `/api/cron/ingest?agent=jobs-data-agent` | `15 8 * * *` | 04:15 ET | BLS |
| `/api/cron/ingest?agent=fed-futures-agent` | `30 8 * * *` | 04:30 ET | CME |
| `/api/cron/ingest?agent=wiki-edit-surge-agent` | `30 9 * * *` | 05:30 ET | Wikipedia edit velocity |
| `/api/cron/ingest?agent=gdelt-event-volume-agent` | `0 10 * * *` | 06:00 ET | GDELT |
| `/api/cron/ingest?agent=etherscan-whale-agent` | `0 11 * * *` | 07:00 ET | Ethereum on-chain whales |
| `/api/cron/ingest?agent=clinical-trial-outcomes-agent` | `0 12 * * *` | 08:00 ET | ClinicalTrials.gov |
| `/api/cron/alpaca-poll` | `0 21 * * *` | 17:00 ET (post-close) | Reconcile broker fills |

**Pro upgrade path:** unlocks sub-daily cadence. Desired long-term for time-sensitive sources:
- `alpaca-poll` → `*/15 13-21 * * 1-5` (15-min, 9am–4pm ET, weekdays)
- `insider-filing`, `congress` → `0 */6 * * *` (6-hourly)

## Manually triggering a cron (operator runbook)

```bash
# Pull CRON_SECRET for this session only
vercel env pull .env.cron-run --environment=production
source .env.cron-run

# Fire one ingest
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  "https://council-intelligence-exchange-v2.vercel.app/api/cron/ingest/insider-filing-agent"

# Fire the integrity audit
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  "https://council-intelligence-exchange-v2.vercel.app/api/cron/integrity-audit"

# Fire the Alpaca reconciler
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  "https://council-intelligence-exchange-v2.vercel.app/api/cron/alpaca-poll"

rm .env.cron-run
```

Expected responses:
- `200` — ok
- `207` — partial (some errors but not total failure)
- `401` — wrong/missing CRON_SECRET
- `404` — unknown agent id
- `500` — agent threw
- `503` — `CRON_SECRET` not configured in env

## `vercel.ts` (not `vercel.json`)

This project uses the TypeScript config surface. Changes to routing/headers/crons go in `vercel.ts` and ship with the next deploy. See file for current contents — security headers, font + `_next/static` cache-control, and the cron schedule above.

## Deployments

```bash
# Preview (current branch)
vercel

# Production (force-promote current branch)
vercel --prod

# Rollback via dashboard — Deployments → pick a previous deploy → Promote
```

## Logs + observability

Every cron + webhook route emits single-line JSON logs via the shared `logEvent()` pattern — grep-friendly in Vercel Log Drains.

Useful log events to watch:
- `cron.ingest.finish` — per-agent ingestion summary
- `cron.integrity-audit.start` / `.finish` — nightly audit
- `alpaca.router.*` — order outcomes
- `alpaca.webhook.*` — broker event receiver
- `alpaca.poll.*` — reconciliation sweep

## Local dev

```bash
cd "/Users/antwannmitchellsr/The Council Intelligence Exchange/The Council Intelligence Exchange v2/.claude/worktrees/trusting-wing-8b7611"
vercel env pull .env.local --environment=development
npm install
npm run dev
```

`npm run dev` binds `localhost:3000` with Turbopack. `vercel env pull` populates `.env.local` (gitignored).

## Related docs

- `docs/NEXT-SESSION-HANDOFF.md` — project-wide context
- `docs/ALPACA-REFERENCE.md` — broker details
- `docs/SUPABASE-REFERENCE.md` — data layer details
- `docs/STAGE-TAXONOMY.md` — stage gate math
