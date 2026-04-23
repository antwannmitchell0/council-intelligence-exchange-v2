// Phase 5 integrity audit orchestrator.
// Pulled by /api/cron/integrity-audit nightly. Pure enough to be testable
// with a stubbed Supabase client, but structured so the cron route stays thin.
//
// Stage taxonomy (see docs/NEXT-SESSION-HANDOFF.md §4):
//   pending → backtest-verified → broker-paper-tracking → live-verified → live-trading
//
// Only agents in {backtest-verified, broker-paper-tracking} are audited.
// Missing stages (because the schema hasn't added them yet) is a no-op.
//
// Data model notes:
//   • `direction` and `confirmed_return` on v2_signals are Phase 4 additions.
//     This module selects them defensively — if the columns don't exist yet
//     or return null for every row, the per-agent audit yields an empty
//     series and the gate short-circuits with `held: reason='insufficient_data'`.
//   • `v2_trade_tickets` is populated by Phase 4 Alpaca webhook. If the
//     table doesn't exist yet the broker-paper promotion path is skipped.

import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { getServerClient } from "@/lib/supabase/server"
import {
  LIVE_VERIFIED_GATE,
  RETIRE_GATE,
  passesLiveVerifiedGate,
  passesRetireGate,
  pearsonIC,
  sharpeApprox,
  tStat,
} from "./math"

// Status values used by Phase 5. Not yet in the v2_verification_status enum —
// the audit tolerates either enum or text-column shapes.
const TRACKED_STAGES = ["backtest-verified", "broker-paper-tracking"] as const
const VERIFIED_TIER_STAGES = ["live-verified", "live-trading"] as const

const ROLLING_WINDOW_DAYS = 90
const RETIRE_WINDOW_DAYS = 30
const MS_PER_DAY = 86_400_000

type AuditActor = "cron:integrity-audit"

export type AuditDecision =
  | {
      kind: "promoted"
      agent_id: string
      from: string
      to: string
      metrics: AuditMetrics
      reasons: string[]
    }
  | {
      kind: "retired"
      agent_id: string
      from: string
      to: string
      metrics: AuditMetrics
      reasons: string[]
    }
  | {
      kind: "held"
      agent_id: string
      stage: string
      metrics: AuditMetrics | null
      reason: string
    }

export type AuditMetrics = {
  ic: number
  tstat: number
  n: number
  sharpe: number
  days: number
  window: "90d" | "30d"
}

export type AuditSummary = {
  checked: number
  promoted: AuditDecision[]
  retired: AuditDecision[]
  held: AuditDecision[]
  started_at: string
  finished_at: string
  duration_ms: number
}

// Minimal row shapes. We project only what we read.
type AgentStageRow = { id: string; name: string; status: string }
type SignalMetricRow = {
  agent_id: string
  created_at: string
  direction: number | null
  confirmed_return: number | null
}

type MinimalClient = SupabaseClient<Database>

/**
 * Entry point called by the cron route. Returns a structured summary
 * suitable for JSON response + emits one integrity event per decision.
 */
export async function runIntegrityAudit(
  logger: (event: string, data: Record<string, unknown>) => void
): Promise<AuditSummary> {
  const started = Date.now()
  const startedAt = new Date(started).toISOString()
  const summary: AuditSummary = {
    checked: 0,
    promoted: [],
    retired: [],
    held: [],
    started_at: startedAt,
    finished_at: startedAt,
    duration_ms: 0,
  }

  const supabase = getServerClient()
  if (!supabase) {
    logger("integrity.audit.no_client", { reason: "supabase_unavailable" })
    const finished = Date.now()
    summary.finished_at = new Date(finished).toISOString()
    summary.duration_ms = finished - started
    return summary
  }

  // 1. Pull agents in tracked stages. If none, cron is a no-op (not an error).
  const tracked = await fetchAgentsByStage(supabase, [
    ...TRACKED_STAGES,
    ...VERIFIED_TIER_STAGES,
  ])
  summary.checked = tracked.length
  logger("integrity.audit.agents_loaded", {
    count: tracked.length,
    stages_queried: [...TRACKED_STAGES, ...VERIFIED_TIER_STAGES],
  })

  if (tracked.length === 0) {
    const finished = Date.now()
    summary.finished_at = new Date(finished).toISOString()
    summary.duration_ms = finished - started
    return summary
  }

  // 2. For each agent compute the rolling windows and decide.
  for (const agent of tracked) {
    const stage = agent.status

    // Promotion / retire paths each use the appropriate window.
    if (stage === "backtest-verified") {
      const decision = await auditBacktestVerified(supabase, agent, logger)
      routeDecision(decision, summary)
    } else if (stage === "broker-paper-tracking") {
      const decision = await auditBrokerPaperTracking(supabase, agent, logger)
      routeDecision(decision, summary)
    } else if (
      stage === "live-verified" ||
      stage === "live-trading"
    ) {
      const decision = await auditVerifiedTier(supabase, agent, logger)
      routeDecision(decision, summary)
    } else {
      // Shouldn't happen given our filter, but be safe.
      const held: AuditDecision = {
        kind: "held",
        agent_id: agent.id,
        stage,
        metrics: null,
        reason: `unexpected_stage:${stage}`,
      }
      summary.held.push(held)
    }
  }

  const finished = Date.now()
  summary.finished_at = new Date(finished).toISOString()
  summary.duration_ms = finished - started
  return summary
}

// ---------------------------------------------------------------------------
// Per-stage audits
// ---------------------------------------------------------------------------

/**
 * backtest-verified → broker-paper-tracking
 * Requires at least one Alpaca paper fill in v2_trade_tickets (Phase 4).
 * If the table doesn't exist yet this path is skipped (held).
 */
async function auditBacktestVerified(
  supabase: MinimalClient,
  agent: AgentStageRow,
  logger: (event: string, data: Record<string, unknown>) => void
): Promise<AuditDecision> {
  const hasFill = await firstBrokerPaperFillExists(supabase, agent.id)
  if (hasFill === "unavailable") {
    logger("integrity.audit.held", {
      agent_id: agent.id,
      stage: agent.status,
      reason: "trade_tickets_unavailable",
    })
    return {
      kind: "held",
      agent_id: agent.id,
      stage: agent.status,
      metrics: null,
      reason: "trade_tickets_unavailable",
    }
  }
  if (hasFill === false) {
    logger("integrity.audit.held", {
      agent_id: agent.id,
      stage: agent.status,
      reason: "no_broker_paper_fill",
    })
    return {
      kind: "held",
      agent_id: agent.id,
      stage: agent.status,
      metrics: null,
      reason: "no_broker_paper_fill",
    }
  }

  const from = agent.status
  const to = "broker-paper-tracking"
  const metrics: AuditMetrics = {
    ic: 0,
    tstat: 0,
    n: 0,
    sharpe: 0,
    days: 0,
    window: "90d",
  }
  const reasons = ["first_broker_paper_fill_detected"]

  await applyPromotion(supabase, agent.id, from, to, metrics, reasons, logger)

  return {
    kind: "promoted",
    agent_id: agent.id,
    from,
    to,
    metrics,
    reasons,
  }
}

/**
 * broker-paper-tracking → live-verified
 * Requires ≥90 broker-paper days AND IC ≥ 0.05 AND Sharpe ≥ 1 AND t-stat > 2.
 */
async function auditBrokerPaperTracking(
  supabase: MinimalClient,
  agent: AgentStageRow,
  logger: (event: string, data: Record<string, unknown>) => void
): Promise<AuditDecision> {
  const metrics = await computeAgentMetrics(
    supabase,
    agent.id,
    ROLLING_WINDOW_DAYS
  )

  if (metrics.n === 0) {
    logger("integrity.audit.held", {
      agent_id: agent.id,
      stage: agent.status,
      reason: "insufficient_data",
      metrics,
    })
    return {
      kind: "held",
      agent_id: agent.id,
      stage: agent.status,
      metrics,
      reason: "insufficient_data",
    }
  }

  const gate = passesLiveVerifiedGate(metrics)
  if (!gate.pass) {
    await writeEvent(supabase, {
      agent_id: agent.id,
      event_type: "math_gate_fail",
      old_value: agent.status,
      new_value: agent.status,
      reason: `live_verified_gate: ${gate.reasons.join("; ")}`,
      context: metricsToJson(metrics, {
        gate: "live_verified",
        thresholds: LIVE_VERIFIED_GATE,
      }),
    })
    logger("integrity.audit.held", {
      agent_id: agent.id,
      stage: agent.status,
      reason: "gate_failed",
      gate: "live_verified",
      gate_reasons: gate.reasons,
      metrics,
    })
    return {
      kind: "held",
      agent_id: agent.id,
      stage: agent.status,
      metrics,
      reason: `gate_failed: ${gate.reasons.join("; ")}`,
    }
  }

  await writeEvent(supabase, {
    agent_id: agent.id,
    event_type: "math_gate_pass",
    old_value: agent.status,
    new_value: "live-verified",
    reason: `live_verified_gate: ${gate.reasons.join("; ")}`,
    context: metricsToJson(metrics, {
      gate: "live_verified",
      thresholds: LIVE_VERIFIED_GATE,
    }),
  })

  const from = agent.status
  const to = "live-verified"
  await applyPromotion(supabase, agent.id, from, to, metrics, gate.reasons, logger)

  return {
    kind: "promoted",
    agent_id: agent.id,
    from,
    to,
    metrics,
    reasons: gate.reasons,
  }
}

/**
 * live-verified / live-trading → degraded
 * Trailing 30d. Retire on IC < 0.02 OR t-stat < 1.5 once the window has enough days.
 */
async function auditVerifiedTier(
  supabase: MinimalClient,
  agent: AgentStageRow,
  logger: (event: string, data: Record<string, unknown>) => void
): Promise<AuditDecision> {
  const metrics = await computeAgentMetrics(
    supabase,
    agent.id,
    RETIRE_WINDOW_DAYS
  )
  metrics.window = "30d"

  if (metrics.n === 0) {
    logger("integrity.audit.held", {
      agent_id: agent.id,
      stage: agent.status,
      reason: "insufficient_data",
      metrics,
    })
    return {
      kind: "held",
      agent_id: agent.id,
      stage: agent.status,
      metrics,
      reason: "insufficient_data",
    }
  }

  const verdict = passesRetireGate({
    ic: metrics.ic,
    tstat: metrics.tstat,
    days: metrics.days,
  })

  if (!verdict.retire) {
    logger("integrity.audit.held", {
      agent_id: agent.id,
      stage: agent.status,
      reason: "within_tolerance",
      metrics,
      retire_reasons: verdict.reasons,
    })
    return {
      kind: "held",
      agent_id: agent.id,
      stage: agent.status,
      metrics,
      reason: `within_tolerance: ${verdict.reasons.join("; ")}`,
    }
  }

  await writeEvent(supabase, {
    agent_id: agent.id,
    event_type: "math_gate_fail",
    old_value: agent.status,
    new_value: "degraded",
    reason: `retire_gate: ${verdict.reasons.join("; ")}`,
    context: metricsToJson(metrics, {
      gate: "retire",
      thresholds: RETIRE_GATE,
    }),
  })

  const from = agent.status
  const to = "degraded"
  await applyStageChange(
    supabase,
    agent.id,
    from,
    to,
    metrics,
    verdict.reasons,
    "retire",
    logger
  )

  return {
    kind: "retired",
    agent_id: agent.id,
    from,
    to,
    metrics,
    reasons: verdict.reasons,
  }
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function fetchAgentsByStage(
  supabase: MinimalClient,
  stages: readonly string[]
): Promise<AgentStageRow[]> {
  // The `status` column is a v2_verification_status enum; new stage values
  // may not be part of the enum yet. The .in() filter is text-safe.
  const { data, error } = await supabase
    .from("v2_agents")
    .select("id, name, status")
    .in("status" as never, stages as unknown as string[])

  if (error || !data) return []
  // Cast boundary — status is typed as the narrow enum but may carry Phase 5 text.
  return (data as unknown as AgentStageRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
  }))
}

/**
 * Returns true/false/'unavailable'. 'unavailable' means the v2_trade_tickets
 * table does not exist yet (Phase 4 not deployed).
 */
async function firstBrokerPaperFillExists(
  supabase: MinimalClient,
  agentId: string
): Promise<boolean | "unavailable"> {
  // Any error containing '42P01' (undefined_table) means Phase 4 hasn't shipped.
  // Using a loose cast — v2_trade_tickets is not in the generated Database type.
  const { count, error } = await (
    supabase.from("v2_trade_tickets" as never) as unknown as {
      select: (cols: string, opts: { count: "exact"; head: true }) => {
        eq: (k: string, v: string) => Promise<{
          count: number | null
          error: { code?: string; message: string } | null
        }>
      }
    }
  )
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)

  if (error) {
    if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
      return "unavailable"
    }
    // Any other error — treat as "no fill seen" so the audit is resilient.
    return false
  }
  return (count ?? 0) > 0
}

async function computeAgentMetrics(
  supabase: MinimalClient,
  agentId: string,
  windowDays: number
): Promise<AuditMetrics> {
  const since = new Date(Date.now() - windowDays * MS_PER_DAY).toISOString()

  // `direction` and `confirmed_return` are Phase 4 additions. Select them
  // loosely so a missing column doesn't crash the cron — the where clause
  // `confirmed_return is not null` filters them at the DB layer.
  const { data, error } = await (
    supabase.from("v2_signals") as unknown as {
      select: (cols: string) => {
        eq: (k: string, v: string) => {
          gte: (k: string, v: string) => {
            not: (k: string, op: string, v: null) => Promise<{
              data: SignalMetricRow[] | null
              error: { code?: string; message: string } | null
            }>
          }
        }
      }
    }
  )
    .select("agent_id, created_at, direction, confirmed_return")
    .eq("agent_id", agentId)
    .gte("created_at", since)
    .not("confirmed_return", "is", null)

  if (error || !data || data.length === 0) {
    return { ic: 0, tstat: 0, n: 0, sharpe: 0, days: 0, window: windowDays === 30 ? "30d" : "90d" }
  }

  const directions: number[] = []
  const returns: number[] = []
  let minMs = Infinity
  let maxMs = -Infinity

  for (const row of data) {
    const d = row.direction
    const r = row.confirmed_return
    if (d === null || r === null) continue
    directions.push(Math.sign(d))
    returns.push(r)
    const t = Date.parse(row.created_at)
    if (Number.isFinite(t)) {
      if (t < minMs) minMs = t
      if (t > maxMs) maxMs = t
    }
  }

  const n = directions.length
  if (n === 0) {
    return { ic: 0, tstat: 0, n: 0, sharpe: 0, days: 0, window: windowDays === 30 ? "30d" : "90d" }
  }

  const ic = pearsonIC(directions, returns)
  const t = tStat(ic, n)
  const sharpe = sharpeApprox(returns)
  const days =
    Number.isFinite(minMs) && Number.isFinite(maxMs)
      ? Math.max(1, Math.round((maxMs - minMs) / MS_PER_DAY))
      : 0

  return {
    ic,
    tstat: t,
    n,
    sharpe,
    days,
    window: windowDays === 30 ? "30d" : "90d",
  }
}

async function applyPromotion(
  supabase: MinimalClient,
  agentId: string,
  fromStatus: string,
  toStatus: string,
  metrics: AuditMetrics,
  reasons: string[],
  logger: (event: string, data: Record<string, unknown>) => void
): Promise<void> {
  await applyStageChange(
    supabase,
    agentId,
    fromStatus,
    toStatus,
    metrics,
    reasons,
    "promotion",
    logger
  )
}

async function applyStageChange(
  supabase: MinimalClient,
  agentId: string,
  fromStatus: string,
  toStatus: string,
  metrics: AuditMetrics,
  reasons: string[],
  kind: "promotion" | "retire",
  logger: (event: string, data: Record<string, unknown>) => void
): Promise<void> {
  // Idempotency: update only rows where status matches `fromStatus`.
  // If a parallel process already moved the agent, this is a no-op.
  const { error } = await (
    supabase.from("v2_agents") as unknown as {
      update: (v: Record<string, string>) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => Promise<{
            error: { code?: string; message: string } | null
          }>
        }
      }
    }
  )
    .update({ status: toStatus })
    .eq("id", agentId)
    .eq("status", fromStatus)

  if (error) {
    logger("integrity.audit.stage_change_failed", {
      agent_id: agentId,
      from: fromStatus,
      to: toStatus,
      message: error.message,
    })
    return
  }

  // Write the phase_promotion / stage_change marker event. The
  // v2_agents_status_change_trigger ALSO writes a status_change row.
  await writeEvent(supabase, {
    agent_id: agentId,
    event_type: kind === "promotion" ? "phase_promotion" : "stage_change",
    old_value: fromStatus,
    new_value: toStatus,
    reason: reasons.join("; "),
    context: metricsToJson(metrics, { kind }),
  })

  logger(
    kind === "promotion"
      ? "integrity.audit.promoted"
      : "integrity.audit.retired",
    {
      agent_id: agentId,
      from: fromStatus,
      to: toStatus,
      metrics,
      reasons,
    }
  )
}

type EventInput = {
  agent_id: string | null
  event_type: string
  old_value: string | null
  new_value: string | null
  reason: string
  context: Record<string, unknown>
  signal_id?: string | null
}

async function writeEvent(
  supabase: MinimalClient,
  input: EventInput
): Promise<void> {
  const actor: AuditActor = "cron:integrity-audit"
  // Cast: v2_integrity_events is not in the generated Database type yet.
  const { error } = await (
    supabase.from("v2_integrity_events" as never) as unknown as {
      insert: (row: Record<string, unknown>) => Promise<{
        error: { code?: string; message: string } | null
      }>
    }
  ).insert({
    agent_id: input.agent_id,
    signal_id: input.signal_id ?? null,
    event_type: input.event_type,
    old_value: input.old_value,
    new_value: input.new_value,
    reason: input.reason,
    actor,
    context: input.context,
  })

  if (error) {
    // Don't throw — the cron must not crash on audit-log errors. Just note it.
    // (Caller logs are upstream; we keep this silent to avoid noisy duplicates.)
  }
}

function metricsToJson(
  metrics: AuditMetrics,
  extra: Record<string, unknown>
): Record<string, unknown> {
  return {
    ic: metrics.ic,
    tstat: metrics.tstat,
    n: metrics.n,
    sharpe: metrics.sharpe,
    days: metrics.days,
    window: metrics.window,
    ...extra,
  }
}

function routeDecision(decision: AuditDecision, summary: AuditSummary): void {
  if (decision.kind === "promoted") {
    summary.promoted.push(decision)
  } else if (decision.kind === "retired") {
    summary.retired.push(decision)
  } else {
    summary.held.push(decision)
  }
}
