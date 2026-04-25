// Floor page client wrapper. Hosts the Canvas, the v1-style header bar
// with LIVE pill / Info / Fullscreen, the agent detail panel overlay,
// and the right-side network-stats sidebar. Mirrors v1's
// council-exchange/app/floor/page.tsx structure.

"use client"

import dynamic from "next/dynamic"
import { Canvas } from "@react-three/fiber"
import { Suspense, useState } from "react"
import { Info, Maximize2, Zap } from "lucide-react"
import { AgentDetailPanel } from "@/components/floor/agent-detail-panel"
import { FloorSidebar } from "@/components/floor/floor-sidebar"
import {
  buildCouncilAgents,
  type CouncilAgent,
} from "@/lib/floor/agents-data"
import type { PublicAgentEntry } from "@/lib/public/types"

const TradingFloor3D = dynamic(
  () =>
    import("@/components/floor/trading-floor-3d").then((m) => ({
      default: m.TradingFloor3D,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050508",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "2px solid rgba(201,168,76,0.2)",
            borderTop: "2px solid #c9a84c",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <span
          style={{
            color: "#c9a84c99",
            fontSize: "13px",
            letterSpacing: "0.1em",
          }}
        >
          INITIALIZING TRADING FLOOR...
        </span>
      </div>
    ),
  }
)

type Props = {
  roster: PublicAgentEntry[]
  dayOfWindow: number
  totalWindowDays: number
}

export function FloorClient({ roster, dayOfWindow, totalWindowDays }: Props) {
  const agents = buildCouncilAgents(roster)
  const [selectedAgent, setSelectedAgent] = useState<CouncilAgent | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [showHelp, setShowHelp] = useState(true)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050508",
        fontFamily: "var(--font-space-grotesk, system-ui)",
      }}
    >
      {/* Page header — title + LIVE pill + Info / Fullscreen toggles */}
      <div
        style={{
          borderBottom: "1px solid rgba(201,168,76,0.1)",
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(5,5,15,0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              background: "rgba(201,168,76,0.15)",
              border: "1px solid rgba(201,168,76,0.3)",
              borderRadius: "10px",
              padding: "8px",
              display: "flex",
            }}
          >
            <Zap size={18} color="#c9a84c" />
          </div>
          <div>
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              THE COUNCIL{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #c9a84c, #f59e0b)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                TRADING FLOOR
              </span>
            </h1>
            <p
              style={{
                fontSize: "13px",
                color: "#ffffff44",
                margin: "2px 0 0",
                letterSpacing: "0.05em",
              }}
            >
              {agents.length} AI agents working in real time · Click any desk to inspect
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: "8px",
              padding: "7px 14px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
            <span
              style={{
                fontSize: "12px",
                color: "#22c55e",
                fontWeight: 600,
                letterSpacing: "0.08em",
              }}
            >
              LIVE
            </span>
          </div>

          <button
            onClick={() => setShowHelp(!showHelp)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "8px",
              cursor: "pointer",
              color: showHelp ? "#c9a84c" : "#ffffff44",
              display: "flex",
            }}
          >
            <Info size={16} />
          </button>

          <button
            onClick={() => setFullscreen(!fullscreen)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "8px",
              cursor: "pointer",
              color: "#ffffff66",
              display: "flex",
            }}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Help bar — shown by default, toggled via Info button */}
      {showHelp && (
        <div
          style={{
            background: "rgba(201,168,76,0.05)",
            borderBottom: "1px solid rgba(201,168,76,0.1)",
            padding: "10px 32px",
            display: "flex",
            gap: "32px",
            fontSize: "12px",
            color: "#c9a84c99",
            letterSpacing: "0.05em",
            flexWrap: "wrap",
          }}
        >
          {[
            "🖱️ Click a desk to inspect agent",
            "🔄 Drag to rotate",
            "🔍 Scroll to zoom",
            "✋ Right-click drag to pan",
          ].map((tip) => (
            <span key={tip}>{tip}</span>
          ))}
        </div>
      )}

      {/* Main split — 3D canvas | sidebar */}
      <div
        style={{
          display: "flex",
          height: fullscreen ? "calc(100vh - 64px)" : "calc(100vh - 140px)",
        }}
      >
        <div
          style={{
            flex: 1,
            position: "relative",
            minHeight: "500px",
          }}
        >
          <Canvas
            camera={{ position: [0, 7, 12], fov: 52, near: 0.1, far: 100 }}
            style={{ background: "#050508", width: "100%", height: "100%" }}
            shadows
          >
            <Suspense fallback={null}>
              <TradingFloor3D
                agents={agents}
                selectedAgent={selectedAgent}
                onSelectAgent={setSelectedAgent}
              />
            </Suspense>
          </Canvas>

          {/* Detail panel — overlays the canvas, top-left */}
          {selectedAgent && (
            <div
              style={{
                position: "absolute",
                top: "24px",
                left: "24px",
                zIndex: 10,
                animation: "fadeInUp 0.2s ease",
              }}
            >
              <AgentDetailPanel
                agent={selectedAgent}
                dayOfWindow={dayOfWindow}
                totalWindowDays={totalWindowDays}
                onClose={() => setSelectedAgent(null)}
              />
            </div>
          )}

          {/* Status legend — bottom right */}
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              right: "16px",
              background: "rgba(5,5,15,0.85)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px",
              padding: "12px 16px",
              display: "flex",
              gap: "16px",
              fontSize: "11px",
              letterSpacing: "0.08em",
            }}
          >
            {[
              { color: "#22c55e", label: "ACTIVE" },
              { color: "#f59e0b", label: "SIGNAL" },
              { color: "#60a5fa", label: "SCANNING" },
              { color: "#4b5563", label: "IDLE" },
            ].map(({ color, label }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: color,
                  }}
                />
                <span style={{ color: "#ffffff55" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            width: "280px",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(5,5,12,0.9)",
            backdropFilter: "blur(12px)",
            padding: "24px",
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          <FloorSidebar
            agents={agents}
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgent}
            dayOfWindow={dayOfWindow}
            totalWindowDays={totalWindowDays}
          />
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
