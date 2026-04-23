// JobsDataAgent — BLS Nonfarm Payrolls + Unemployment Rate.
//
// Thesis
//   The BLS jobs report (first Friday of the month) is the single largest
//   scheduled macro-volatility event on the US calendar. Establishment-survey
//   nonfarm payrolls (CES0000000001) and the headline unemployment rate
//   (LNS14000000) drive the Fed reaction function, and thus discount rates
//   for every cash-flow model in the market. The Council v1 backtest shows
//   this specialist is INVERSELY calibrated — large paper-IC magnitude
//   (|IC|=0.32, N=120, t=-3.70) but conviction maps to the wrong direction.
//   Ingestion captures the raw observation; the sign-flip lives in the
//   ensemble combiner (see Confidential Agent Playbook).
//
// Data source
//   BLS Public Data API v2 — `POST /timeseries/data/`.
//     Docs: https://www.bls.gov/developers/api_signature_v2.htm
//   Free, US-government, unrestricted commercial use.
//
// Rate-limit posture
//   25 req/day unauthenticated, 500 req/day with a registration key.
//   Up to 50 series per POST — we send 2 series per call to keep blast
//   radius tiny on any single response parse. Daily cron = well under cap.
//
// External ID
//   `${series_id}:${year}:${period}` — BLS `period` is "M01"..."M13"
//   (M13 = annual); combined with year this uniquely identifies a datum.

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, RateLimiter } from "../http"
import type { NormalizedSignal, RawSignal } from "../types"

const SOURCE_ID = "bls-jobs-report"
const AGENT_ID = "jobs-data-agent"

const ENDPOINT = "https://api.bls.gov/publicAPI/v2/timeseries/data/"

const SERIES_IDS = ["CES0000000001", "LNS14000000"] as const
type SeriesId = (typeof SERIES_IDS)[number]

// Conservative — BLS caps daily requests, not per-second. 1 req/s is plenty.
const blsLimiter = new RateLimiter({ capacity: 1, refillPerSec: 1 })

type BlsDatum = {
  year?: string
  period?: string
  periodName?: string
  value?: string
  footnotes?: Array<{ code?: string; text?: string }>
}

type BlsSeries = {
  seriesID?: string
  data?: BlsDatum[]
}

type BlsResponse = {
  status?: string
  message?: string[]
  Results?: { series?: BlsSeries[] }
}

type JobsPayload = {
  series_id: SeriesId
  year: string
  period: string
  value: number | null
  footnote_codes: string[]
  prior_value: number | null
  delta: number | null
}

function assertBlsEnv(): string {
  const key = process.env.BLS_API_KEY?.trim()
  if (!key) {
    throw new Error(
      "BLS_API_KEY env var is required to fetch BLS timeseries (https://data.bls.gov/registrationEngine/)"
    )
  }
  return key
}

function parseBlsValue(v: string | undefined): number | null {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function currentYear(): number {
  return new Date().getUTCFullYear()
}

function isSeriesId(s: string | undefined): s is SeriesId {
  return s === "CES0000000001" || s === "LNS14000000"
}

export class JobsDataAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  protected async fetch(): Promise<RawSignal[]> {
    const apiKey = assertBlsEnv()

    const y = currentYear()
    const body = {
      seriesid: [...SERIES_IDS],
      startyear: String(y - 1),
      endyear: String(y),
      registrationkey: apiKey,
    }

    await blsLimiter.take()

    const res = await fetchWithRetry(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(
        `BLS timeseries/data returned ${res.status} ${res.statusText}`
      )
    }

    const json = (await res.json()) as BlsResponse
    if (json.status && json.status !== "REQUEST_SUCCEEDED") {
      const msgs = (json.message ?? []).join("; ")
      throw new Error(`BLS status=${json.status} message=${msgs || "<none>"}`)
    }

    const out: RawSignal<JobsPayload>[] = []
    const series = json.Results?.series ?? []

    for (const s of series) {
      if (!isSeriesId(s.seriesID)) continue
      const data = s.data ?? []
      // BLS returns newest first. For each datum compute prior_value from
      // the next observation in the list (which is older).
      for (let i = 0; i < data.length; i++) {
        const d = data[i]
        if (!d.year || !d.period) continue
        const value = parseBlsValue(d.value)
        const next = data[i + 1]
        const prior_value = next ? parseBlsValue(next.value) : null
        const delta =
          value !== null && prior_value !== null ? value - prior_value : null

        const payload: JobsPayload = {
          series_id: s.seriesID,
          year: d.year,
          period: d.period,
          value,
          footnote_codes:
            (d.footnotes ?? [])
              .map((f) => f?.code)
              .filter((c): c is string => Boolean(c)),
          prior_value,
          delta,
        }

        out.push({
          source_id: SOURCE_ID,
          external_id: `${payload.series_id}:${payload.year}:${payload.period}`,
          fetched_at: new Date().toISOString(),
          payload,
        })
      }
    }
    return out
  }

  protected parse(raw: RawSignal[]): NormalizedSignal[] {
    const out: NormalizedSignal[] = []
    for (const r of raw) {
      const p = r.payload as JobsPayload
      const external_id = buildExternalId([
        SOURCE_ID,
        p.series_id,
        p.year,
        p.period,
      ])

      const body = JSON.stringify({
        series_id: p.series_id,
        year: p.year,
        period: p.period,
        value: p.value,
        footnote_codes: p.footnote_codes,
        prior_value: p.prior_value,
        delta: p.delta,
      })

      out.push({
        agent_id: AGENT_ID,
        source_id: SOURCE_ID,
        external_id,
        body,
        confidence: null,
        source_url: `https://data.bls.gov/timeseries/${p.series_id}`,
        status: "pending",
      })
    }
    return out
  }
}
