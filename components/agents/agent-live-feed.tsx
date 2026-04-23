"use client"

import { useEffect, useState } from "react"
import { getBrowserClient } from "@/lib/supabase/client"
import type { SignalRow } from "@/lib/supabase/types"

type Props = {
  agentId: string
  agentColor: string
  initialSignals: SignalRow[]
}

const MAX = 20

export function AgentLiveFeed({
  agentId,
  agentColor,
  initialSignals,
}: Props) {
  const [signals, setSignals] = useState<SignalRow[]>(initialSignals)

  useEffect(() => {
    const supabase = getBrowserClient()
    if (!supabase) return
    const ch = supabase
      .channel(`v2_agent_${agentId}_signals`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "v2_signals",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const row = payload.new as SignalRow
          if (row.status !== "verified") return
          setSignals((prev) => [row, ...prev].slice(0, MAX))
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "v2_signals",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const row = payload.new as SignalRow
          if (row.status !== "verified") return
          setSignals((prev) => {
            const existing = prev.find((s) => s.id === row.id)
            if (existing) return prev.map((s) => (s.id === row.id ? row : s))
            return [row, ...prev].slice(0, MAX)
          })
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [agentId])

  if (signals.length === 0) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center rounded-[8px] border border-dashed border-graphite bg-obsidian/20 text-center">
        <p className="mono mb-2 text-[12px] uppercase tracking-[0.18em] text-ink-muted">
          No verified signals yet
        </p>
        <p className="text-[14px] text-ink-body/60">
          When this agent publishes, it'll land here.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col">
      {signals.map((s) => (
        <li
          key={s.id}
          style={{
            animation: "council-row-enter 180ms var(--ease-council-out) both",
          }}
          className="grid grid-cols-[96px_auto_1fr_64px] items-start gap-4 border-b border-graphite/60 px-1 py-5 last:border-b-0"
        >
          <time
            className="mono text-[12px] text-ink-muted"
            dateTime={s.created_at}
          >
            {formatTs(s.created_at)}
          </time>
          <span
            aria-hidden
            className="mt-1.5 h-2 w-2 rounded-full"
            style={{
              backgroundColor: agentColor,
              boxShadow: `0 0 8px ${agentColor}`,
            }}
          />
          <p className="text-[15px] leading-[1.55] text-ink">{s.body}</p>
          <span className="mono text-right text-[13px] text-ink-body/70">
            {s.confidence != null ? `${Math.round(s.confidence)}%` : "—"}
          </span>
        </li>
      ))}
    </ul>
  )
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso)
    const month = (d.getMonth() + 1).toString().padStart(2, "0")
    const day = d.getDate().toString().padStart(2, "0")
    const hh = String(d.getHours()).padStart(2, "0")
    const mm = String(d.getMinutes()).padStart(2, "0")
    return `${month}/${day} ${hh}:${mm}`
  } catch {
    return iso
  }
}
