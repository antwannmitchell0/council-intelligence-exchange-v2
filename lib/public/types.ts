// Public-page shared types + pure helpers.
//
// Distinct from lib/public/operations.ts (which has `import "server-only"`).
// This file is safe to import from client components — types and pure
// formatters only.

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
  error?: string
}

export type PublicOpsSnapshot = {
  ok: boolean
  day_of_window: number
  total_window_days: number
  earliest_live_verified_iso: string
  signals_24h: number
  signals_lifetime: number
  active_agent_count: number
  paper_orders_lifetime: number
  paper_orders_filled_lifetime: number
  paper_orders_24h: number
  error?: string
}

export type PublicAgentEntry = {
  agent_id: string
  display_name: string
  description: string
  tier: "live" | "wiring" | "roadmap"
  signals_lifetime: number
  hours_since_last_signal: number | null
  hours_since_heartbeat: number | null
  // Below: scaffolded for the floor 3D rework (plan
  // /Users/antwannmitchellsr/.claude/plans/title-the-council-stays-cheeky-engelbart.md).
  // Optional today so the existing fetcher still satisfies the type;
  // promote to required once getPublicAgentRoster() is extended.
  //
  // Most recent signal body — TEXT column containing JSON. Parsed into a
  // human-readable snippet by the consumer (detail panel, speech bubble).
  last_signal_body?: string | null
  // Lifetime order counts from v2_trade_tickets (any status / filled).
  orders_submitted_lifetime?: number
  orders_filled_lifetime?: number
}

/** Format a "Xh ago" / "Xd ago" string from hours-since. Pure — safe on the client. */
export function formatRelativePublic(hours: number | null): string {
  if (hours == null) return "—"
  if (hours < 1) return "moments ago"
  if (hours < 36) return `${Math.round(hours)}h ago`
  if (hours < 72) return `${Math.round(hours / 24)}d ago`
  return `${Math.round(hours / 24)}d ago`
}
