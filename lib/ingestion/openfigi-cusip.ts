// OpenFIGI CUSIP → ticker resolver.
//
// SEC 13F-HR information tables identify holdings by 9-character CUSIP, not
// ticker. To route 13F-derived signals to a tradable Alpaca symbol we need
// to map CUSIP → US-listed equity ticker.
//
// OpenFIGI (openfigi.com, run by Bloomberg) is the canonical free public
// CUSIP/ISIN/SEDOL → ticker mapping API. v2 sunsets July 2026 — we use v3.
//   POST https://api.openfigi.com/v3/mapping
//   Body: [{ "idType": "ID_CUSIP", "idValue": "594918104", "marketSecDes": "Equity" }, ...]
//   Returns: per-input { data: [{ ticker, exchCode, securityType, marketSector, ... }] }
//
// Rate limits (v3, with X-OPENFIGI-APIKEY):
//   - 250 requests / minute
//   - 100 CUSIP mappings per request body
//   So 25,000 CUSIPs/min headroom — vastly more than 13F generates daily.
//
//   Without a key: 25 req/min, 10 mappings per request. Strongly prefer
//   the keyed path.
//
// Pick rule (single ticker per CUSIP)
//   A CUSIP maps to many FIGI rows because each US exchange listing has its
//   own FIGI. We want the primary US-listed common stock ticker:
//     1. marketSector === "Equity"
//     2. securityType === "Common Stock" (drop warrants / preferreds / units)
//     3. exchCode === "US" (composite) preferred; fall back to any US sub-
//        exchange (UN=NYSE, UW=NASDAQ, UA=AMEX, etc.) if "US" missing
//
// Caching strategy mirrors sec-cik-ticker.ts: module-level Map, in-flight
// dedup, 7-day TTL (holdings are quarterly, CUSIPs don't churn). Cache
// survives Fluid Compute container reuse.

import "server-only"
import { fetchWithRetry } from "./http"

const OPENFIGI_URL = "https://api.openfigi.com/v3/mapping"

// US sub-exchange codes that represent tradable US-listed common stock.
// Treated as fallback if no row carries the composite "US" exchCode.
const US_EXCHANGE_CODES = new Set<string>([
  "US", // composite (preferred)
  "UN", // NYSE
  "UW", // NASDAQ Global Select
  "UQ", // NASDAQ Global Market
  "UR", // NASDAQ Capital Market
  "UA", // NYSE American (formerly AMEX)
  "UP", // NYSE Arca
  "UF", // BATS
  "UV", // OTCBB
])

// Module-level cache. Keys are 9-char CUSIPs (uppercase, no whitespace).
type CusipMap = Map<string, string>
const cache: CusipMap = new Map()
const negativeCache: Set<string> = new Set() // CUSIPs we've confirmed have no US-equity ticker
let cachedAt: number = 0
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

// One in-flight request per uncached CUSIP — coalesces concurrent callers.
const inflight = new Map<string, Promise<string | null>>()

type OpenFigiMatch = {
  figi?: string
  ticker?: string
  exchCode?: string
  securityType?: string
  securityType2?: string
  marketSector?: string
  name?: string
}

type OpenFigiEntry = {
  data?: OpenFigiMatch[]
  warning?: string
  error?: string
}

function normalizeCusip(raw: string | null | undefined): string | null {
  if (!raw) return null
  const c = raw.trim().toUpperCase().replace(/\s+/g, "")
  // CUSIPs are 9 chars (8 + 1 check digit). Some upstreams emit 8 (the
  // base) or pad with leading zeros. Accept anything 8-9 alphanumerics.
  if (!/^[0-9A-Z]{8,9}$/.test(c)) return null
  return c
}

/**
 * pickPrimaryUsTicker — given OpenFIGI's full list of matches for a single
 * CUSIP, choose the canonical US-listed common-stock ticker. Returns null
 * if the CUSIP has no public US-equity listing (foreign-only, bond, fund,
 * private).
 */
function pickPrimaryUsTicker(matches: OpenFigiMatch[]): string | null {
  const eligible = matches.filter(
    (m) =>
      m.marketSector === "Equity" &&
      (m.securityType === "Common Stock" ||
        m.securityType2 === "Common Stock") &&
      typeof m.ticker === "string" &&
      m.ticker.length > 0 &&
      typeof m.exchCode === "string" &&
      US_EXCHANGE_CODES.has(m.exchCode)
  )
  if (eligible.length === 0) return null

  // Prefer composite "US" exchange.
  const composite = eligible.find((m) => m.exchCode === "US")
  if (composite?.ticker) return composite.ticker.trim().toUpperCase()

  // Otherwise the first US sub-exchange match in OpenFIGI's order, which
  // is roughly the most-recent / primary listing.
  const first = eligible[0]
  return first.ticker ? first.ticker.trim().toUpperCase() : null
}

/**
 * postOpenFigiBatch — single bulk POST to /v3/mapping. Up to 100 CUSIPs
 * per call (OpenFIGI's hard cap). Caller is responsible for chunking.
 */
async function postOpenFigiBatch(
  cusips: string[]
): Promise<Array<string | null>> {
  if (cusips.length === 0) return []
  if (cusips.length > 100) {
    throw new Error(
      `OpenFIGI bulk mapping limit is 100 CUSIPs per request, got ${cusips.length}`
    )
  }

  const apiKey = process.env.OPENFIGI_API_KEY?.trim()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  if (apiKey) headers["X-OPENFIGI-APIKEY"] = apiKey

  const body = JSON.stringify(
    cusips.map((cusip) => ({
      idType: "ID_CUSIP",
      idValue: cusip,
      marketSecDes: "Equity",
    }))
  )

  const res = await fetchWithRetry(
    OPENFIGI_URL,
    { method: "POST", headers, body },
    {
      // OpenFIGI returns 429 with a Retry-After header on rate-limit hits;
      // fetchWithRetry honors it natively.
      retryOn: (status) => status === 429,
    }
  )
  if (!res.ok) {
    throw new Error(
      `OpenFIGI v3/mapping returned ${res.status} ${res.statusText}`
    )
  }

  const json = (await res.json()) as OpenFigiEntry[]
  // The response is positional — entry[i] corresponds to cusips[i].
  return cusips.map((_, i) => {
    const entry = json[i]
    if (!entry || entry.error) return null
    const matches = entry.data ?? []
    return pickPrimaryUsTicker(matches)
  })
}

function isCacheFresh(): boolean {
  return cachedAt > 0 && Date.now() - cachedAt < CACHE_TTL_MS
}

function bumpCacheStamp(): void {
  cachedAt = Date.now()
}

/**
 * lookupTickersByCusips — bulk variant. Resolves a batch of CUSIPs to US
 * common-stock tickers. Returns a Map keyed by the input CUSIP (normalized).
 * CUSIPs without a US public-equity listing are absent from the returned
 * Map (caller treats absence as "skip routing"). Order of input is not
 * preserved in the return value; use the Map.
 *
 * Caches positive AND negative results — we don't re-query CUSIPs we've
 * already confirmed have no US ticker.
 */
export async function lookupTickersByCusips(
  rawCusips: Iterable<string>
): Promise<Map<string, string>> {
  const normalized: string[] = []
  const seen = new Set<string>()
  for (const r of rawCusips) {
    const n = normalizeCusip(r)
    if (!n || seen.has(n)) continue
    seen.add(n)
    normalized.push(n)
  }

  const result = new Map<string, string>()
  const toFetch: string[] = []

  for (const c of normalized) {
    if (!isCacheFresh()) break // force a refresh below
    const cached = cache.get(c)
    if (cached) {
      result.set(c, cached)
      continue
    }
    if (negativeCache.has(c)) continue // confirmed no ticker; skip
    toFetch.push(c)
  }

  // If cache is stale, treat everything as needing a fetch — the new
  // results will repopulate.
  if (!isCacheFresh()) {
    cache.clear()
    negativeCache.clear()
    toFetch.length = 0
    toFetch.push(...normalized)
  }

  // Chunk to OpenFIGI's 100-per-request ceiling.
  for (let i = 0; i < toFetch.length; i += 100) {
    const chunk = toFetch.slice(i, i + 100)
    try {
      const tickers = await postOpenFigiBatch(chunk)
      for (let j = 0; j < chunk.length; j++) {
        const cusip = chunk[j]
        const ticker = tickers[j]
        if (ticker) {
          cache.set(cusip, ticker)
          result.set(cusip, ticker)
        } else {
          negativeCache.add(cusip)
        }
      }
      bumpCacheStamp()
    } catch (err) {
      // Fail-closed for this batch — log and skip. The agent's circuit
      // breaker handles repeated failure at a coarser granularity.
      console.warn(
        "[openfigi-cusip] batch lookup failed:",
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  return result
}

/**
 * lookupTickerByCusip — single-CUSIP convenience wrapper. Coalesces
 * concurrent callers via the inflight map so 50 simultaneous lookups for
 * the same CUSIP issue one HTTP request.
 */
export async function lookupTickerByCusip(
  rawCusip: string | null | undefined
): Promise<string | null> {
  const cusip = normalizeCusip(rawCusip)
  if (!cusip) return null

  if (isCacheFresh()) {
    const cached = cache.get(cusip)
    if (cached) return cached
    if (negativeCache.has(cusip)) return null
  }

  const existing = inflight.get(cusip)
  if (existing) return existing

  const promise = (async () => {
    try {
      const map = await lookupTickersByCusips([cusip])
      return map.get(cusip) ?? null
    } catch {
      return null
    } finally {
      inflight.delete(cusip)
    }
  })()
  inflight.set(cusip, promise)
  return promise
}

/** Test helper — reset cache between unit-test runs. */
export function __resetCusipCacheForTests(): void {
  cache.clear()
  negativeCache.clear()
  cachedAt = 0
  inflight.clear()
}
