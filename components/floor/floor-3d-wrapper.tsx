"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import { AgentDetailDrawer } from "@/components/marketplace/agent-detail-drawer"
import { council } from "@/design/tokens"
import type {
  AgentRow,
  SignalRow,
  SourceRow,
} from "@/lib/supabase/types"

// Dynamically import Floor3D so three.js doesn't bloat the initial bundle
const Floor3D = dynamic(() => import("./floor-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <p className="mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
        Loading the floor…
      </p>
    </div>
  ),
})

type Props = {
  agents: AgentRow[]
  sources: SourceRow[]
  latestSignals: SignalRow[]
}

export function Floor3DWrapper({ agents, sources, latestSignals }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  const agentsById = useMemo(() => {
    const m = new Map<string, AgentRow>()
    for (const a of agents) m.set(a.id, a)
    return m
  }, [agents])

  const sourcesByAgent = useMemo(() => {
    const m = new Map<string, SourceRow[]>()
    for (const s of sources) {
      const list = m.get(s.agent_id) ?? []
      list.push(s)
      m.set(s.agent_id, list)
    }
    return m
  }, [sources])

  const latestSignalByAgent = useMemo(() => {
    const m = new Map<string, SignalRow>()
    for (const s of latestSignals) if (!m.has(s.agent_id)) m.set(s.agent_id, s)
    return m
  }, [latestSignals])

  const drawerAgent: AgentRow | null = openId
    ? (agentsById.get(openId) ??
      (() => {
        const staticAgent = council.agent.find((a) => a.id === openId)
        if (!staticAgent) return null
        return {
          id: staticAgent.id,
          name: staticAgent.name,
          hex: staticAgent.hex,
          brief: null,
          bio_md: null,
          specialty: null,
          joined_at: new Date().toISOString(),
          status: "pending" as const,
          price_monthly_cents: null,
          tier_label: null,
        } satisfies AgentRow
      })())
    : null

  return (
    <>
      <div
        className="relative w-full overflow-hidden rounded-[16px] border border-graphite bg-gradient-to-b from-obsidian/60 to-void/90"
        style={{ aspectRatio: "16 / 10", minHeight: 480 }}
      >
        <Floor3D agents={agents} onAgentClick={setOpenId} />
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <div className="mono flex items-center gap-2 rounded-full border border-graphite bg-void/80 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] backdrop-blur-sm">
            <span className="text-ink-muted">Drag to rotate</span>
            <span className="text-ink-veiled">·</span>
            <span className="text-ink-muted">Scroll to zoom</span>
            <span className="text-ink-veiled">·</span>
            <span className="text-ink-muted">Click desk to inspect</span>
          </div>
        </div>
      </div>

      <AgentDetailDrawer
        agent={drawerAgent}
        sources={openId ? sourcesByAgent.get(openId) ?? [] : []}
        latestSignal={
          openId ? latestSignalByAgent.get(openId) ?? null : null
        }
        onClose={() => setOpenId(null)}
      />
    </>
  )
}
