// CongressAgent — Congressional stock-trade disclosures.
//
// Thesis
//   Senator / Representative stock transactions, as mandated by the
//   STOCK Act (2012), have been shown to exhibit abnormal return (Ziobrowski
//   et al. 2004, 2011). Tracking bipartisan, bulk, or first-time-entry
//   positions has residual information content even after the act's 45-day
//   disclosure window — especially for committee chairs with subject-matter
//   jurisdiction.
//
// Data source — design decision
//   Two free options were considered:
//     1. Senate Stock Watcher — `https://senatestockwatcher.com/api/v1/transactions`
//        (community-maintained JSON mirror of Senate eFD disclosures, stable,
//         no auth, reasonable uptime).
//     2. Capitol Trades — web-scrape of public pages. Their robots.txt and
//        ToS discourage scraping for commercial use, and the data is behind
//        a rate-limiter that trips aggressively. Legal exposure is higher
//        than the incremental coverage is worth for Phase 3.
//
//   We ship Senate Stock Watcher only. House-side (Clerk PDFs) is left for a
//   dedicated future agent with a PDF-extraction pipeline. This is a
//   pragmatic Phase 3 scope cut — captured in the returned record's `chamber`
//   field for later coverage-gap analysis.
//
// External ID
//   Deterministic hash of (representative, transaction_date, ticker,
//   transaction_type, amount_range) — these five together form a stable
//   row identity inside Senate Stock Watcher even when upstream mutates
//   cosmetic columns.

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, RateLimiter } from "../http"
import type { NormalizedSignal, OrderSide, RawSignal } from "../types"

// Senate Stock Watcher's `type` field is free-text but converges on a few
// canonical strings. Map defensively — unknown values return null so the
// router skips rather than guessing wrong.
function parseSide(transactionType: string): OrderSide | null {
  const t = transactionType.toLowerCase()
  if (t.includes("purchase") || t.startsWith("buy")) return "buy"
  if (t.includes("sale") || t.startsWith("sell")) return "sell"
  return null
}

function normalizeTicker(raw: string | null): string | null {
  if (!raw) return null
  const t = raw.trim().toUpperCase()
  if (!t || t === "--" || t === "N/A") return null
  // Alpaca doesn't trade non-US tickers; the community feed occasionally
  // emits things like "BRK.B" — that's valid Alpaca symbol format.
  // Filter anything with whitespace or obvious junk.
  if (/\s/.test(t)) return null
  return t
}

const SOURCE_ID = "senate-stock-watcher"
const AGENT_ID = "congress-agent"

const ENDPOINT = "https://senatestockwatcher.com/api/v1/transactions"

// Community API — generous but not infinite. Cap at 2 req/s.
const senateLimiter = new RateLimiter({ capacity: 2, refillPerSec: 2 })

type SenateTxn = {
  senator?: string
  ticker?: string | null
  transaction_date?: string
  type?: string
  amount?: string
  asset_description?: string
  disclosure_date?: string
  party?: string | null
  comment?: string | null
}

type CongressPayload = {
  representative: string
  chamber: "senate" | "house"
  party: string | null
  ticker: string | null
  transaction_date: string
  transaction_type: string
  amount_range_usd: string
  disclosure_date: string | null
  asset_description: string | null
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function isTxnArray(v: unknown): v is SenateTxn[] {
  return Array.isArray(v)
}

export class CongressAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  protected async fetch(): Promise<RawSignal[]> {
    await senateLimiter.take()

    const res = await fetchWithRetry(ENDPOINT, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Council-Intelligence-Exchange-v2/CongressAgent (research use)",
      },
    })

    if (!res.ok) {
      throw new Error(
        `Senate Stock Watcher returned ${res.status} ${res.statusText}`
      )
    }

    const json: unknown = await res.json()
    // The community API occasionally ships the array inside `transactions`
    // and occasionally at the top level. Handle both defensively without
    // breaking strict typing.
    let items: SenateTxn[] = []
    if (isTxnArray(json)) {
      items = json
    } else if (
      json &&
      typeof json === "object" &&
      isTxnArray((json as { transactions?: unknown }).transactions)
    ) {
      items = (json as { transactions: SenateTxn[] }).transactions
    }

    const out: RawSignal<CongressPayload>[] = []
    for (const t of items) {
      const representative = toStr(t.senator).trim()
      const txnDate = toStr(t.transaction_date).trim()
      const txnType = toStr(t.type).trim()
      const amount = toStr(t.amount).trim()
      if (!representative || !txnDate || !txnType) continue

      const payload: CongressPayload = {
        representative,
        chamber: "senate",
        party: t.party ?? null,
        ticker: t.ticker ?? null,
        transaction_date: txnDate,
        transaction_type: txnType,
        amount_range_usd: amount,
        disclosure_date: t.disclosure_date ?? null,
        asset_description: t.asset_description ?? null,
      }

      out.push({
        source_id: SOURCE_ID,
        fetched_at: new Date().toISOString(),
        payload,
      })
    }
    return out
  }

  protected parse(raw: RawSignal[]): NormalizedSignal[] {
    const out: NormalizedSignal[] = []
    for (const r of raw) {
      const p = r.payload as CongressPayload
      const external_id = buildExternalId([
        SOURCE_ID,
        p.representative,
        p.transaction_date,
        p.ticker ?? "",
        p.transaction_type,
        p.amount_range_usd,
      ])

      const body = JSON.stringify({
        representative: p.representative,
        chamber: p.chamber,
        party: p.party,
        ticker: p.ticker,
        transaction_date: p.transaction_date,
        transaction_type: p.transaction_type,
        amount_range_usd: p.amount_range_usd,
        disclosure_date: p.disclosure_date,
        asset_description: p.asset_description,
      })

      const symbol = normalizeTicker(p.ticker)
      const side = parseSide(p.transaction_type)

      out.push({
        agent_id: AGENT_ID,
        source_id: SOURCE_ID,
        external_id,
        body,
        confidence: null,
        source_url: "https://senatestockwatcher.com",
        status: "pending",
        symbol,
        side: symbol ? side : null,
        target_weight: null,
      })
    }
    return out
  }
}
