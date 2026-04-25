// Daily digest cron — fires at 14:00 UTC (9 AM ET, market open).
//
// Pulls yesterday's signals from v2_signals, groups by agent, builds a
// per-subscriber digest email and sends via Resend. One email per
// active subscriber.
//
// V1 fanout pattern: linear send loop with rate-limit awareness. Resend's
// free tier is 100 emails/day, paid tier 100/sec. We're vastly under
// either ceiling for the foreseeable future, so no batching needed yet.
//
// Auth: Vercel cron pings with Authorization: Bearer ${CRON_SECRET}.
// Same shape as the ingest cron route.

import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"
import { getServerClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import {
  digestHtml,
  digestSubject,
  digestText,
  type DigestAgentSummary,
  type DigestSignal,
  type DigestEmailInput,
} from "@/lib/email/templates/digest"
import { sendAlert } from "@/lib/notifications/webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function logEvent(event: string, data: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }))
  } catch {
    console.log(event, data)
  }
}

// Pretty display names + status emojis — small mirror of lib/admin/status.ts
// because we don't want a circular dep just for this lookup.
const DISPLAY_NAMES: Record<string, string> = {
  "insider-filing-agent": "SEC Insider Filing",
  "thirteen-f-agent": "SEC 13F (snapshots)",
  "thirteen-f-diff-agent": "SEC 13F (diffs)",
  "congress-agent": "Congress (eFDSearch)",
  "yield-curve-agent": "Yield Curve",
  "jobs-data-agent": "Jobs Data",
  "fed-futures-agent": "Fed Futures",
  "gdelt-event-volume-agent": "GDELT Event Volume",
  "wiki-edit-surge-agent": "Wiki Edit Surge",
  "etherscan-whale-agent": "Etherscan Whale",
  "clinical-trial-outcomes-agent": "Clinical Trials",
}

const RENDER_ORDER: string[] = [
  "insider-filing-agent",
  "thirteen-f-agent",
  "thirteen-f-diff-agent",
  "congress-agent",
  "yield-curve-agent",
  "jobs-data-agent",
  "fed-futures-agent",
  "gdelt-event-volume-agent",
  "wiki-edit-surge-agent",
  "etherscan-whale-agent",
  "clinical-trial-outcomes-agent",
]

function summarizeSignal(row: {
  agent_id: string
  symbol: string | null
  side: string | null
  body: string
}): DigestSignal {
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(row.body)
  } catch {
    /* swallow */
  }

  // Build a one-liner per agent. Keep this small + scannable; subscribers
  // care about "what fired" not the full filing JSON.
  let summary = ""
  if (row.agent_id === "insider-filing-agent") {
    const name = String(parsed.reporting_owner ?? parsed.filer_name ?? "insider")
    summary = `${name} filed Form 4`
  } else if (row.agent_id === "thirteen-f-agent") {
    const filer = String(parsed.filer_name ?? parsed.filer_cik ?? "filer")
    summary = `${filer} holding`
  } else if (row.agent_id === "thirteen-f-diff-agent") {
    const event = String(parsed.event ?? "DIFF")
    const filer = String(parsed.filer_name ?? "filer")
    summary = `${event} · ${filer}`
  } else if (row.agent_id === "congress-agent") {
    const rep = String(parsed.representative ?? "senator")
    const txn = String(parsed.transaction_type ?? "trade")
    summary = `${rep} · ${txn}`
  } else if (row.agent_id === "yield-curve-agent" || row.agent_id === "fed-futures-agent") {
    const series = String(parsed.series_id ?? "")
    const value = parsed.value
    const delta = parsed.delta
    summary = `${series} = ${value}${delta != null ? ` (Δ ${delta})` : ""}`
  } else if (row.agent_id === "jobs-data-agent") {
    const series = String(parsed.series_id ?? "")
    const value = parsed.value
    summary = `${series} = ${value}`
  } else {
    // Fallback: first 80 chars of the body.
    summary = row.body.slice(0, 80).replace(/\s+/g, " ")
  }

  return {
    agent_id: row.agent_id,
    agent_display_name:
      DISPLAY_NAMES[row.agent_id] ?? row.agent_id,
    symbol: row.symbol,
    side: row.side === "buy" || row.side === "sell" ? row.side : null,
    body_summary: summary,
    source_url: null, // we don't include source_url from the row in this query
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now()
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "cron_secret_not_configured" },
      { status: 503 }
    )
  }
  const auth = request.headers.get("authorization") ?? ""
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const supabase = getServerClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "supabase_unavailable" },
      { status: 503 }
    )
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const digestDate = new Date().toISOString().slice(0, 10)

  // 1. Fetch signals from the last 24h.
  const { data: rawSignals, error: sigErr } = await supabase
    .from("v2_signals")
    .select("agent_id, symbol, side, body, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50000)

  if (sigErr) {
    logEvent("digest.fetch_signals_failed", { error: sigErr.message })
    return NextResponse.json(
      { ok: false, error: sigErr.message },
      { status: 500 }
    )
  }

  // 2. Group by agent, keep top-3 per agent.
  type Bucket = { count: number; samples: DigestSignal[] }
  const buckets = new Map<string, Bucket>()
  for (const row of (rawSignals ?? []) as Array<{
    agent_id: string
    symbol: string | null
    side: string | null
    body: string
    created_at: string
  }>) {
    const b = buckets.get(row.agent_id) ?? { count: 0, samples: [] }
    b.count += 1
    if (b.samples.length < 3) {
      b.samples.push(summarizeSignal(row))
    }
    buckets.set(row.agent_id, b)
  }

  // 3. Build the per-agent summary list (in render order).
  const agentSummaries: DigestAgentSummary[] = RENDER_ORDER.map((agent_id) => {
    const b = buckets.get(agent_id) ?? { count: 0, samples: [] }
    // Status emoji is a heuristic: green if signals fired today, red if
    // not. The /admin fleet panel has the canonical health view; this is
    // the email-friendly version.
    const status_emoji: "🟢" | "🟡" | "🔴" =
      b.count > 0 ? "🟢" : "🔴"
    return {
      agent_id,
      display_name: DISPLAY_NAMES[agent_id] ?? agent_id,
      signal_count: b.count,
      status_emoji,
      top_signals: b.samples,
    }
  })

  const totalSignals = agentSummaries.reduce((acc, a) => acc + a.signal_count, 0)

  // 4. Fetch active subscribers.
  const { data: subscribers, error: subErr } = await supabase
    .from("v2_subscribers")
    .select("email")
    .eq("status", "active")
  if (subErr) {
    logEvent("digest.fetch_subscribers_failed", { error: subErr.message })
    return NextResponse.json(
      { ok: false, error: subErr.message },
      { status: 500 }
    )
  }

  const list = (subscribers ?? []) as Array<{ email: string }>

  // 5. Send. Linear loop is fine for V1 — Resend handles 100/sec on paid
  // and 1/sec on free with auto-queueing. We're a long way from either
  // throttle.
  let sent = 0
  let failed = 0
  for (const sub of list) {
    const input: DigestEmailInput = {
      digest_date: digestDate,
      total_signals_24h: totalSignals,
      agent_summaries: agentSummaries,
      unsubscribe_email: process.env.RESEND_REPLY_TO ?? "info@demmmarketing.com",
    }
    const result = await sendEmail({
      to: sub.email,
      subject: digestSubject(input),
      html: digestHtml(input),
      text: digestText(input),
      tag: "digest",
    })
    if (result.ok) sent += 1
    else {
      failed += 1
      logEvent("digest.send_failed", {
        email: sub.email,
        error: result.error,
      })
    }
  }

  const duration_ms = Date.now() - startedAt
  logEvent("digest.finish", {
    digest_date: digestDate,
    subscribers: list.length,
    sent,
    failed,
    total_signals: totalSignals,
    duration_ms,
  })

  if (failed > 0) {
    waitUntil(
      sendAlert({
        severity: "warn",
        title: `Daily digest: ${failed}/${list.length} sends failed`,
        description: `Digest for ${digestDate} sent ${sent}, failed ${failed}. Check Vercel logs for per-recipient errors.`,
      })
    )
  }

  return NextResponse.json({
    ok: failed === 0,
    digest_date: digestDate,
    subscribers: list.length,
    sent,
    failed,
    total_signals: totalSignals,
    duration_ms,
  })
}
