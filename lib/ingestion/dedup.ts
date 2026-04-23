// Dedup helpers for ingestion.
// Signal uniqueness is enforced by the DB via:
//   unique index on v2_signals (source_id, external_id) where external_id is not null
// See: supabase/migrations/0005_signal_dedup_constraint.sql
//
// buildExternalId generates a stable, deterministic identifier from an
// ordered set of source-specific parts (e.g. [accessionNumber, cik, formType]).
// Node's built-in crypto is used — no extra dependency.

import { createHash } from "node:crypto"

const SEP = "\u001f" // ASCII unit separator — will not appear in normal inputs.

/**
 * Stable SHA-256 hex digest over the ordered `parts` array.
 * Empty/whitespace-only parts are coerced to an empty string to keep the
 * hash deterministic without throwing.
 *
 * NOTE: the returned string is NOT secret — it is a content-addressable
 * id used only for dedup against the `(source_id, external_id)` unique index.
 */
export function buildExternalId(parts: string[]): string {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error("buildExternalId: parts must be a non-empty array")
  }
  const canonical = parts.map((p) => (p ?? "").toString().trim()).join(SEP)
  return createHash("sha256").update(canonical).digest("hex")
}

/**
 * De-duplicates a NormalizedSignal-like array in-memory by `external_id`.
 * First occurrence wins. The DB unique index is the source of truth; this
 * helper just trims the payload before the upsert round-trip.
 */
export function dedupeByExternalId<T extends { external_id: string }>(
  signals: readonly T[]
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const s of signals) {
    if (seen.has(s.external_id)) continue
    seen.add(s.external_id)
    out.push(s)
  }
  return out
}
