// YieldCurveAgent — FRED 2Y / 10Y / 10Y-2Y spread observations.
//
// Thesis
//   The slope of the US Treasury yield curve is the single most-watched
//   macro recession indicator. Estrella & Mishkin (1998) and more recently
//   Engstrom & Sharpe (2018, "near-term forward spread") establish that
//   persistent inversion of the 10Y-2Y (and the FOMC-horizon forward spread)
//   precedes recessions with 12–24 month lead. Daily deltas are noisy but
//   regime shifts — sign flips, crosses of zero — are high-signal.
//
// Data source
//   FRED — Federal Reserve Economic Data (St. Louis Fed). Free, public,
//   commercial-use permitted with attribution.
//     Docs: https://fred.stlouisfed.org/docs/api/fred/series_observations.html
//   Series pulled:
//     - DGS2    — 2-Year Treasury constant maturity
//     - DGS10   — 10-Year Treasury constant maturity
//     - T10Y2Y  — 10Y-minus-2Y spread (pre-computed by FRED)
//
// Rate-limit posture
//   FRED allows ~120 req/min with an API key. We request 3 series per run.
//   A conservative 2 req/s / capacity 3 keeps us well clear of that ceiling.
//
// External ID
//   `${series_id}:${observation_date}` — each observation is unique per
//   series + calendar date.

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, RateLimiter } from "../http"
import type { NormalizedSignal, RawSignal } from "../types"

const SOURCE_ID = "fred-yield-curve"
const AGENT_ID = "yield-curve-agent"

const SERIES_IDS = ["DGS2", "DGS10", "T10Y2Y"] as const
type SeriesId = (typeof SERIES_IDS)[number]

const fredLimiter = new RateLimiter({ capacity: 3, refillPerSec: 2 })

type FredObservation = {
  date?: string
  value?: string
}

type FredObservationsResponse = {
  observations?: FredObservation[]
}

type YieldCurvePayload = {
  series_id: SeriesId
  observation_date: string
  value: number | null
  prior_value: number | null
  delta: number | null
}

function assertFredEnv(): string {
  const key = process.env.FRED_API_KEY?.trim()
  if (!key) {
    throw new Error(
      "FRED_API_KEY env var is required to fetch FRED series (https://fred.stlouisfed.org/docs/api/api_key.html)"
    )
  }
  return key
}

function parseFredValue(v: string | undefined): number | null {
  // FRED uses "." to indicate a missing/holiday observation. Coerce safely.
  if (!v || v === ".") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function pullSeries(
  series_id: SeriesId,
  apiKey: string
): Promise<YieldCurvePayload[]> {
  await fredLimiter.take()

  const url = new URL("https://api.stlouisfed.org/fred/series/observations")
  url.searchParams.set("series_id", series_id)
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("file_type", "json")
  url.searchParams.set("limit", "100")
  url.searchParams.set("sort_order", "desc")

  const res = await fetchWithRetry(url.toString(), {
    headers: { Accept: "application/json" },
  })
  if (!res.ok) {
    throw new Error(
      `FRED series_observations(${series_id}) returned ${res.status} ${res.statusText}`
    )
  }
  const json = (await res.json()) as FredObservationsResponse
  const obs = json.observations ?? []

  // `sort_order=desc` → obs[0] is newest. We need prior_value = the next
  // *non-null* observation so sign flips across a holiday still register.
  const out: YieldCurvePayload[] = []
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i]
    if (!o.date) continue
    const value = parseFredValue(o.value)
    let prior_value: number | null = null
    for (let j = i + 1; j < obs.length; j++) {
      const p = parseFredValue(obs[j].value)
      if (p !== null) {
        prior_value = p
        break
      }
    }
    const delta =
      value !== null && prior_value !== null ? value - prior_value : null
    out.push({
      series_id,
      observation_date: o.date,
      value,
      prior_value,
      delta,
    })
  }
  return out
}

export class YieldCurveAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  protected async fetch(): Promise<RawSignal[]> {
    const apiKey = assertFredEnv()

    const batches = await Promise.all(
      SERIES_IDS.map((id) => pullSeries(id, apiKey))
    )

    const out: RawSignal<YieldCurvePayload>[] = []
    for (const batch of batches) {
      for (const obs of batch) {
        out.push({
          source_id: SOURCE_ID,
          external_id: `${obs.series_id}:${obs.observation_date}`,
          fetched_at: new Date().toISOString(),
          payload: obs,
        })
      }
    }
    return out
  }

  protected parse(raw: RawSignal[]): NormalizedSignal[] {
    const out: NormalizedSignal[] = []
    for (const r of raw) {
      const p = r.payload as YieldCurvePayload
      const external_id = buildExternalId([
        SOURCE_ID,
        p.series_id,
        p.observation_date,
      ])

      const body = JSON.stringify({
        series_id: p.series_id,
        observation_date: p.observation_date,
        value: p.value,
        prior_value: p.prior_value,
        delta: p.delta,
      })

      out.push({
        agent_id: AGENT_ID,
        source_id: SOURCE_ID,
        external_id,
        body,
        confidence: null,
        source_url: `https://fred.stlouisfed.org/series/${p.series_id}`,
        status: "pending",
      })
    }
    return out
  }
}
