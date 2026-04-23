// WikiEditSurgeAgent — Wikipedia pageview surges on curated ticker articles.
//
// Thesis
//   Pageviews on a company's Wikipedia article spike when retail + journalist
//   attention shifts — often 24–72h ahead of named catalysts (earnings
//   whispers, M&A leaks, product-launch pre-coverage). A daily pageview ratio
//   > 3× the 30-day median is a sparse, high-precision attention signal.
//
// Data source
//   Wikimedia Pageview REST API:
//     https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/...
//   Free, public, open license. Daily-granularity endpoint publishes ~24h
//   after close-of-day UTC.
//
// Rate-limit posture
//   Wikimedia permits ~200 req/s; we cap at 5 req/s / capacity 5 out of good
//   citizenship — this run makes ≤ 1 call per tracked article (20-ish total).
//
// External ID
//   `wiki:${article}:${date}` — one signal per article per calendar date.
//
// Academic citation
//   Moat, Curme, Avakian, Kenett, Stanley, Preis (2013), *Quantifying
//   Wikipedia Usage Patterns Before Stock Market Moves*, Scientific Reports.
//   Demonstrates pageview-based anticipatory signal in DJIA constituents.

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, politeUserAgent, RateLimiter } from "../http"
import type { NormalizedSignal, RawSignal } from "../types"

const SOURCE_ID = "wikimedia-pageviews"
const AGENT_ID = "wiki-edit-surge-agent"

const PAGEVIEW_BASE =
  "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user"

// Curated: ~20 large-cap tickers whose Wikipedia titles are stable and
// unambiguous. The article slug must match Wikipedia's canonical URL form
// (spaces → underscores, %-encoding handled by the HTTP layer).
const TRACKED_ARTICLES = [
  "Apple_Inc.",
  "Microsoft",
  "Tesla,_Inc.",
  "Nvidia",
  "Amazon_(company)",
  "Alphabet_Inc.",
  "Meta_Platforms",
  "JPMorgan_Chase",
  "Walmart",
  "ExxonMobil",
  "Berkshire_Hathaway",
  "Johnson_%26_Johnson",
  "Visa_Inc.",
  "Mastercard",
  "Procter_%26_Gamble",
  "UnitedHealth_Group",
  "Home_Depot",
  "Coca-Cola",
  "PepsiCo",
  "Netflix",
] as const

const wikiLimiter = new RateLimiter({ capacity: 5, refillPerSec: 5 })

type WikiPageviewItem = {
  project?: string
  article?: string
  granularity?: string
  timestamp?: string // YYYYMMDDHH
  access?: string
  agent?: string
  views?: number
}

type WikiPageviewResponse = {
  items?: WikiPageviewItem[]
}

type SurgePayload = {
  article: string
  date: string
  pageviews: number
  median_30d: number
  ratio: number
}

/** YYYYMMDD for the Wikimedia endpoint path. */
function yyyymmdd(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, "0")
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0")
  const dd = d.getUTCDate().toString().padStart(2, "0")
  return `${y}${m}${dd}`
}

/** YYYYMMDDHH → `YYYY-MM-DD`. */
function timestampToDate(ts: string | undefined): string | null {
  if (!ts || ts.length < 8) return null
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

async function pullArticle(article: string): Promise<SurgePayload | null> {
  // Pull a 31-day window so we have 30 days of baseline + 1 candidate "today".
  // Wikimedia's daily endpoint lags by ~24h; the agent is scheduled at 09:30
  // UTC to land after the prior-day batch ships.
  const end = new Date()
  const start = new Date(end.getTime() - 31 * 24 * 60 * 60 * 1000)

  await wikiLimiter.take()

  const url = `${PAGEVIEW_BASE}/${article}/daily/${yyyymmdd(start)}/${yyyymmdd(end)}`

  const res = await fetchWithRetry(
    url,
    {
      headers: {
        "User-Agent": politeUserAgent("WikiEditSurgeAgent"),
        Accept: "application/json",
      },
    },
    {
      // 404 happens when an article has zero views in the window or was
      // renamed — treat as "no data today" rather than retrying forever.
      retryOn: (status) => status >= 500 && status < 600,
    }
  )

  if (res.status === 404) return null

  if (!res.ok) {
    throw new Error(
      `wikimedia pageviews(${article}) returned ${res.status} ${res.statusText}`
    )
  }

  const json = (await res.json()) as WikiPageviewResponse
  const items = (json.items ?? [])
    .map((i) => ({
      date: timestampToDate(i.timestamp),
      views: Number.isFinite(i.views) ? (i.views as number) : 0,
    }))
    .filter((i): i is { date: string; views: number } => i.date !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  if (items.length < 10) return null

  // Candidate = most recent bucket. Baseline = prior up-to-30 entries.
  const candidate = items[items.length - 1]
  const baseline = items.slice(-31, -1).map((i) => i.views)
  const med = median(baseline)
  const ratio = med > 0 ? candidate.views / med : 0

  if (ratio <= 3) return null

  return {
    article,
    date: candidate.date,
    pageviews: candidate.views,
    median_30d: med,
    ratio,
  }
}

export class WikiEditSurgeAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  protected async fetch(): Promise<RawSignal[]> {
    const fetched_at = new Date().toISOString()
    const out: RawSignal<SurgePayload>[] = []

    // Serial loop — avoids punching through the rate limiter and keeps the
    // memory footprint trivial.
    for (const article of TRACKED_ARTICLES) {
      const surge = await pullArticle(article)
      if (!surge) continue
      out.push({
        source_id: SOURCE_ID,
        external_id: `wiki:${surge.article}:${surge.date}`,
        fetched_at,
        payload: surge,
      })
    }

    return out
  }

  protected parse(raw: RawSignal[]): NormalizedSignal[] {
    const out: NormalizedSignal[] = []
    for (const r of raw) {
      const p = r.payload as SurgePayload
      if (!p.article || !p.date) continue

      const external_id = buildExternalId([SOURCE_ID, p.article, p.date])

      const body = JSON.stringify({
        article: p.article,
        date: p.date,
        pageviews: p.pageviews,
        median_30d: p.median_30d,
        ratio: p.ratio,
      })

      const source_url = `https://en.wikipedia.org/wiki/${p.article}`

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
