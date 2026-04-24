// PDT (Pattern Day Trader) guard.
//
// Paper accounts start at $100k so this won't bite in practice tonight, but
// the guard lives here so flipping to live trading later is a one-line URL
// swap in lib/alpaca/client.ts plus RIA registration — no scrambling to add
// protection under real-money pressure.
//
// Reference: FINRA Rule 4210 — brokers must restrict accounts flagged PDT
// with equity < $25,000 to 3 day-trades per 5-business-day window.

import "server-only"
import type { AlpacaAccount } from "./client"

export type PdtCheckResult = { ok: true } | { ok: false; reason: string }

const PDT_MIN_EQUITY_USD = 25_000
const PDT_MAX_DAYTRADES_5D = 3

export function canPlaceOrder(account: AlpacaAccount): PdtCheckResult {
  const equity = Number(account.equity)
  if (!Number.isFinite(equity)) {
    return { ok: false, reason: "unparseable_equity" }
  }
  if (account.status !== "ACTIVE") {
    return { ok: false, reason: `account_status_${account.status}` }
  }
  if (account.pattern_day_trader && equity < PDT_MIN_EQUITY_USD) {
    return {
      ok: false,
      reason: `pdt_flagged_equity_${equity.toFixed(0)}_under_25k`,
    }
  }
  if (account.daytrade_count >= PDT_MAX_DAYTRADES_5D && equity < PDT_MIN_EQUITY_USD) {
    return {
      ok: false,
      reason: `daytrade_count_${account.daytrade_count}_at_limit`,
    }
  }
  return { ok: true }
}
