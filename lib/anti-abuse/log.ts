import "server-only"
import { createHash } from "node:crypto"
import { getServerClient } from "@/lib/supabase/server"

export type AbuseReason =
  | "honeypot"
  | "ratelimit"
  | "email-invalid"
  | "disposable"

export interface AbuseLogInput {
  route: string
  reason: AbuseReason
  ip: string | null
  userAgent: string | null
  metadata?: Record<string, unknown>
}

/**
 * SHA-256 hash with the configured salt. Returns null if salt is missing
 * or the input is absent — we never log raw IPs or user-agents.
 */
function hashWithSalt(value: string | null): string | null {
  if (!value) return null
  const salt = process.env.ABUSE_HASH_SALT
  if (!salt) return null
  return createHash("sha256").update(salt).update(value).digest("hex")
}

/**
 * Best-effort write to v2_abuse_events. Never throws — the caller's
 * response path must not depend on audit success.
 */
export async function logAbuseEvent(input: AbuseLogInput): Promise<void> {
  try {
    if (!process.env.ABUSE_HASH_SALT) {
      // Warn once per process is out of scope; a per-call warn is fine
      // for now since abuse hits should be rare in prod.
      // eslint-disable-next-line no-console
      console.warn(
        "[abuse-log] ABUSE_HASH_SALT not set — storing event without ip/ua hashes"
      )
    }

    const supabase = getServerClient()
    if (!supabase) return

    const row = {
      route: input.route,
      ip_hash: hashWithSalt(input.ip),
      ua_hash: hashWithSalt(input.userAgent),
      reason: input.reason,
      metadata: input.metadata ?? null,
    }

    // Cast to the `never`-typed generic table shim the rest of the
    // codebase uses; the table is defined in migration 0009.
    const { error } = await supabase
      .from("v2_abuse_events" as never)
      .insert(row as never)

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[abuse-log] insert failed", error.message)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[abuse-log] unexpected error",
      err instanceof Error ? err.message : String(err)
    )
  }
}
