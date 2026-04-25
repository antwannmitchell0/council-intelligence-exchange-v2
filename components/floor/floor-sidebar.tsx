// FloorSidebar — right column on /floor.
//
// Mirrors v1's NETWORK STATUS sidebar in v2's violet/dark palette:
//   - Status header with pulsing emerald dot
//   - 4 stat cards: Total Agents · Active Now · Scanning · Avg Win Rate
//   - Agent roster (codename + status dot — click to focus on the floor)
//   - Big total-signals counter at bottom
//
// Stats are computed from the public roster + ops snapshot. Avg win rate
// is intentionally hidden until at least one agent earns live-verified
// (Day 90 earliest) — until then we show "—" because publishing a fake
// hit-rate is the integrity violation we publicly refuse to commit.

"use client"

import type { PublicAgentEntry, PublicOpsSnapshot } from "@/lib/public/types"
import type { FloorNickname } from "@/lib/floor/nicknames"

type FloorStatus = "active" | "scanning" | "idle"

type RosterRow = {
  nickname: FloorNickname
  status: FloorStatus
  signals_lifetime: number
}

type Props = {
  ops: PublicOpsSnapshot
  roster: RosterRow[]
  selectedNickname: string | null
  onSelect: (nickname: string | null) => void
}

const STATUS_DOT: Record<FloorStatus, string> = {
  active: "bg-emerald-400",
  scanning: "bg-sky-400",
  idle: "bg-graphite",
}

const STATUS_LABEL: Record<FloorStatus, string> = {
  active: "Active",
  scanning: "Scanning",
  idle: "Idle",
}

export function FloorSidebar({ ops, roster, selectedNickname, onSelect }: Props) {
  const total = roster.length
  const active = roster.filter((r) => r.status === "active").length
  const scanning = roster.filter((r) => r.status === "scanning").length

  // Each tile uses inline-style colors so we get the v1 council-exchange
  // gold + accent palette exactly, not the v2 violet/dark scheme.
  const tiles: Array<{
    label: string
    value: string
    color: string
    bg: string
    border: string
  }> = [
    {
      label: "Total agents",
      value: total.toString(),
      color: "#c9a84c", // gold (v1 TOTAL)
      bg: "rgba(201,168,76,0.08)",
      border: "rgba(201,168,76,0.3)",
    },
    {
      label: "Active now",
      value: active.toString(),
      color: "#22c55e", // emerald (v1 ACTIVE)
      bg: "rgba(34,197,94,0.08)",
      border: "rgba(34,197,94,0.3)",
    },
    {
      label: "Scanning",
      value: scanning.toString(),
      color: "#60a5fa", // blue (v1 SCANNING)
      bg: "rgba(96,165,250,0.08)",
      border: "rgba(96,165,250,0.3)",
    },
    {
      // Hit-rate is gated on earning live-verified status (Day 90+).
      // Showing it before is an integrity violation.
      label: "Avg win rate",
      value: "—",
      color: "#a78bfa", // purple (v1 WIN RATE)
      bg: "rgba(167,139,250,0.06)",
      border: "rgba(167,139,250,0.2)",
    },
  ]

  return (
    <aside className="flex h-full w-full flex-col gap-4 overflow-y-auto border-l border-graphite bg-void/85 p-5 backdrop-blur-md md:w-[300px]">
      {/* Network status header */}
      <div className="border-b border-graphite pb-4">
        <p
          className="mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "rgba(201,168,76,0.8)" }}
        >
          Network status
        </p>
        <p className="mt-1 text-[16px] font-semibold tracking-tight text-ink">
          Live Trading Floor
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span
            aria-hidden
            className="relative inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-50" />
          </span>
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            All systems operational
          </span>
        </div>
      </div>

      {/* Stat tiles — gold + accent palette per v1 council-exchange */}
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-md border px-3 py-2.5"
            style={{ backgroundColor: t.bg, borderColor: t.border }}
          >
            <p className="mono text-[9px] uppercase tracking-[0.18em] text-ink-veiled">
              {t.label}
            </p>
            <p
              className="mt-1 text-[20px] font-semibold leading-none"
              style={{ color: t.color }}
            >
              {t.value}
            </p>
          </div>
        ))}
      </div>

      {/* Agent roster */}
      <div className="flex flex-col gap-1.5 border-t border-graphite pt-4">
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-ink-veiled">
          Agent roster
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {roster.map((row) => {
            const selected = selectedNickname === row.nickname.nickname
            return (
              <li key={row.nickname.nickname}>
                <button
                  type="button"
                  onClick={() =>
                    onSelect(selected ? null : row.nickname.nickname)
                  }
                  className="flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left transition-colors duration-[120ms]"
                  style={{
                    borderColor: selected
                      ? "rgba(201,168,76,0.4)"
                      : "rgba(48,53,63,0.6)",
                    backgroundColor: selected
                      ? "rgba(201,168,76,0.08)"
                      : "rgba(11,12,17,0.4)",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="flex h-5 w-5 items-center justify-center rounded-[5px] border border-graphite text-[10px] font-bold"
                      style={{
                        backgroundColor: `${row.nickname.hex}1a`,
                        borderColor: `${row.nickname.hex}55`,
                        color: row.nickname.hex,
                      }}
                    >
                      {row.nickname.letter}
                    </span>
                    <span className="mono text-[12px] tracking-[0.08em] text-ink">
                      {row.nickname.nickname}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="mono text-[10px] tracking-[0.08em] text-ink-veiled">
                      {row.signals_lifetime.toLocaleString()}
                    </span>
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[row.status]}`}
                      title={STATUS_LABEL[row.status]}
                    />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Total signals counter — gold gradient (v1 council-exchange) */}
      <div
        className="mt-auto rounded-lg border p-4 text-center"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(201,168,76,0.10), rgba(201,168,76,0.02))",
          borderColor: "rgba(201,168,76,0.2)",
        }}
      >
        <p
          className="text-[28px] font-semibold leading-none tracking-tight"
          style={{ color: "#c9a84c" }}
        >
          {ops.signals_lifetime.toLocaleString()}
        </p>
        <p
          className="mono mt-1.5 text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "rgba(201,168,76,0.7)" }}
        >
          Total signals · since Day 0
        </p>
      </div>
    </aside>
  )
}

// Helper for callers to derive status from heartbeat + signal freshness.
export function deriveStatus(entry: PublicAgentEntry): FloorStatus {
  // Active = heartbeat in last 36h AND has produced signals
  // Scanning = heartbeat in last 36h, no recent signals (waiting for upstream)
  // Idle = no recent heartbeat
  const hb = entry.hours_since_heartbeat
  if (hb == null || hb > 36) return "idle"
  if (entry.signals_lifetime > 0 && (entry.hours_since_last_signal ?? 999) < 72) {
    return "active"
  }
  return "scanning"
}
