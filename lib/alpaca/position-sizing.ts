// Position sizing for paper orders.
//
// Phase 4 policy: fixed fractional-NAV sizing. Kelly-sizing lives in
// `confidential-agent-playbook` skill — ships once broker-paper has
// enough fills per agent to estimate edge.
//
// 2026-04-24: lowered from 0.01 (1%) to 0.0025 (0.25%) alongside EDGAR
// pagination. At 1% × $925/order, the $77k buying power saturated
// after ~83 orders — below realistic Form 4 daily volume. At 0.25%
// (~$232/order) we can place ~330 orders before buying power
// constrains, comfortably above typical daily filing volume.

import "server-only"

export const DEFAULT_TARGET_WEIGHT = 0.0025 // 0.25% of paper NAV
export const MAX_NOTIONAL_USD = 5_000       // absolute cap per order
export const MIN_NOTIONAL_USD = 1           // Alpaca minimum

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
