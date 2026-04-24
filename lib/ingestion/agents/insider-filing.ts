// InsiderFilingAgent — SEC EDGAR Form 4 (insider transactions).
//
// Thesis
//   Multi-executive cluster buying is informative. When 2+ officers /
//   directors of the same issuer buy within a short window, the conviction
//   is structurally higher than single-executive prints (Lakonishok & Lee
//   2001; Cohen, Malloy & Pomorski 2012). Post-announcement drift on cluster
//   buys is one of the oldest, most-replicated public-market anomalies.
//
// Data source
//   SEC EDGAR full-text filing search (JSON):
//     https://efts.sec.gov/LATEST/search-index?forms=4&dateRange=custom&startdt=...&enddt=...
//   Public US-government data, unrestricted commercial use.
//   Docs: https://www.sec.gov/os/accessing-edgar-data
//
// Rate-limit posture
//   SEC enforces a HARD 10 req/s cap. We run a local RateLimiter well below
//   that (5 req/s, capacity 5) to stay safe under retries. `User-Agent` must
//   identify a real contact per SEC fair-use rules — enforced by
//   `politeUserAgent()`; missing env var is surfaced to the caller.
//
// External ID
//   Accession number (e.g. `0001234567-25-000123`) — the canonical
//   per-filing identifier inside EDGAR.

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, politeUserAgent, RateLimiter } from "../http"
import { lookupTicker, preloadTickerMap } from "../sec-cik-ticker"
import type { NormalizedSignal, RawSignal } from "../types"

const SOURCE_ID = "sec-edgar-form4"
const AGENT_ID = "insider-filing-agent"

const SEARCH_URL = "https://efts.sec.gov/LATEST/search-index"

const edgarLimiter = new RateLimiter({ capacity: 5, refillPerSec: 5 })

type EdgarHit = {
  _id?: string
  _source?: {
    adsh?: string
    ciks?: string[]
    display_names?: string[]
    tickers?: string[]
    form?: string
    file_date?: string
    xsl?: string
  }
}

type EdgarSearchPayload = {
  hits?: {
    hits?: EdgarHit[]
  }
}

type Form4Payload = {
  accession: string
  issuer_cik: string | null
  issuer_ticker: string | null
  reporting_person: string | null
  form: string
  file_date: string | null
  raw: EdgarHit
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

export class InsiderFilingAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  protected async fetch(): Promise<RawSignal[]> {
    assertSecEnv()

    // Warm the CIK→ticker map in parallel with the filing fetch. First call
    // inside a cold container pulls ~15k-row company_tickers.json once;
    // every subsequent call is a Map.get() at ~microsecond cost.
    const preload = preloadTickerMap().catch(() => {
      // Non-fatal — lookupTicker() falls back to null per-row, agent still
      // ingests the signal (just without a tradable symbol).
    })

    // Pull filings from the last 72h. Hobby cron cadence is daily (1x/day),
    // so a 3-day window guarantees every filing is seen at least twice
    // before it ages out — resilient to individual cron misses and
    // EDGAR downtime. Accession-based dedup (unique index on
    // source_id, external_id) keeps the write volume flat.
    const end = new Date()
    const start = new Date(end.getTime() - 72 * 60 * 60 * 1000)

    const params = new URLSearchParams({
      forms: "4",
      dateRange: "custom",
      startdt: isoDate(start),
      enddt: isoDate(end),
    })

    await edgarLimiter.take()

    const res = await fetchWithRetry(`${SEARCH_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": politeUserAgent("InsiderFilingAgent"),
        "Accept-Encoding": "gzip, deflate",
        Accept: "application/json",
      },
    })

    if (!res.ok) {
      throw new Error(
        `EDGAR search-index returned ${res.status} ${res.statusText}`
      )
    }

    const json = (await res.json()) as EdgarSearchPayload
    const hits = json.hits?.hits ?? []

    // Make sure the mapper is warm before we resolve per-row.
    await preload

    const out: RawSignal<Form4Payload>[] = []
    for (const hit of hits) {
      const src = hit._source
      const accession = src?.adsh ?? hit._id
      if (!accession) continue

      // Form 4 EDGAR search-index hits contain TWO ciks: the reporting
      // person at [0] and the issuer at [1]. Same ordering for
      // display_names. `tickers` is consistently null on Form 4 hits, so
      // we always resolve via SEC's CIK→ticker map.
      const reporterCik = src?.ciks?.[0] ?? null
      const issuerCik = src?.ciks?.[1] ?? null
      const resolvedTicker = issuerCik ? await lookupTicker(issuerCik) : null

      const payload: Form4Payload = {
        accession,
        issuer_cik: issuerCik,
        issuer_ticker: resolvedTicker,
        reporting_person: src?.display_names?.[0] ?? null,
        form: src?.form ?? "4",
        file_date: src?.file_date ?? null,
        raw: hit,
      }
      // Keep the reporter CIK on the raw payload for future audit queries.
      ;(payload as unknown as { reporter_cik?: string | null }).reporter_cik = reporterCik

      out.push({
        source_id: SOURCE_ID,
        external_id: accession,
        fetched_at: new Date().toISOString(),
        payload,
      })
    }
    return out
  }

  protected parse(raw: RawSignal[]): NormalizedSignal[] {
    const out: NormalizedSignal[] = []
    for (const r of raw) {
      const p = r.payload as Form4Payload
      if (!p.accession) continue

      const external_id = buildExternalId([SOURCE_ID, p.accession])

      const body = JSON.stringify({
        issuer_cik: p.issuer_cik,
        issuer_ticker: p.issuer_ticker,
        reporting_person: p.reporting_person,
        form: p.form,
        file_date: p.file_date,
        accession: p.accession,
      })

      const source_url = `https://www.sec.gov/Archives/edgar/data/${
        p.issuer_cik ?? ""
      }/${p.accession.replace(/-/g, "")}/${p.accession}-index.htm`

      // Phase 4: Form 4 cluster buys are the core thesis for this agent;
      // EDGAR search-index hits don't distinguish acquisitions from
      // dispositions without a secondary filing fetch, so for Day-0 we
      // assume `buy` and let the math gate filter false positives over
      // the 90-day window. Upgrade path: parse transactionCode from the
      // filing body and set side accordingly before live trading.
      out.push({
        agent_id: AGENT_ID,
        source_id: SOURCE_ID,
        external_id,
        body,
        confidence: null,
        source_url,
        status: "pending",
        symbol: p.issuer_ticker?.trim() || null,
        side: p.issuer_ticker?.trim() ? "buy" : null,
        target_weight: null,
      })
    }
    return out
  }
}
