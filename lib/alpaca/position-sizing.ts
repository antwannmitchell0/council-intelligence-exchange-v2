// Position sizing for paper orders.
//
// Tonight's policy (Phase 4) is deliberately boring: fixed 1% of paper NAV
// per signal, capped at $5,000 absolute. Kelly-sizing and volatility-adjusted
// sizing live in the `confidential-agent-playbook` skill and land later once
// the broker-paper track has enough fills to estimate edge per agent.

import "server-only"

export const DEFAULT_TARGET_WEIGHT = 0.01 // 1% of paper NAV
export const MAX_NOTIONAL_USD = 5_000      // absolute cap per order
export const MIN_NOTIONAL_USD = 1          // Alpaca minimum

export type NotionalResult = {
  notional: number          // dollars, rounded to 2dp
  capped: boolean
  reason?: string
}

/**
 * computeNotional — turns account equity + a target weight into a dollar
 * notional for a market order. Caps at MAX_NOTIONAL_USD. Returns null-
 * equivalent (notional = 0) with a reason when the input can't produce a
 * tradable amount.
 */
export function computeNotional(
  accountEquityUsd: number,
  targetWeight: number | null | undefined
): NotionalResult {
  if (!Number.isFinite(accountEquityUsd) || accountEquityUsd <= 0) {
    return { notional: 0, capped: false, reason: "zero_equity" }
  }

  const weight =
    targetWeight != null && Number.isFinite(targetWeight) && targetWeight > 0
      ? Math.min(targetWeight, 1)
      : DEFAULT_TARGET_WEIGHT

  const raw = accountEquityUsd * weight
  const cappedValue = Math.min(raw, MAX_NOTIONAL_USD)
  const rounded = Math.round(cappedValue * 100) / 100

  if (rounded < MIN_NOTIONAL_USD) {
    return { notional: 0, capped: false, reason: "below_min_notional" }
  }

  return {
    notional: rounded,
    capped: cappedValue < raw,
  }
}
