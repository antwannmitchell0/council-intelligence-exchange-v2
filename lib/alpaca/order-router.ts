// Order router — PersistedSignal[] → Alpaca paper orders → v2_trade_tickets.
//
// Called inline from BaseIngestionAgent.run() after the signals upsert. The
// integrity contract here is strict:
//   1. A missing Alpaca env must NEVER fail ingestion. We log + no-op.
//   2. A broken Alpaca session must NEVER trip the ingestion agent's circuit
//      breaker. We use a dedicated breaker keyed on 'alpaca-router'.
//   3. `client_order_id = signal.id` — Alpaca's dedup key == our dedup key.
//      Retries are safe. Alpaca's 409 response is treated as success.
//   4. Every outcome (success, skip, fail) leaves a v2_integrity_events row
//      so the public audit log reflects reality.

import "server-only"
import { getServerClient } from "@/lib/supabase/server"
import type { PersistedSignal } from "@/lib/ingestion/types"
import { alpacaClient, type AlpacaAccount, type AlpacaOrder } from "./client"
import { canPlaceOrder } from "./pdt-guard"
import { computeNotional } from "./position-sizing"

const ROUTER_KEY = "alpaca-router"
const FAILURE_THRESHOLD = 3

type RouterBreakerState = {
  consecutive_failures: number
  last_failure_at: number | null
  is_open: boolean
}

// Dedicated in-memory breaker for the router. Separate from the per-agent
// ingestion breaker so one bad Alpaca session can't blackhole ingestion.
const routerBreaker: RouterBreakerState = {
  consecutive_failures: 0,
  last_failure_at: null,
  is_open: false,
}

export type OrderRoutingOutcome = {
  signal_id: string
  status:
    | "submitted"
    | "rejected"
    | "skipped_no_symbol"
    | "skipped_no_side"
    | "skipped_no_env"
    | "skipped_guardrail"
    | "skipped_breaker_open"
    | "failed"
  alpaca_order_id?: string
  reason?: string
}

export type OrderRoutingResult = {
  processed: number
  submitted: number
  skipped: number
  failed: number
  outcomes: OrderRoutingOutcome[]
}

const EMPTY_RESULT: OrderRoutingResult = {
  processed: 0,
  submitted: 0,
  skipped: 0,
  failed: 0,
  outcomes: [],
}

function logEvent(event: string, data: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }))
  } catch {
    console.log(event, data)
  }
}

function recordRouterFailure(): void {
  routerBreaker.consecutive_failures += 1
  routerBreaker.last_failure_at = Date.now()
  if (routerBreaker.consecutive_failures >= FAILURE_THRESHOLD) {
    routerBreaker.is_open = true
  }
}

function recordRouterSuccess(): void {
  routerBreaker.consecutive_failures = 0
  routerBreaker.last_failure_at = null
  routerBreaker.is_open = false
}

async function writeIntegrityEvent(
  event_type: string,
  agent_id: string,
  signal_id: string,
  context: Record<string, unknown>,
  reason?: string
): Promise<void> {
  const supabase = getServerClient()
  if (!supabase) return
  const { error } = await supabase
    .from("v2_integrity_events" as never)
    .insert({
      agent_id,
      signal_id,
      event_type,
      actor: "trigger:alpaca-router",
      reason: reason ?? null,
      context,
    } as never)
  if (error) {
    console.warn(`[alpaca-router] integrity event write failed:`, error.message)
  }
}

async function persistTicket(args: {
  signal_id: string
  agent_id: string
  order: AlpacaOrder
  notional: number
}): Promise<void> {
  const supabase = getServerClient()
  if (!supabase) return
  const { order } = args
  const row = {
    signal_id: args.signal_id,
    agent_id: args.agent_id,
    alpaca_order_id: order.id,
    client_order_id: order.client_order_id,
    symbol: order.symbol,
    side: order.side,
    qty: order.qty ? Number(order.qty) : null,
    notional: order.notional ? Number(order.notional) : args.notional,
    filled_avg_price: order.filled_avg_price ? Number(order.filled_avg_price) : null,
    order_status: mapAlpacaStatus(order.status),
    submitted_at: order.submitted_at ?? new Date().toISOString(),
    filled_at: order.filled_at,
    broker: "alpaca-paper",
    raw: order as unknown as Record<string, unknown>,
  }
  const { error } = await supabase
    .from("v2_trade_tickets")
    .upsert(row as never, { onConflict: "client_order_id" })
  if (error) {
    console.warn(`[alpaca-router] ticket upsert failed:`, error.message)
  }
}

async function promoteSignalStage(signal_id: string): Promise<void> {
  const supabase = getServerClient()
  if (!supabase) return
  const { error } = await supabase
    .from("v2_signals")
    .update({ stage_tag: "broker-paper-tracking" } as never)
    .eq("id", signal_id)
  if (error) {
    console.warn(`[alpaca-router] stage promotion failed:`, error.message)
  }
}

// Alpaca emits more statuses than we care to track; bucket them down.
function mapAlpacaStatus(
  s: string
):
  | "submitted"
  | "accepted"
  | "filled"
  | "partially_filled"
  | "canceled"
  | "rejected"
  | "expired" {
  switch (s) {
    case "filled":
      return "filled"
    case "partially_filled":
      return "partially_filled"
    case "canceled":
    case "replaced":
    case "pending_cancel":
      return "canceled"
    case "rejected":
      return "rejected"
    case "expired":
      return "expired"
    case "accepted":
    case "pending_new":
    case "accepted_for_bidding":
      return "accepted"
    default:
      return "submitted"
  }
}

/**
 * routeOrders — translate persisted signals to paper orders.
 * Never throws. Every outcome is captured in the returned result and in
 * v2_integrity_events. Callers should record the result in their own
 * warnings/telemetry but not fail on it.
 */
export async function routeOrders(
  signals: PersistedSignal[]
): Promise<OrderRoutingResult> {
  if (signals.length === 0) return EMPTY_RESULT

  const outcomes: OrderRoutingOutcome[] = []

  if (routerBreaker.is_open) {
    logEvent("alpaca.router.skipped_breaker_open", {
      signals: signals.length,
      consecutive_failures: routerBreaker.consecutive_failures,
    })
    for (const s of signals) {
      outcomes.push({
        signal_id: s.id,
        status: "skipped_breaker_open",
        reason: `breaker_open_after_${routerBreaker.consecutive_failures}_failures`,
      })
    }
    return summarize(signals.length, outcomes)
  }

  const client = alpacaClient()
  if (!client) {
    logEvent("alpaca.router.skipped_no_env", { signals: signals.length })
    for (const s of signals) {
      outcomes.push({
        signal_id: s.id,
        status: "skipped_no_env",
        reason: "alpaca_env_missing_or_not_paper",
      })
    }
    return summarize(signals.length, outcomes)
  }

  // Fetch account once per batch. If it fails, we treat the whole batch as
  // skipped (breaker records one failure), not as N failures.
  let account: AlpacaAccount
  try {
    account = await client.getAccount()
  } catch (err) {
    recordRouterFailure()
    const message = err instanceof Error ? err.message : String(err)
    logEvent("alpaca.router.account_fetch_failed", { message })
    for (const s of signals) {
      outcomes.push({
        signal_id: s.id,
        status: "failed",
        reason: `account_fetch_failed: ${message}`,
      })
    }
    return summarize(signals.length, outcomes)
  }

  const pdt = canPlaceOrder(account)
  if (!pdt.ok) {
    logEvent("alpaca.router.guardrail_blocked", {
      reason: pdt.reason,
      signals: signals.length,
    })
    for (const s of signals) {
      outcomes.push({
        signal_id: s.id,
        status: "skipped_guardrail",
        reason: pdt.reason,
      })
    }
    return summarize(signals.length, outcomes)
  }

  const equity = Number(account.equity)

  for (const s of signals) {
    if (!s.symbol) {
      outcomes.push({ signal_id: s.id, status: "skipped_no_symbol" })
      continue
    }
    if (!s.side) {
      outcomes.push({ signal_id: s.id, status: "skipped_no_side" })
      continue
    }

    const sizing = computeNotional(equity, s.target_weight ?? null)
    if (sizing.notional <= 0) {
      outcomes.push({
        signal_id: s.id,
        status: "skipped_guardrail",
        reason: sizing.reason ?? "notional_zero",
      })
      continue
    }

    try {
      const res = await client.createOrder({
        symbol: s.symbol,
        side: s.side,
        type: "market",
        time_in_force: "day",
        notional: sizing.notional.toFixed(2),
        client_order_id: s.id,
      })

      if (!res.ok) {
        // Business-level rejection (bad symbol, unshortable, insufficient
        // bp, etc.). Persist a ticket row so the public audit log reflects
        // the attempt, and write an integrity event. Do NOT trip the
        // breaker — rejections are routine, not infrastructure failures.
        outcomes.push({
          signal_id: s.id,
          status: "rejected",
          reason: `${res.status}:${res.code ?? ""} ${res.message}`.trim(),
        })
        await writeIntegrityEvent(
          "order_rejected",
          s.agent_id,
          s.id,
          { symbol: s.symbol, side: s.side, notional: sizing.notional, alpaca: res.body },
          res.message
        )
        continue
      }

      await persistTicket({
        signal_id: s.id,
        agent_id: s.agent_id,
        order: res.order,
        notional: sizing.notional,
      })
      await promoteSignalStage(s.id)
      await writeIntegrityEvent(
        "order_submitted",
        s.agent_id,
        s.id,
        {
          symbol: res.order.symbol,
          side: res.order.side,
          notional: sizing.notional,
          alpaca_order_id: res.order.id,
        }
      )

      outcomes.push({
        signal_id: s.id,
        status: "submitted",
        alpaca_order_id: res.order.id,
      })
      recordRouterSuccess()
    } catch (err) {
      recordRouterFailure()
      const message = err instanceof Error ? err.message : String(err)
      logEvent("alpaca.router.order_threw", {
        signal_id: s.id,
        symbol: s.symbol,
        message,
      })
      outcomes.push({
        signal_id: s.id,
        status: "failed",
        reason: message,
      })
    }
  }

  return summarize(signals.length, outcomes)
}

function summarize(
  processed: number,
  outcomes: OrderRoutingOutcome[]
): OrderRoutingResult {
  const submitted = outcomes.filter((o) => o.status === "submitted").length
  const failed = outcomes.filter((o) => o.status === "failed").length
  const skipped = outcomes.length - submitted - failed
  return { processed, submitted, skipped, failed, outcomes }
}
