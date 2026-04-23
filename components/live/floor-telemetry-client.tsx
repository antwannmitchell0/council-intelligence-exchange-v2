"use client"

import { useEffect, useState } from "react"
import { getBrowserClient } from "@/lib/supabase/client"
import { council } from "@/design/tokens"
import { BLANK } from "@/lib/render-if-verified"
import type { HeartbeatRow } from "@/lib/supabase/types"

type Props = { initialHeartbeats: HeartbeatRow[] }

const statusLabel: Record<HeartbeatRow["status"], string> = {
  online: "online",
  idle: "idle",
  offline: "offline",
  degraded: "degraded",
}

const statusColor: Record<HeartbeatRow["status"], string> = {
  online: "text-success",
  idle: "text-ink-muted",
  offline: "text-ink-veiled",
  degraded: "text-council-amber",
}

export function FloorTelemetryClient({ initialHeartbeats }: Props) {
  const [beats, setBeats] = useState(
    new Map(initialHeartbeats.map((h) => [h.agent_id, h]))
  )

  useEffect(() => {
    const supabase = getBrowserClient()
    if (!supabase) return
    const ch = supabase
      .channel("v2_heartbeats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_agent_heartbeats" },
        (payload) => {
          const row = (payload.new ?? payload.old) as HeartbeatRow
          setBeats((prev) => {
            const next = new Map(prev)
            if (payload.eventType === "DELETE") next.delete(row.agent_id)
            else next.set(row.agent_id, row)
            return next
          })
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [])

  return (
    <div className="grid gap-3">
      {council.agent.map((agent) => {
        const beat = beats.get(agent.id)
        const status = beat?.status
        return (
          <div
            key={agent.id}
            className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-6 rounded-[8px] border border-graphite bg-obsidian/40 px-6 py-5"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor: agent.hex,
                boxShadow: `0 0 12px ${agent.hex}`,
                opacity: status === "online" ? 1 : 0.35,
              }}
              aria-hidden
            />
            <span className="text-[15px] font-medium text-ink">
              {agent.name}
            </span>
            <span className="mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              status
            </span>
            <span
              className={`mono text-[13px] ${
                status ? statusColor[status] : "text-ink-veiled"
              }`}
            >
              {status ? statusLabel[status] : BLANK}
            </span>
          </div>
        )
      })}
    </div>
  )
}
