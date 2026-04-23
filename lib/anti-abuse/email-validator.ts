import "server-only"
import { promises as dns } from "node:dns"
import { DISPOSABLE_DOMAINS } from "./disposable-domains"

/**
 * Pragmatic RFC-5322-ish regex. Good enough to reject obvious garbage
 * without dragging in a parser. MX lookup is the real gate.
 */
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

/** Max 254 chars per RFC 5321. */
const MAX_EMAIL_LENGTH = 254

export function isValidEmailSyntax(email: string): boolean {
  if (typeof email !== "string") return false
  const trimmed = email.trim()
  if (!trimmed || trimmed.length > MAX_EMAIL_LENGTH) return false
  return EMAIL_RE.test(trimmed)
}

/**
 * Extract the hostname from an email address, lowercased.
 * Returns null if the address is malformed.
 */
function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at < 1 || at >= email.length - 1) return null
  return email.slice(at + 1).trim().toLowerCase()
}

export function isDisposable(email: string): boolean {
  const domain = extractDomain(email)
  if (!domain) return false
  return DISPOSABLE_DOMAINS.has(domain)
}

/**
 * Checks whether the given domain resolves an MX record.
 * Times out after `timeoutMs` (default 2000ms) to avoid hanging the request.
 *
 * Returns `false` on timeout, NXDOMAIN, or any DNS error. We intentionally
 * do NOT fall back to A-record-as-MX per RFC 5321 §5 — that's too lenient
 * for an anti-abuse gate where MX is cheap and meaningful.
 */
export async function hasMX(
  domain: string,
  timeoutMs: number = 2000
): Promise<boolean> {
  if (!domain) return false

  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("mx-timeout")), timeoutMs)
  })

  try {
    const mx = await Promise.race([dns.resolveMx(domain), timeout])
    return Array.isArray(mx) && mx.length > 0
  } catch {
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Convenience helper: given an email, run syntax + MX.
 * Caller is still expected to run `isDisposable` separately so the
 * response code can differ ("invalid" vs "please use a work email").
 */
export async function isEmailDeliverable(
  email: string,
  timeoutMs: number = 2000
): Promise<boolean> {
  if (!isValidEmailSyntax(email)) return false
  const domain = extractDomain(email)
  if (!domain) return false
  return hasMX(domain, timeoutMs)
}
