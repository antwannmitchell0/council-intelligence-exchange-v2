// Parses v2_signals.body (JSON-in-text) into a short human-readable
// summary. Mirrors the per-agent shape logic from the daily-digest
// cron (app/api/cron/daily-digest/route.ts:summarizeSignal). Pure —
// safe on the client.

export function summarizeSignalBody(
  agent_id: string,
  body: string | null
): string | null {
  if (!body) return null
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(body)
  } catch {
    // Body wasn't JSON — fall back to raw string.
    return body.slice(0, 120).replace(/\s+/g, " ")
  }

  const get = (key: string): string => {
    const v = parsed[key]
    if (v == null) return ""
    return String(v)
  }

  switch (agent_id) {
    case "insider-filing-agent": {
      const owner = get("reporting_owner") || get("filer_name") || "an insider"
      const ticker = get("symbol")
      const side = get("side")
      if (ticker && side) return `${owner} · ${side.toUpperCase()} ${ticker}`
      if (ticker) return `${owner} · Form 4 · ${ticker}`
      return `${owner} filed Form 4`
    }
    case "thirteen-f-agent": {
      const filer = get("filer_name") || get("filer_cik") || "a filer"
      const ticker = get("ticker")
      if (ticker) return `${filer} holds ${ticker}`
      return `${filer} 13F position`
    }
    case "thirteen-f-diff-agent": {
      const event = get("event") || "DIFF"
      const filer = get("filer_name") || "a filer"
      const ticker = get("ticker")
      if (ticker) return `${event} · ${filer} · ${ticker}`
      return `${event} · ${filer}`
    }
    case "congress-agent": {
      const rep = get("representative") || "a senator"
      const txn = get("transaction_type") || "trade"
      const ticker = get("ticker")
      if (ticker) return `${rep} · ${txn} · ${ticker}`
      return `${rep} · ${txn}`
    }
    case "yield-curve-agent":
    case "fed-futures-agent": {
      const series = get("series_id")
      const value = get("value")
      const delta = get("delta")
      if (series && value) {
        return delta && delta !== "null"
          ? `${series} = ${value} (Δ ${delta})`
          : `${series} = ${value}`
      }
      return "FRED observation published"
    }
    case "jobs-data-agent": {
      const series = get("series_id")
      const value = get("value")
      if (series && value) return `${series} = ${value}`
      return "BLS data published"
    }
    case "gdelt-event-volume-agent":
      return "Global news event-volume anomaly"
    case "wiki-edit-surge-agent":
      return "Wikipedia edit surge detected"
    case "etherscan-whale-agent":
      return "On-chain whale transaction detected"
    case "clinical-trial-outcomes-agent": {
      const status = get("status_transition") || get("status") || "transition"
      const sponsor = get("sponsor")
      return sponsor ? `${sponsor} · ${status}` : `Trial ${status}`
    }
    default:
      return body.slice(0, 80).replace(/\s+/g, " ")
  }
}

/** Truncate a long summary to fit a speech bubble or compact tile. */
export function truncate(s: string | null, n: number): string | null {
  if (!s) return null
  if (s.length <= n) return s
  return `${s.slice(0, n - 1)}…`
}
