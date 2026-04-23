"use client"

import { useMemo, useState } from "react"
import { FloorCanvas } from "@/components/floor/floor-canvas"
import { AgentDetailDrawer } from "@/components/marketplace/agent-detail-drawer"
import { council } from "@/design/tokens"
import type {
  AgentRow,
  HeartbeatRow,
  HiveEventRow,
  SignalRow,
  SourceRow,
} from "@/lib/supabase/types"

type Props = {
  agents: AgentRow[]
  heartbeats: HeartbeatRow[]
  events: HiveEventRow[]
  signals: SignalRow[]
  sources: SourceRow[]
}

export function FloorWithDrawer({
  agents,
  heartbeats,
  events,
  signals,
  sources,
}: Props) {
  const [openAgentId, setOpenAgentId] = useState<string | null>(null)

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
    for (const s of signals) if (!m.has(s.agent_id)) m.set(s.agent_id, s)
    return m
  }, [signals])

  const drawerAgent = openAgentId
    ? (agentsById.get(openAgentId) ??
      (() => {
        const staticAgent = council.agent.find((a) => a.id === openAgentId)
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
      <FloorCanvas
        agents={agents}
        initialHeartbeats={heartbeats}
        initialEvents={events}
        initialSignals={signals}
        onAgentClick={(id) => setOpenAgentId(id)}
      />

      <AgentDetailDrawer
        agent={drawerAgent}
        sources={openAgentId ? sourcesByAgent.get(openAgentId) ?? [] : []}
        latestSignal={
          openAgentId ? latestSignalByAgent.get(openAgentId) ?? null : null
        }
        onClose={() => setOpenAgentId(null)}
      />
    </>
  )
}
