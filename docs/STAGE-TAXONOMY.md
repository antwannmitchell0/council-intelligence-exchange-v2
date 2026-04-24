# Stage Taxonomy — The Integrity Contract

> Every performance claim on this exchange carries exactly one stage tag. No mixing. No hand-wave aggregation. The math decides the stage, and the audit trail proves it.

This is the non-negotiable rule the entire project is organized around. If a number doesn't have a stage, it doesn't ship.

## The five stages

| Stage | Meaning | How it's shown on the site |
|---|---|---|
| `pending` | No data, or ingestion not yet wired | "In verification" |
| `backtest-verified` | Historical paper-traded data passed the backtest bar | "Backtest-verified · N historical signals · IC 0.XX" |
| `broker-paper-tracking` | Signals flowing through Alpaca paper; 90-day clock running | "Broker-paper tracking · Day X of 90" |
| `live-verified` | Passed the live bar on ≥90 days of broker-attested data | "Live-verified · X days tracked · IC Y" |
| `live-trading` | Real customer money — **deferred pending RIA registration** | Do not claim — blocked at code boundary |

## The math gates

The thresholds are encoded once, in `lib/integrity/math.ts`. Every promotion decision imports them — no magic numbers elsewhere in the codebase.

### `pending → backtest-verified`

Gate: **IC ≥ 0.10 AND t-stat > 2 AND n ≥ 50** on historical data.

The 0.10 IC bar is stricter than the live gate (0.05) on purpose. Historical data is easier — we want only robust signals through. Applied manually via SQL during Phase 1.5 promotions, not by cron.

### `backtest-verified → broker-paper-tracking`

Gate: **first Alpaca paper order submitted** (not filled — submission is enough).

Automatic: when `lib/alpaca/order-router.ts` successfully POSTs an order for a signal, it runs:
```sql
update v2_signals set stage_tag = 'broker-paper-tracking' where id = $1
```
The agent itself stays in whatever status it was; `stage_tag` is a per-signal attribute. An integrity event with `actor='trigger:alpaca-router'`, `event_type='order_submitted'` marks the transition.

### `broker-paper-tracking → live-verified`

Gate (defined in `lib/integrity/math.ts`):

```ts
export const LIVE_VERIFIED_GATE = {
  minDays: 90,       // ≥90 calendar days of broker-paper fills
  minIC: 0.05,       // Pearson IC of direction vs realized return
  minSharpe: 1,      // annualized, sqrt(252) daily
  minTStat: 2,       // |t| ≈ p < 0.05
} as const
```

**All four must pass.** One failure → stays at `broker-paper-tracking`. Automatic: the `/api/cron/integrity-audit` cron runs nightly (06:00 UTC), computes rolling 90-day metrics per agent, and promotes those that clear. Integrity events: `actor='cron:integrity-audit'`, `event_type='phase_promotion'`.

### `live-verified → live-trading`

**Blocked at the code boundary.** `lib/alpaca/client.ts` asserts the base URL contains `paper-api.` — a live URL is refused at runtime. Unblocking this requires:

1. RIA registration completed
2. Remove the paper-URL assert in `client.ts`
3. Swap `ALPACA_BASE_URL` to `https://api.alpaca.markets`
4. Regenerate Live keys in Alpaca → replace `ALPACA_API_KEY_ID` / `ALPACA_API_SECRET`
5. Re-tune position sizing (the 1%/$5k numbers were for paper)

### Retirement gate — any verified tier → retired

Gate (same file):

```ts
export const RETIRE_GATE = {
  minDays: 30,       // need enough rolling window
  icFloor: 0.02,     // IC below this = retire
  tstatFloor: 1.5,   // t-stat below this = retire
} as const
```

Fires **OR** logic — either threshold broken retires the agent. Automatic via the same nightly cron. Integrity event: `event_type='math_gate_fail'` with full thresholds in `context`.

## Where each stage is written in code

| Stage | Set by | File |
|---|---|---|
| `pending` | Every `BaseIngestionAgent` insert | `lib/ingestion/base-agent.ts:113` — hardcoded on insert |
| `backtest-verified` | Manual SQL / Phase 1.5 migration | `supabase/seed/0004_backtested_specialists.sql` (future migration for bulk promotion) |
| `broker-paper-tracking` | Order router on successful Alpaca submit | `lib/alpaca/order-router.ts::promoteSignalStage` |
| `live-verified` | Nightly integrity audit | `lib/integrity/audit.ts` (invoked by `/api/cron/integrity-audit`) |
| `live-trading` | Not settable — code blocks it | (intentional gap) |

## Where each stage is stored in the DB

Column: `v2_signals.stage_tag` (text, with CHECK constraint listing the 5 values).
Migration: `0010_phase4_alpaca.sql`.
Default: `'pending'`.

**Agent-level stage:** currently inferred as the maximum stage across the agent's recent signals. No separate `v2_agents.stage_tag` column today — can be added later if we want explicit per-agent stage rather than computed.

## Audit trail — how every transition is proven

Every stage change writes a row to `v2_integrity_events` (append-only; migration 0008):

| Actor | Writes on |
|---|---|
| `trigger:alpaca-router` | Order submit, reject |
| `trigger:alpaca-webhook` | Broker events (fill, cancel, expire) |
| `cron:alpaca-poll` | Reconciled fill from polling |
| `cron:integrity-audit` | Promotion / retirement decisions |
| `trigger:v2_agents_status_change` | Any `v2_agents.status` change (DB trigger) |
| `manual:<user>` | Admin SQL changes |

No row is ever updated or deleted. The full history of every agent's integrity journey is queryable:

```sql
select created_at, actor, event_type, old_value, new_value, reason, context
from v2_integrity_events
where agent_id = 'insider-filing-agent'
order by created_at desc;
```

## The non-negotiables

Copied from `docs/NEXT-SESSION-HANDOFF.md` §12, because they govern every promotion decision:

- Every performance number carries a stage tag
- No mixed-stage aggregates (never average a `pending` IC with a `live-verified` IC)
- Auto-promotion is 100% math-gated
- Historical paper data cannot retroactively satisfy the 90-day broker-paper bar
- If the math doesn't support a claim, blank it out or retire the agent

## What the UI is allowed to claim per stage

| Stage | Site may say | Site must NOT say |
|---|---|---|
| `pending` | "In verification" | Any IC, Sharpe, win-rate, hit-rate, or return |
| `backtest-verified` | "Backtest-verified · IC X · n Y · date range Z" with caveat that post-cost individual-trade returns may be negative | "Verified" unqualified, or claim these numbers describe live behavior |
| `broker-paper-tracking` | "Broker-paper tracking · Day X of 90" + rolling IC / Sharpe / drawdown | "Verified" unqualified |
| `live-verified` | "Live-verified · X days tracked · IC Y · Sharpe Z" | "Suitable for investment", "trading advice", anything triggering the Investment Advisers Act without RIA |
| `live-trading` | (not applicable — blocked) | Anything at all |

`lib/render-if-verified.ts` is the canonical gate for rendering verified claims. Bios that lack stage-qualified numbers render blank — not filler. Integrity over polish.

## Related docs

- `lib/integrity/math.ts` — the thresholds, encoded once
- `lib/integrity/audit.ts` — the cron logic that applies them
- `app/api/cron/integrity-audit/route.ts` — the Vercel cron entry
- `supabase/migrations/0010_phase4_alpaca.sql` — the `stage_tag` column
- `docs/ALPACA-REFERENCE.md` — the broker that attests to `broker-paper-tracking`
- `docs/NEXT-SESSION-HANDOFF.md` — project-wide context
