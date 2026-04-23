import "server-only"
import { getCache } from "@vercel/functions"

export interface RateLimitResult {
  /** True if the request should be allowed through. */
  allowed: boolean
  /** Approximate remaining requests in the current window. 0 when blocked. */
  remaining: number
}

/**
 * Per-IP sliding-window rate limiter backed by Vercel Runtime Cache.
 *
 * Stores the array of hit timestamps (ms since epoch) at
 *   `ratelimit:<key>:<ip>`
 * TTL is set to the window length so stale entries self-evict.
 *
 * On any cache error (infra hiccup, missing Runtime Cache binding in
 * a local dev environment, etc.) we FAIL OPEN — returning `allowed=true`
 * with `remaining=max`. Blocking legit users on an infra wobble is worse
 * than letting a burst through; other layers (honeypot, MX, disposable
 * blocklist) still run.
 */
export async function checkIpRateLimit(
  ip: string,
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (!ip || ip === "unknown") {
    // No useful identity — don't block, but don't record either.
    return { allowed: true, remaining: max }
  }

  const cacheKey = `ratelimit:${key}:${ip}`
  const now = Date.now()
  const windowStart = now - windowMs

  try {
    const cache = getCache()
    const raw = await cache.get(cacheKey)
    const prior: number[] = Array.isArray(raw)
      ? (raw as unknown[]).filter(
          (t): t is number => typeof t === "number" && t > windowStart
        )
      : []

    if (prior.length >= max) {
      return { allowed: false, remaining: 0 }
    }

    const next = [...prior, now]
    // ttl is in seconds per RuntimeCache.set contract.
    await cache.set(cacheKey, next, {
      ttl: Math.max(1, Math.ceil(windowMs / 1000)),
      name: `ratelimit:${key}`,
    })

    return { allowed: true, remaining: Math.max(0, max - next.length) }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[rate-limit] cache unavailable, failing open",
      err instanceof Error ? err.message : String(err)
    )
    return { allowed: true, remaining: max }
  }
}
