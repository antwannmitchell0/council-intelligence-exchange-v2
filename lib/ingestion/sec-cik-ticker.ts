// SEC CIK → ticker resolver.
//
// EDGAR's search-index endpoint doesn't consistently populate the `tickers`
// array on Form 4 hits — the filings are indexed by the reporting PERSON
// (the insider), not the issuer. To derive a tradable symbol from a Form 4
// hit we need to map `issuer_cik` to the public ticker separately.
//
// SEC publishes a free, authoritative mapping at:
//   https://www.sec.gov/files/company_tickers.json
// Updated roughly daily. Public-domain US-government data. No rate limit
// beyond the standard 10 req/s EDGAR cap, which this file doesn't touch
// per-request anyway — we fetch once per cold start and cache in-memory.
//
// Data shape (as of 2024+):
//   {
//     "0": { "cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc." },
//     "1": { "cik_str": 789019, "ticker": "MSFT", "title": "Microsoft Corp." },
//     ...
//   }
// CIKs are integers without leading zeros. We normalize by stripping
// leading zeros at lookup time so caller can pass either form.

import "server-only"
import { fetchWithRetry, politeUserAgent } from "./http"

// Primary source: US-primary-listed companies. ~7,993 entries.
const COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
// Fallback source: broader coverage including NYSE/NASDAQ/OTC + foreign ADRs.
// ~13,000 entries. Different payload shape than the primary file — uses
// a "data" array with positional columns defined by a "fields" array.
const EXCHANGE_TICKERS_URL =
  "https://www.sec.gov/files/company_tickers_exchange.json"

// Module-level cache. Survives across invocations inside the same function
// container. Fluid Compute reuses containers aggressively, so amortized
// cost per Form 4 batch is near zero after the first call.
type TickerMap = Map<string, string>
let cache: TickerMap | null = null
let inflight: Promise<TickerMap> | null = null
let cachedAt: number = 0

// Time-to-live for the cache. SEC refreshes the file ~daily; 12h keeps
// new listings fresh without hammering their CDN.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000

type SecCompanyEntry = {
  cik_str?: number | string
  ticker?: string
  title?: string
}

function normalizeCik(cik: string | number | null | undefined): string | null {
  if (cik == null) return null
  const s = String(cik).trim()
  if (!s) return null
  // Strip leading zeros — SEC files store CIKs as integers, but EDGAR
  // URLs and some metadata pad to 10 digits. Both normalize to the same
  // base-10 string.
  return s.replace(/^0+/, "") || "0"
}

async function fetchPrimaryMap(): Promise<TickerMap> {
  const res = await fetchWithRetry(COMPANY_TICKERS_URL, {
    headers: {
      "User-Agent": politeUserAgent("SecCikTickerMapper"),
      "Accept-Encoding": "gzip, deflate",
      Accept: "application/json",
    },
  })
  if (!res.ok) {
    throw new Error(
      `company_tickers.json returned ${res.status} ${res.statusText}`
    )
  }
  const json = (await res.json()) as Record<string, SecCompanyEntry>
  const map: TickerMap = new Map()
  for (const entry of Object.values(json)) {
    const cik = normalizeCik(entry.cik_str)
    const ticker = entry.ticker?.trim().toUpperCase()
    if (!cik || !ticker) continue
    map.set(cik, ticker)
  }
  return map
}

type ExchangeTickersPayload = {
  // Shape: { fields: ["cik","name","ticker","exchange"], data: [[1045810,"NVIDIA","NVDA","Nasdaq"], ...] }
  fields?: string[]
  data?: Array<Array<string | number | null>>
}

/**
 * fetchExchangeMap — broader SEC file that includes foreign ADRs + OTC listings
 * missing from company_tickers.json. Shape is column-oriented; we reconstruct
 * a flat CIK → ticker map after looking up the indices of the 'cik' and
 * 'ticker' columns.
 */
async function fetchExchangeMap(): Promise<TickerMap> {
  const res = await fetchWithRetry(EXCHANGE_TICKERS_URL, {
    headers: {
      "User-Agent": politeUserAgent("SecCikTickerMapper"),
      "Accept-Encoding": "gzip, deflate",
      Accept: "application/json",
    },
  })
  if (!res.ok) {
    throw new Error(
      `company_tickers_exchange.json returned ${res.status} ${res.statusText}`
    )
  }
  const json = (await res.json()) as ExchangeTickersPayload
  const fields = json.fields ?? []
  const data = json.data ?? []
  const cikIdx = fields.findIndex((f) => f.toLowerCase() === "cik")
  const tickerIdx = fields.findIndex((f) => f.toLowerCase() === "ticker")
  if (cikIdx === -1 || tickerIdx === -1) {
    throw new Error(
      "company_tickers_exchange.json missing expected 'cik' or 'ticker' column"
    )
  }
  const map: TickerMap = new Map()
  for (const row of data) {
    const cik = normalizeCik(row[cikIdx] as string | number | null)
    const tickerRaw = row[tickerIdx]
    const ticker = typeof tickerRaw === "string" ? tickerRaw.trim().toUpperCase() : null
    if (!cik || !ticker) continue
    map.set(cik, ticker)
  }
  return map
}

/**
 * fetchMap — combine the primary + exchange files. Primary takes precedence
 * (narrower but higher-quality "primary ticker" signal). Exchange fills in
 * foreign ADRs + OTC listings that the primary file omits.
 */
async function fetchMap(): Promise<TickerMap> {
  const [primary, exchange] = await Promise.allSettled([
    fetchPrimaryMap(),
    fetchExchangeMap(),
  ])
  const merged: TickerMap = new Map()

  // Exchange goes first so primary can overwrite when both have the same CIK
  // (primary represents the canonical "primary ticker" for the issuer).
  if (exchange.status === "fulfilled") {
    for (const [cik, ticker] of exchange.value) merged.set(cik, ticker)
  } else {
    console.warn(
      "[sec-cik-ticker] exchange map fetch failed:",
      exchange.reason instanceof Error ? exchange.reason.message : exchange.reason
    )
  }
  if (primary.status === "fulfilled") {
    for (const [cik, ticker] of primary.value) merged.set(cik, ticker)
  } else {
    console.warn(
      "[sec-cik-ticker] primary map fetch failed:",
      primary.reason instanceof Error ? primary.reason.message : primary.reason
    )
  }

  if (merged.size === 0) {
    throw new Error(
      "both SEC ticker maps failed to fetch — cannot resolve any CIK"
    )
  }
  return merged
}

async function getMap(): Promise<TickerMap> {
  if (cache && Date.now() - cachedAt < CACHE_TTL_MS) return cache
  if (inflight) return inflight
  inflight = fetchMap()
    .then((m) => {
      cache = m
      cachedAt = Date.now()
      return m
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/**
 * lookupTicker — resolve a SEC CIK to its primary US-exchange ticker.
 * Returns null when the CIK has no public equity listing (private companies,
 * trusts, foreign subsidiaries without ADRs, etc.) — caller should skip
 * order routing for those signals.
 */
export async function lookupTicker(
  cik: string | number | null | undefined
): Promise<string | null> {
  const norm = normalizeCik(cik)
  if (!norm) return null
  try {
    const map = await getMap()
    return map.get(norm) ?? null
  } catch (err) {
    // Fail-closed: if the mapping fetch dies, return null so the caller
    // skips order routing. Better to miss signals than trade the wrong
    // symbol. The circuit breaker on the agent will also trip if this
    // keeps happening.
    console.warn(
      `[sec-cik-ticker] lookup failed for CIK ${norm}:`,
      err instanceof Error ? err.message : String(err)
    )
    return null
  }
}

/**
 * preloadTickerMap — opt-in warmup. Called once at agent cold start to
 * avoid a per-signal latency hit on the first batch. Safe to call more
 * than once; returns a no-op if the cache is warm.
 */
export async function preloadTickerMap(): Promise<void> {
  await getMap()
}

/** Test helper — reset cache between unit-test runs. */
export function __resetTickerCacheForTests(): void {
  cache = null
  cachedAt = 0
  inflight = null
}
