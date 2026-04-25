// Ported from v1 council-exchange/components/floor/NetworkStats.tsx.
//
// Adaptations from v1:
//   - Total Agents = 11 (not v1's 9)
//   - Active / Scanning derive from real per-agent CouncilAgent.status
//   - Avg Win Rate stays "—" with "Verifying" subscript (no fake 100%)
//   - Total Signals = sum of agent.totalSignals (real lifetime counts)
//   - Each agent row shows real lifetime signal count, not v1's "100%"

"use client"

import {
  Activity,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import type { CouncilAgent } from "@/lib/floor/agents-data"

interface Props {
  agents: CouncilAgent[]
  selectedAgent: CouncilAgent | null
  onSelectAgent: (agent: CouncilAgent | null) => void
  // Day in the 90-day window — feeds the "Verifying" subscript.
  dayOfWindow: number
  totalWindowDays: number
}

export function FloorSidebar({
  agents,
  selectedAgent,
  onSelectAgent,
  dayOfWindow,
  totalWindowDays,
}: Props) {
  const total = agents.length
  const active = agents.filter(
    (a) => a.status === "active" || a.status === "signal"
  ).length
  const scanning = agents.filter((a) => a.status === "scanning").length
  const totalSignals = agents.reduce((s, a) => s + a.totalSignals, 0)

  const tiles: Array<{
    icon: typeof Users
    label: string
    value: string
    sub?: string
    color: string
  }> = [
    {
      icon: Users,
      label: "Total Agents",
      value: total.toString(),
      color: "#c9a84c",
    },
    {
      icon: Activity,
      label: "Active Now",
      value: active.toString(),
      color: "#22c55e",
    },
    {
      icon: Zap,
      label: "Scanning",
      value: scanning.toString(),
      color: "#60a5fa",
    },
    {
      icon: TrendingUp,
      label: "Avg Win Rate",
      value: "—",
      sub: `Day ${dayOfWindow} / ${totalWindowDays}`,
      color: "#a78bfa",
    },
  ]

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        fontFamily: "var(--font-space-grotesk, system-ui)",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid rgba(201,168,76,0.15)",
          paddingBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            color: "#c9a84c99",
            letterSpacing: "0.15em",
            marginBottom: "4px",
          }}
        >
          NETWORK STATUS
        </div>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>
          Live Trading Floor
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "6px",
          }}
        >
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#22c55e",
              animation: "pulse 2s infinite",
            }}
          />
          <span style={{ fontSize: "12px", color: "#22c55e" }}>
            ALL SYSTEMS OPERATIONAL
          </span>
        </div>
      </div>

      {/* Stat tiles */}
      {tiles.map(({ icon: Icon, label, value, sub, color }) => (
        <div
          key={label}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "12px",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "10px" }}
          >
            <div
              style={{
                background: color + "18",
                border: `1px solid ${color}33`,
                borderRadius: "8px",
                padding: "7px",
                display: "flex",
              }}
            >
              <Icon size={14} color={color} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "13px", color: "#ffffff66" }}>
                {label}
              </span>
              {sub ? (
                <span
                  style={{
                    fontSize: "10px",
                    color: "#ffffff33",
                    letterSpacing: "0.05em",
                    marginTop: "1px",
                  }}
                >
                  {sub}
                </span>
              ) : null}
            </div>
          </div>
          <span style={{ fontSize: "18px", fontWeight: 700, color }}>
            {value}
          </span>
        </div>
      ))}

      {/* Agent roster — clickable rows */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingTop: "16px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            color: "#ffffff33",
            letterSpacing: "0.1em",
            marginBottom: "12px",
          }}
        >
          AGENT ROSTER
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {agents.map((agent) => {
            const isSelected = selectedAgent?.code === agent.code
            const dotColor =
              agent.status === "active" || agent.status === "signal"
                ? "#22c55e"
                : agent.status === "scanning"
                  ? "#60a5fa"
                  : "#4b5563"
            return (
              <button
                key={agent.code}
                type="button"
                onClick={() => onSelectAgent(isSelected ? null : agent)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  background: isSelected
                    ? agent.color + "18"
                    : "rgba(255,255,255,0.02)",
                  borderRadius: "8px",
                  border: `1px solid ${
                    isSelected ? agent.color + "55" : "rgba(255,255,255,0.04)"
                  }`,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "6px",
                      background: agent.color + "22",
                      border: `1px solid ${agent.color}44`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: agent.color,
                    }}
                  >
                    {agent.code}
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#ffffffcc",
                      fontWeight: 500,
                    }}
                  >
                    {agent.isNova ? `${agent.name} 👑` : agent.name}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "#ffffff44" }}>
                    {agent.totalSignals.toLocaleString()}
                  </span>
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: dotColor,
                    }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Total signals counter */}
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.03))",
          border: "1px solid rgba(201,168,76,0.2)",
          borderRadius: "12px",
          padding: "16px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "32px",
            fontWeight: 800,
            color: "#c9a84c",
            letterSpacing: "-0.02em",
          }}
        >
          {totalSignals.toLocaleString()}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#c9a84c99",
            letterSpacing: "0.12em",
            marginTop: "4px",
          }}
        >
          TOTAL SIGNALS · LIFETIME
        </div>
      </div>
    </div>
  )
}
