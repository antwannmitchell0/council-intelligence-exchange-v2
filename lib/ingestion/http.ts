// HTTP fetch utilities for ingestion agents.
// - fetchWithRetry: exponential backoff w/ jitter, honors Retry-After
// - RateLimiter: per-source token bucket
// - politeUserAgent: SEC-compliant UA builder

export type FetchRetryOptions = {
  maxAttempts?: number
  baseDelayMs?: number
  jitterPct?: number
  // Allow callers to classify additional statuses as retryable.
  retryOn?: (status: number) => boolean
}

const DEFAULT_RETRY_STATUSES = new Set<number>([408, 425, 429, 500, 502, 503, 504])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const dateMs = Date.parse(header)
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now())
  return null
}

function computeBackoff(
  attempt: number,
  baseDelayMs: number,
  jitterPct: number
): number {
  // attempt is 1-indexed: attempt 1 uses base * 2^0, attempt 2 uses base * 2^1, etc.
  const pure = baseDelayMs * Math.pow(2, attempt - 1)
  const jitter = pure * jitterPct * (Math.random() * 2 - 1)
  return Math.max(0, pure + jitter)
}

/**
 * fetchWithRetry — native fetch wrapper with exponential backoff + jitter.
 * Retries on network errors and on configured HTTP status codes.
 * Honors `Retry-After` when present on 429 / 503.
 */
export async function fetchWithRetry(
  url: string | URL,
  opts: RequestInit = {},
  {
    maxAttempts = 5,
    baseDelayMs = 1000,
    jitterPct = 0.2,
    retryOn,
  }: FetchRetryOptions = {}
): Promise<Response> {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, opts)
      const isRetryable =
        (retryOn ? retryOn(res.status) : false) || DEFAULT_RETRY_STATUSES.has(res.status)

      if (!isRetryable) return res

      if (attempt === maxAttempts) return res

      const retryAfter = parseRetryAfter(res.headers.get("retry-after"))
      const delay = retryAfter ?? computeBackoff(attempt, baseDelayMs, jitterPct)
      await sleep(delay)
      continue
    } catch (err) {
      lastError = err
      if (attempt === maxAttempts) throw err
      const delay = computeBackoff(attempt, baseDelayMs, jitterPct)
      await sleep(delay)
    }
  }

  // Unreachable under normal flow — the last response or error is returned above.
  throw lastError ?? new Error("fetchWithRetry: exhausted attempts")
}

/**
 * RateLimiter — lazy-refill token bucket. One instance per upstream source.
 * `capacity` is the burst size; `refillPerSec` is the steady-state rate.
 *
 * Example (SEC EDGAR — 10 req/s hard cap):
 *   const edgar = new RateLimiter({ capacity: 10, refillPerSec: 10 })
 *   await edgar.take()
 */
export class RateLimiter {
  private readonly capacity: number
  private readonly refillPerSec: number
  private tokens: number
  private lastRefill: number

  constructor({
    capacity,
    refillPerSec,
  }: {
    capacity: number
    refillPerSec: number
  }) {
    if (capacity <= 0) throw new Error("RateLimiter: capacity must be > 0")
    if (refillPerSec <= 0) throw new Error("RateLimiter: refillPerSec must be > 0")
    this.capacity = capacity
    this.refillPerSec = refillPerSec
    this.tokens = capacity
    this.lastRefill = Date.now()
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec)
      this.lastRefill = now
    }
  }

  /**
   * Waits until a token is available, then consumes it.
   * Returns the wait time in ms (0 if no wait was needed).
   */
  async take(cost = 1): Promise<number> {
    if (cost <= 0) return 0
    if (cost > this.capacity) {
      throw new Error(
        `RateLimiter: cost ${cost} exceeds capacity ${this.capacity}`
      )
    }

    let waited = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      this.refill()
      if (this.tokens >= cost) {
        this.tokens -= cost
        return waited
      }
      const deficit = cost - this.tokens
      const waitMs = Math.ceil((deficit / this.refillPerSec) * 1000)
      waited += waitMs
      await sleep(waitMs)
    }
  }

  /** Snapshot — for debug / telemetry only. Do not use to gate flow. */
  snapshot(): { tokens: number; capacity: number; refillPerSec: number } {
    this.refill()
    return {
      tokens: this.tokens,
      capacity: this.capacity,
      refillPerSec: this.refillPerSec,
    }
  }
}

/**
 * politeUserAgent — builds a compliant UA string from the `SEC_USER_AGENT`
 * env var. SEC EDGAR requires "Sample Company Name AdminContact@samplecompany.com".
 * Falls back to a generic identifier when the env var is missing (dev only).
 */
export function politeUserAgent(suffix?: string): string {
  const base = process.env.SEC_USER_AGENT?.trim()
  const tail = suffix ? ` ${suffix}` : ""
  if (!base) {
    return `Council-Intelligence-Exchange-v2 (contact-missing)${tail}`
  }
  return `${base}${tail}`
}
