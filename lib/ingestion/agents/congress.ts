// CongressAgent — Senate Periodic Transaction Reports (PTRs).
//
// Thesis
//   Senator stock transactions, as mandated by the STOCK Act (2012), have
//   been shown to exhibit abnormal return (Ziobrowski et al. 2004, 2011).
//   Tracking bipartisan, bulk, or first-time-entry positions has residual
//   information content even after the act's 45-day disclosure window —
//   especially for committee chairs with subject-matter jurisdiction.
//
// Data source — design decision (2026-04-24)
//   Original source — Senate Stock Watcher (`senatestockwatcher.com`) —
//   went permanently offline; domain no longer resolves. Capitol Trades
//   was rejected on ToS grounds (commercial-scrape exposure). GitHub
//   community mirrors are volunteer-dependent and the dead upstream proves
//   how that fails.
//
//   Replacement: official Senate eFDSearch system (`efdsearch.senate.gov`).
//   Public US-government data, no commercial-use restriction, no API key.
//
//   Three-step fetch flow:
//     1. GET  /search/home/         → initial CSRF + session cookie
//     2. POST /search/home/         → accept TOS agreement, get fresh CSRF
//     3. POST /search/report/data/  → DataTables-style JSON list of recent
//                                     PTR filings (just the report metadata)
//     4. GET  /search/view/ptr/<uuid>/ for each → HTML table of the actual
//                                                 transactions inside the PTR
//
//   We track cookies in an instance-level Map and pass them on every
//   subsequent request. CSRF tokens are scraped from the page HTML.
//
//   House-side disclosures live behind Clerk PDF processing — separate
//   future agent. We tag every emitted row with `chamber: "senate"` so a
//   future house agent can co-exist without a schema change.
//
// External ID
//   Deterministic hash of (representative, transaction_date, ticker,
//   transaction_type, amount_range) — these five together form a stable
//   row identity even when upstream mutates cosmetic columns.

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, RateLimiter } from "../http"
import type { NormalizedSignal, OrderSide, RawSignal } from "../types"

// Senate eFDSearch transaction-type strings. Defensive mapping —
// unknown values return null so the router skips rather than guessing.
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
  if (/\s/.test(t)) return null
  return t
}

// SOURCE_ID is preserved from the original Senate Stock Watcher wiring —
// the *logical* source (Senate STOCK Act disclosures) is unchanged; only
// the upstream gateway swapped from the community mirror to the official
// eFDSearch system. Keeping the same source_id preserves FK references in
// v2_sources + dedup continuity for any rows that historically came from
// the community mirror.
const SOURCE_ID = "senate-stock-watcher"
const AGENT_ID = "congress-agent"

const BASE_URL = "https://efdsearch.senate.gov"
const HOME_URL = `${BASE_URL}/search/home/`
const SEARCH_URL = `${BASE_URL}/search/`
const DATA_URL = `${BASE_URL}/search/report/data/`

// Browser-like UA — eFDSearch's CSRF + session pipeline gates obvious bot UAs.
// This agent identifies as a research client; matches the spirit of the
// public-data charter without spoofing a specific browser version that
// would rot.
const USER_AGENT =
  "Mozilla/5.0 (compatible; Council-Intelligence-Exchange-v2/CongressAgent; research; contact via SEC_USER_AGENT env)"

// eFDSearch is anonymous — no documented rate limit, but we self-throttle
// to be a polite citizen since the detail-page loop can run dozens of GETs.
const senateLimiter = new RateLimiter({ capacity: 2, refillPerSec: 2 })

// Senate filer_type=1 = Senator. report_type=11 = Periodic Transaction Report.
const FILTER_FILER_TYPES = "[1]"
const FILTER_REPORT_TYPES = "[11]"

// How far back we look on each cron tick. The disclosure window is 45 days
// from transaction; PTRs are filed irregularly. A 7-day backstop catches
// late-Friday filings even when the cron last ran Monday and dedup handles
// any overlap.
const LOOKBACK_HOURS = 7 * 24

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

type DataTablesResponse = {
  data?: Array<Array<string>>
  recordsTotal?: number
  recordsFiltered?: number
  result?: string
}

function extractCsrf(html: string): string | null {
  const m = html.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)
  return m ? m[1] : null
}

// eFDSearch expects MM/DD/YYYY HH:MM:SS in submitted_start_date / end_date.
function formatEfdDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const yyyy = d.getFullYear()
  const HH = String(d.getHours()).padStart(2, "0")
  const MM = String(d.getMinutes()).padStart(2, "0")
  const SS = String(d.getSeconds()).padStart(2, "0")
  return `${mm}/${dd}/${yyyy} ${HH}:${MM}:${SS}`
}

// Strip HTML tags + decode the few entities eFDSearch emits.
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

// Parse the transaction table from a PTR detail page. Column order is
// fixed by the eFDSearch template: # | Transaction Date | Owner | Ticker |
// Asset Name | Asset Type | Type | Amount | Comment.
function parsePtrTransactions(
  html: string,
  representative: string
): CongressPayload[] {
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)
  if (!tbodyMatch) return []
  const tbody = tbodyMatch[1]

  const out: CongressPayload[] = []
  for (const rowMatch of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cellMatches = [
      ...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi),
    ]
    const cells = cellMatches.map((m) => stripHtml(m[1]))
    if (cells.length < 9) continue

    // cells[0] is the row number; we don't need it.
    const [, txnDate, , ticker, assetName, , txnType, amount] = cells
    if (!txnDate || !txnType) continue

    out.push({
      representative,
      chamber: "senate",
      party: null,
      ticker: ticker && ticker !== "--" ? ticker : null,
      transaction_date: txnDate,
      transaction_type: txnType,
      amount_range_usd: amount || "",
      disclosure_date: null,
      asset_description: assetName && assetName !== "--" ? assetName : null,
    })
  }
  return out
}

export class CongressAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  private cookieJar = new Map<string, string>()

  private mergeSetCookies(res: Response): void {
    // Node 19.7+ exposes getSetCookie(); Vercel runs Node 24 LTS by default.
    const setCookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : []
    for (const sc of setCookies) {
      const m = sc.match(/^([^=]+)=([^;]*)/)
      if (m) this.cookieJar.set(m[1], m[2])
    }
  }

  private cookieHeader(): string {
    return Array.from(this.cookieJar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ")
  }

  private baseHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
      ...extra,
    }
    const cookie = this.cookieHeader()
    if (cookie) headers["Cookie"] = cookie
    return headers
  }

  protected async fetch(): Promise<RawSignal[]> {
    // Reset cookies per run — keeps cron ticks isolated and avoids stale
    // session state across container reuse.
    this.cookieJar = new Map()

    // Step 1: GET /search/home/ — pickup CSRF cookie + initial CSRF token.
    await senateLimiter.take()
    const homeRes = await fetchWithRetry(HOME_URL, {
      method: "GET",
      headers: this.baseHeaders({ Accept: "text/html" }),
    })
    if (!homeRes.ok) {
      throw new Error(
        `eFDSearch GET /search/home/ returned ${homeRes.status} ${homeRes.statusText}`
      )
    }
    this.mergeSetCookies(homeRes)
    const homeHtml = await homeRes.text()
    const initialCsrf = extractCsrf(homeHtml)
    if (!initialCsrf) {
      throw new Error("eFDSearch home page missing csrfmiddlewaretoken")
    }

    // Step 2: POST /search/home/ — accept the TOS agreement. We use manual
    // redirect handling so we can capture the Set-Cookie header from the
    // 302 (the agreement-accepted session cookie) before native fetch
    // drops it across an automatic redirect chain.
    await senateLimiter.take()
    const agreementRes = await fetchWithRetry(HOME_URL, {
      method: "POST",
      headers: this.baseHeaders({
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: HOME_URL,
        Accept: "text/html",
      }),
      body: new URLSearchParams({
        csrfmiddlewaretoken: initialCsrf,
        prohibition_agreement: "1",
      }).toString(),
      redirect: "manual",
    })
    // 200 (some setups), 302 (canonical), or 303 are all acceptable here.
    if (agreementRes.status >= 400) {
      throw new Error(
        `eFDSearch POST agreement returned ${agreementRes.status} ${agreementRes.statusText}`
      )
    }
    this.mergeSetCookies(agreementRes)

    // Step 2b: GET /search/ with the now-warm cookie jar to fetch the
    // search page + a fresh CSRF token bound to the post-agreement session.
    await senateLimiter.take()
    const searchPageRes = await fetchWithRetry(SEARCH_URL, {
      method: "GET",
      headers: this.baseHeaders({
        Accept: "text/html",
        Referer: HOME_URL,
      }),
    })
    if (!searchPageRes.ok) {
      throw new Error(
        `eFDSearch GET /search/ returned ${searchPageRes.status} ${searchPageRes.statusText}`
      )
    }
    this.mergeSetCookies(searchPageRes)
    const searchHtml = await searchPageRes.text()
    const searchCsrf = extractCsrf(searchHtml)
    if (!searchCsrf) {
      throw new Error("eFDSearch /search/ page missing csrfmiddlewaretoken")
    }

    // Step 3: POST /search/report/data/ — DataTables JSON of recent PTRs.
    const end = new Date()
    const start = new Date(end.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000)

    await senateLimiter.take()
    const dataRes = await fetchWithRetry(DATA_URL, {
      method: "POST",
      headers: this.baseHeaders({
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        Referer: SEARCH_URL,
        Accept: "application/json, text/javascript, */*",
      }),
      body: new URLSearchParams({
        csrfmiddlewaretoken: searchCsrf,
        report_types: FILTER_REPORT_TYPES,
        filer_types: FILTER_FILER_TYPES,
        submitted_start_date: formatEfdDate(start),
        submitted_end_date: formatEfdDate(end),
        candidate_state: "",
        senator_state: "",
        office_id: "",
        first_name: "",
        last_name: "",
        start: "0",
        length: "200",
      }).toString(),
    })
    if (!dataRes.ok) {
      throw new Error(
        `eFDSearch POST /search/report/data/ returned ${dataRes.status} ${dataRes.statusText}`
      )
    }
    this.mergeSetCookies(dataRes)
    const dataJson = (await dataRes.json()) as DataTablesResponse
    const rows = dataJson.data ?? []

    // Step 4: For each PTR row, GET the detail page and parse its
    // transaction table. Each cell-array row from DataTables is:
    //   [first_name, last_name, full_display_name, anchor_html, file_date]
    const out: RawSignal<CongressPayload>[] = []
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 4) continue
      const fullName = String(row[2] ?? "").trim()
      const anchorHtml = String(row[3] ?? "")
      if (!fullName) continue

      const hrefMatch = anchorHtml.match(
        /href="(\/search\/view\/ptr\/[^"]+\/?)"/
      )
      if (!hrefMatch) continue
      const detailUrl = `${BASE_URL}${hrefMatch[1]}`

      await senateLimiter.take()
      const detailRes = await fetchWithRetry(detailUrl, {
        method: "GET",
        headers: this.baseHeaders({
          Accept: "text/html",
          Referer: SEARCH_URL,
        }),
      })
      if (!detailRes.ok) {
        // One bad PTR shouldn't kill the run — partial-success semantics
        // are honored upstream by BaseIngestionAgent.
        continue
      }
      const detailHtml = await detailRes.text()
      const transactions = parsePtrTransactions(detailHtml, fullName)

      for (const t of transactions) {
        out.push({
          source_id: SOURCE_ID,
          fetched_at: new Date().toISOString(),
          payload: t,
        })
      }
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
        source_url: "https://efdsearch.senate.gov/search/",
        status: "pending",
        symbol,
        side: symbol ? side : null,
        target_weight: null,
      })
    }
    return out
  }
}
