// Public live-operations data fetchers.
//
// Used by /hive, /trading, /exchange — surfaces that show "the system is
// running" without revealing the paid-tier signal contents. Subscribers
// see actual symbols + sides via daily digest + Discord; public visitors
// see *that* signals are flowing, *which* agents are active, and the
// 90-day verification clock.
//
// The Day-0 anchor is 2026-04-24 — the date the integrity contract
// started running. Earliest live-verified eligibility = Day 0 + 90 days.

import "server-only"
import { getServerClient } from "@/lib/supabase/server"
import type {
  HealthCheck,
  HealthStatus,
  PublicAgentEntry,
  PublicOpsSnapshot,
} from "./types"
export type {
  HealthCheck,
  HealthStatus,
  PublicAgentEntry,
  PublicOpsSnapshot,
} from "./types"
export { formatRelativePublic } from "./types"

export const COUNCIL_DAY_ZERO_ISO = "2026-04-24"
export const COUNCIL_DAY_ZERO_MS = Date.parse(`${COUNCIL_DAY_ZERO_ISO}T00:00:00Z`)
export const VERIFICATION_WINDOW_DAYS = 90

/**
 * The 11 ingest agent IDs — keep this in sync with lib/ingestion/registry.ts
 * Used to filter v2_agents queries down to actual trading specialists,
 * excluding the older vendor-service slate that lives in v2_agents from
 * pre-Phase-3 seed migrations.
 */
export const TRADING_AGENT_IDS: readonly string[] = [
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
] as const

export function dayOfWindow(now: Date = new Date()): number {
  const elapsedMs = now.getTime() - COUNCIL_DAY_ZERO_MS
  if (elapsedMs < 0) return 0
  // Day 1 is the first full day after Day 0.
  return Math.floor(elapsedMs / (24 * 60 * 60 * 1000)) + 1
}

export function earliestLiveVerifiedISO(): string {
  const earliest = new Date(
    COUNCIL_DAY_ZERO_MS + VERIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000
  )
  return earliest.toISOString().slice(0, 10)
}

export async function getPublicOpsSnapshot(): Promise<PublicOpsSnapshot> {
  const day = dayOfWindow()
  const earliest = earliestLiveVerifiedISO()

  const supabase = getServerClient()
  if (!supabase) {
    return {
      ok: false,
      day_of_window: day,
      total_window_days: VERIFICATION_WINDOW_DAYS,
      earliest_live_verified_iso: earliest,
      signals_24h: 0,
      signals_lifetime: 0,
      active_agent_count: 0,
      paper_orders_lifetime: 0,
      paper_orders_filled_lifetime: 0,
      paper_orders_24h: 0,
      error: "supabase_unavailable",
    }
  }

  const since24h = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString()

  // Two parallel head-only count queries — Supabase exposes count: "exact"
  // mode that returns just the row count without the data payload, fast
  // and cheap.
  const tradingFilter = `agent_id.in.(${TRADING_AGENT_IDS.join(",")})`

  const [signalsLifetime, signals24h, ordersLifetime, ordersFilledLifetime, orders24h, distinctAgents] =
    await Promise.all([
      supabase
        .from("v2_signals")
        .select("*", { count: "exact", head: true })
        .or(tradingFilter),
      supabase
        .from("v2_signals")
        .select("*", { count: "exact", head: true })
        .or(tradingFilter)
        .gte("created_at", since24h),
      supabase
        .from("v2_trade_tickets")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("v2_trade_tickets")
        .select("*", { count: "exact", head: true })
        .eq("order_status", "filled"),
      supabase
        .from("v2_trade_tickets")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since24h),
      // Agents that emitted at least one signal in the last 24h — proxy for
      // "active". Distinct count via fetch + de-dupe in JS (Supabase JS
      // doesn't expose count(distinct) directly).
      supabase
        .from("v2_signals")
        .select("agent_id")
        .or(tradingFilter)
        .gte("created_at", since24h)
        .limit(50000),
    ])

  const activeAgentSet = new Set<string>()
  for (const r of (distinctAgents.data ?? []) as Array<{ agent_id: string }>) {
    activeAgentSet.add(r.agent_id)
  }

  return {
    ok: true,
    day_of_window: day,
    total_window_days: VERIFICATION_WINDOW_DAYS,
    earliest_live_verified_iso: earliest,
    signals_24h: signals24h.count ?? 0,
    signals_lifetime: signalsLifetime.count ?? 0,
    active_agent_count: activeAgentSet.size,
    paper_orders_lifetime: ordersLifetime.count ?? 0,
    paper_orders_filled_lifetime: ordersFilledLifetime.count ?? 0,
    paper_orders_24h: orders24h.count ?? 0,
  }
}

// ---- Public agent roster -------------------------------------------------
// PublicAgentEntry type lives in ./types so client components can import
// it without pulling the server-only fetcher chain into their bundle.

const PUBLIC_AGENT_META: Array<{
  agent_id: string
  display_name: string
  description: string
  tier: "live" | "wiring"
}> = [
  {
    agent_id: "insider-filing-agent",
    display_name: "SEC Insider Filing",
    description:
      "Form 4 cluster-buy detector — 2+ insiders, same issuer, 30-day window. Lakonishok & Lee 2001 / Cohen, Malloy & Pomorski 2012.",
    tier: "live",
  },
  {
    agent_id: "thirteen-f-agent",
    display_name: "SEC 13F (snapshots)",
    description:
      "Institutional holdings — quarterly 13F-HR information tables, CUSIPs resolved to tickers via OpenFIGI.",
    tier: "live",
  },
  {
    agent_id: "thirteen-f-diff-agent",
    display_name: "SEC 13F (diffs)",
    description:
      "Quarter-over-quarter diff of 13F holdings. Emits NEW_ENTRY / EXIT / GROW / SHRINK with side populated.",
    tier: "wiring",
  },
  {
    agent_id: "congress-agent",
    display_name: "Congress (eFDSearch)",
    description:
      "Senate STOCK Act periodic transaction reports — direct from official Senate Clerk eFDSearch.",
    tier: "live",
  },
  {
    agent_id: "yield-curve-agent",
    display_name: "Yield Curve",
    description:
      "FRED 2Y / 10Y / 10Y-2Y spread. Estrella & Mishkin 1998; Engstrom & Sharpe 2018 near-term forward spread.",
    tier: "live",
  },
  {
    agent_id: "jobs-data-agent",
    display_name: "Jobs Data",
    description:
      "BLS monthly employment situation — nonfarm payrolls + unemployment rate macro signal.",
    tier: "live",
  },
  {
    agent_id: "fed-futures-agent",
    display_name: "Fed Futures",
    description:
      "FRED FEDFUNDS / DFEDTARU / DFEDTARL — Fed-funds futures proxy for monetary policy expectations.",
    tier: "live",
  },
  {
    agent_id: "gdelt-event-volume-agent",
    display_name: "GDELT Event Volume",
    description:
      "GDELT 2.0 global-news event-volume anomaly detector. Entity → ticker mapping bootstrap pending.",
    tier: "wiring",
  },
  {
    agent_id: "wiki-edit-surge-agent",
    display_name: "Wikipedia Edit Surge",
    description:
      "Wikimedia edit-velocity leading indicator. Entity → ticker mapping bootstrap pending.",
    tier: "wiring",
  },
  {
    agent_id: "etherscan-whale-agent",
    display_name: "Etherscan Whale",
    description:
      "On-chain ERC-20 + ETH whale transaction detector. Alpaca crypto routing pending.",
    tier: "wiring",
  },
  {
    agent_id: "clinical-trial-outcomes-agent",
    display_name: "Clinical Trials",
    description:
      "ClinicalTrials.gov status-transition biotech catalyst signal. Sponsor → ticker mapping pending.",
    tier: "wiring",
  },
]

export async function getPublicAgentRoster(): Promise<PublicAgentEntry[]> {
  const supabase = getServerClient()
  if (!supabase) {
    return PUBLIC_AGENT_META.map((m) => ({
      ...m,
      signals_lifetime: 0,
      hours_since_last_signal: null,
      hours_since_heartbeat: null,
    }))
  }

  // Per-agent lifetime count via parallel head-only queries — one per
  // agent. Cheap (count: exact + head: true returns just an integer)
  // and avoids reading 12k+ rows into memory just to bucket them.
  const lifetimeCountPromises = PUBLIC_AGENT_META.map((m) =>
    supabase
      .from("v2_signals")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", m.agent_id)
      .then((r) => ({ agent_id: m.agent_id, count: r.count ?? 0 }))
  )

  // Per-agent most-recent signal timestamp — one row each, ordered
  // descending. Limit 1 = single row return.
  const lastSignalPromises = PUBLIC_AGENT_META.map((m) =>
    supabase
      .from("v2_signals")
      .select("created_at")
      .eq("agent_id", m.agent_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => ({
        agent_id: m.agent_id,
        last_signal_at: (r.data as { created_at?: string } | null)?.created_at ?? null,
      }))
  )

  // Heartbeats — single query for all agents.
  const heartbeatPromise = supabase
    .from("v2_agent_heartbeats")
    .select("agent_id, last_seen")

  const [lifetimes, lastSignals, heartbeats] = await Promise.all([
    Promise.all(lifetimeCountPromises),
    Promise.all(lastSignalPromises),
    heartbeatPromise,
  ])

  const lifetimeMap = new Map<string, number>()
  for (const r of lifetimes) lifetimeMap.set(r.agent_id, r.count)

  const lastSignalMap = new Map<string, string | null>()
  for (const r of lastSignals)
    lastSignalMap.set(r.agent_id, r.last_signal_at)

  const heartbeatMap = new Map<string, string>()
  for (const r of (heartbeats.data ?? []) as Array<{
    agent_id: string
    last_seen: string
  }>) {
    heartbeatMap.set(r.agent_id, r.last_seen)
  }

  const now = Date.now()
  function hoursSince(iso: string | null | undefined): number | null {
    if (!iso) return null
    const ms = Date.parse(iso)
    if (!Number.isFinite(ms)) return null
    return (now - ms) / (60 * 60 * 1000)
  }

  return PUBLIC_AGENT_META.map((m) => ({
    ...m,
    signals_lifetime: lifetimeMap.get(m.agent_id) ?? 0,
    hours_since_last_signal: hoursSince(lastSignalMap.get(m.agent_id) ?? null),
    hours_since_heartbeat: hoursSince(heartbeatMap.get(m.agent_id) ?? null),
  }))
}

// formatRelativePublic moved to ./types — re-exported above for callers
// that import from this module path.
