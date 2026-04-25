// ThirteenFAgent — SEC 13F-HR (institutional long positions, quarterly).
//
// Thesis
//   Institutional-investor 13F filings reveal the positioning of >$100M
//   managers with a 45-day post-period lag. Tracking concentrated, non-index
//   13F changes — especially entries and exits at activist / deep-value
//   shops — has documented predictive power for idiosyncratic return
//   (Griffin & Xu 2009; Ali, Wei & Zhou 2011). The lag mutes the edge but
//   cluster-level entries still carry information.
//
// Data source
//   Same SEC EDGAR full-text search, filtered to `forms=13F-HR`:
//     https://efts.sec.gov/LATEST/search-index?forms=13F-HR&...
//   For each filing hit we additionally fetch the information-table XML
//   from EDGAR's archive directory. CUSIPs in the info table are resolved
//   to US-listed common-stock tickers via OpenFIGI (lib/ingestion/openfigi-cusip.ts).
//
// Rate-limit posture
//   SEC global 10 req/s hard cap — we throttle locally at 5 req/s capacity 5.
//   `User-Agent` must identify a real contact (politeUserAgent + SEC_USER_AGENT).
//
// External ID
//   `${accession}:${cusip}` — the (filing × position) tuple uniquely
//   identifies a holding row across re-runs and amendments.
//
// `side` semantics — first ship (2026-04-24)
//   We emit per-holding rows with `symbol` populated but `side = null`.
//   13F-HR is a position SNAPSHOT, not a transaction; the alpha lives in
//   quarter-over-quarter DIFFS (entries / exits / size jumps). Until the
//   diff layer ships, we keep `side = null` so the order router doesn't
//   flood Alpaca with buy orders for every hedge-fund position. Schema
//   stays routable; activation flips the side once diffs are computed.

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, politeUserAgent, RateLimiter } from "../http"
import { lookupTickersByCusips } from "../openfigi-cusip"
import type { NormalizedSignal, RawSignal } from "../types"

const SOURCE_ID = "sec-edgar-13fhr"
const AGENT_ID = "thirteen-f-agent"

const SEARCH_URL = "https://efts.sec.gov/LATEST/search-index"

// Same SEC bucket philosophy as insider-filing; separate instance keeps
// 13F retries from starving insider-filing retries when both run in the
// same cron tick.
const edgarLimiter = new RateLimiter({ capacity: 5, refillPerSec: 5 })

// Cap how many filings we expand per cron run. 13F-HR daily volume is
// typically 0–80 filings, but quarter-end (mid-Feb / mid-May / mid-Aug /
// mid-Nov) spikes can push 500+. Vercel function maxDuration is 300s; an
// info-table fetch + parse + OpenFIGI batch averages ~250 ms, so 100
// filings = ~25 s safe margin within the budget.
const MAX_FILINGS_PER_RUN = 100

type EdgarHit = {
  _id?: string
  _source?: {
    adsh?: string
    ciks?: string[]
    display_names?: string[]
    form?: string
    file_date?: string
    period_of_report?: string
  }
}

type EdgarSearchPayload = {
  hits?: {
    hits?: EdgarHit[]
  }
}

type EdgarIndexPayload = {
  directory?: {
    item?: Array<{ name?: string; type?: string }>
  }
}

type Holding = {
  cusip: string
  name_of_issuer: string | null
  title_of_class: string | null
  value_raw: number | null // unit varies — see notes below
  shares: number | null
  share_type: string | null // "SH" (shares) or "PRN" (principal of debt)
  put_call: string | null // null for long; "Put"/"Call" for derivatives
}

type ThirteenFHoldingPayload = {
  accession: string
  filer_cik: string | null
  filer_name: string | null
  form: string
  file_date: string | null
  period_of_report: string | null
  holding: Holding
  symbol: string // resolved ticker — only emitted when we have one
}

function assertSecEnv(): void {
  if (!process.env.SEC_USER_AGENT?.trim()) {
    throw new Error(
      "SEC_USER_AGENT env var is required for EDGAR requests (must be of form 'Name contact@example.com')"
    )
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseNumber(s: string | null | undefined): number | null {
  if (!s) return null
  const cleaned = s.replace(/,/g, "").trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * extractTagText — pulls the inner text of the FIRST occurrence of a given
 * tag inside a string. 13F-HR XML uses both namespaced (`<ns1:tag>`) and
 * unnamespaced forms across filers — we accept either. Tag matching is
 * case-insensitive for resilience.
 */
function extractTagText(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<(?:[a-zA-Z0-9]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tag}>`,
    "i"
  )
  const m = xml.match(re)
  if (!m) return null
  return m[1].trim().replace(/<[^>]+>/g, "").trim()
}

/**
 * splitInfoTables — split a 13F info-table XML doc into individual
 * `<infoTable>` blocks. The schema is `informationTable` containing zero
 * or more `infoTable` children, with the namespaces varying between filers
 * (often `n1:`, `ns1:`, or no prefix). We slice on the closing tag and
 * keep tag-prefix-agnostic.
 */
function splitInfoTables(xml: string): string[] {
  const blocks: string[] = []
  const re =
    /<(?:[a-zA-Z0-9]+:)?infoTable\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?infoTable>/gi
  for (const m of xml.matchAll(re)) {
    blocks.push(m[1])
  }
  return blocks
}

function parseHolding(block: string): Holding | null {
  const cusipRaw = extractTagText(block, "cusip")
  if (!cusipRaw) return null
  const cusip = cusipRaw.toUpperCase().replace(/\s+/g, "")
  if (!/^[0-9A-Z]{8,9}$/.test(cusip)) return null

  return {
    cusip,
    name_of_issuer: extractTagText(block, "nameOfIssuer"),
    title_of_class: extractTagText(block, "titleOfClass"),
    value_raw: parseNumber(extractTagText(block, "value")),
    shares: parseNumber(extractTagText(block, "sshPrnamt")),
    share_type: extractTagText(block, "sshPrnamtType"),
    put_call: extractTagText(block, "putCall"),
  }
}

/**
 * findInfoTableUrl — given a 13F filing's accession-folder index.json,
 * return the absolute URL to the information-table XML document. Different
 * filers name the file differently (`infotable.xml`, `form13fInfoTable.xml`,
 * `infoTable.xml`, etc.); we match by the SEC's `type` annotation
 * ("INFORMATION TABLE") which is consistent.
 */
function findInfoTableUrl(
  accessionFolderUrl: string,
  index: EdgarIndexPayload
): string | null {
  const items = index.directory?.item ?? []
  const infoItem = items.find(
    (it) => (it.type ?? "").toUpperCase().includes("INFORMATION TABLE")
  )
  let infoName = infoItem?.name

  // Fallback: any *.xml file other than the primary doc / xsd.
  if (!infoName) {
    const xmlItem = items.find((it) => {
      const n = (it.name ?? "").toLowerCase()
      return n.endsWith(".xml") && !n.endsWith(".xsd") && !n.includes("primary_doc")
    })
    infoName = xmlItem?.name
  }
  if (!infoName) return null
  return `${accessionFolderUrl}/${infoName}`
}

export class ThirteenFAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  protected async fetch(): Promise<RawSignal[]> {
    assertSecEnv()

    // Last 24h of new 13F-HR filings.
    const end = new Date()
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)

    const params = new URLSearchParams({
      forms: "13F-HR",
      dateRange: "custom",
      startdt: isoDate(start),
      enddt: isoDate(end),
    })

    await edgarLimiter.take()
    const searchRes = await fetchWithRetry(`${SEARCH_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": politeUserAgent("ThirteenFAgent"),
        "Accept-Encoding": "gzip, deflate",
        Accept: "application/json",
      },
    })
    if (!searchRes.ok) {
      throw new Error(
        `EDGAR search-index (13F-HR) returned ${searchRes.status} ${searchRes.statusText}`
      )
    }
    const searchJson = (await searchRes.json()) as EdgarSearchPayload
    const hits = (searchJson.hits?.hits ?? []).slice(0, MAX_FILINGS_PER_RUN)

    // Pass 1: walk each filing → fetch index.json → fetch info-table XML
    // → parse <infoTable> blocks into Holding[]. Accumulate (filing,
    // holding) tuples and the union set of all CUSIPs.
    type FilingHoldings = {
      hit: EdgarHit
      accession: string
      cik: string
      holdings: Holding[]
    }
    const filings: FilingHoldings[] = []
    const allCusips = new Set<string>()

    for (const hit of hits) {
      const src = hit._source
      const accession = src?.adsh ?? hit._id
      if (!accession) continue
      const cik = src?.ciks?.[0]
      if (!cik) continue
      const accessionNoDashes = accession.replace(/-/g, "")
      const folderUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoDashes}`

      // 1a: fetch index.json to find the info-table file name.
      await edgarLimiter.take()
      const indexRes = await fetchWithRetry(`${folderUrl}/index.json`, {
        headers: {
          "User-Agent": politeUserAgent("ThirteenFAgent"),
          "Accept-Encoding": "gzip, deflate",
          Accept: "application/json",
        },
      })
      if (!indexRes.ok) continue
      const indexJson = (await indexRes.json()) as EdgarIndexPayload
      const infoUrl = findInfoTableUrl(folderUrl, indexJson)
      if (!infoUrl) continue

      // 1b: fetch the info-table XML and parse <infoTable> blocks.
      await edgarLimiter.take()
      const xmlRes = await fetchWithRetry(infoUrl, {
        headers: {
          "User-Agent": politeUserAgent("ThirteenFAgent"),
          "Accept-Encoding": "gzip, deflate",
          Accept: "application/xml, text/xml, */*",
        },
      })
      if (!xmlRes.ok) continue
      const xml = await xmlRes.text()
      const blocks = splitInfoTables(xml)

      const holdings: Holding[] = []
      for (const block of blocks) {
        const h = parseHolding(block)
        if (!h) continue
        // Skip option positions on first ship — Alpaca paper trades equity,
        // not options, and 13F option lines distort position-counting.
        if (h.put_call) continue
        // Skip non-share principal types (debt, etc.) — those aren't
        // tradable as common-stock signals.
        if (h.share_type && h.share_type.toUpperCase() !== "SH") continue
        holdings.push(h)
        allCusips.add(h.cusip)
      }

      filings.push({ hit, accession, cik, holdings })
    }

    // Pass 2: bulk-resolve all CUSIPs → tickers in one shot. The OpenFIGI
    // resolver caches across calls, so per-CUSIP cost amortizes to zero
    // after a few cron ticks once the cache fills with the recurring
    // top-N holdings.
    const tickerMap = await lookupTickersByCusips(allCusips)

    // Pass 3: emit one RawSignal per (filing, holding) where the CUSIP
    // resolved to a US common-stock ticker. Holdings with no ticker
    // (foreign-only, illiquid, private) are dropped — caller can still
    // see them in raw form by querying EDGAR directly.
    const out: RawSignal<ThirteenFHoldingPayload>[] = []
    for (const f of filings) {
      const src = f.hit._source
      for (const h of f.holdings) {
        const symbol = tickerMap.get(h.cusip)
        if (!symbol) continue
        out.push({
          source_id: SOURCE_ID,
          external_id: `${f.accession}:${h.cusip}`,
          fetched_at: new Date().toISOString(),
          payload: {
            accession: f.accession,
            filer_cik: f.cik,
            filer_name: src?.display_names?.[0] ?? null,
            form: src?.form ?? "13F-HR",
            file_date: src?.file_date ?? null,
            period_of_report: src?.period_of_report ?? null,
            holding: h,
            symbol,
          },
        })
      }
    }
    return out
  }

  protected parse(raw: RawSignal[]): NormalizedSignal[] {
    const out: NormalizedSignal[] = []
    for (const r of raw) {
      const p = r.payload as ThirteenFHoldingPayload
      const external_id = buildExternalId([
        SOURCE_ID,
        p.accession,
        p.holding.cusip,
      ])

      const body = JSON.stringify({
        filer_cik: p.filer_cik,
        filer_name: p.filer_name,
        form: p.form,
        file_date: p.file_date,
        period_of_report: p.period_of_report,
        accession: p.accession,
        cusip: p.holding.cusip,
        ticker: p.symbol,
        name_of_issuer: p.holding.name_of_issuer,
        title_of_class: p.holding.title_of_class,
        value_raw: p.holding.value_raw,
        shares: p.holding.shares,
        share_type: p.holding.share_type,
      })

      const source_url = `https://www.sec.gov/Archives/edgar/data/${
        p.filer_cik ?? ""
      }/${p.accession.replace(/-/g, "")}/${p.accession}-index.htm`

      out.push({
        agent_id: AGENT_ID,
        source_id: SOURCE_ID,
        external_id,
        body,
        confidence: null,
        source_url,
        status: "pending",
        symbol: p.symbol,
        // First-ship: side stays null — diff-aware logic (entries / exits /
        // size jumps) lands separately. Symbol is present so the row is
        // routable; the order router will pass since side=null disables
        // routing.
        side: null,
        target_weight: null,
      })
    }
    return out
  }
}
