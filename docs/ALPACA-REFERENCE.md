# Alpaca API — Council Intelligence Exchange v2

> Reference card for the broker-paper integration wired in Phase 4 (2026-04-23).

**Account:** Council Exchange (Alpaca)
**Mode:** Paper Trading only
**Dashboard:** https://app.alpaca.markets/paper/dashboard/overview
**Purpose:** Powers broker-paper tracking for the 24-agent intelligence roster. Signals from `insider-filing-agent` and `congress-agent` get routed here; fills start the 90-day clock toward `live-verified` stage.

## 🔴 Account-separation rule

**Do NOT use the Demm Money Machine account for this project.** Mixing fills breaks the integrity math — every agent's IC/Sharpe/win-rate is computed from `v2_trade_tickets` and contaminated history silently invalidates the 90-day clock. One Alpaca account per product. See `docs/NEXT-SESSION-HANDOFF.md` §5.

## Env vars (all Production-only in Vercel)

| Variable | Source | Purpose |
|---|---|---|
| `ALPACA_API_KEY_ID` | Alpaca → Council Exchange → Paper → API Keys | REST auth header `APCA-API-KEY-ID` |
| `ALPACA_API_SECRET` | Same key pair, shown once at generation | REST auth header `APCA-API-SECRET-KEY` |
| `ALPACA_WEBHOOK_SECRET` | `openssl rand -hex 32` | Gates `POST /api/alpaca/webhook` |
| `ALPACA_BASE_URL` | `https://paper-api.alpaca.markets` (default) | Client refuses non-paper URLs |

## Rotation procedure

If a key is suspected compromised:
1. Alpaca dashboard → API Keys → **Regenerate** (the old pair dies instantly)
2. ```
   vercel env rm ALPACA_API_KEY_ID production --yes
   vercel env rm ALPACA_API_SECRET production --yes
   ```
3. ```
   vercel env add ALPACA_API_KEY_ID production   # paste new Key ID
   vercel env add ALPACA_API_SECRET production   # paste new Secret
   ```
4. Redeploy: `vercel --prod`

`ALPACA_WEBHOOK_SECRET` rotates the same way — just generate a fresh `openssl rand -hex 32`.

**Vercel CLI gotcha (learned 2026-04-23):** a var stored with multiple environments (Production + Preview) is a single record; `vercel env rm <name> preview` removes the entire record, not just the preview scope. Always add with `production` only.

## Guardrails baked into the code

- **Paper-only assertion** — `lib/alpaca/client.ts` refuses any `ALPACA_BASE_URL` that doesn't contain `paper-api.`. Live trading requires removing that assert + RIA registration.
- **Idempotency** — `client_order_id = signal.id`. Alpaca returns 409 on duplicate; router treats that as success.
- **PDT guard** — blocks orders when `pattern_day_trader === true && equity < $25k` (FINRA 4210).
- **Dedicated circuit breaker** — a failing Alpaca session never trips the ingestion breaker. One bad session blackholes orders, not ingests.
- **Env-absent path** — missing keys = log + no-op. Ingestion always stays green.
- **Position sizing** — 1% of NAV, capped at $5k per order. (`lib/alpaca/position-sizing.ts`.)

## Integrity wiring

Every order outcome writes a row to `v2_integrity_events`:

| actor | emitted by |
|---|---|
| `trigger:alpaca-router` | order submit / reject at placement time |
| `trigger:alpaca-webhook` | trade-update events (fill, cancel, expire) |
| `cron:alpaca-poll` | reconciliation sweep (belt-and-suspenders) |

The append-only guarantee (no UPDATE/DELETE policies, see migration `0008_integrity_events.sql`) means every order ever placed is permanently auditable.

## Repo surface

| File | Role |
|---|---|
| `lib/alpaca/client.ts` | REST wrapper — `createOrder`, `getAccount`, `listOrders`, `getOrderByClientId` |
| `lib/alpaca/order-router.ts` | `PersistedSignal[]` → Alpaca orders, promotes signal stage |
| `lib/alpaca/pdt-guard.ts` | FINRA 4210 check |
| `lib/alpaca/position-sizing.ts` | 1%/$5k notional calculator |
| `app/api/alpaca/webhook/route.ts` | `x-webhook-secret` authed, writes `v2_trade_tickets` |
| `app/api/cron/alpaca-poll/route.ts` | Reconciles fills on cron |
| `supabase/migrations/0010_phase4_alpaca.sql` | `v2_trade_tickets` + `stage_tag` column |
| `lib/ingestion/base-agent.ts` | Post-insert `routeOrders()` hook |
| `vercel.ts` | `/api/cron/alpaca-poll` cron entry |

## Verification commands

```bash
# Confirm env vars are Production-only (3 rows + ALPACA_BASE_URL)
vercel env ls production | grep ALPACA

# Auth test — should return account JSON
vercel env pull .env.alpaca-check --environment=production
source .env.alpaca-check
curl -s https://paper-api.alpaca.markets/v2/account \
  -H "APCA-API-KEY-ID: $ALPACA_API_KEY_ID" \
  -H "APCA-API-SECRET-KEY: $ALPACA_API_SECRET" | head -c 400
rm .env.alpaca-check
```

```sql
-- After first cron run, confirm the Day-0 fill landed
select id, agent_id, symbol, side, order_status, filled_at
from v2_trade_tickets
order by created_at desc
limit 5;

-- Integrity audit trail
select created_at, actor, event_type, agent_id, reason
from v2_integrity_events
where actor like 'trigger:alpaca%' or actor like 'cron:alpaca%'
order by created_at desc
limit 20;
```

## Upgrade path (post-RIA)

To flip to live trading later:
1. Register as RIA (out of scope for this doc).
2. Generate **Live** keys in Alpaca — replace `ALPACA_API_KEY_ID` / `ALPACA_API_SECRET`.
3. Change `ALPACA_BASE_URL` to `https://api.alpaca.markets`.
4. **Remove** the paper-only assertion from `lib/alpaca/client.ts` (the `/paper-api\./i.test(baseUrl)` guard).
5. Shrink position size — the 1%/$5k numbers were chosen for paper; real money needs a Kelly-sized or volatility-adjusted sizer (see `confidential-agent-playbook` skill).

## Related docs

- `docs/NEXT-SESSION-HANDOFF.md` — full project context
- `supabase/migrations/0010_phase4_alpaca.sql` — the schema changes
- Alpaca API docs: https://docs.alpaca.markets/
