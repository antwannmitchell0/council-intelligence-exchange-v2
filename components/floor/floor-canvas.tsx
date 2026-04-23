"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getBrowserClient } from "@/lib/supabase/client"
import { council } from "@/design/tokens"
import type {
  AgentRow,
  HeartbeatRow,
  HiveEventRow,
  SignalRow,
} from "@/lib/supabase/types"

type FloorAgent = {
  id: string
  name: string
  color: string
  x: number
  y: number
  vx: number
  vy: number
  pulseAt: number | null // ms timestamp
  sleeping: boolean
}

type Trace = {
  from: string
  to: string | null // null = broadcast (solo pulse)
  color: string
  emittedAt: number // ms timestamp
  ttlMs: number
}

type Props = {
  agents: AgentRow[]
  initialHeartbeats: HeartbeatRow[]
  initialEvents: HiveEventRow[]
  initialSignals: SignalRow[]
  onAgentClick?: (agentId: string) => void
}

const FLOOR_WIDTH = 960
const FLOOR_HEIGHT = 540
const AGENT_RADIUS = 9
const PULSE_RADIUS = 28
const PULSE_DURATION_MS = 900
const TRACE_DURATION_MS = 1400
const DRIFT_SPEED = 0.12
const JITTER = 0.02
const BOUNDARY_FORCE = 0.0012
const AGENT_SLEEP_OPACITY = 0.22

export function FloorCanvas({
  agents,
  initialHeartbeats,
  initialEvents,
  initialSignals,
  onAgentClick,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null)
  const [reduceMotion, setReduceMotion] = useState(false)

  const heartbeatMap = useMemo(() => {
    const m = new Map<string, HeartbeatRow>()
    for (const h of initialHeartbeats) m.set(h.agent_id, h)
    return m
  }, [initialHeartbeats])

  const latestSignalMap = useMemo(() => {
    const m = new Map<string, SignalRow>()
    for (const s of initialSignals) if (!m.has(s.agent_id)) m.set(s.agent_id, s)
    return m
  }, [initialSignals])

  // Agents state held in a ref so the RAF loop mutates without re-render
  const agentsRef = useRef<Map<string, FloorAgent>>(new Map())
  const tracesRef = useRef<Trace[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Seed agents on the floor in a loose ring
  useEffect(() => {
    const seeded = new Map<string, FloorAgent>()
    const order = council.agent
    const cx = FLOOR_WIDTH / 2
    const cy = FLOOR_HEIGHT / 2
    const ringRadius = Math.min(FLOOR_WIDTH, FLOOR_HEIGHT) * 0.32
    order.forEach((a, i) => {
      const theta = (i / order.length) * Math.PI * 2 - Math.PI / 2
      const x = cx + Math.cos(theta) * ringRadius
      const y = cy + Math.sin(theta) * ringRadius
      const hb = heartbeatMap.get(a.id)
      const matched = agents.find((ag) => ag.id === a.id)
      seeded.set(a.id, {
        id: a.id,
        name: matched?.name ?? a.name,
        color: matched?.hex ?? a.hex,
        x,
        y,
        vx: (Math.random() - 0.5) * DRIFT_SPEED,
        vy: (Math.random() - 0.5) * DRIFT_SPEED,
        pulseAt: null,
        sleeping: hb?.status !== "online",
      })
    })
    agentsRef.current = seeded
  }, [agents, heartbeatMap])

  // Replay recent events for a gentle "there was activity" feel on first paint
  useEffect(() => {
    const now = Date.now()
    for (const ev of initialEvents.slice(0, 6)) {
      const ageMs = now - new Date(ev.occurred_at).getTime()
      if (ageMs > 30_000) continue
      const agent = ev.from_agent
        ? agentsRef.current.get(ev.from_agent)
        : null
      if (agent) agent.pulseAt = now - Math.min(ageMs, PULSE_DURATION_MS - 100)
      if (ev.kind === "signal-corroborated" && ev.from_agent && ev.to_agent) {
        tracesRef.current.push({
          from: ev.from_agent,
          to: ev.to_agent,
          color: agent?.color ?? council.color.violet,
          emittedAt: now - Math.min(ageMs, TRACE_DURATION_MS - 100),
          ttlMs: TRACE_DURATION_MS,
        })
      }
    }
  }, [initialEvents])

  // Subscribe to realtime events
  useEffect(() => {
    const supabase = getBrowserClient()
    if (!supabase) return
    const ch = supabase
      .channel("v2_hive_events_floor")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "v2_hive_events" },
        (payload) => {
          const ev = payload.new as HiveEventRow
          const now = Date.now()
          const fromAgent = ev.from_agent
            ? agentsRef.current.get(ev.from_agent)
            : null
          if (fromAgent && (ev.kind === "signal-published" || ev.kind === "signal-corroborated")) {
            fromAgent.pulseAt = now
          }
          if (ev.kind === "agent-awake" && ev.from_agent) {
            const a = agentsRef.current.get(ev.from_agent)
            if (a) {
              a.sleeping = false
              a.pulseAt = now
            }
          }
          if (ev.kind === "agent-sleep" && ev.from_agent) {
            const a = agentsRef.current.get(ev.from_agent)
            if (a) a.sleeping = true
          }
          if (
            ev.kind === "signal-corroborated" &&
            ev.from_agent &&
            ev.to_agent
          ) {
            tracesRef.current.push({
              from: ev.from_agent,
              to: ev.to_agent,
              color: fromAgent?.color ?? council.color.violet,
              emittedAt: now,
              ttlMs: TRACE_DURATION_MS,
            })
          }
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [])

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    function fitCanvas() {
      if (!canvas || !ctx) return
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
    fitCanvas()
    const obs = new ResizeObserver(fitCanvas)
    obs.observe(canvas)

    let lastT = performance.now()
    let paused = false
    const visHandler = () => {
      paused = document.hidden
      if (!paused) lastT = performance.now()
    }
    document.addEventListener("visibilitychange", visHandler)

    function frame(now: number) {
      if (!canvas || !ctx) return
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const scaleX = w / FLOOR_WIDTH
      const scaleY = h / FLOOR_HEIGHT
      const scale = Math.min(scaleX, scaleY)

      ctx.clearRect(0, 0, w, h)

      // Background radial glow
      const grad = ctx.createRadialGradient(
        w / 2,
        h / 2,
        0,
        w / 2,
        h / 2,
        Math.min(w, h) * 0.55
      )
      grad.addColorStop(0, "rgba(124,92,255,0.08)")
      grad.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // Update agents
      const dt = paused ? 0 : Math.min(now - lastT, 64)
      lastT = now
      const cx = FLOOR_WIDTH / 2
      const cy = FLOOR_HEIGHT / 2

      for (const a of agentsRef.current.values()) {
        if (!reduceMotion) {
          a.vx += (Math.random() - 0.5) * JITTER
          a.vy += (Math.random() - 0.5) * JITTER
          const dx = a.x - cx
          const dy = a.y - cy
          a.vx -= dx * BOUNDARY_FORCE
          a.vy -= dy * BOUNDARY_FORCE
          // Clamp speed
          const speed = Math.hypot(a.vx, a.vy)
          const maxSpeed = DRIFT_SPEED * 1.6
          if (speed > maxSpeed) {
            a.vx = (a.vx / speed) * maxSpeed
            a.vy = (a.vy / speed) * maxSpeed
          }
          a.x += a.vx * (dt / 16)
          a.y += a.vy * (dt / 16)
        }
      }

      // Draw traces (between agents)
      const liveTraces: Trace[] = []
      for (const t of tracesRef.current) {
        const age = now - t.emittedAt
        if (age > t.ttlMs) continue
        liveTraces.push(t)
        const progress = Math.min(1, age / t.ttlMs)
        const fromA = agentsRef.current.get(t.from)
        const toA = t.to ? agentsRef.current.get(t.to) : null
        if (!fromA || !toA) continue

        const fx = (fromA.x / FLOOR_WIDTH) * w
        const fy = (fromA.y / FLOOR_HEIGHT) * h
        const tx = (toA.x / FLOOR_WIDTH) * w
        const ty = (toA.y / FLOOR_HEIGHT) * h

        const alpha =
          progress < 0.15
            ? progress / 0.15
            : progress > 0.75
              ? (1 - progress) / 0.25
              : 1

        ctx.strokeStyle = rgbaFromHex(t.color, 0.6 * alpha)
        ctx.lineWidth = 1.2 * scale
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(fx, fy)
        ctx.lineTo(tx, ty)
        ctx.stroke()

        // Spark moving along the line
        const sx = fx + (tx - fx) * progress
        const sy = fy + (ty - fy) * progress
        ctx.beginPath()
        ctx.arc(sx, sy, 2.5 * scale, 0, Math.PI * 2)
        ctx.fillStyle = rgbaFromHex(t.color, 0.95 * alpha)
        ctx.fill()
      }
      tracesRef.current = liveTraces

      // Draw agents
      for (const a of agentsRef.current.values()) {
        const ax = (a.x / FLOOR_WIDTH) * w
        const ay = (a.y / FLOOR_HEIGHT) * h
        const isHovered = hoveredAgentId === a.id
        const globalAlpha =
          hoveredAgentId && !isHovered ? 0.35 : a.sleeping ? AGENT_SLEEP_OPACITY : 1

        // Pulse ring
        if (a.pulseAt && !reduceMotion) {
          const pulseAge = now - a.pulseAt
          if (pulseAge < PULSE_DURATION_MS) {
            const progress = pulseAge / PULSE_DURATION_MS
            const r = AGENT_RADIUS + (PULSE_RADIUS - AGENT_RADIUS) * progress
            const pulseAlpha = (1 - progress) * 0.65
            ctx.strokeStyle = rgbaFromHex(a.color, pulseAlpha * globalAlpha)
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(ax, ay, r * scale, 0, Math.PI * 2)
            ctx.stroke()
          } else {
            a.pulseAt = null
          }
        }

        // Dot
        ctx.fillStyle = rgbaFromHex(a.color, globalAlpha)
        ctx.beginPath()
        ctx.arc(ax, ay, AGENT_RADIUS * scale * 0.5, 0, Math.PI * 2)
        ctx.fill()

        // Halo (always present, stronger when awake)
        ctx.fillStyle = rgbaFromHex(
          a.color,
          (a.sleeping ? 0.08 : 0.2) * globalAlpha
        )
        ctx.beginPath()
        ctx.arc(ax, ay, AGENT_RADIUS * scale * 1.2, 0, Math.PI * 2)
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      document.removeEventListener("visibilitychange", visHandler)
      obs.disconnect()
    }
  }, [hoveredAgentId, reduceMotion])

  // Sync overlay labels every 60ms (don't try for 60fps labels)
  const [overlayTick, setOverlayTick] = useState(0)
  useEffect(() => {
    if (reduceMotion) return
    const id = window.setInterval(() => setOverlayTick((t) => t + 1), 60)
    return () => window.clearInterval(id)
  }, [reduceMotion])

  const overlayAgents = Array.from(agentsRef.current.values())

  return (
    <div
      ref={overlayRef}
      className="relative mx-auto aspect-[16/9] w-full overflow-hidden rounded-[16px] border border-graphite bg-obsidian/40"
      style={{ maxWidth: `${FLOOR_WIDTH}px` }}
      role="application"
      aria-label="The Council floor — live agent activity"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden
      />

      {overlayAgents.map((a) => {
        const cx = (a.x / FLOOR_WIDTH) * 100
        const cy = (a.y / FLOOR_HEIGHT) * 100
        return (
          <button
            key={a.id}
            type="button"
            onMouseEnter={() => setHoveredAgentId(a.id)}
            onMouseLeave={() => setHoveredAgentId(null)}
            onFocus={() => setHoveredAgentId(a.id)}
            onBlur={() => setHoveredAgentId(null)}
            onClick={() => onAgentClick?.(a.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-transparent px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-glow"
            style={{
              left: `${cx}%`,
              top: `${cy}%`,
              width: 36,
              height: 36,
            }}
            aria-label={`${a.name}${a.sleeping ? " (offline)" : " (online)"}`}
          />
        )
      })}

      {hoveredAgentId && (
        <AgentLabel
          agent={overlayAgents.find((a) => a.id === hoveredAgentId)!}
          latestSignal={latestSignalMap.get(hoveredAgentId) ?? null}
        />
      )}
      {/* ensure tick re-renders overlay */}
      <span aria-hidden className="sr-only">
        {overlayTick}
      </span>
    </div>
  )
}

function AgentLabel({
  agent,
  latestSignal,
}: {
  agent: FloorAgent
  latestSignal: SignalRow | null
}) {
  const cx = (agent.x / FLOOR_WIDTH) * 100
  const cy = (agent.y / FLOOR_HEIGHT) * 100
  return (
    <div
      className="pointer-events-none absolute flex flex-col items-start gap-1 rounded-[8px] border border-graphite bg-void/90 px-3 py-2 backdrop-blur-sm"
      style={{
        left: `calc(${cx}% + 20px)`,
        top: `calc(${cy}% - 12px)`,
        maxWidth: 280,
      }}
    >
      <span className="mono text-[11px] uppercase tracking-[0.14em] text-ink">
        {agent.name}
      </span>
      <span
        className={`mono text-[10px] uppercase tracking-[0.14em] ${
          agent.sleeping ? "text-ink-veiled" : "text-cyan"
        }`}
      >
        {agent.sleeping ? "offline" : "online"}
      </span>
      {latestSignal && (
        <p className="mt-1 line-clamp-2 text-[12px] leading-[1.45] text-ink-body/85">
          {latestSignal.body}
        </p>
      )}
    </div>
  )
}

function rgbaFromHex(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "")
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
