// In-memory circuit breaker keyed by agent_id.
// Trips after 3 consecutive failures; resets on a single success.
// State is also mirrored to `v2_agent_heartbeats.status` so the Floor UI
// can render a "degraded" badge when an agent is in the open state.

import "server-only"
import { getServerClient } from "@/lib/supabase/server"
import type { CircuitBreakerState } from "./types"

const FAILURE_THRESHOLD = 3

type InternalState = {
  consecutive_failures: number
  last_failure_at: number | null
  is_open: boolean
}

const registry = new Map<string, InternalState>()

function getOrInit(agent_id: string): InternalState {
  let s = registry.get(agent_id)
  if (!s) {
    s = { consecutive_failures: 0, last_failure_at: null, is_open: false }
    registry.set(agent_id, s)
  }
  return s
}

function toPublic(s: InternalState): CircuitBreakerState {
  return {
    consecutive_failures: s.consecutive_failures,
    last_failure_at: s.last_failure_at ? new Date(s.last_failure_at).toISOString() : null,
    is_open: s.is_open,
  }
}

export function readBreakerState(agent_id: string): CircuitBreakerState {
  return toPublic(getOrInit(agent_id))
}

async function writeHeartbeat(
  agent_id: string,
  status: "online" | "degraded"
): Promise<void> {
  const supabase = getServerClient()
  if (!supabase) return
  const payload = {
    agent_id,
    last_seen: new Date().toISOString(),
    status,
  }
  // Best-effort; breaker decisions must not fail because telemetry is down.
  const { error } = await supabase
    .from("v2_agent_heartbeats")
    .upsert(payload as never, { onConflict: "agent_id" })
  if (error) {
    // Intentionally swallowed — log to stderr for observability.
    console.warn(`[circuit-breaker] heartbeat write failed for ${agent_id}:`, error.message)
  }
}

export async function recordFailure(agent_id: string): Promise<CircuitBreakerState> {
  const s = getOrInit(agent_id)
  s.consecutive_failures += 1
  s.last_failure_at = Date.now()
  if (s.consecutive_failures >= FAILURE_THRESHOLD) {
    s.is_open = true
    await writeHeartbeat(agent_id, "degraded")
  }
  return toPublic(s)
}

export async function recordSuccess(agent_id: string): Promise<CircuitBreakerState> {
  const s = getOrInit(agent_id)
  const wasOpen = s.is_open
  s.consecutive_failures = 0
  s.last_failure_at = null
  s.is_open = false
  if (wasOpen) {
    await writeHeartbeat(agent_id, "online")
  }
  return toPublic(s)
}

/** Test hook — do not use in production code paths. */
export function __resetBreakersForTests(): void {
  registry.clear()
}
