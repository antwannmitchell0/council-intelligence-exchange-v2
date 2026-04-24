// Alpaca order-status reconciler.
//
// Runs every 15 minutes during US market hours. Alpaca's native trade-events
// are a streaming channel, not HTTP webhooks, so Vercel Cron can't subscribe
// directly. This cron closes the loop: pull recent orders, match them to
// v2_trade_tickets by client_order_id, and persist state changes.
//
// The same code path is used whether updates arrive via:
//   (a) this poll cron (default path tonight), or
//   (b) a future bridge forwarding stream events into /api/alpaca/webhook.
// Both write to v2_trade_tickets and v2_integrity_events with identical
// shape. The audit log treats them as equivalent sources of broker truth.

import { NextResponse } from "next/server"
import { getServerClient } from "@/lib/supabase/server"
import { alpacaClient, type AlpacaOrder } from "@/lib/alpaca/client"
import type { TradeTicketStatus } from "@/lib/supabase/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function logEvent(event: string, data: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }))
  } catch {
    console.log(event, data)
  }
}

function mapStatus(s: string): TradeTicketStatus {
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

function eventTypeFor(status: TradeTicketStatus): string {
  if (status === "filled" || status === "partially_filled") return "order_filled"
  if (status === "rejected") return "order_rejected"
  if (status === "canceled" || status === "expired") return "order_canceled"
  return "order_update"
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    logEvent("alpaca.poll.misconfigured", { reason: "cron_secret_not_configured" })
    return NextResponse.json(
      { ok: false, error: "cron_secret_not_configured" },
      { status: 503 }
    )
  }
  const auth = request.headers.get("authorization") ?? ""
  if (auth !== `Bearer ${expected}`) {
    logEvent("alpaca.poll.unauthorized", {})
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    )
  }

  const client = alpacaClient()
  if (!client) {
    logEvent("alpaca.poll.no_env", {})
    return NextResponse.json(
      { ok: true, skipped: "alpaca_env_missing" },
      { status: 200 }
    )
  }

  const supabase = getServerClient()
  if (!supabase) {
    logEvent("alpaca.poll.supabase_unavailable", {})
    return NextResponse.json(
      { ok: false, error: "supabase_unavailable" },
      { status: 503 }
    )
  }

  // Pull orders updated in the last 24h. Cron is every 15m so dedup is
  // cheap; 24h window is tolerant of extended Vercel cron drift + holidays.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let orders: AlpacaOrder[] = []
  try {
    orders = await client.listOrders({
      status: "all",
      after: since,
      limit: 500,
      direction: "desc",
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logEvent("alpaca.poll.list_failed", { message })
    return NextResponse.json(
      { ok: false, error: "list_orders_failed", message },
      { status: 500 }
    )
  }

  let reconciled = 0
  let skipped = 0
  let failed = 0

  for (const order of orders) {
    const clientOrderId = order.client_order_id
    if (!clientOrderId) {
      skipped += 1
      continue
    }

    const lookup = await supabase
      .from("v2_trade_tickets")
      .select("id, agent_id, signal_id, order_status")
      .eq("client_order_id", clientOrderId)
      .maybeSingle()
    const lookupErr = lookup.error
    const existing = lookup.data as {
      id: string
      agent_id: string
      signal_id: string
      order_status: TradeTicketStatus
    } | null

    if (lookupErr) {
      failed += 1
      logEvent("alpaca.poll.lookup_failed", {
        client_order_id: clientOrderId,
        message: lookupErr.message,
      })
      continue
    }
    if (!existing) {
      // Order exists at Alpaca but has no ticket locally. Could be a manual
      // test order placed from the dashboard — skip silently.
      skipped += 1
      continue
    }

    const status = mapStatus(order.status)
    if (status === existing.order_status) {
      skipped += 1
      continue
    }

    const fields: Record<string, unknown> = {
      order_status: status,
      alpaca_order_id: order.id,
      raw: order as unknown as Record<string, unknown>,
    }
    if (order.filled_avg_price)
      fields.filled_avg_price = Number(order.filled_avg_price)
    if (order.filled_qty) fields.qty = Number(order.filled_qty)
    if (order.filled_at) fields.filled_at = order.filled_at
    if (order.submitted_at) fields.submitted_at = order.submitted_at

    const { error: updateErr } = await supabase
      .from("v2_trade_tickets")
      .update(fields as never)
      .eq("client_order_id", clientOrderId)

    if (updateErr) {
      failed += 1
      logEvent("alpaca.poll.update_failed", {
        client_order_id: clientOrderId,
        message: updateErr.message,
      })
      continue
    }

    // Only one integrity row per status transition. Same contract as the
    // webhook path — actor string differs so we can tell which source
    // observed the fill first.
    const { error: ieErr } = await supabase
      .from("v2_integrity_events" as never)
      .insert({
        agent_id: existing.agent_id,
        signal_id: existing.signal_id,
        event_type: eventTypeFor(status),
        actor: "cron:alpaca-poll",
        old_value: existing.order_status,
        new_value: status,
        reason: "poll reconciliation",
        context: {
          client_order_id: clientOrderId,
          alpaca_order_id: order.id,
          price: order.filled_avg_price,
          qty: order.filled_qty,
        },
      } as never)
    if (ieErr) {
      logEvent("alpaca.poll.integrity_event_failed", {
        message: ieErr.message,
      })
    }

    reconciled += 1
  }

  logEvent("alpaca.poll.ok", {
    orders: orders.length,
    reconciled,
    skipped,
    failed,
  })

  return NextResponse.json(
    { ok: true, orders: orders.length, reconciled, skipped, failed },
    { status: 200 }
  )
}
