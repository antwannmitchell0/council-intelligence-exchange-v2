// GdeltEventVolumeAgent — GDELT 2.0 global event-volume anomaly detection.
//
// Thesis
//   Geopolitical and risk-laden news volume leaks into global coverage 24–72h
//   before equity, commodity and FX markets fully price the risk. A rolling
//   24h z-score over hourly tone-filtered volume isolates unusual coverage
//   spikes (positive or negative tone extremes) that would otherwise hide in
//   normal news flow. Emitting only when z > 2 keeps the feed sparse and
//   high-precision.
//
// Data source
//   GDELT 2.0 Doc API (TimelineVolRaw mode):
//     https://api.gdeltproject.org/api/v2/doc/doc
//   100% free, 15-minute update cadence, CAMEO-coded events from 50,000+
//   news outlets worldwide. No API key required. Public-domain attribution.
//
// Rate-limit posture
//   GDELT publishes no hard cap but community-enforced norms are ~1 req/s.
//   We run a local RateLimiter at 1 req/s / capacity 2 to stay well-behaved.
//
// External ID
//   `${iso_hour}` (e.g. `2026-04-23T14:00:00Z`) — one anomaly emission per
//   UTC hour; the DB unique index handles retry idempotency.
//
// Academic citation
//   Leetaru & Schrodt (2013), *GDELT: Global Data on Events, Language, and
//   Tone, 1979–2012*. Used across macro/FX research shops for early-warning
//   narrative-volume indicators.

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, politeUserAgent, RateLimiter } from "../http"
import type { NormalizedSignal, RawSignal } from "../types"

const SOURCE_ID = "gdelt-doc-timelinevolraw"
const AGENT_ID = "gdelt-event-volume-agent"

const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

// Sparse 24h of hourly buckets → effective rate ≪ 1 req/s; conservative anyway.
const gdeltLimiter = new RateLimiter({ capacity: 2, refillPerSec: 1 })

type GdeltTimelineDatum = {
  date?: string
  value?: number
}

type GdeltTimelineSeries = {
  data?: GdeltTimelineDatum[]
}

type GdeltTimelineResponse = {
  timeline?: GdeltTimelineSeries[]
}

type HourlyPoint = {
  iso_hour: string
  raw_volume: number
}

type AnomalyPayload = {
  hour: string
  raw_volume: number
  median_24h: number
  stdev_24h: number
  zscore: number
  top_themes: string[]
}

/**
 * Normalize GDELT's `YYYYMMDDHHMMSS` date stamp → strict ISO-8601 UTC.
 * Invalid stamps return `null` so the caller can skip the datum.
 */
function gdeltDateToIso(stamp: string | undefined): string | null {
  if (!stamp || stamp.length < 12) return null
  const yyyy = stamp.slice(0, 4)
  const mm = stamp.slice(4, 6)
  const dd = stamp.slice(6, 8)
  const hh = stamp.slice(8, 10)
  const mi = stamp.slice(10, 12)
  const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:00Z`
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return iso
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) /
    (values.length - 1)
  return Math.sqrt(variance)
}

export class GdeltEventVolumeAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  protected async fetch(): Promise<RawSignal[]> {
    // Tone-filtered query captures news with notable sentiment tilt either way.
    // `TimelineVolRaw` returns raw article counts in 15-min buckets (we
    // aggregate to hourly downstream). Last 24h gives us a rolling baseline.
    const params = new URLSearchParams({
      query: "tone<-5 OR tone>5",
      mode: "TimelineVolRaw",
      format: "json",
      timespan: "24h",
    })

    await gdeltLimiter.take()

    const res = await fetchWithRetry(`${GDELT_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": politeUserAgent("GdeltEventVolumeAgent"),
        Accept: "application/json",
      },
    })

    if (!res.ok) {
      throw new Error(
        `GDELT doc api returned ${res.status} ${res.statusText}`
      )
    }

    const json = (await res.json()) as GdeltTimelineResponse
    const series = json.timeline?.[0]?.data ?? []

    // Bucket 15-min datapoints into hourly sums.
    const byHour = new Map<string, number>()
    for (const d of series) {
      const iso = gdeltDateToIso(d.date)
      if (!iso) continue
      const hourKey = `${iso.slice(0, 13)}:00:00Z`
      const v = Number.isFinite(d.value) ? (d.value as number) : 0
      byHour.set(hourKey, (byHour.get(hourKey) ?? 0) + v)
    }

    const hourly: HourlyPoint[] = Array.from(byHour.entries())
      .map(([iso_hour, raw_volume]) => ({ iso_hour, raw_volume }))
      .sort((a, b) => (a.iso_hour < b.iso_hour ? -1 : 1))

    if (hourly.length === 0) return []

    // Current hour = the most recent hourly bucket. Baseline = the prior 24
    // buckets (or whatever is available). Emit only when |z| > 2.
    const fetched_at = new Date().toISOString()
    const out: RawSignal<AnomalyPayload>[] = []

    const current = hourly[hourly.length - 1]
    const baseline = hourly
      .slice(0, -1)
      .slice(-24)
      .map((h) => h.raw_volume)

    if (baseline.length < 3) return []

    const med = median(baseline)
    const sd = stdev(baseline)
    const z = sd > 0 ? (current.raw_volume - med) / sd : 0

    if (Math.abs(z) <= 2) return []

    const payload: AnomalyPayload = {
      hour: current.iso_hour,
      raw_volume: current.raw_volume,
      median_24h: med,
      stdev_24h: sd,
      zscore: z,
      // Top-themes enrichment is a downstream concern (ensemble combination);
      // we emit an empty array so the shape is stable.
      top_themes: [],
    }

    out.push({
      source_id: SOURCE_ID,
      external_id: current.iso_hour,
      fetched_at,
      payload,
    })

    return out
  }

  protected parse(raw: RawSignal[]): NormalizedSignal[] {
    const out: NormalizedSignal[] = []
    for (const r of raw) {
      const p = r.payload as AnomalyPayload
      if (!p.hour) continue

      const external_id = buildExternalId([SOURCE_ID, p.hour])

      const body = JSON.stringify({
        hour: p.hour,
        raw_volume: p.raw_volume,
        median_24h: p.median_24h,
        zscore: p.zscore,
        top_themes: p.top_themes,
      })

      out.push({
        agent_id: AGENT_ID,
        source_id: SOURCE_ID,
        external_id,
        body,
        confidence: null,
        source_url: "https://api.gdeltproject.org/api/v2/doc/doc",
        status: "pending",
      })
    }
    return out
  }
}
