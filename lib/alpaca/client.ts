// Thin Alpaca REST wrapper — paper-trading only for Phase 4.
//
// No SDK dependency: the surface we consume is small (POST /v2/orders,
// GET /v2/account, GET /v2/orders), and `fetchWithRetry` from the
// ingestion framework already gives us backoff + retry + rate-limit for free.
//
// Safety:
//   - Module load must never throw: missing env returns `null` from
//     `alpacaClient()` so ingestion stays green.
//   - Live-trading is blocked at the client boundary: the base URL is
//     asserted to contain `paper-api` (flip one env var + remove the assert
//     when RIA registration is done; see docs/NEXT-SESSION-HANDOFF.md §4).

import "server-only"
import { fetchWithRetry, RateLimiter } from "@/lib/ingestion/http"

export const ALPACA_DEFAULT_BASE_URL = "https://paper-api.alpaca.markets"

// Alpaca's documented per-account REST limit is 200 req/min. Throttle well
// inside it so retries don't push us over.
const alpacaLimiter = new RateLimiter({ capacity: 3, refillPerSec: 3 })

export type AlpacaOrderRequest = {
  symbol: string
  side: "buy" | "sell"
  type: "market" | "limit"
  time_in_force: "day" | "gtc" | "opg" | "cls" | "ioc" | "fok"
  notional?: string
  qty?: string
  client_order_id: string
  limit_price?: string
}

export type AlpacaOrder = {
  id: string
  client_order_id: string
  created_at: string
  submitted_at: string | null
  filled_at: string | null
  canceled_at: string | null
  expired_at: string | null
  symbol: string
  side: "buy" | "sell"
  qty: string | null
  notional: string | null
  filled_qty: string
  filled_avg_price: string | null
  status: string
  type: string
  time_in_force: string
}

export type AlpacaAccount = {
  id: string
  account_number: string
  status: string
  currency: string
  equity: string
  cash: string
  buying_power: string
  pattern_day_trader: boolean
  daytrade_count: number
  daytrading_buying_power: string
  portfolio_value: string
}

export type AlpacaClient = {
  baseUrl: string
  createOrder: (req: AlpacaOrderRequest) => Promise<AlpacaCreateOrderResult>
  getAccount: () => Promise<AlpacaAccount>
  listOrders: (params: {
    status?: "open" | "closed" | "all"
    after?: string
    until?: string
    limit?: number
    direction?: "asc" | "desc"
  }) => Promise<AlpacaOrder[]>
  getOrderByClientId: (clientOrderId: string) => Promise<AlpacaOrder | null>
}

export type AlpacaCreateOrderResult =
  | { ok: true; order: AlpacaOrder }
  | { ok: false; status: number; code?: string; message: string; body: unknown }

function readEnv() {
  const keyId = process.env.ALPACA_API_KEY_ID?.trim()
  const secret = process.env.ALPACA_API_SECRET?.trim()
  const baseUrl =
    process.env.ALPACA_BASE_URL?.trim() || ALPACA_DEFAULT_BASE_URL
  if (!keyId || !secret) return null
  if (!/paper-api\./i.test(baseUrl)) {
    // Guardrail: Phase 4 is paper-only. Live trading is blocked on RIA
    // registration (handoff §4). If someone sets a live URL by accident
    // we fail closed rather than place live orders.
    return null
  }
  return { keyId, secret, baseUrl: baseUrl.replace(/\/+$/, "") }
}

function authHeaders(keyId: string, secret: string): Record<string, string> {
  return {
    "APCA-API-KEY-ID": keyId,
    "APCA-API-SECRET-KEY": secret,
    "Content-Type": "application/json",
    Accept: "application/json",
  }
}

/**
 * alpacaClient — returns a bound REST client, or `null` when env is absent
 * or the base URL isn't a recognized paper endpoint. Callers must handle
 * `null` by logging and no-op'ing; Phase 4's integrity contract requires
 * that a missing client never fails ingestion.
 */
export function alpacaClient(): AlpacaClient | null {
  const env = readEnv()
  if (!env) return null

  const headers = authHeaders(env.keyId, env.secret)

  async function createOrder(
    req: AlpacaOrderRequest
  ): Promise<AlpacaCreateOrderResult> {
    await alpacaLimiter.take()
    const res = await fetchWithRetry(
      `${env!.baseUrl}/v2/orders`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(req),
      },
      // 422 (rejection) is a business signal, not a transient failure —
      // don't retry those. 409 means "client_order_id already used" which
      // we treat as success (idempotency).
      { retryOn: (s) => s >= 500 && s !== 503 ? true : s === 429 }
    )

    const raw = await res.text()
    let body: unknown = raw
    try {
      body = raw ? JSON.parse(raw) : null
    } catch {
      body = raw
    }

    if (res.status === 409) {
      // Duplicate client_order_id — fetch the existing order so the caller
      // can reconcile without a second code path.
      const existing = await getOrderByClientId(req.client_order_id)
      if (existing) return { ok: true, order: existing }
      return {
        ok: false,
        status: 409,
        message: "duplicate client_order_id but no matching order found",
        body,
      }
    }

    if (!res.ok) {
      const b =
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>)
          : {}
      return {
        ok: false,
        status: res.status,
        code: typeof b.code === "string" ? b.code : undefined,
        message:
          typeof b.message === "string"
            ? b.message
            : `alpaca_${res.status}`,
        body,
      }
    }

    return { ok: true, order: body as AlpacaOrder }
  }

  async function getAccount(): Promise<AlpacaAccount> {
    await alpacaLimiter.take()
    const res = await fetchWithRetry(`${env!.baseUrl}/v2/account`, {
      method: "GET",
      headers,
    })
    if (!res.ok) {
      throw new Error(`alpaca_account_${res.status}`)
    }
    return (await res.json()) as AlpacaAccount
  }

  async function listOrders(params: {
    status?: "open" | "closed" | "all"
    after?: string
    until?: string
    limit?: number
    direction?: "asc" | "desc"
  }): Promise<AlpacaOrder[]> {
    const qs = new URLSearchParams()
    if (params.status) qs.set("status", params.status)
    if (params.after) qs.set("after", params.after)
    if (params.until) qs.set("until", params.until)
    if (params.limit) qs.set("limit", String(params.limit))
    if (params.direction) qs.set("direction", params.direction)

    await alpacaLimiter.take()
    const res = await fetchWithRetry(
      `${env!.baseUrl}/v2/orders?${qs.toString()}`,
      { method: "GET", headers }
    )
    if (!res.ok) {
      throw new Error(`alpaca_list_orders_${res.status}`)
    }
    return (await res.json()) as AlpacaOrder[]
  }

  async function getOrderByClientId(
    clientOrderId: string
  ): Promise<AlpacaOrder | null> {
    await alpacaLimiter.take()
    const res = await fetchWithRetry(
      `${env!.baseUrl}/v2/orders:by_client_order_id?client_order_id=${encodeURIComponent(
        clientOrderId
      )}`,
      { method: "GET", headers }
    )
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`alpaca_by_client_${res.status}`)
    return (await res.json()) as AlpacaOrder
  }

  return {
    baseUrl: env.baseUrl,
    createOrder,
    getAccount,
    listOrders,
    getOrderByClientId,
  }
}
