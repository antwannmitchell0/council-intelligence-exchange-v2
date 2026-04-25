// Server-side data fetchers for the /admin command center's live panels.
//
// Two surfaces:
//   getHealthStatus()    → fetches /api/health from inside the deployment
//   getAgentFleetStatus() → reads heartbeats + 24h signal counts from Supabase
//
// Both are invoked at admin-page render time (the page is dynamic = force-
// dynamic so each refresh re-fetches). Failures are non-fatal — the page
// renders with degraded data rather than 500'ing.

import "server-only"
import { headers } from "next/headers"
import { getServerClient } from "@/lib/supabase/server"

// ---- Health endpoint -----------------------------------------------------

export type HealthCheck = {
  name: string
  ok: boolean
  latency_ms: number
  critical: boolean
  detail?: string
}

export type HealthStatus = {
  ok: boolean
  total_latency_ms: number
  checks: HealthCheck[]
  // Set when the fetch itself failed (network, timeout, etc.) — distinct
  // from a healthy "service is reachable but reporting degraded".
  error?: string
}

export async function getHealthStatus(): Promise<HealthStatus> {
  // Build the absolute URL — server-side fetch from inside the deployment
  // can't use a relative path. We pull the host from the incoming request
  // headers so this works on prod and any preview URL.
  let baseUrl: string
  try {
    const h = await headers()
    const host = h.get("host") ?? "localhost:3000"
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
    baseUrl = `${proto}://${host}`
  } catch {
    baseUrl = "http://localhost:3000"
  }

  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      cache: "no-store",
      // Tight timeout — admin page render can't hang on a slow dependency.
      signal: AbortSignal.timeout(8000),
    })
    const json = (await res.json()) as HealthStatus
    return json
  } catch (err) {
    return {
      ok: false,
      total_latency_ms: 0,
      checks: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ---- Agent fleet status --------------------------------------------------

export type AgentTier = "fresh" | "stale" | "down"

export type AgentFleetEntry = {
  agent_id: string
  display_name: string
  last_seen: string | null
  hours_since_seen: number | null
  tier: AgentTier
  signals_24h: number
}

const FRESH_HOURS = 36 // green: ran within last 36h (one daily tick + grace)
const STALE_HOURS = 72 // yellow: between 36–72h (one missed tick)

function tierFor(hoursSinceSeen: number | null): AgentTier {
  if (hoursSinceSeen == null) return "down"
  if (hoursSinceSeen <= FRESH_HOURS) return "fresh"
  if (hoursSinceSeen <= STALE_HOURS) return "stale"
  return "down"
}

// Display-name overrides — pretty labels for the fleet panel. agents
// already have display names in v2_agents.name but reading the heartbeat
// table doesn't pull those; we supply them inline to avoid a JOIN.
const DISPLAY_NAMES: Record<string, string> = {
  "insider-filing-agent": "SEC Insider Filing",
  "thirteen-f-agent": "SEC 13F (snapshots)",
  "thirteen-f-diff-agent": "SEC 13F (diffs)",
  "congress-agent": "Congress (eFDSearch)",
  "yield-curve-agent": "Yield Curve",
  "jobs-data-agent": "Jobs Data",
  "fed-futures-agent": "Fed Futures",
  "gdelt-event-volume-agent": "GDELT Event Volume",
  "wiki-edit-surge-agent": "Wiki Edit Surge",
  "etherscan-whale-agent": "Etherscan Whale",
  "clinical-trial-outcomes-agent": "Clinical Trials",
}

// The order we want to render the fleet in — clusters by data category.
const RENDER_ORDER: string[] = [
  "insider-filing-agent",
  "thirteen-f-agent",
  "thirteen-f-diff-agent",
  "congress-agent",
  "yield-curve-agent",
  "jobs-data-agent",
  "fed-futures-agent",
  "gdelt-event-volume-agent",
  "wiki-edit-surge-agent",
  "etherscan-whale-agent",
  "clinical-trial-outcomes-agent",
]

export async function getAgentFleetStatus(): Promise<AgentFleetEntry[]> {
  const supabase = getServerClient()
  if (!supabase) return []

  // 1) Heartbeats — last_seen per agent.
  const { data: heartbeats, error: hbErr } = await supabase
    .from("v2_agent_heartbeats")
    .select("agent_id, last_seen")
  if (hbErr) {
    console.warn("[admin/status] heartbeats fetch failed:", hbErr.message)
  }
  const heartbeatMap = new Map<string, string>()
  for (const r of (heartbeats ?? []) as Array<{
    agent_id: string
    last_seen: string
  }>) {
    heartbeatMap.set(r.agent_id, r.last_seen)
  }

  // 2) 24h signal counts — bucket by agent_id.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: signals, error: sigErr } = await supabase
    .from("v2_signals")
    .select("agent_id")
    .gte("created_at", since)
    .limit(50000)
  if (sigErr) {
    console.warn("[admin/status] signals fetch failed:", sigErr.message)
  }
  const countByAgent = new Map<string, number>()
  for (const s of signals ?? []) {
    const a = (s as { agent_id: string }).agent_id
    countByAgent.set(a, (countByAgent.get(a) ?? 0) + 1)
  }

  // 3) Build the fleet entries in render order.
  const now = Date.now()
  return RENDER_ORDER.map((agent_id) => {
    const last_seen = heartbeatMap.get(agent_id) ?? null
    let hours_since_seen: number | null = null
    if (last_seen) {
      const ms = Date.parse(last_seen)
      if (Number.isFinite(ms)) {
        hours_since_seen = (now - ms) / (60 * 60 * 1000)
      }
    }
    return {
      agent_id,
      display_name: DISPLAY_NAMES[agent_id] ?? agent_id,
      last_seen,
      hours_since_seen,
      tier: tierFor(hours_since_seen),
      signals_24h: countByAgent.get(agent_id) ?? 0,
    }
  })
}

/** Format hours-since-seen as a humane "4h ago" / "2d ago" string. */
export function formatRelative(hours: number | null): string {
  if (hours == null) return "never seen"
  if (hours < 1) return "<1h ago"
  if (hours < 48) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}

// ---- Revenue snapshot ----------------------------------------------------

export type RevenueStatus = {
  // True if v2_subscribers table is reachable. False = table missing
  // (migration 0016 not applied yet) or Supabase unreachable.
  ok: boolean
  active_subscribers: number
  past_due: number
  canceled: number
  // Current MRR assuming flat $49/mo Early Access tier. Will lift to a
  // real per-tier calculation once we have multiple tiers.
  mrr_usd: number
  // Last 7 days of new active subscribers — proxy for momentum.
  new_last_7d: number
  error?: string
}

const EARLY_ACCESS_PRICE_USD = 49

export async function getRevenueStatus(): Promise<RevenueStatus> {
  const supabase = getServerClient()
  if (!supabase) {
    return {
      ok: false,
      active_subscribers: 0,
      past_due: 0,
      canceled: 0,
      mrr_usd: 0,
      new_last_7d: 0,
      error: "supabase_unavailable",
    }
  }

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString()

  // Single query, returns all subscribers — we'll bucket in JS. v2_subscribers
  // grows slowly (subscribers, not signals), so reading the whole table is
  // fine for now. Lift to a SQL aggregate when we cross 10k rows.
  const { data, error } = await supabase
    .from("v2_subscribers")
    .select("status, tier, created_at")
    .limit(50000)

  if (error) {
    return {
      ok: false,
      active_subscribers: 0,
      past_due: 0,
      canceled: 0,
      mrr_usd: 0,
      new_last_7d: 0,
      error: error.message,
    }
  }

  let active = 0
  let pastDue = 0
  let canceled = 0
  let newLast7d = 0
  for (const r of (data ?? []) as Array<{
    status: string
    tier: string
    created_at: string
  }>) {
    if (r.status === "active") active += 1
    else if (r.status === "past_due") pastDue += 1
    else if (r.status === "canceled") canceled += 1
    if (r.created_at >= sevenDaysAgo && r.status !== "canceled") newLast7d += 1
  }

  return {
    ok: true,
    active_subscribers: active,
    past_due: pastDue,
    canceled,
    mrr_usd: active * EARLY_ACCESS_PRICE_USD,
    new_last_7d: newLast7d,
  }
}
