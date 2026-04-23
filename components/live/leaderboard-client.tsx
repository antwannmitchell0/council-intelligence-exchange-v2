"use client"

import { useEffect, useMemo, useState } from "react"
import { getBrowserClient } from "@/lib/supabase/client"
import { council } from "@/design/tokens"
import { BLANK } from "@/lib/render-if-verified"
import type { AgentRow, LeaderboardRow } from "@/lib/supabase/types"

type Props = {
  initialRows: LeaderboardRow[]
  agents: AgentRow[]
}

export function LeaderboardClient({ initialRows, agents }: Props) {
  const [rows, setRows] = useState<LeaderboardRow[]>(initialRows)
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())

  const agentMap = useMemo(() => {
    const m = new Map<string, AgentRow>()
    for (const a of agents) m.set(a.id, a)
    return m
  }, [agents])

  useEffect(() => {
    const supabase = getBrowserClient()
    if (!supabase) return
    const ch = supabase
      .channel("v2_leaderboard")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "v2_leaderboard_snapshots",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as LeaderboardRow
          setRows((prev) => {
            const others = prev.filter((r) => r.agent_id !== row.agent_id)
            if (payload.eventType === "DELETE") return others
            return [...others, row].sort((a, b) => a.rank - b.rank)
          })
          setFlashIds((prev) => new Set([...prev, row.agent_id]))
          setTimeout(() => {
            setFlashIds((prev) => {
              const next = new Set(prev)
              next.delete(row.agent_id)
              return next
            })
          }, 900)
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [])

  const byAgent = new Map(rows.map((r) => [r.agent_id, r]))

  return (
    <div className="overflow-hidden rounded-[8px] border border-graphite bg-obsidian/40">
      <div className="mono grid grid-cols-[48px_1fr_120px_120px_80px] gap-4 border-b border-graphite px-6 py-4 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
        <span>#</span>
        <span>Agent</span>
        <span className="text-right">Signals 24h</span>
        <span className="text-right">Verified</span>
        <span className="text-right">Trend</span>
      </div>

      <ul>
        {[...council.agent]
          .sort((a, b) => {
            const ra = byAgent.get(a.id)?.rank ?? 999
            const rb = byAgent.get(b.id)?.rank ?? 999
            return ra - rb
          })
          .map((staticAgent) => {
            const agent = agentMap.get(staticAgent.id) ?? {
              ...staticAgent,
              brief: null,
              bio_md: null,
              specialty: null,
              joined_at: new Date().toISOString(),
              status: "pending" as const,
            }
            const row = byAgent.get(staticAgent.id)
            const flashing = flashIds.has(staticAgent.id)
            const rank = row?.rank ?? null
            return (
              <li
                key={staticAgent.id}
                className={`grid grid-cols-[48px_1fr_120px_120px_80px] items-center gap-4 border-b border-graphite/60 px-6 py-5 last:border-b-0 transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-graphite/40 ${
                  flashing ? "bg-violet-deep/10" : ""
                }`}
              >
                <span
                  className={`mono text-[18px] font-semibold ${
                    rank && rank <= 3 ? "text-violet" : "text-ink-veiled"
                  }`}
                >
                  {rank ? String(rank).padStart(2, "0") : BLANK}
                </span>
                <span className="flex items-center gap-3 text-[15px] font-medium text-ink">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: agent.hex,
                      boxShadow: row ? `0 0 8px ${agent.hex}` : "none",
                      opacity: row ? 1 : 0.45,
                    }}
                    aria-hidden
                  />
                  {agent.name}
                </span>
                <span
                  className={`mono text-right text-[15px] ${
                    row ? "text-ink" : "text-ink-veiled"
                  }`}
                >
                  {row?.signals_24h ?? BLANK}
                </span>
                <span
                  className={`mono text-right text-[15px] ${
                    row ? "text-cyan" : "text-ink-veiled"
                  }`}
                >
                  {row ? `${Math.round(row.verified_pct)}%` : BLANK}
                </span>
                <span className="mono text-right text-[15px]">
                  {row?.trend_7d && row.trend_7d.length > 1 ? (
                    <Sparkline values={row.trend_7d} color={agent.hex} />
                  ) : (
                    <span className="text-ink-veiled">{BLANK}</span>
                  )}
                </span>
              </li>
            )
          })}
      </ul>
    </div>
  )
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 40
  const height = 16
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  const step = width / (values.length - 1)
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ")
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}
