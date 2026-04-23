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
//   Public US-government data, unrestricted commercial use.
//
// Rate-limit posture
//   SEC global 10 req/s hard cap — we throttle locally at 5 req/s capacity 5.
//   `User-Agent` must identify a real contact (politeUserAgent + SEC_USER_AGENT).
//
// External ID
//   Accession number (e.g. `0001234567-25-000456`).

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, politeUserAgent, RateLimiter } from "../http"
import type { NormalizedSignal, RawSignal } from "../types"

const SOURCE_ID = "sec-edgar-13fhr"
const AGENT_ID = "thirteen-f-agent"

const SEARCH_URL = "https://efts.sec.gov/LATEST/search-index"

// Same SEC bucket philosophy as insider-filing; separate instance keeps
// 13F retries from starving insider-filing retries when both run in the
// same cron tick.
const edgarLimiter = new RateLimiter({ capacity: 5, refillPerSec: 5 })

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

type ThirteenFPayload = {
  accession: string
  filer_cik: string | null
  filer_name: string | null
  form: string
  file_date: string | null
  period_of_report: string | null
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

export class ThirteenFAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  protected async fetch(): Promise<RawSignal[]> {
    assertSecEnv()

    // 13F filings cluster heavily around quarter-end + 45d — we pull the
    // last 24h so cron catches any same-day additions. Dedup by accession.
    const end = new Date()
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)

    const params = new URLSearchParams({
      forms: "13F-HR",
      dateRange: "custom",
      startdt: isoDate(start),
      enddt: isoDate(end),
    })

    await edgarLimiter.take()

    const res = await fetchWithRetry(`${SEARCH_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": politeUserAgent("ThirteenFAgent"),
        "Accept-Encoding": "gzip, deflate",
        Accept: "application/json",
      },
    })

    if (!res.ok) {
      throw new Error(
        `EDGAR search-index (13F-HR) returned ${res.status} ${res.statusText}`
      )
    }

    const json = (await res.json()) as EdgarSearchPayload
    const hits = json.hits?.hits ?? []

    const out: RawSignal<ThirteenFPayload>[] = []
    for (const hit of hits) {
      const src = hit._source
      const accession = src?.adsh ?? hit._id
      if (!accession) continue

      const payload: ThirteenFPayload = {
        accession,
        filer_cik: src?.ciks?.[0] ?? null,
        filer_name: src?.display_names?.[0] ?? null,
        form: src?.form ?? "13F-HR",
        file_date: src?.file_date ?? null,
        period_of_report: src?.period_of_report ?? null,
        raw: hit,
      }

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
      const p = r.payload as ThirteenFPayload
      if (!p.accession) continue

      const external_id = buildExternalId([SOURCE_ID, p.accession])

      // Holdings-level detail (total_aum_usd, holdings_count) requires a
      // secondary XML fetch of the 13F information-table document. We
      // intentionally defer that expansion — the accession-level record is
      // enough to seed the signal + persist; enrichment runs as a separate
      // step once a holdings-normalizer exists.
      const body = JSON.stringify({
        filer_cik: p.filer_cik,
        filer_name: p.filer_name,
        form: p.form,
        file_date: p.file_date,
        period_of_report: p.period_of_report,
        accession: p.accession,
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
      })
    }
    return out
  }
}
