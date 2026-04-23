"use client"

import { useEffect, useMemo, useState } from "react"
import { getBrowserClient } from "@/lib/supabase/client"
import type { AgentRow, SignalRow } from "@/lib/supabase/types"
import { agentColor, type AgentId } from "@/design/tokens"

type Props = {
  initialSignals: SignalRow[]
  agents: AgentRow[]
}

const MAX_ROWS = 20

export function LiveFeedClient({ initialSignals, agents }: Props) {
  const [signals, setSignals] = useState<SignalRow[]>(initialSignals)

  const agentMap = useMemo(() => {
    const m = new Map<string, AgentRow>()
    for (const a of agents) m.set(a.id, a)
    return m
  }, [agents])

  useEffect(() => {
    const supabase = getBrowserClient()
    if (!supabase) return
    const channel = supabase
      .channel("v2_signals")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "v2_signals" },
        (payload) => {
          const row = payload.new as SignalRow
          if (row.status !== "verified") return
          setSignals((prev) => [row, ...prev].slice(0, MAX_ROWS))
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "v2_signals" },
        (payload) => {
          const row = payload.new as SignalRow
          if (row.status !== "verified") return
          setSignals((prev) => {
            const existing = prev.find((r) => r.id === row.id)
            if (existing) return prev.map((r) => (r.id === row.id ? row : r))
            return [row, ...prev].slice(0, MAX_ROWS)
          })
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  if (signals.length === 0) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center rounded-[8px] border border-dashed border-graphite bg-obsidian/20 text-center">
        <p className="mono mb-2 text-[12px] uppercase tracking-[0.18em] text-ink-muted">
          Feed idle
        </p>
        <p className="text-[15px] text-ink-body/60">
          The Council is listening. Next verified signal lands here.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col">
      {signals.map((signal) => {
        const agent = agentMap.get(signal.agent_id)
        const color =
          agent?.hex ?? agentColor(signal.agent_id as AgentId)
        return (
          <li
            key={signal.id}
            style={{
              animation:
                "council-row-enter 180ms var(--ease-council-out) both",
            }}
            className="grid grid-cols-[96px_auto_1fr_72px] items-center gap-4 border-b border-graphite/60 px-1 py-4 last:border-b-0"
          >
            <time
              className="mono text-[12px] text-ink-muted"
              dateTime={signal.created_at}
            >
              {formatTs(signal.created_at)}
            </time>
            <span
              aria-label={agent?.name ?? signal.agent_id}
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
            />
            <p className="text-[15px] leading-[1.5] text-ink">
              {signal.body}
            </p>
            <span className="mono text-right text-[13px] text-ink-body/70">
              {signal.confidence != null
                ? `${Math.round(signal.confidence)}%`
                : "—"}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso)
    const hh = String(d.getHours()).padStart(2, "0")
    const mm = String(d.getMinutes()).padStart(2, "0")
    const ss = String(d.getSeconds()).padStart(2, "0")
    return `${hh}:${mm}:${ss}`
  } catch {
    return iso
  }
}
