"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { SilhouetteAvatar } from "@/components/floor/silhouette-avatar"
import { council } from "@/design/tokens"
import { cn } from "@/lib/utils"
import type { AgentRow } from "@/lib/supabase/types"

type Props = {
  agents: AgentRow[]
}

type Desk = {
  id: string
  name: string
  hex: string
  status: "verified" | "pending" | "unverified"
  row: number
  col: number
}

type AgentState = {
  id: string
  hex: string
  name: string
  // Logical grid position (desk coordinates); fractional while walking
  x: number
  y: number
  homeX: number
  homeY: number
  mode: "at_desk" | "walking_out" | "walking_back" | "talking"
  targetX: number
  targetY: number
  partnerId: string | null
  nextDecisionAt: number // ms timestamp
  phraseShownAt: number | null
  currentPhrase: string | null
}

const GRID_COLS = 4
const GRID_ROW_SPACING = 130 // base grid units in logical space
const GRID_COL_SPACING = 140

const SPEECH_POOL = [
  "Signal verified",
  "Flow detected",
  "Confluence confirmed",
  "Integrity gate clear",
  "Heartbeat stable",
  "Deltas pushed",
  "Pattern surfaced",
  "Corroboration x2",
  "Trace sealed",
  "Noise dismissed",
]

const WALK_SPEED = 0.08 // fraction of distance per frame at 60fps
const TALK_DURATION = 3400
const WALK_COOLDOWN_MIN = 8000
const WALK_COOLDOWN_MAX = 20000

function orderAgentsForGrid(agents: AgentRow[]): AgentRow[] {
  // Verified first, then pending; within each group, alphabetical.
  const order = { verified: 0, pending: 1, unverified: 2 } as const
  return [...agents].sort((a, b) => {
    const diff =
      (order[a.status as keyof typeof order] ?? 3) -
      (order[b.status as keyof typeof order] ?? 3)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })
}

function computeDeskLayout(agents: AgentRow[]): Desk[] {
  return orderAgentsForGrid(agents).map((agent, i) => ({
    id: agent.id,
    name: agent.name,
    hex: agent.hex,
    status: agent.status,
    row: Math.floor(i / GRID_COLS),
    col: i % GRID_COLS,
  }))
}

export function IsoFloorScene({ agents }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false)
  const [tick, setTick] = useState(0)
  const stateRef = useRef<Map<string, AgentState>>(new Map())
  const rafRef = useRef<number | null>(null)

  const desks = useMemo(() => computeDeskLayout(agents), [agents])
  const deskById = useMemo(() => {
    const m = new Map<string, Desk>()
    for (const d of desks) m.set(d.id, d)
    return m
  }, [desks])

  const verifiedAgentIds = useMemo(
    () =>
      agents
        .filter((a) => a.status === "verified")
        .map((a) => a.id),
    [agents]
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Initialize agent states from desk layout — verified only get active states
  useEffect(() => {
    const next = new Map<string, AgentState>()
    for (const d of desks) {
      if (d.status !== "verified") continue
      const prev = stateRef.current.get(d.id)
      const x = d.col * GRID_COL_SPACING
      const y = d.row * GRID_ROW_SPACING
      next.set(d.id, {
        id: d.id,
        hex: d.hex,
        name: d.name,
        x: prev?.x ?? x,
        y: prev?.y ?? y,
        homeX: x,
        homeY: y,
        mode: prev?.mode ?? "at_desk",
        targetX: prev?.targetX ?? x,
        targetY: prev?.targetY ?? y,
        partnerId: prev?.partnerId ?? null,
        nextDecisionAt:
          prev?.nextDecisionAt ??
          Date.now() + WALK_COOLDOWN_MIN + Math.random() * WALK_COOLDOWN_MAX,
        phraseShownAt: prev?.phraseShownAt ?? null,
        currentPhrase: prev?.currentPhrase ?? null,
      })
    }
    stateRef.current = next
  }, [desks])

  // Animation loop — pure logical positions; visual render uses stateRef via tick
  useEffect(() => {
    if (reduceMotion) return
    if (verifiedAgentIds.length === 0) return

    let alive = true

    const loop = () => {
      if (!alive) return
      const now = Date.now()
      const states = stateRef.current

      for (const s of states.values()) {
        switch (s.mode) {
          case "at_desk": {
            if (now >= s.nextDecisionAt && verifiedAgentIds.length > 1) {
              // Decide to visit another agent
              const others = verifiedAgentIds.filter((id) => id !== s.id)
              const targetId = others[Math.floor(Math.random() * others.length)]
              const targetDesk = deskById.get(targetId)
              if (targetDesk) {
                s.mode = "walking_out"
                s.targetX = targetDesk.col * GRID_COL_SPACING
                s.targetY = targetDesk.row * GRID_ROW_SPACING
                s.partnerId = targetId
              } else {
                s.nextDecisionAt = now + WALK_COOLDOWN_MIN
              }
            } else if (now >= s.nextDecisionAt) {
              // Solo agent: wander briefly
              s.mode = "walking_out"
              s.targetX = s.homeX + (Math.random() - 0.5) * 40
              s.targetY = s.homeY + (Math.random() - 0.5) * 40
              s.partnerId = null
            }
            break
          }
          case "walking_out": {
            const dx = s.targetX - s.x
            const dy = s.targetY - s.y
            const dist = Math.hypot(dx, dy)
            if (dist < 2) {
              s.x = s.targetX
              s.y = s.targetY
              if (s.partnerId) {
                s.mode = "talking"
                s.phraseShownAt = now
                s.currentPhrase =
                  SPEECH_POOL[Math.floor(Math.random() * SPEECH_POOL.length)]
              } else {
                s.mode = "walking_back"
                s.targetX = s.homeX
                s.targetY = s.homeY
              }
            } else {
              s.x += dx * WALK_SPEED
              s.y += dy * WALK_SPEED
            }
            break
          }
          case "talking": {
            if (s.phraseShownAt && now - s.phraseShownAt > TALK_DURATION) {
              s.mode = "walking_back"
              s.targetX = s.homeX
              s.targetY = s.homeY
              s.currentPhrase = null
              s.phraseShownAt = null
              s.partnerId = null
            }
            break
          }
          case "walking_back": {
            const dx = s.targetX - s.x
            const dy = s.targetY - s.y
            const dist = Math.hypot(dx, dy)
            if (dist < 2) {
              s.x = s.homeX
              s.y = s.homeY
              s.mode = "at_desk"
              s.nextDecisionAt =
                now + WALK_COOLDOWN_MIN + Math.random() * WALK_COOLDOWN_MAX
            } else {
              s.x += dx * WALK_SPEED
              s.y += dy * WALK_SPEED
            }
            break
          }
        }
      }
      // Trigger re-render ~30fps rather than every frame for CPU efficiency
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    const tickInterval = window.setInterval(() => {
      setTick((t) => (t + 1) % 10000)
    }, 33)

    return () => {
      alive = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.clearInterval(tickInterval)
    }
  }, [reduceMotion, verifiedAgentIds, deskById])

  const verifiedCount = desks.filter((d) => d.status === "verified").length
  const totalCount = desks.length

  // Floor dimensions (in logical coordinates — the viewBox scales these)
  const rows = Math.ceil(desks.length / GRID_COLS)
  const logicalWidth = GRID_COLS * GRID_COL_SPACING + 120
  const logicalHeight = rows * GRID_ROW_SPACING + 120

  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-[16px] border border-graphite bg-obsidian/40"
      style={{ aspectRatio: "16 / 11" }}
      role="application"
      aria-label="The Council floor — verified agents at work"
    >
      {/* Iso grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(transparent 48%, rgba(124,92,255,0.04) 49%, rgba(124,92,255,0.04) 50%, transparent 51%),
            linear-gradient(90deg, transparent 48%, rgba(41,230,209,0.03) 49%, rgba(41,230,209,0.03) 50%, transparent 51%)
          `,
          backgroundSize: "60px 60px",
          transform: "perspective(900px) rotateX(52deg) rotateZ(-45deg) scale(1.15)",
          transformOrigin: "center",
        }}
      />

      {/* Iso scene container — everything inside shares the same perspective */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: "1400px" }}
      >
        <div
          className="relative"
          style={{
            width: logicalWidth,
            height: logicalHeight,
            transform: "rotateX(52deg) rotateZ(-45deg)",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Desks */}
          {desks.map((d) => {
            const x = d.col * GRID_COL_SPACING
            const y = d.row * GRID_ROW_SPACING
            const isVerified = d.status === "verified"
            return (
              <div
                key={`desk-${d.id}`}
                className="absolute"
                style={{
                  left: x,
                  top: y,
                  transform: "translateZ(0)",
                }}
                aria-hidden
              >
                {/* Desk surface */}
                <div
                  className={cn(
                    "relative h-[46px] w-[90px] rounded-[6px]",
                    isVerified ? "bg-graphite" : "bg-obsidian/70"
                  )}
                  style={{
                    boxShadow: isVerified
                      ? `0 0 24px -4px ${d.hex}66, inset 0 0 0 1px ${d.hex}22`
                      : "inset 0 0 0 1px rgba(138,141,154,0.12)",
                  }}
                >
                  {/* Monitor */}
                  <div
                    className="absolute left-1/2 top-1 h-[18px] w-[42px] -translate-x-1/2 rounded-[2px]"
                    style={{
                      backgroundColor: isVerified ? "#0A0B0F" : "#12131A",
                      boxShadow: isVerified
                        ? `inset 0 0 6px ${d.hex}55`
                        : "none",
                    }}
                  />
                  {/* Chair outline — suggests where the agent sits */}
                  <div
                    className="absolute left-1/2 -bottom-8 h-[14px] w-[22px] -translate-x-1/2 rounded-[2px]"
                    style={{
                      backgroundColor: isVerified
                        ? "rgba(28,30,40,0.9)"
                        : "rgba(28,30,40,0.35)",
                    }}
                  />
                </div>
              </div>
            )
          })}

          {/* Connection threads between talking agents */}
          {(() => {
            const drawn = new Set<string>()
            const threads: React.ReactElement[] = []
            for (const s of stateRef.current.values()) {
              if (s.mode !== "talking" || !s.partnerId) continue
              const p = stateRef.current.get(s.partnerId)
              if (!p) continue
              const key = [s.id, s.partnerId].sort().join("-")
              if (drawn.has(key)) continue
              drawn.add(key)
              const x1 = s.x + 30
              const y1 = s.y + 10
              const x2 = p.x + 30
              const y2 = p.y + 10
              threads.push(
                <svg
                  key={`thread-${key}`}
                  className="pointer-events-none absolute left-0 top-0 overflow-visible"
                  width={logicalWidth}
                  height={logicalHeight}
                  aria-hidden
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#29E6D1"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="-16"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                  </line>
                </svg>
              )
            }
            return threads
          })()}

          {/* Agent avatars — rotated back so they appear upright despite the iso parent */}
          {Array.from(stateRef.current.values()).map((s) => (
            <div
              key={`agent-${s.id}`}
              className="absolute"
              style={{
                left: s.x + 26,
                top: s.y + 4,
                transform: "rotateZ(45deg) rotateX(-52deg) translateZ(30px)",
                transformOrigin: "center bottom",
                transition: s.mode === "at_desk" ? "none" : "none",
              }}
            >
              <SilhouetteAvatar
                color={s.hex}
                size={28}
                label={s.name}
                dimmed={false}
              />
              {s.currentPhrase ? (
                <div
                  className="mono absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-cyan/40 bg-void/90 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-cyan"
                  style={{ animation: "council-row-enter 180ms var(--ease-council-out)" }}
                >
                  {s.currentPhrase}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Top-left floor badge */}
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-graphite bg-void/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] backdrop-blur-sm">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-cyan"
          style={{ boxShadow: "0 0 8px var(--council-cyan)" }}
        />
        <span className="mono text-ink-muted">The Floor</span>
        <span className="mono text-cyan">
          {verifiedCount}/{totalCount} live
        </span>
      </div>

      {/* Empty-state overlay if no verified agents */}
      {verifiedCount === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-void/70 backdrop-blur-sm">
          <div className="text-center">
            <p className="mono mb-2 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
              Floor awaiting activation
            </p>
            <p className="text-[15px] text-ink-body/75">
              No agents verified yet. Desks are set. When the first agent goes
              live, you'll see it here.
            </p>
          </div>
        </div>
      ) : null}

      {/* Tick sentinel — forces React to re-read stateRef on each tick */}
      <span className="sr-only" aria-hidden>
        {tick}
      </span>
    </div>
  )
}
