// Alpaca webhook receiver.
//
// Alpaca's native trade-events delivery is a streaming channel (SSE / WS)
// rather than HTTP webhooks — so in practice the `/api/cron/alpaca-poll`
// cron is what reconciles fills tonight. This endpoint stays live anyway
// for two reasons:
//   1. A thin bridge adapter (lambda, Cloudflare Worker, etc.) can forward
//      stream events to this URL, and the contract below already matches
//      Alpaca's trade-update payload.
//   2. It is the single source of truth for the integrity-events log row
//      `actor='trigger:alpaca-webhook'`, which the audit query in the
//      handoff references.
//
// Auth: `x-webhook-secret: $ALPACA_WEBHOOK_SECRET`. 401 if missing/mismatch.

import { NextResponse } from "next/server"
import { getServerClient } from "@/lib/supabase/server"
import type { TradeTicketStatus } from "@/lib/supabase/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type AlpacaTradeUpdate = {
  event?: string
  timestamp?: string
  price?: string
  qty?: string
  position_qty?: string
  order?: {
    id?: string
    client_order_id?: string
    symbol?: string
    side?: "buy" | "sell"
    filled_avg_price?: string | null
    filled_qty?: string
    status?: string
    submitted_at?: string | null
    filled_at?: string | null
    canceled_at?: string | null
    expired_at?: string | null
  }
}

function logEvent(event: string, data: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }))
  } catch {
    console.log(event, data)
  }
}

function mapStatus(s: string | undefined): TradeTicketStatus {
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

export async function POST(request: Request) {
  const expected = process.env.ALPACA_WEBHOOK_SECRET
  if (!expected) {
    logEvent("alpaca.webhook.misconfigured", {
      reason: "ALPACA_WEBHOOK_SECRET not set",
    })
    return NextResponse.json(
      { ok: false, error: "webhook_secret_not_configured" },
      { status: 503 }
    )
  }
  const provided = request.headers.get("x-webhook-secret") ?? ""
  if (provided !== expected) {
    logEvent("alpaca.webhook.unauthorized", {})
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    )
  }

  let payload: AlpacaTradeUpdate
  try {
    payload = (await request.json()) as AlpacaTradeUpdate
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    )
  }

  const order = payload.order
  const clientOrderId = order?.client_order_id
  if (!clientOrderId) {
    logEvent("alpaca.webhook.missing_client_order_id", { payload })
    return NextResponse.json(
      { ok: true, skipped: "missing_client_order_id" },
      { status: 200 }
    )
  }

  const supabase = getServerClient()
  if (!supabase) {
    logEvent("alpaca.webhook.supabase_unavailable", {})
    return NextResponse.json(
      { ok: false, error: "supabase_unavailable" },
      { status: 503 }
    )
  }

  // Look up the ticket that the router created when it placed the order.
  const lookup = await supabase
    .from("v2_trade_tickets")
    .select("id, agent_id, signal_id")
    .eq("client_order_id", clientOrderId)
    .maybeSingle()
  const lookupErr = lookup.error
  const existing = lookup.data as {
    id: string
    agent_id: string
    signal_id: string
  } | null

  if (lookupErr) {
    logEvent("alpaca.webhook.ticket_lookup_failed", {
      client_order_id: clientOrderId,
      message: lookupErr.message,
    })
    return NextResponse.json(
      { ok: false, error: "ticket_lookup_failed" },
      { status: 500 }
    )
  }

  if (!existing) {
    // The event arrived before the router's insert (extremely unlikely but
    // possible under retry storms). Acknowledge without writing; the
    // reconciler cron will catch it on the next tick.
    logEvent("alpaca.webhook.ticket_not_found", {
      client_order_id: clientOrderId,
    })
    return NextResponse.json(
      { ok: true, skipped: "ticket_not_found" },
      { status: 200 }
    )
  }

  const status = mapStatus(order?.status)
  const fields: Record<string, unknown> = {
    order_status: status,
    raw: payload as unknown as Record<string, unknown>,
  }
  if (order?.id) fields.alpaca_order_id = order.id
  if (order?.filled_avg_price)
    fields.filled_avg_price = Number(order.filled_avg_price)
  if (order?.filled_qty) fields.qty = Number(order.filled_qty)
  if (order?.filled_at) fields.filled_at = order.filled_at
  if (order?.submitted_at) fields.submitted_at = order.submitted_at

  const { error: updateErr } = await supabase
    .from("v2_trade_tickets")
    .update(fields as never)
    .eq("client_order_id", clientOrderId)

  if (updateErr) {
    logEvent("alpaca.webhook.ticket_update_failed", {
      client_order_id: clientOrderId,
      message: updateErr.message,
    })
    return NextResponse.json(
      { ok: false, error: "ticket_update_failed" },
      { status: 500 }
    )
  }

  // Integrity event — actor matches the string reserved in migration 0008
  // so the audit query `where actor='trigger:alpaca-webhook'` works.
  const eventType =
    status === "filled" || status === "partially_filled"
      ? "order_filled"
      : status === "rejected"
      ? "order_rejected"
      : status === "canceled" || status === "expired"
      ? "order_canceled"
      : "order_update"

  const { error: ieErr } = await supabase
    .from("v2_integrity_events" as never)
    .insert({
      agent_id: existing.agent_id,
      signal_id: existing.signal_id,
      event_type: eventType,
      actor: "trigger:alpaca-webhook",
      reason: payload.event ?? null,
      context: {
        client_order_id: clientOrderId,
        alpaca_order_id: order?.id,
        status,
        price: order?.filled_avg_price,
        qty: order?.filled_qty,
      },
    } as never)
  if (ieErr) {
    // Don't fail the webhook on audit write failure — retries are cheap,
    // the state in v2_trade_tickets is already consistent.
    logEvent("alpaca.webhook.integrity_event_failed", {
      message: ieErr.message,
    })
  }

  logEvent("alpaca.webhook.ok", {
    client_order_id: clientOrderId,
    event: payload.event,
    status,
  })
  return NextResponse.json({ ok: true, status }, { status: 200 })
}
