"use client"

import { useMemo, useState } from "react"
import { AgentProductCard } from "@/components/marketplace/agent-product-card"
import { AgentDetailDrawer } from "@/components/marketplace/agent-detail-drawer"
import type { AgentRow, SignalRow, SourceRow } from "@/lib/supabase/types"

type Props = {
  items: { agent: AgentRow; sources: SourceRow[] }[]
  latestSignals: SignalRow[]
}

export function MarketplaceGrid({ items, latestSignals }: Props) {
  const [openAgentId, setOpenAgentId] = useState<string | null>(null)

  const signalByAgent = useMemo(() => {
    const m = new Map<string, SignalRow>()
    for (const s of latestSignals) {
      if (!m.has(s.agent_id)) m.set(s.agent_id, s)
    }
    return m
  }, [latestSignals])

  const openItem = items.find((i) => i.agent.id === openAgentId) ?? null

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ agent, sources }) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => setOpenAgentId(agent.id)}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-glow focus-visible:ring-offset-2 focus-visible:ring-offset-void rounded-[12px]"
            aria-label={`Open ${agent.name} details`}
          >
            <AgentProductCard agent={agent} sources={sources} />
          </button>
        ))}
      </div>

      <AgentDetailDrawer
        agent={openItem?.agent ?? null}
        sources={openItem?.sources ?? []}
        latestSignal={
          openItem ? signalByAgent.get(openItem.agent.id) ?? null : null
        }
        onClose={() => setOpenAgentId(null)}
      />
    </>
  )
}
