// Pure math for the integrity-audit cron.
// No I/O. No framework imports. Fully unit-testable.
//
// Vocabulary (encoded here once, referenced everywhere):
//   IC      — information coefficient. Pearson correlation between the
//             sign of the agent's prediction (direction ∈ {-1, 0, +1}) and
//             the realized forward return. Range [-1, 1]. Positive = edge.
//   t-stat  — the t-statistic of IC given sample size n. Thresholds
//             borrow from the classic "|t| > 2 ≈ p < 0.05" heuristic.
//   Sharpe  — mean(returns)/stdev(returns), annualized by sqrt(252).
//             Rough approximation — assumes daily independence.
//
// Everything here is static. Side-effects happen in lib/integrity/audit.ts.

const TRADING_DAYS_PER_YEAR = 252

export const LIVE_VERIFIED_GATE = {
  minDays: 90,
  minIC: 0.05,
  minSharpe: 1,
  minTStat: 2,
} as const

export const RETIRE_GATE = {
  minDays: 30,
  icFloor: 0.02,
  tstatFloor: 1.5,
} as const

export type GateMetrics = {
  ic: number
  tstat: number
  n: number
  sharpe: number
  days: number
}

export type GateResult = {
  pass: boolean
  reasons: string[]
}

export type RetireInputs = {
  ic: number
  tstat: number
  days: number
}

export type RetireResult = {
  retire: boolean
  reasons: string[]
}

/**
 * Pearson correlation between directions (sign of prediction) and realized
 * returns. Returns 0 for degenerate inputs (mismatched/short/zero-variance),
 * never NaN — the cron must be numerically safe on sparse data.
 */
export function pearsonIC(directions: number[], returns: number[]): number {
  const n = Math.min(directions.length, returns.length)
  if (n < 2) return 0

  let sumX = 0
  let sumY = 0
  for (let i = 0; i < n; i += 1) {
    sumX += directions[i]
    sumY += returns[i]
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let cov = 0
  let varX = 0
  let varY = 0
  for (let i = 0; i < n; i += 1) {
    const dx = directions[i] - meanX
    const dy = returns[i] - meanY
    cov += dx * dy
    varX += dx * dx
    varY += dy * dy
  }
  if (varX === 0 || varY === 0) return 0

  const denom = Math.sqrt(varX * varY)
  if (!Number.isFinite(denom) || denom === 0) return 0

  const ic = cov / denom
  if (!Number.isFinite(ic)) return 0

  // Clamp to [-1, 1] to absorb floating-point drift.
  if (ic > 1) return 1
  if (ic < -1) return -1
  return ic
}

/**
 * t-statistic for a correlation coefficient with n observations.
 * t = IC * sqrt(n-2) / sqrt(1 - IC^2)
 * Returns 0 for n < 3 or |IC| = 1 (undefined / infinite cases).
 */
export function tStat(ic: number, n: number): number {
  if (!Number.isFinite(ic)) return 0
  if (n < 3) return 0
  const denomSq = 1 - ic * ic
  if (denomSq <= 0) return 0
  const t = (ic * Math.sqrt(n - 2)) / Math.sqrt(denomSq)
  return Number.isFinite(t) ? t : 0
}

/**
 * Rough daily-annualized Sharpe. Uses sample stdev (n-1 denominator) and
 * multiplies by sqrt(252). Returns 0 for degenerate inputs.
 */
export function sharpeApprox(returns: number[]): number {
  const n = returns.length
  if (n < 2) return 0
  let sum = 0
  for (let i = 0; i < n; i += 1) sum += returns[i]
  const mean = sum / n

  let ssq = 0
  for (let i = 0; i < n; i += 1) {
    const d = returns[i] - mean
    ssq += d * d
  }
  const variance = ssq / (n - 1)
  if (variance <= 0) return 0
  const stdev = Math.sqrt(variance)
  if (!Number.isFinite(stdev) || stdev === 0) return 0

  const sharpe = (mean / stdev) * Math.sqrt(TRADING_DAYS_PER_YEAR)
  return Number.isFinite(sharpe) ? sharpe : 0
}

/**
 * The gate that promotes `broker-paper-tracking` → `live-verified`.
 * All four conditions must hold. Returns the list of reasons that
 * either passed or failed, so we can log the full story.
 */
export function passesLiveVerifiedGate(m: GateMetrics): GateResult {
  const reasons: string[] = []
  const daysOk = m.days >= LIVE_VERIFIED_GATE.minDays
  const icOk = m.ic >= LIVE_VERIFIED_GATE.minIC
  const sharpeOk = m.sharpe >= LIVE_VERIFIED_GATE.minSharpe
  const tstatOk = m.tstat > LIVE_VERIFIED_GATE.minTStat

  reasons.push(
    `days=${m.days.toFixed(0)} ${daysOk ? ">=" : "<"} ${LIVE_VERIFIED_GATE.minDays}`
  )
  reasons.push(
    `ic=${m.ic.toFixed(4)} ${icOk ? ">=" : "<"} ${LIVE_VERIFIED_GATE.minIC}`
  )
  reasons.push(
    `sharpe=${m.sharpe.toFixed(3)} ${sharpeOk ? ">=" : "<"} ${LIVE_VERIFIED_GATE.minSharpe}`
  )
  reasons.push(
    `tstat=${m.tstat.toFixed(3)} ${tstatOk ? ">" : "<="} ${LIVE_VERIFIED_GATE.minTStat}`
  )

  return {
    pass: daysOk && icOk && sharpeOk && tstatOk,
    reasons,
  }
}

/**
 * The gate that retires any verified-tier agent back to `degraded`.
 * TRIPS if the trailing window is sufficient AND either IC or t-stat
 * falls below the floor. The `days` check guards against a thin sample
 * retiring a fresh agent on noise.
 */
export function passesRetireGate(i: RetireInputs): RetireResult {
  const reasons: string[] = []
  const daysOk = i.days >= RETIRE_GATE.minDays
  const icBad = i.ic < RETIRE_GATE.icFloor
  const tstatBad = i.tstat < RETIRE_GATE.tstatFloor

  reasons.push(
    `days=${i.days.toFixed(0)} ${daysOk ? ">=" : "<"} ${RETIRE_GATE.minDays}`
  )
  reasons.push(
    `ic=${i.ic.toFixed(4)} ${icBad ? "<" : ">="} ${RETIRE_GATE.icFloor}`
  )
  reasons.push(
    `tstat=${i.tstat.toFixed(3)} ${tstatBad ? "<" : ">="} ${RETIRE_GATE.tstatFloor}`
  )

  return {
    retire: daysOk && (icBad || tstatBad),
    reasons,
  }
}
