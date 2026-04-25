// Daily digest email — 9 AM ET / 14:00 UTC.
//
// Pulls yesterday's signals from v2_signals, groups by agent, ranks. The
// digest cron does the data fetching; this template just formats.

export type DigestSignal = {
  agent_display_name: string
  agent_id: string
  symbol: string | null
  side: "buy" | "sell" | null
  body_summary: string // human-readable one-liner
  source_url: string | null
}

export type DigestAgentSummary = {
  agent_id: string
  display_name: string
  signal_count: number
  status_emoji: "🟢" | "🟡" | "🔴" // health from fleet panel
  // Top 3 signals from this agent for the digest body.
  top_signals: DigestSignal[]
}

export type DigestEmailInput = {
  // ISO date "2026-04-25" — the day BEING digested (so a 9 AM ET email
  // covers signals through end of day yesterday Eastern).
  digest_date: string
  total_signals_24h: number
  agent_summaries: DigestAgentSummary[]
  unsubscribe_email: string
}

export function digestSubject(input: DigestEmailInput): string {
  const top = input.agent_summaries[0]
  if (!top || top.signal_count === 0) {
    return `Council · ${input.digest_date} · Quiet day`
  }
  return `Council · ${input.digest_date} · ${input.total_signals_24h.toLocaleString()} signals across ${input.agent_summaries.filter((a) => a.signal_count > 0).length} agents`
}

export function digestText(input: DigestEmailInput): string {
  const lines: string[] = [
    `Council Intelligence — ${input.digest_date} digest`,
    "",
    `${input.total_signals_24h.toLocaleString()} new signals across ${input.agent_summaries.filter((a) => a.signal_count > 0).length} active agents.`,
    "",
    "─".repeat(60),
    "",
  ]

  for (const agent of input.agent_summaries) {
    if (agent.signal_count === 0) continue
    lines.push(
      `${agent.status_emoji} ${agent.display_name} — ${agent.signal_count} signals`
    )
    for (const sig of agent.top_signals) {
      const dir = sig.side ? `[${sig.side.toUpperCase()}]` : "[snapshot]"
      const sym = sig.symbol ?? "—"
      lines.push(`    ${dir} ${sym}  ${sig.body_summary}`)
    }
    lines.push("")
  }

  lines.push("─".repeat(60))
  lines.push("")
  lines.push("Not investment advice. Educational research platform.")
  lines.push("Methodology: https://council-intelligence-exchange-v2.vercel.app/intelligence")
  lines.push("")
  lines.push(
    `To cancel: reply with "cancel" or manage your subscription via the Stripe email you received at signup. ${input.unsubscribe_email}`
  )

  return lines.join("\n")
}

export function digestHtml(input: DigestEmailInput): string {
  const activeAgents = input.agent_summaries.filter((a) => a.signal_count > 0)

  const agentBlocks = activeAgents
    .map((agent) => {
      const sigs = agent.top_signals
        .map((sig) => {
          const dir = sig.side
            ? `<span style="font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${
                sig.side === "buy" ? "#10b981" : "#ef4444"
              };">${sig.side}</span>`
            : `<span style="font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;">snapshot</span>`
          const sym = sig.symbol
            ? `<span style="font-family:ui-monospace,monospace;font-size:13px;color:#ffffff;">${sig.symbol}</span>`
            : `<span style="color:#6b7280;">—</span>`
          const link = sig.source_url
            ? `<a href="${sig.source_url}" style="color:#a78bfa;text-decoration:none;">${escapeHtml(sig.body_summary)}</a>`
            : escapeHtml(sig.body_summary)
          return `<tr><td style="padding:6px 0;font-size:13px;color:#d1d5db;line-height:1.55;">${dir} &nbsp; ${sym} &nbsp; ${link}</td></tr>`
        })
        .join("")
      return `
        <div style="margin:24px 0;">
          <p style="margin:0 0 8px;font-size:14px;color:#ffffff;">
            ${agent.status_emoji} <span style="font-weight:600;">${escapeHtml(agent.display_name)}</span>
            <span style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9ca3af;margin-left:8px;">${agent.signal_count} signals</span>
          </p>
          <table cellspacing="0" cellpadding="0" border="0" style="width:100%;">${sigs}</table>
        </div>
      `
    })
    .join("")

  const emptyMsg = `<p style="font-size:14px;color:#9ca3af;line-height:1.6;">Quiet day — no agents fired signals in the last 24 hours. Either the markets stayed boring, or one of our crons is sulking. Check the <a href="https://council-intelligence-exchange-v2.vercel.app/admin" style="color:#a78bfa;">command center</a>.</p>`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>Council Intelligence Digest</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <p style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#9ca3af;margin:0 0 12px;">
      Council Intelligence · ${input.digest_date}
    </p>
    <h1 style="font-size:24px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;color:#ffffff;margin:0 0 8px;">
      ${input.total_signals_24h.toLocaleString()} signals · ${activeAgents.length} agents
    </h1>
    <p style="font-size:13px;color:#9ca3af;margin:0 0 32px;">
      Yesterday's intelligence — top three signals per active agent.
    </p>

    ${activeAgents.length > 0 ? agentBlocks : emptyMsg}

    <hr style="border:none;border-top:1px solid #1f2937;margin:40px 0 24px;" />

    <p style="font-size:12px;line-height:1.6;color:#6b7280;margin:0 0 12px;">
      Not investment advice. Educational research platform. See the <a href="https://council-intelligence-exchange-v2.vercel.app/intelligence" style="color:#9ca3af;text-decoration:underline;">Methodology</a>.
    </p>
    <p style="font-size:11px;font-family:ui-monospace,monospace;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;margin:0;">
      To cancel · reply &quot;cancel&quot; · or manage via your Stripe receipt
    </p>
  </div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
