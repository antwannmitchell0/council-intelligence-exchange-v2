// BaseIngestionAgent — the canonical lifecycle every trading-specialist extends.
// Contract:
//   fetch() → parse() → dedupe in-memory → upsert to v2_signals (DB is source of truth)
//            → write heartbeat → return IngestionResult
// Errors trip the circuit breaker; a tripped breaker short-circuits run().

import "server-only"
import { randomUUID } from "node:crypto"
import { routeOrders } from "@/lib/alpaca/order-router"
import { getServerClient } from "@/lib/supabase/server"
import {
  readBreakerState,
  recordFailure,
  recordSuccess,
} from "./circuit-breaker"
import { dedupeByExternalId } from "./dedup"
import type {
  IngestionResult,
  IngestionStatus,
  NormalizedSignal,
  PersistedSignal,
  RawSignal,
} from "./types"

export abstract class BaseIngestionAgent {
  abstract readonly agentId: string
  abstract readonly sourceId: string

  /** Pull raw rows from the upstream source. */
  protected abstract fetch(): Promise<RawSignal[]>

  /** Transform raw rows into NormalizedSignal rows ready for insert. */
  protected abstract parse(raw: RawSignal[]): NormalizedSignal[]

  /**
   * run — the full ingestion lifecycle.
   * All signals are stage-tagged `pending` on insert. Graduation to
   * `verified` happens elsewhere (broker-paper attestation).
   */
  async run(): Promise<IngestionResult> {
    const run_id = randomUUID()
    const startedAt = Date.now()
    const warnings: string[] = []

    const breaker = readBreakerState(this.agentId)
    if (breaker.is_open) {
      return {
        run_id,
        agent_id: this.agentId,
        status: "skipped",
        ingested: 0,
        deduped: 0,
        errors: 0,
        warnings: [
          `circuit_breaker_open: ${breaker.consecutive_failures} consecutive failures`,
        ],
        duration_ms: Date.now() - startedAt,
      }
    }

    const supabase = getServerClient()
    if (!supabase) {
      await recordFailure(this.agentId)
      return {
        run_id,
        agent_id: this.agentId,
        status: "failed",
        ingested: 0,
        deduped: 0,
        errors: 1,
        warnings: ["supabase_unavailable"],
        duration_ms: Date.now() - startedAt,
      }
    }

    let raw: RawSignal[] = []
    let normalized: NormalizedSignal[] = []

    try {
      raw = await this.fetch()
    } catch (err) {
      await recordFailure(this.agentId)
      return {
        run_id,
        agent_id: this.agentId,
        status: "failed",
        ingested: 0,
        deduped: 0,
        errors: 1,
        warnings: [`fetch_failed: ${errMsg(err)}`],
        duration_ms: Date.now() - startedAt,
      }
    }

    try {
      normalized = this.parse(raw)
    } catch (err) {
      await recordFailure(this.agentId)
      return {
        run_id,
        agent_id: this.agentId,
        status: "failed",
        ingested: 0,
        deduped: 0,
        errors: 1,
        warnings: [`parse_failed: ${errMsg(err)}`],
        duration_ms: Date.now() - startedAt,
      }
    }

    const deduplicated = dedupeByExternalId(normalized)
    const inMemoryDeduped = normalized.length - deduplicated.length

    // Stage-tag every insert as `pending`. Graduation is a separate process
    // (Phase 4 order router promotes to `broker-paper-tracking` after fill).
    const rows = deduplicated.map((s) => ({
      agent_id: s.agent_id,
      body: s.body,
      confidence: s.confidence,
      source_url: s.source_url,
      status: "pending" as const,
      symbol: s.symbol ?? null,
      side: s.side ?? null,
      target_weight: s.target_weight ?? null,
      stage_tag: "pending" as const,
      external_id: s.external_id,
      source_id: s.source_id,
    }))

    let ingested = 0
    let errors = 0
    let persisted: PersistedSignal[] = []

    if (rows.length > 0) {
      const { data, error } = await supabase
        .from("v2_signals")
        // Cast: external_id / source_id added in migration 0005;
        // symbol / side / target_weight / stage_tag added in migration 0010.
        .upsert(rows as never, {
          onConflict: "source_id,external_id",
          ignoreDuplicates: true,
        })
        // Include external_id so we can reliably match inserted rows back
        // to their source NormalizedSignal. Index-based zipping is wrong
        // when duplicates live mid-batch — only new rows are returned.
        .select("id, created_at, external_id")

      if (error) {
        errors = 1
        warnings.push(`upsert_failed: ${error.message}`)
        await recordFailure(this.agentId)
        return {
          run_id,
          agent_id: this.agentId,
          status: "failed",
          ingested: 0,
          deduped: inMemoryDeduped,
          errors,
          warnings,
          duration_ms: Date.now() - startedAt,
        }
      }

      ingested = data?.length ?? 0

      const returned = (data ?? []) as Array<{
        id: string
        created_at: string
        external_id: string | null
      }>
      const byExternal = new Map<string, NormalizedSignal>()
      for (const s of deduplicated) byExternal.set(s.external_id, s)
      for (const r of returned) {
        if (!r.external_id) continue
        const src = byExternal.get(r.external_id)
        if (!src) continue
        persisted.push({ ...src, id: r.id, created_at: r.created_at })
      }
    }

    // DB-enforced dedup count = (what we tried to insert) − (what was actually inserted)
    const dbDeduped = Math.max(0, deduplicated.length - ingested)
    const totalDeduped = inMemoryDeduped + dbDeduped

    // Phase 4 order routing. Strict contract: a broken Alpaca session must
    // never fail ingestion. Router catches its own errors and returns a
    // result; we only surface the summary into warnings for visibility.
    if (persisted.length > 0) {
      try {
        const routing = await routeOrders(persisted)
        if (routing.submitted > 0 || routing.failed > 0) {
          warnings.push(
            `alpaca: submitted=${routing.submitted} failed=${routing.failed} skipped=${routing.skipped}`
          )
        }
      } catch (err) {
        warnings.push(`alpaca_router_threw: ${errMsg(err)}`)
      }
    }

    // Heartbeat — success path. `last_signal_id` intentionally omitted here;
    // keeping heartbeat writes cheap/idempotent during ingest.
    const { error: hbError } = await supabase
      .from("v2_agent_heartbeats")
      .upsert(
        {
          agent_id: this.agentId,
          last_seen: new Date().toISOString(),
          status: "online",
        } as never,
        { onConflict: "agent_id" }
      )
    if (hbError) {
      warnings.push(`heartbeat_failed: ${hbError.message}`)
    }

    await recordSuccess(this.agentId)

    const status: IngestionStatus = errors === 0 ? "success" : "partial"
    return {
      run_id,
      agent_id: this.agentId,
      status,
      ingested,
      deduped: totalDeduped,
      errors,
      warnings,
      duration_ms: Date.now() - startedAt,
    }
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}
