// FedFuturesAgent — Fed Funds rate posture via FRED (CME FedWatch proxy).
//
// Thesis
//   CME FedWatch — implied probabilities from 30-Day Fed Funds futures —
//   is the market's real-time best estimate of the FOMC policy path. The
//   difference between the effective Fed Funds rate and the upper/lower
//   edges of the FOMC target band is a clean, observable summary of
//   policy stance. Fisher's (2001) and later work (Piazzesi & Swanson 2008,
//   Bauer & Swanson 2023) shows monetary-surprise shocks explain material
//   cross-sectional equity variance around FOMC windows.
//
// Data source — design decision
//   CME Group does NOT expose a stable public JSON API for the FedWatch
//   tool. The public page renders via an internal, undocumented endpoint
//   whose shape changes frequently and whose terms-of-service restrict
//   programmatic commercial use. Scraping it is both fragile and
//   legally exposed.
//
//   Instead, we pull three FRED series that together encode the same
//   posture signal, with zero ToS risk:
//     - FEDFUNDS  — Effective Federal Funds Rate
//     - DFEDTARU  — FOMC target range, upper bound
//     - DFEDTARL  — FOMC target range, lower bound
//
//   From these we derive `spread_bps` (effective minus target midpoint) and
//   `direction` (where inside the band the market is printing). This is an
//   honest proxy — slightly less informative than FedWatch's SEP-band
//   probabilities but strictly public, free, and commercially usable.
//   Future upgrade path: attach an unofficial FedWatch scraper ONLY after
//   explicit licensing review.
//
// Rate-limit posture
//   FRED — 120 req/min with API key; we consume 3 series per run. Shared
//   posture with YieldCurveAgent: 2 req/s / capacity 3 is safe.
//
// External ID
//   `fedfunds-spread:${observation_date}` — one composite row per day.

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, RateLimiter } from "../http"
import type { NormalizedSignal, RawSignal } from "../types"

const SOURCE_ID = "fred-fedfunds-proxy"
const AGENT_ID = "fed-futures-agent"

const SERIES_EFFECTIVE = "FEDFUNDS"
const SERIES_TARGET_UPPER = "DFEDTARU"
const SERIES_TARGET_LOWER = "DFEDTARL"

const fedLimiter = new RateLimiter({ capacity: 3, refillPerSec: 2 })

type FredObservation = { date?: string; value?: string }
type FredObservationsResponse = { observations?: FredObservation[] }

type FedFuturesPayload = {
  observation_date: string
  effective_rate: number | null
  target_upper: number | null
  target_lower: number | null
  spread_bps: number | null
  direction: "above-band" | "in-band" | "below-band" | "unknown"
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
  if (!v || v === ".") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function pullSeries(
  series_id: string,
  apiKey: string
): Promise<Map<string, number | null>> {
  await fedLimiter.take()
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
  const map = new Map<string, number | null>()
  for (const o of json.observations ?? []) {
    if (!o.date) continue
    map.set(o.date, parseFredValue(o.value))
  }
  return map
}

function directionOf(
  effective: number | null,
  upper: number | null,
  lower: number | null
): FedFuturesPayload["direction"] {
  if (effective === null || upper === null || lower === null) return "unknown"
  if (effective > upper) return "above-band"
  if (effective < lower) return "below-band"
  return "in-band"
}

export class FedFuturesAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  protected async fetch(): Promise<RawSignal[]> {
    const apiKey = assertFredEnv()

    const [eff, upper, lower] = await Promise.all([
      pullSeries(SERIES_EFFECTIVE, apiKey),
      pullSeries(SERIES_TARGET_UPPER, apiKey),
      pullSeries(SERIES_TARGET_LOWER, apiKey),
    ])

    // Only emit rows for dates where we have AT LEAST the effective rate;
    // upper/lower are daily-target series and may not exist on every
    // effective-rate date (FEDFUNDS is published monthly — treat each
    // monthly observation as the anchor date).
    const out: RawSignal<FedFuturesPayload>[] = []
    for (const [date, effective_rate] of eff.entries()) {
      const target_upper = upper.get(date) ?? null
      const target_lower = lower.get(date) ?? null

      let spread_bps: number | null = null
      if (
        effective_rate !== null &&
        target_upper !== null &&
        target_lower !== null
      ) {
        const mid = (target_upper + target_lower) / 2
        // Convert pct points → basis points: 1pp = 100bps.
        spread_bps = Math.round((effective_rate - mid) * 100)
      }

      const payload: FedFuturesPayload = {
        observation_date: date,
        effective_rate,
        target_upper,
        target_lower,
        spread_bps,
        direction: directionOf(effective_rate, target_upper, target_lower),
      }

      out.push({
        source_id: SOURCE_ID,
        external_id: `fedfunds-spread:${date}`,
        fetched_at: new Date().toISOString(),
        payload,
      })
    }
    return out
  }

  protected parse(raw: RawSignal[]): NormalizedSignal[] {
    const out: NormalizedSignal[] = []
    for (const r of raw) {
      const p = r.payload as FedFuturesPayload
      const external_id = buildExternalId([
        SOURCE_ID,
        "fedfunds-spread",
        p.observation_date,
      ])

      const body = JSON.stringify({
        observation_date: p.observation_date,
        effective_rate: p.effective_rate,
        target_upper: p.target_upper,
        target_lower: p.target_lower,
        spread_bps: p.spread_bps,
        direction: p.direction,
      })

      out.push({
        agent_id: AGENT_ID,
        source_id: SOURCE_ID,
        external_id,
        body,
        confidence: null,
        source_url: "https://fred.stlouisfed.org/series/FEDFUNDS",
        status: "pending",
      })
    }
    return out
  }
}
