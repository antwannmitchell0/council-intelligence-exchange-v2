// ThirteenFDiffAgent — quarter-over-quarter diff layer for 13F-HR.
//
// The thirteen-f-agent ingests SEC 13F-HR information tables and emits one
// snapshot signal per (filing, holding) with `side = null`. Snapshots aren't
// directly tradable — alpha lives in the *changes* between consecutive
// quarterly filings (Ziobrowski 2004, Griffin & Xu 2009, Ali / Wei / Zhou
// 2011). This agent reads recent thirteen-f-agent output, groups by filer,
// finds the most recent two `period_of_report` values per filer, and emits
// new transactional signals for the diffs:
//
//   NEW_ENTRY  — CUSIP in current quarter, not in prior      → side = "buy"
//   EXIT       — CUSIP in prior quarter, not in current      → side = "sell"
//   GROW       — shares > 1.25x the prior quarter            → side = "buy"
//   SHRINK     — shares < 0.75x the prior quarter            → side = "sell"
//   HOLD       — within ±25% band                            → not emitted
//
// Bootstrap behavior — first appearance of a filer in our DB has no prior
// quarter, so it emits zero signals from that filer. The next filing 3
// months later starts producing diffs. This is intentional: alpha *is*
// quarter-over-quarter change, not first-time discovery.
//
// Data source: our own Supabase. No upstream HTTP, no rate limiter — just
// SQL + JSON parse + diff math + emit.
//
// External ID:
//   `${current_accession}:${cusip}:${event_type}` — unique per (filing ×
//   holding × event), so a NEW_ENTRY signal for AAPL in Berkshire's 2026Q1
//   filing dedups cleanly against a future GROW signal in 2026Q2.

import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { getServerClient } from "@/lib/supabase/server"
import type { NormalizedSignal, OrderSide, RawSignal } from "../types"

const SOURCE_ID = "sec-edgar-13fhr"
const AGENT_ID = "thirteen-f-diff-agent"

// Read window — how far back we scan for thirteen-f-agent output to find
// "this quarter's" filings. 7 days catches anything the snapshot agent
// landed in the last week. The diff agent itself runs daily, so weekly
// overlap is fine — dedup handles re-emission.
const SCAN_WINDOW_DAYS = 7

// How far back we look for the prior quarter's snapshot rows. 13F-HR is
// quarterly with a 45-day post-period grace, so 200 days catches the most
// recent prior period plus margin for late filers and amendments.
const PRIOR_LOOKBACK_DAYS = 200

// Diff thresholds. ±25% bands are well above noise from share-price-only
// movements (which 13F never reports — it reports shares + value) and
// catches meaningful conviction changes without firing on rebalancing
// drift. Tunable via env if we ever want to A/B alternate thresholds.
const GROW_RATIO = Number(process.env.THIRTEEN_F_DIFF_GROW_RATIO ?? "1.25")
const SHRINK_RATIO = Number(process.env.THIRTEEN_F_DIFF_SHRINK_RATIO ?? "0.75")

type EventType = "NEW_ENTRY" | "EXIT" | "GROW" | "SHRINK"

type SnapshotBody = {
  filer_cik?: string | null
  filer_name?: string | null
  accession?: string
  period_of_report?: string | null
  cusip?: string
  ticker?: string
  shares?: number | null
  value_raw?: number | null
  name_of_issuer?: string | null
}

type SnapshotRow = {
  body: SnapshotBody
  source_url: string | null
  created_at: string
}

type FilerHolding = {
  cusip: string
  ticker: string
  shares: number | null
  value_raw: number | null
  name_of_issuer: string | null
}

type FilerPeriod = {
  filer_cik: string
  filer_name: string | null
  period_of_report: string
  accession: string
  source_url: string | null
  // CUSIP → holding for fast intersection.
  holdings: Map<string, FilerHolding>
}

type DiffEvent = {
  filer_cik: string
  filer_name: string | null
  current: FilerPeriod
  prior: FilerPeriod
  event: EventType
  cusip: string
  ticker: string
  // Shares + values from current quarter (or null on EXIT, where current
  // doesn't hold the position).
  current_shares: number | null
  prior_shares: number | null
  current_value: number | null
  prior_value: number | null
  name_of_issuer: string | null
}

function parseBody(raw: string): SnapshotBody | null {
  try {
    const obj = JSON.parse(raw) as unknown
    if (typeof obj !== "object" || obj === null) return null
    return obj as SnapshotBody
  } catch {
    return null
  }
}

function eventToSide(event: EventType): OrderSide {
  return event === "NEW_ENTRY" || event === "GROW" ? "buy" : "sell"
}

/**
 * groupByFilerPeriod — collapse a flat list of snapshot rows into the
 * (filer_cik, period_of_report) buckets the diff math operates on. Each
 * bucket carries the accession + filer_name + holdings map for that
 * specific filing. We deliberately keep ONE accession per
 * (filer, period) — amendments would create duplicates which would be
 * resolved by `created_at` ordering (latest wins).
 */
function groupByFilerPeriod(rows: SnapshotRow[]): Map<string, FilerPeriod[]> {
  const byFiler = new Map<string, FilerPeriod[]>()
  // Pre-bucket by (filer, period) → accumulate holdings.
  const byKey = new Map<string, FilerPeriod>()

  for (const row of rows) {
    const b = row.body
    const filer_cik = (b.filer_cik ?? "").toString().trim()
    const period = (b.period_of_report ?? "").toString().trim()
    const accession = (b.accession ?? "").toString().trim()
    const cusip = (b.cusip ?? "").toString().trim().toUpperCase()
    const ticker = (b.ticker ?? "").toString().trim().toUpperCase()
    if (!filer_cik || !period || !accession || !cusip || !ticker) continue

    const key = `${filer_cik}::${period}::${accession}`
    let bucket = byKey.get(key)
    if (!bucket) {
      bucket = {
        filer_cik,
        filer_name: b.filer_name ?? null,
        period_of_report: period,
        accession,
        source_url: row.source_url,
        holdings: new Map(),
      }
      byKey.set(key, bucket)
    }
    // First-write wins. Snapshot agent already dedups same-CUSIP same-
    // accession in-run, so within a single filing we should see at most
    // one row per CUSIP. If we see more than one (amendment chain), the
    // first one we encounter is fine — the diff math doesn't care about
    // discretion-bucket nuance.
    if (!bucket.holdings.has(cusip)) {
      bucket.holdings.set(cusip, {
        cusip,
        ticker,
        shares: b.shares ?? null,
        value_raw: b.value_raw ?? null,
        name_of_issuer: b.name_of_issuer ?? null,
      })
    }
  }

  // Collapse → one filing per (filer, period). If a filer has multiple
  // accessions for the same period (rare — usually only on amendments),
  // pick the one with the most holdings (typically the most-complete
  // filing).
  const byFilerPeriod = new Map<string, FilerPeriod>()
  for (const bucket of byKey.values()) {
    const fpKey = `${bucket.filer_cik}::${bucket.period_of_report}`
    const existing = byFilerPeriod.get(fpKey)
    if (!existing || bucket.holdings.size > existing.holdings.size) {
      byFilerPeriod.set(fpKey, bucket)
    }
  }

  for (const fp of byFilerPeriod.values()) {
    const list = byFiler.get(fp.filer_cik) ?? []
    list.push(fp)
    byFiler.set(fp.filer_cik, list)
  }

  // Sort each filer's filings by period_of_report DESC. ISO-like dates
  // (YYYY-MM-DD or 2026-Q1 style) sort lexicographically the same as
  // chronologically.
  for (const list of byFiler.values()) {
    list.sort((a, b) =>
      a.period_of_report < b.period_of_report ? 1 : a.period_of_report > b.period_of_report ? -1 : 0
    )
  }
  return byFiler
}

/**
 * computeDiffs — for each filer with ≥2 distinct quarterly filings, compare
 * the most recent two periods and emit one DiffEvent per change.
 */
function computeDiffs(byFiler: Map<string, FilerPeriod[]>): DiffEvent[] {
  const events: DiffEvent[] = []
  for (const [filer_cik, periods] of byFiler) {
    if (periods.length < 2) continue
    const current = periods[0]
    const prior = periods[1]

    // NEW_ENTRY + GROW: walk current holdings, compare to prior.
    for (const [cusip, h] of current.holdings) {
      const p = prior.holdings.get(cusip)
      if (!p) {
        events.push({
          filer_cik,
          filer_name: current.filer_name,
          current,
          prior,
          event: "NEW_ENTRY",
          cusip,
          ticker: h.ticker,
          current_shares: h.shares,
          prior_shares: null,
          current_value: h.value_raw,
          prior_value: null,
          name_of_issuer: h.name_of_issuer,
        })
        continue
      }
      // Both quarters hold this CUSIP → ratio check on shares (preferred)
      // or value (fallback). 13F reports both; shares is unambiguous, value
      // floats with price.
      const cs = h.shares
      const ps = p.shares
      if (cs == null || ps == null || ps === 0) continue
      const ratio = cs / ps
      if (ratio >= GROW_RATIO) {
        events.push({
          filer_cik,
          filer_name: current.filer_name,
          current,
          prior,
          event: "GROW",
          cusip,
          ticker: h.ticker,
          current_shares: cs,
          prior_shares: ps,
          current_value: h.value_raw,
          prior_value: p.value_raw,
          name_of_issuer: h.name_of_issuer,
        })
      } else if (ratio <= SHRINK_RATIO) {
        events.push({
          filer_cik,
          filer_name: current.filer_name,
          current,
          prior,
          event: "SHRINK",
          cusip,
          ticker: h.ticker,
          current_shares: cs,
          prior_shares: ps,
          current_value: h.value_raw,
          prior_value: p.value_raw,
          name_of_issuer: h.name_of_issuer,
        })
      }
      // HOLD (within ±25%) → not emitted.
    }

    // EXIT: walk prior holdings, find any CUSIP not in current.
    for (const [cusip, p] of prior.holdings) {
      if (current.holdings.has(cusip)) continue
      events.push({
        filer_cik,
        filer_name: current.filer_name,
        current,
        prior,
        event: "EXIT",
        cusip,
        ticker: p.ticker,
        current_shares: null,
        prior_shares: p.shares,
        current_value: null,
        prior_value: p.value_raw,
        name_of_issuer: p.name_of_issuer,
      })
    }
  }
  return events
}

export class ThirteenFDiffAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  /**
   * fetch — pull thirteen-f-agent's snapshot rows from Supabase, scoped to
   * the recent ingest window (for current-quarter filings) plus the prior
   * lookback (for the prior-quarter baseline). Group, diff, and emit one
   * RawSignal per detected event.
   */
  protected async fetch(): Promise<RawSignal[]> {
    const supabase = getServerClient()
    if (!supabase) {
      throw new Error("supabase_client_unavailable")
    }

    // Pull both windows in a single query — the diff math needs at least
    // two periods per filer, so we read everything in the union and let
    // groupByFilerPeriod handle the bookkeeping.
    const sinceMs =
      Date.now() - PRIOR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    const sinceIso = new Date(sinceMs).toISOString()

    // Filter by source_id so we only see the snapshot agent's output (not
    // future signals from this diff agent itself, which share source_id but
    // have a different agent_id).
    const { data, error } = await supabase
      .from("v2_signals")
      .select("body, source_url, created_at, agent_id")
      .eq("source_id", SOURCE_ID)
      .eq("agent_id", "thirteen-f-agent")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(50000)

    if (error) {
      throw new Error(`v2_signals read failed: ${error.message}`)
    }

    const rows: SnapshotRow[] = []
    for (const r of data ?? []) {
      const body = parseBody((r as { body: string }).body)
      if (!body) continue
      rows.push({
        body,
        source_url: (r as { source_url: string | null }).source_url,
        created_at: (r as { created_at: string }).created_at,
      })
    }

    // Restrict to filers whose CURRENT period falls inside the recent scan
    // window — i.e. filers that filed something in the last week. Otherwise
    // we'd re-emit the same diffs every day forever.
    const recentCutoffMs =
      Date.now() - SCAN_WINDOW_DAYS * 24 * 60 * 60 * 1000

    const byFilerPeriod = groupByFilerPeriod(rows)

    // Drop filers whose latest filing is older than the scan window. They
    // already had their diff emitted on whatever day that filing landed.
    for (const [filer_cik, periods] of byFilerPeriod) {
      if (periods.length === 0) {
        byFilerPeriod.delete(filer_cik)
        continue
      }
      // Find the latest created_at across all this filer's snapshot rows
      // (we don't have it on FilerPeriod directly; reconstruct from rows).
      // Cheap O(n) scan — n is at most a few thousand per filer.
      let latestMs = 0
      for (const row of rows) {
        const cik = (row.body.filer_cik ?? "").toString().trim()
        if (cik !== filer_cik) continue
        const ms = Date.parse(row.created_at)
        if (Number.isFinite(ms) && ms > latestMs) latestMs = ms
      }
      if (latestMs < recentCutoffMs) byFilerPeriod.delete(filer_cik)
    }

    const events = computeDiffs(byFilerPeriod)

    return events.map((e) => ({
      source_id: SOURCE_ID,
      external_id: `${e.current.accession}:${e.cusip}:${e.event}`,
      fetched_at: new Date().toISOString(),
      payload: e,
    }))
  }

  protected parse(raw: RawSignal[]): NormalizedSignal[] {
    const out: NormalizedSignal[] = []
    for (const r of raw) {
      const e = r.payload as DiffEvent
      const external_id = buildExternalId([
        SOURCE_ID,
        e.current.accession,
        e.cusip,
        e.event,
      ])

      const body = JSON.stringify({
        event: e.event,
        filer_cik: e.filer_cik,
        filer_name: e.filer_name,
        ticker: e.ticker,
        cusip: e.cusip,
        name_of_issuer: e.name_of_issuer,
        current_accession: e.current.accession,
        current_period: e.current.period_of_report,
        prior_accession: e.prior.accession,
        prior_period: e.prior.period_of_report,
        current_shares: e.current_shares,
        prior_shares: e.prior_shares,
        current_value: e.current_value,
        prior_value: e.prior_value,
        share_ratio:
          e.current_shares != null && e.prior_shares != null && e.prior_shares !== 0
            ? Number((e.current_shares / e.prior_shares).toFixed(4))
            : null,
      })

      out.push({
        agent_id: AGENT_ID,
        source_id: SOURCE_ID,
        external_id,
        body,
        confidence: null,
        source_url: e.current.source_url,
        status: "pending",
        symbol: e.ticker,
        side: eventToSide(e.event),
        target_weight: null,
      })
    }
    return out
  }
}
