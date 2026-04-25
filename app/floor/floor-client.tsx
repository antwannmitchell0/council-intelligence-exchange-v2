// FloorClient — full /floor experience composed on the client.
//
// Layout (mirrors v1 council-exchange.vercel.app/floor in v2 violet/dark):
//   [Header — title + LIVE pill + instructions]
//   [3D scene canvas       |  Right sidebar (300px)   ]
//                           |   Stats + agent roster
//                           |   Total signals counter
//   [Click a desk → AgentDetailPanel overlays the canvas]

"use client"

import { Canvas } from "@react-three/fiber"
import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import { AgentDetailPanel } from "@/components/floor/agent-detail-panel"
import { FloorHeader } from "@/components/floor/floor-header"
import {
  FloorSidebar,
  deriveStatus,
} from "@/components/floor/floor-sidebar"
import {
  agentForNickname,
  nicknameForAgent,
  type FloorNickname,
} from "@/lib/floor/nicknames"
import type {
  PublicAgentEntry,
  PublicOpsSnapshot,
} from "@/lib/public/operations"
import type { AgentRow } from "@/lib/supabase/types"

const TradingFloor3D = dynamic(
  () =>
    import("@/components/floor/trading-floor-3d").then((m) => ({
      default: m.TradingFloor3D,
    })),
  { ssr: false }
)

type Props = {
  ops: PublicOpsSnapshot
  roster: PublicAgentEntry[]
  nicknames: FloorNickname[]
}

export function FloorClient({ ops, roster, nicknames }: Props) {
  const [ready, setReady] = useState(false)
  const [selectedNickname, setSelectedNickname] = useState<string | null>(null)

  // Index roster by agent_id for fast detail-panel lookup.
  const rosterByAgentId = useMemo(() => {
    const map = new Map<string, PublicAgentEntry>()
    for (const r of roster) map.set(r.agent_id, r)
    return map
  }, [roster])

  // Convert public roster + nicknames into the AgentRow shape that the
  // existing TradingFloor3D scene expects. Filtered to the 11 codenamed
  // trading agents only — this is what hides the legacy vendor-service
  // slate from showing up on the public floor.
  const sceneAgents = useMemo<AgentRow[]>(() => {
    return nicknames.map((n) => {
      const live = rosterByAgentId.get(n.agent_id)
      const status: AgentRow["status"] =
        live && live.signals_lifetime > 0 ? "verified" : "pending"
      return {
        id: n.agent_id,
        name: n.nickname,
        hex: n.hex,
        brief: n.thesis,
        bio_md: null,
        specialty: null,
        joined_at: new Date().toISOString(),
        status,
        price_monthly_cents: null,
        tier_label: null,
      }
    })
  }, [nicknames, rosterByAgentId])

  // Build the sidebar roster rows with derived live status.
  const sidebarRoster = useMemo(() => {
    return nicknames.map((n) => {
      const live = rosterByAgentId.get(n.agent_id)
      return {
        nickname: n,
        status: live ? deriveStatus(live) : ("idle" as const),
        signals_lifetime: live?.signals_lifetime ?? 0,
      }
    })
  }, [nicknames, rosterByAgentId])

  const liveCount = sidebarRoster.filter((r) => r.status === "active").length

  // Resolve selected nickname → both the codename metadata and the live entry.
  const selectedNicknameMeta = selectedNickname
    ? agentForNickname(selectedNickname)
    : null
  const selectedEntry = selectedNicknameMeta
    ? rosterByAgentId.get(selectedNicknameMeta.agent_id) ?? null
    : null

  return (
    <div className="flex min-h-screen flex-col">
      <FloorHeader agentCount={nicknames.length} liveCount={liveCount} />

      <div className="flex flex-1 flex-col md:flex-row">
        {/* 3D scene area */}
        <div className="relative flex-1">
          {/* Loading curtain */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-void/95 transition-opacity duration-500"
            style={{ opacity: ready ? 0 : 1 }}
          >
            <div className="flex flex-col items-center gap-3">
              <span className="relative inline-block h-3 w-3">
                <span className="absolute inset-0 animate-ping rounded-full bg-violet-glow opacity-50" />
                <span className="relative inline-block h-3 w-3 rounded-full bg-violet" />
              </span>
              <p className="mono text-[11px] uppercase tracking-[0.18em] text-violet-glow">
                Initializing trading floor…
              </p>
            </div>
          </div>

          {/* 3D canvas */}
          <div className="h-full min-h-[500px]">
            <Canvas
              shadows
              camera={{ position: [0, 11, 18], fov: 50 }}
              gl={{ antialias: true, alpha: true }}
              style={{
                background: "transparent",
                width: "100%",
                height: "100%",
              }}
              onCreated={() => setReady(true)}
            >
              <TradingFloor3D
                agents={sceneAgents}
                onAgentClick={(agent_id) => {
                  const nick = nicknameForAgent(agent_id)
                  if (nick) setSelectedNickname(nick.nickname)
                }}
              />
            </Canvas>
          </div>

          {/* Bottom-right legend */}
          <div className="pointer-events-none absolute bottom-4 right-4 flex gap-4 rounded-md border border-graphite bg-void/85 px-4 py-2 text-[10px] backdrop-blur-md">
            {[
              { label: "Active", color: "bg-emerald-400" },
              { label: "Scanning", color: "bg-sky-400" },
              { label: "Idle", color: "bg-graphite" },
            ].map((entry) => (
              <span
                key={entry.label}
                className="mono flex items-center gap-1.5 uppercase tracking-[0.14em] text-ink-veiled"
              >
                <span
                  aria-hidden
                  className={`inline-block h-1.5 w-1.5 rounded-full ${entry.color}`}
                />
                {entry.label}
              </span>
            ))}
          </div>

          {/* Detail panel — only renders when a nickname is selected */}
          {selectedNicknameMeta ? (
            <AgentDetailPanel
              nickname={selectedNicknameMeta}
              entry={selectedEntry}
              onClose={() => setSelectedNickname(null)}
            />
          ) : null}
        </div>

        {/* Right sidebar */}
        <FloorSidebar
          ops={ops}
          roster={sidebarRoster}
          selectedNickname={selectedNickname}
          onSelect={setSelectedNickname}
        />
      </div>
    </div>
  )
}
