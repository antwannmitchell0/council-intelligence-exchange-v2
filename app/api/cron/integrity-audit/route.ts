// Phase 5 nightly integrity-audit cron.
// Schedule: "0 6 * * *" (06:00 UTC daily). Wired in vercel.ts.
// Auth: Authorization: Bearer $CRON_SECRET — same contract as /api/cron/ingest.
//
// Responsibilities:
//   1. Audit every agent in a tracked or verified-tier stage.
//   2. Promote agents that clear the math gate:
//        backtest-verified     → broker-paper-tracking (first Alpaca paper fill)
//        broker-paper-tracking → live-verified          (90d, IC≥0.05, Sharpe≥1, t>2)
//   3. Retire verified-tier agents whose trailing 30d math breaks down.
//   4. Emit a v2_integrity_events row for every decision, with full math context.
//
// The handler is a no-op (but still returns 200) when no agents are in
// tracked stages yet — Phase 5 infrastructure lands before Phase 4 populates
// the stages.

import { NextResponse } from "next/server"
import { runIntegrityAudit, type AuditDecision } from "@/lib/integrity/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Fluid Compute: 300s is plenty for N agents × small SELECT + a few UPDATEs.
export const maxDuration = 300

function logEvent(event: string, data: Record<string, unknown>): void {
  // Single-line JSON log — matches the pattern in app/api/cron/ingest/[agent]/route.ts.
  try {
    console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }))
  } catch {
    console.log(event, data)
  }
}

export async function GET(request: Request) {
  const requestedAt = Date.now()

  const expected = process.env.CRON_SECRET
  if (!expected) {
    logEvent("cron.integrity-audit.misconfigured", {
      reason: "cron_secret_not_configured",
    })
    return NextResponse.json(
      { ok: false, error: "cron_secret_not_configured" },
      { status: 503 }
    )
  }

  const auth = request.headers.get("authorization") ?? ""
  if (auth !== `Bearer ${expected}`) {
    logEvent("cron.integrity-audit.unauthorized", {})
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    )
  }

  logEvent("cron.integrity-audit.start", {})

  try {
    const summary = await runIntegrityAudit(logEvent)

    logEvent("cron.integrity-audit.finish", {
      checked: summary.checked,
      promoted: summary.promoted.length,
      retired: summary.retired.length,
      held: summary.held.length,
      promoted_agents: summary.promoted.map(idOf),
      retired_agents: summary.retired.map(idOf),
      duration_ms: summary.duration_ms,
      request_duration_ms: Date.now() - requestedAt,
    })

    return NextResponse.json(
      {
        ok: true,
        checked: summary.checked,
        promoted: summary.promoted,
        retired: summary.retired,
        held: summary.held,
        started_at: summary.started_at,
        finished_at: summary.finished_at,
        duration_ms: summary.duration_ms,
      },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    logEvent("cron.integrity-audit.threw", {
      message,
      stack,
      request_duration_ms: Date.now() - requestedAt,
    })
    return NextResponse.json(
      { ok: false, error: "integrity_audit_threw", message },
      { status: 500 }
    )
  }
}

function idOf(d: AuditDecision): string {
  return d.agent_id
}
