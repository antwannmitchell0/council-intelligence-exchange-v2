"use client"

import { useEffect, useState } from "react"
import { getBrowserClient } from "@/lib/supabase/client"
import { BLANK } from "@/lib/render-if-verified"

type Stats = {
  agentsOnline: number | null
  signalsToday: number | null
  verifiedPct: number | null
}

type Props = { initial: Stats }

export function HeroStatsClient({ initial }: Props) {
  const [stats, setStats] = useState<Stats>(initial)

  useEffect(() => {
    const supabase = getBrowserClient()
    if (!supabase) return
    const refresh = async () => {
      const { data } = await supabase.rpc("v2_hero_stats").maybeSingle()
      if (data) {
        setStats({
          agentsOnline: (data as { agents_online: number }).agents_online,
          signalsToday: (data as { signals_today: number }).signals_today,
          verifiedPct: (data as { verified_pct: number }).verified_pct,
        })
      }
    }
    const ch = supabase
      .channel("v2_hero_stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_signals" },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_agent_heartbeats" },
        () => void refresh()
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [])

  const items = [
    { label: "Agents online", value: stats.agentsOnline, unit: "/ 9" as const },
    { label: "Signals today", value: stats.signalsToday, unit: undefined },
    { label: "Verified", value: stats.verifiedPct, unit: "%" as const },
  ]

  return (
    <dl className="relative z-10 mt-20 grid w-full max-w-3xl grid-cols-3 gap-6 border-t border-graphite pt-10">
      {items.map((item) => {
        const hasValue = item.value != null
        return (
          <div key={item.label} className="flex flex-col gap-2">
            <dt className="mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
              {item.label}
            </dt>
            <dd
              className={`mono flex items-baseline gap-1.5 text-[28px] font-medium sm:text-[36px] ${
                hasValue ? "text-ink" : "text-ink-veiled"
              }`}
            >
              {hasValue ? Math.round(item.value as number) : BLANK}
              {item.unit ? (
                <span className="text-base text-ink-muted">{item.unit}</span>
              ) : null}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
