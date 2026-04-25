// Ported from v1 council-exchange/components/floor/AgentPanel.tsx.
//
// Adaptations from v1:
//   - Win Rate / Avg Return tiles show "—" with a "Day N / 90" hint
//     instead of v1's faked "100%" / "+9.4%". Integrity contract:
//     no claim is published until the math gate earns it.
//   - "Signals" tile uses real signals_lifetime from v2.
//   - "Last Signal" block shows the parsed last_signal_body from v2.
//   - View Signals + Lease Agent CTAs replaced with one $49/mo /pricing
//     link (v2's actual subscription product).

"use client"

import Link from "next/link"
import {
  Activity,
  Target,
  TrendingUp,
  X,
  Zap,
} from "lucide-react"
import type { CouncilAgent } from "@/lib/floor/agents-data"

interface AgentPanelProps {
  agent: CouncilAgent
  // Day in the 90-day verification window — used to communicate progress
  // on the still-unearned win rate / avg return tiles.
  dayOfWindow: number
  totalWindowDays: number
  onClose: () => void
}

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "ACTIVE", color: "#22c55e" },
  scanning: { label: "SCANNING", color: "#60a5fa" },
  signal: { label: "⚡ SIGNAL", color: "#f59e0b" },
  idle: { label: "IDLE", color: "#6b7280" },
}

export function AgentDetailPanel({
  agent,
  dayOfWindow,
  totalWindowDays,
  onClose,
}: AgentPanelProps) {
  const status = statusLabels[agent.status]
  const verifyingLabel = `Day ${dayOfWindow} / ${totalWindowDays}`

  return (
    <div
      style={{
        background: "rgba(5,5,15,0.95)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${agent.color}44`,
        borderRadius: "16px",
        padding: "24px",
        width: "320px",
        boxShadow: `0 0 40px ${agent.color}22, 0 20px 60px rgba(0,0,0,0.8)`,
        fontFamily: "var(--font-space-grotesk, system-ui)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "0.15em",
              color: agent.color + "99",
              marginBottom: "4px",
            }}
          >
            AGENT {agent.code}
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            {agent.isNova ? `${agent.name} 👑` : agent.name}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#ffffff66",
              marginTop: "2px",
            }}
          >
            {agent.specialty}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            padding: "6px",
            cursor: "pointer",
            color: "#ffffff66",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Status + Verifying chips */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: status.color,
            background: status.color + "18",
            border: `1px solid ${status.color}44`,
            borderRadius: "6px",
            padding: "4px 10px",
          }}
        >
          {status.label}
        </span>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "#c9a84c",
            background: "#c9a84c18",
            border: "1px solid #c9a84c44",
            borderRadius: "6px",
            padding: "4px 10px",
          }}
        >
          VERIFYING · {verifyingLabel}
        </span>
      </div>

      {/* Stats grid — real lifetime signals + orders, gated win rate */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {[
          {
            icon: Activity,
            label: "Signals",
            value: agent.totalSignals.toLocaleString(),
            color: agent.color,
            sub: agent.totalSignals > 0 ? "lifetime" : "no signals yet",
          },
          {
            icon: Zap,
            label: "Orders",
            value: agent.ordersSubmitted.toLocaleString(),
            color: "#60a5fa",
            sub: `${agent.ordersFilled.toLocaleString()} filled`,
          },
          {
            icon: TrendingUp,
            label: "Win Rate",
            value: "—",
            color: "#a78bfa",
            sub: `earns at day ${totalWindowDays}`,
          },
          {
            icon: Target,
            label: "Avg Return",
            value: "—",
            color: "#c9a84c",
            sub: `earns at day ${totalWindowDays}`,
          },
        ].map(({ icon: Icon, label, value, color, sub }) => (
          <div
            key={label}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "10px",
              padding: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "6px",
              }}
            >
              <Icon size={12} color={color} />
              <span
                style={{
                  fontSize: "10px",
                  color: "#ffffff44",
                  letterSpacing: "0.1em",
                }}
              >
                {label.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color }}>
              {value}
            </div>
            {sub ? (
              <div
                style={{
                  fontSize: "10px",
                  color: "#ffffff33",
                  marginTop: "2px",
                  letterSpacing: "0.06em",
                }}
              >
                {sub}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Verification progress bar */}
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "6px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "#ffffff44",
              letterSpacing: "0.1em",
            }}
          >
            VERIFICATION
          </span>
          <span
            style={{
              fontSize: "11px",
              color: agent.color,
              fontWeight: 600,
            }}
          >
            {Math.round((dayOfWindow / totalWindowDays) * 100)}%
          </span>
        </div>
        <div
          style={{
            height: "4px",
            background: "rgba(255,255,255,0.06)",
            borderRadius: "2px",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, (dayOfWindow / totalWindowDays) * 100)}%`,
              background: `linear-gradient(90deg, ${agent.color}, ${agent.color}cc)`,
              borderRadius: "2px",
              transition: "width 0.8s ease",
            }}
          />
        </div>
      </div>

      {/* Last signal — real text */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "10px",
          padding: "12px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            color: "#ffffff33",
            letterSpacing: "0.12em",
            marginBottom: "6px",
          }}
        >
          LAST SIGNAL
        </div>
        <div style={{ fontSize: "13px", color: "#ffffffcc", lineHeight: 1.5 }}>
          {agent.lastSignal}
        </div>
      </div>

      {/* Thesis line */}
      <div
        style={{
          fontSize: "11px",
          color: "#ffffff44",
          letterSpacing: "0.05em",
          marginBottom: "16px",
          fontStyle: "italic",
        }}
      >
        {agent.thesis}
      </div>

      {/* Single CTA — $49/mo Early Access */}
      <Link
        href="/pricing"
        onClick={onClose}
        style={{
          display: "block",
          width: "100%",
          background: `linear-gradient(135deg, ${agent.color}, ${agent.color}bb)`,
          color: "#000",
          border: "none",
          borderRadius: "10px",
          padding: "12px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.05em",
          cursor: "pointer",
          textAlign: "center",
          textDecoration: "none",
        }}
      >
        Get Early Access — $49/mo →
      </Link>
    </div>
  )
}

export default AgentDetailPanel
