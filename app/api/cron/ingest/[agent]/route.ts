// Dynamic cron entrypoint: /api/cron/ingest/{agent}
// Vercel Cron pings this with Authorization: Bearer $CRON_SECRET.
// The `agent` param maps to a BaseIngestionAgent factory in the registry.

import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"
import { resolveAgent, listRegisteredAgents } from "@/lib/ingestion/registry"
import { sendAlert } from "@/lib/notifications/webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Fluid Compute default on all plans; explicit here so the agent has
// room to fetch, parse, and upsert large batches.
export const maxDuration = 300

type RouteContext = {
  params: Promise<{ agent: string }>
}

function logEvent(event: string, data: Record<string, unknown>): void {
  // Structured single-line log — plays nicely with Vercel Log Drains.
  try {
    console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }))
  } catch {
    console.log(event, data)
  }
}

// Fire-and-forget alert. We use waitUntil so the cron's response isn't
// gated on the webhook round-trip; if the webhook is slow or fails, the
// cron itself still returns on time.
function alertFailure(
  agentId: string,
  reason: string,
  detail: string
): void {
  waitUntil(
    sendAlert({
      severity: "error",
      title: `Cron failed: ${agentId}`,
      description: `**${reason}**\n\n${detail}`,
      fields: [
        { name: "Agent", value: agentId, inline: true },
        { name: "Reason", value: reason, inline: true },
        {
          name: "Vercel logs",
          value:
            "https://vercel.com/antwanns-projects/council-intelligence-exchange-v2/logs",
          inline: false,
        },
      ],
    })
  )
}

export async function GET(request: Request, ctx: RouteContext) {
  const requestedAt = Date.now()
  const expected = process.env.CRON_SECRET
  if (!expected) {
    logEvent("cron.ingest.misconfigured", { reason: "cron_secret_not_configured" })
    return NextResponse.json(
      { ok: false, error: "cron_secret_not_configured" },
      { status: 503 }
    )
  }

  const auth = request.headers.get("authorization") ?? ""
  if (auth !== `Bearer ${expected}`) {
    logEvent("cron.ingest.unauthorized", {})
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    )
  }

  const { agent: agentId } = await ctx.params

  const agent = resolveAgent(agentId)
  if (!agent) {
    logEvent("cron.ingest.unknown_agent", {
      agent_id: agentId,
      registered: listRegisteredAgents(),
    })
    return NextResponse.json(
      {
        ok: false,
        error: "unknown_agent",
        agent_id: agentId,
        registered: listRegisteredAgents(),
      },
      { status: 404 }
    )
  }

  logEvent("cron.ingest.start", { agent_id: agentId })

  try {
    const result = await agent.run()
    const http =
      result.status === "failed"
        ? 500
        : result.status === "partial"
        ? 207
        : 200
    logEvent("cron.ingest.finish", {
      agent_id: agentId,
      status: result.status,
      ingested: result.ingested,
      deduped: result.deduped,
      errors: result.errors,
      warnings: result.warnings,
      duration_ms: result.duration_ms,
      http,
      request_duration_ms: Date.now() - requestedAt,
    })
    if (result.status === "failed") {
      alertFailure(
        agentId,
        "agent_run_returned_failed",
        `errors: ${result.errors}\nwarnings: ${result.warnings.join("; ") || "none"}`
      )
    }
    return NextResponse.json({ ok: result.status !== "failed", result }, { status: http })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    logEvent("cron.ingest.threw", {
      agent_id: agentId,
      message,
      stack,
      request_duration_ms: Date.now() - requestedAt,
    })
    alertFailure(agentId, "agent_run_threw", message)
    return NextResponse.json(
      { ok: false, error: "agent_run_threw", message, agent_id: agentId },
      { status: 500 }
    )
  }
}
