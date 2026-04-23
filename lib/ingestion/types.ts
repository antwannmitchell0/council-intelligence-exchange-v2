// Shared types for Phase 2 ingestion framework.
// Every trading-specialist pipeline flows raw → normalized → persisted.

import type { VerificationStatus } from "@/lib/supabase/types"

export type IngestionStatus = "success" | "partial" | "failed" | "skipped"

export type IngestionRunMeta = {
  run_id: string
  agent_id: string
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  status: IngestionStatus
}

/**
 * RawSignal — whatever the upstream source returned, still in its
 * native shape (JSON blob, HTML fragment, CSV row, etc.). Each concrete
 * agent shapes this to match the source it consumes.
 */
export type RawSignal<TPayload = unknown> = {
  source_id: string
  fetched_at: string
  external_id?: string | null
  payload: TPayload
}

/**
 * NormalizedSignal — ready to be inserted into `v2_signals`.
 * `external_id` is the stable per-source identifier used for dedup
 * against the unique index `(source_id, external_id)`.
 */
export type NormalizedSignal = {
  agent_id: string
  source_id: string
  external_id: string
  body: string
  confidence: number | null
  source_url: string | null
  status: VerificationStatus
}

/**
 * PersistedSignal — post-insert, includes DB-assigned id + created_at.
 */
export type PersistedSignal = NormalizedSignal & {
  id: string
  created_at: string
}

export type IngestionResult = {
  run_id: string
  agent_id: string
  status: IngestionStatus
  ingested: number
  deduped: number
  errors: number
  warnings: string[]
  duration_ms: number
}

export type CircuitBreakerState = {
  consecutive_failures: number
  last_failure_at: string | null
  is_open: boolean
}
