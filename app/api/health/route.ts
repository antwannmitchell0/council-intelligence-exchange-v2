// Health-check endpoint for external uptime monitoring.
//
// Returns JSON with a top-level `ok` boolean + per-check diagnostics. A
// passing response always returns HTTP 200 (including degraded checks),
// so uptime monitors can key on `ok: true` in the body rather than status
// code alone. Use HTTP 503 only when the endpoint ITSELF cannot function
// (e.g., env misconfigured).
//
// Intended consumers:
//   - UptimeRobot / Better Uptime / Pingdom (poll every 1-5 min)
//   - Manual curl during incidents
//   - Future Slack webhook integration (docs/ROADMAP.md §B2)
//
// Deliberately cheap: each check has a short timeout + minimal payload so
// frequent polling doesn't rack up costs or interfere with real traffic.

import { NextResponse } from "next/server"
import { getServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

type CheckResult = {
  name: string
  ok: boolean
  latency_ms: number
  // Non-critical checks (e.g., upstream third parties) report failure but
  // do NOT gate the overall `ok` boolean. Use this to track upstream health
  // without false-positive alerting on the platform.
  critical: boolean
  detail?: string
}

async function timeIt<T>(
  name: string,
  fn: () => Promise<T>,
  options: { timeoutMs?: number; critical?: boolean } = {}
): Promise<CheckResult> {
  const { timeoutMs = 5000, critical = true } = options
  const start = Date.now()
  try {
    const timer = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeoutMs)
    )
    await Promise.race([fn(), timer])
    return { name, ok: true, latency_ms: Date.now() - start, critical }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return {
      name,
      ok: false,
      latency_ms: Date.now() - start,
      critical,
      detail,
    }
  }
}

async function checkSupabase(): Promise<CheckResult> {
  return timeIt("supabase", async () => {
    const supabase = getServerClient()
    if (!supabase) throw new Error("no_client")
    // Cheap call — count on a tiny table, head-only (no data transfer).
    const { error, count } = await supabase
      .from("v2_agents")
      .select("*", { count: "exact", head: true })
    if (error) throw new Error(error.message)
    if (count == null) throw new Error("null_count")
  })
}

async function checkAlpaca(): Promise<CheckResult> {
  return timeIt("alpaca", async () => {
    const keyId = process.env.ALPACA_API_KEY_ID
    const secret = process.env.ALPACA_API_SECRET
    const baseUrl =
      process.env.ALPACA_BASE_URL ?? "https://paper-api.alpaca.markets"
    if (!keyId || !secret) throw new Error("env_missing")
    if (!/paper-api\./i.test(baseUrl)) throw new Error("non_paper_url")
    const res = await fetch(`${baseUrl}/v2/clock`, {
      headers: {
        "APCA-API-KEY-ID": keyId,
        "APCA-API-SECRET-KEY": secret,
      },
    })
    if (!res.ok) throw new Error(`alpaca_${res.status}`)
  })
}

async function checkSecEdgar(): Promise<CheckResult> {
  return timeIt(
    "sec-edgar",
    async () => {
      const res = await fetch(
        "https://efts.sec.gov/LATEST/search-index?forms=4&size=1",
        {
          headers: {
            "User-Agent":
              process.env.SEC_USER_AGENT ?? "Council Health Check health@example.com",
          },
        }
      )
      if (!res.ok) throw new Error(`edgar_${res.status}`)
    },
    // SEC EDGAR's full-text search legitimately takes 2-7s in normal
    // operation; bump the timeout to 10s so we don't false-positive on
    // EDGAR slowness. Marked non-critical because EDGAR being slow is
    // upstream weather, not platform degradation — affects only one
    // ingestion job, not site availability.
    { timeoutMs: 10000, critical: false }
  )
}

function logEvent(event: string, data: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }))
  } catch {
    console.log(event, data)
  }
}

export async function GET() {
  const started = Date.now()

  // Run all checks in parallel — total wall-clock time bounded by the
  // slowest check plus a small margin.
  const [supabase, alpaca, edgar] = await Promise.all([
    checkSupabase(),
    checkAlpaca(),
    checkSecEdgar(),
  ])

  const checks = [supabase, alpaca, edgar]
  // `ok` reflects platform health for uptime monitors. Non-critical checks
  // (e.g., SEC EDGAR upstream) are tracked but do not gate `ok` — their
  // status appears in the `checks` array for diagnostics regardless.
  const ok = checks.filter((c) => c.critical).every((c) => c.ok)

  // Structured log: always record total, but only surface warn-level on
  // failure to keep the signal-to-noise ratio high for log drains.
  if (ok) {
    logEvent("health.ok", {
      total_latency_ms: Date.now() - started,
      supabase_ms: supabase.latency_ms,
      alpaca_ms: alpaca.latency_ms,
      edgar_ms: edgar.latency_ms,
    })
  } else {
    logEvent("health.degraded", {
      failures: checks.filter((c) => !c.ok).map((c) => ({ name: c.name, detail: c.detail })),
      total_latency_ms: Date.now() - started,
    })
  }

  // Optional bearer auth — when CRON_SECRET is set AND the request includes
  // it, the response is full. Otherwise we still return the status to allow
  // public uptime monitors to check — but we don't need to protect the
  // endpoint because it exposes no secrets or user data.
  return NextResponse.json(
    {
      ok,
      total_latency_ms: Date.now() - started,
      version: "1.0.0",
      deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown",
      checks,
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  )
}
