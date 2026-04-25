"use client"

import { Html, OrbitControls, Text } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { AgentFigure, type AgentState as FigureState } from "./agent-figure"
import type { AgentRow } from "@/lib/supabase/types"

type Props = {
  agents: AgentRow[]
  // Called when a desk is clicked. If unset, the component falls back to
  // the legacy router.push(`/agents/{id}`) navigation.
  onAgentClick?: (agent_id: string) => void
}

// Horseshoe opens toward +Z (front/camera).
// Angles: 45° → 315° going through 180° (back), a 270° arc.
// angle=45°  → right-front, angle=180° → back-center, angle=315° → left-front
const HORSESHOE_START_DEG = 45
const HORSESHOE_SPAN_DEG = 270
const INNER_RADIUS = 6.2
const OUTER_RADIUS = 9.8
const INNER_MAX = 11

interface DeskData {
  agent: AgentRow
  angle: number
  x: number
  z: number
  radius: number
}

function ring(agents: AgentRow[], radius: number): DeskData[] {
  return agents.map((agent, i) => {
    const frac = agents.length > 1 ? i / (agents.length - 1) : 0.5
    const deg = HORSESHOE_START_DEG + frac * HORSESHOE_SPAN_DEG
    const angle = (deg * Math.PI) / 180
    return { agent, angle, x: radius * Math.sin(angle), z: radius * Math.cos(angle), radius }
  })
}

function computeDesks(agents: AgentRow[]): DeskData[] {
  const sorted = [...agents].sort((a, b) => {
    if (a.status === "verified" && b.status !== "verified") return -1
    if (a.status !== "verified" && b.status === "verified") return 1
    return a.name.localeCompare(b.name)
  })
  const inner = sorted.slice(0, Math.min(INNER_MAX, sorted.length))
  const outer = sorted.slice(inner.length)
  return [...ring(inner, INNER_RADIUS), ...(outer.length ? ring(outer, OUTER_RADIUS) : [])]
}

function Desk({
  data,
  isHovered,
  onHover,
  onClick,
}: {
  data: DeskData
  isHovered: boolean
  onHover: (v: boolean) => void
  onClick: () => void
}) {
  const { agent, angle, x, z } = data
  const isVerified = agent.status === "verified"
  const glowColor = isVerified ? agent.hex : "#3A3D50"
  const deskColor = isVerified ? "#1C2030" : "#12131A"

  return (
    <group position={[x, 0.07, z]} rotation={[0, angle, 0]}>
      {/* Desk surface */}
      <mesh
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(true)
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => {
          onHover(false)
          document.body.style.cursor = "default"
        }}
      >
        <boxGeometry args={[2.1, 0.11, 1.1]} />
        <meshStandardMaterial
          color={deskColor}
          emissive={isVerified ? glowColor : "#000000"}
          emissiveIntensity={isVerified ? 0.08 : 0}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>

      {/* Monitor screen — plane mesh, emissive */}
      <mesh position={[0, 0.48, -0.38]} castShadow>
        <planeGeometry args={[0.95, 0.56]} />
        <meshStandardMaterial
          color="#0A0B0F"
          emissive={isVerified ? agent.hex : "#1A1B22"}
          emissiveIntensity={isVerified ? 0.55 : 0.06}
          roughness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Monitor bezel */}
      <mesh position={[0, 0.48, -0.41]}>
        <boxGeometry args={[1.04, 0.64, 0.05]} />
        <meshStandardMaterial color="#0A0B0F" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Monitor stand */}
      <mesh position={[0, 0.2, -0.37]}>
        <boxGeometry args={[0.16, 0.2, 0.16]} />
        <meshStandardMaterial color="#12131A" />
      </mesh>

      {/* Chair seat */}
      <mesh position={[0, 0.18, 0.72]} castShadow>
        <boxGeometry args={[0.82, 0.07, 0.82]} />
        <meshStandardMaterial color="#12131A" roughness={0.8} />
      </mesh>
      {/* Chair back */}
      <mesh position={[0, 0.52, 1.06]} castShadow>
        <boxGeometry args={[0.82, 0.6, 0.07]} />
        <meshStandardMaterial color="#12131A" roughness={0.8} />
      </mesh>

      {/* Per-desk point light (verified only) */}
      {isVerified ? (
        <pointLight position={[0, 0.7, 0]} distance={3.2} intensity={0.5} color={glowColor} />
      ) : null}

      {/* Agent name on monitor — always faces camera */}
      <Html
        position={[0, 0.52, -0.36]}
        center
        distanceFactor={4.5}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "7px",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: isVerified ? agent.hex : "#4F5260",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {agent.name}
        </div>
      </Html>

      {/* Hover tooltip */}
      {isHovered ? (
        <Html
          position={[0, 2.5, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: isVerified ? agent.hex : "#8A8D9A",
              whiteSpace: "nowrap",
              background: "rgba(10,10,15,0.92)",
              border: `1px solid ${isVerified ? agent.hex + "55" : "#1C1E2888"}`,
              borderRadius: "9999px",
              padding: "3px 10px",
              backdropFilter: "blur(6px)",
              pointerEvents: "none",
            }}
          >
            {agent.name} · {isVerified ? "verified" : "in verification"}
          </div>
        </Html>
      ) : null}
    </group>
  )
}

// ---- Walking + talking FSM -----------------------------------------------
//
// Each agent has a small state machine that periodically initiates a meet
// with another agent: walks from the desk → midpoint → talks for a few
// seconds → walks back. Position interpolation runs in useFrame and
// mutates a ref directly (no React re-renders per frame). FigureState
// transitions trigger React re-renders so AgentFigure swaps limb-pose
// animations.

type AgentLogic = {
  id: string
  agent: AgentRow
  // Home (chair-side of desk) world position.
  homeX: number
  homeZ: number
  homeYaw: number // facing the desk monitor
  // Live position + target.
  x: number
  z: number
  targetX: number
  targetZ: number
  yaw: number
  // FSM
  mode: "at_desk" | "walking_out" | "talking" | "walking_back"
  partnerId: string | null
  nextDecisionAt: number
  talkUntil: number
}

const TALK_DURATION_MS = 6000
const DECISION_COOLDOWN_MIN_MS = 6000
const DECISION_COOLDOWN_MAX_MS = 18000
const WALK_SPEED = 0.04

export function TradingFloor3D({ agents, onAgentClick }: Props) {
  const router = useRouter()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const desks = useMemo(() => computeDesks(agents), [agents])

  // Per-agent live logic — refs so 60fps updates don't churn React.
  const logicRef = useRef<Map<string, AgentLogic>>(new Map())
  // Display-state map — drives AgentFigure's limb animation. Updated only
  // on transition (every few seconds), not per frame.
  const [displayState, setDisplayState] = useState<Record<string, FigureState>>(
    {}
  )
  // Group refs per agent — parent's useFrame mutates these directly.
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map())
  // Tick state to force render (~10Hz throttle so position-derived
  // overlays + connection threads stay fresh without 60fps re-renders).
  const [, setTick] = useState(0)
  const lastTickRef = useRef(0)

  // Initialize logic state once desks are known.
  useEffect(() => {
    const next = new Map<string, AgentLogic>()
    const now = Date.now()
    for (const d of desks) {
      const agentR = d.radius + 1.12
      const homeX = agentR * Math.sin(d.angle)
      const homeZ = agentR * Math.cos(d.angle)
      // Face the desk monitor — opposite of outward radius angle.
      const homeYaw = Math.atan2(-homeX, -homeZ)
      const prev = logicRef.current.get(d.agent.id)
      next.set(d.agent.id, {
        id: d.agent.id,
        agent: d.agent,
        homeX,
        homeZ,
        homeYaw,
        x: prev?.x ?? homeX,
        z: prev?.z ?? homeZ,
        targetX: prev?.targetX ?? homeX,
        targetZ: prev?.targetZ ?? homeZ,
        yaw: prev?.yaw ?? homeYaw,
        mode: prev?.mode ?? "at_desk",
        partnerId: prev?.partnerId ?? null,
        nextDecisionAt:
          prev?.nextDecisionAt ??
          now + DECISION_COOLDOWN_MIN_MS + Math.random() * 8000,
        talkUntil: prev?.talkUntil ?? 0,
      })
    }
    logicRef.current = next
    // Seed display states.
    const ds: Record<string, FigureState> = {}
    for (const id of next.keys()) ds[id] = "idle"
    setDisplayState(ds)
  }, [desks])

  // Per-frame: update positions, transition state machines, mutate group
  // transforms directly.
  useFrame(() => {
    const now = Date.now()
    const states = logicRef.current
    if (states.size === 0) return

    let stateChanged = false
    const idsArray = Array.from(states.keys())

    for (const s of states.values()) {
      switch (s.mode) {
        case "at_desk":
          if (now >= s.nextDecisionAt) {
            // Pick another idle agent who isn't already paired.
            const candidates = idsArray.filter((id) => {
              if (id === s.id) return false
              const o = states.get(id)
              return !!o && o.mode === "at_desk" && o.partnerId === null
            })
            if (candidates.length > 0) {
              const partnerId =
                candidates[Math.floor(Math.random() * candidates.length)]
              const partner = states.get(partnerId)!
              // Midpoint between two desks.
              const midX = (s.homeX + partner.homeX) / 2
              const midZ = (s.homeZ + partner.homeZ) / 2
              // Stagger so they don't overlap exactly — offset perpendicular
              // to their connecting line.
              const dx = partner.homeX - s.homeX
              const dz = partner.homeZ - s.homeZ
              const len = Math.hypot(dx, dz) || 1
              const perpX = -dz / len
              const perpZ = dx / len
              const offset = 0.55
              s.targetX = midX + perpX * offset
              s.targetZ = midZ + perpZ * offset
              s.partnerId = partnerId
              s.mode = "walking_out"

              partner.targetX = midX - perpX * offset
              partner.targetZ = midZ - perpZ * offset
              partner.partnerId = s.id
              partner.mode = "walking_out"

              stateChanged = true
            } else {
              // Push decision out a bit if no partner available.
              s.nextDecisionAt =
                now + 4000 + Math.random() * 6000
            }
          }
          break
        case "walking_out": {
          const dx = s.targetX - s.x
          const dz = s.targetZ - s.z
          const dist = Math.hypot(dx, dz)
          if (dist < 0.06) {
            s.x = s.targetX
            s.z = s.targetZ
            s.mode = "talking"
            s.talkUntil = now + TALK_DURATION_MS
            stateChanged = true
          } else {
            // Face the walking direction.
            s.yaw = Math.atan2(dx, dz)
            s.x += dx * WALK_SPEED
            s.z += dz * WALK_SPEED
          }
          break
        }
        case "talking": {
          // Face the partner.
          if (s.partnerId) {
            const p = states.get(s.partnerId)
            if (p) {
              s.yaw = Math.atan2(p.x - s.x, p.z - s.z)
            }
          }
          if (now >= s.talkUntil) {
            s.mode = "walking_back"
            s.targetX = s.homeX
            s.targetZ = s.homeZ
            stateChanged = true
          }
          break
        }
        case "walking_back": {
          const dx = s.targetX - s.x
          const dz = s.targetZ - s.z
          const dist = Math.hypot(dx, dz)
          if (dist < 0.06) {
            s.x = s.homeX
            s.z = s.homeZ
            s.yaw = s.homeYaw
            s.mode = "at_desk"
            s.partnerId = null
            s.nextDecisionAt =
              now +
              DECISION_COOLDOWN_MIN_MS +
              Math.random() *
                (DECISION_COOLDOWN_MAX_MS - DECISION_COOLDOWN_MIN_MS)
            stateChanged = true
          } else {
            s.yaw = Math.atan2(dx, dz)
            s.x += dx * WALK_SPEED
            s.z += dz * WALK_SPEED
          }
          break
        }
      }

      // Mutate group transform directly — no React re-render needed.
      const g = groupRefs.current.get(s.id)
      if (g) {
        g.position.set(s.x, 0, s.z)
        g.rotation.y = s.yaw
      }
    }

    // Sync display state when transitions happened.
    if (stateChanged) {
      const next: Record<string, FigureState> = {}
      for (const s of states.values()) {
        next[s.id] =
          s.mode === "talking"
            ? "talking"
            : s.mode === "walking_out" || s.mode === "walking_back"
            ? "walking"
            : "idle"
      }
      setDisplayState(next)
    }

    // Throttled tick to refresh derived overlays (connection threads).
    if (now - lastTickRef.current > 100) {
      lastTickRef.current = now
      setTick((t) => (t + 1) % 10000)
    }
  })

  // Build talking-pair connection threads from current logic state.
  const threads: Array<{
    from: [number, number, number]
    to: [number, number, number]
  }> = []
  const visited = new Set<string>()
  for (const s of logicRef.current.values()) {
    if (s.mode !== "talking" || !s.partnerId) continue
    if (visited.has(s.id)) continue
    const p = logicRef.current.get(s.partnerId)
    if (!p || p.mode !== "talking") continue
    visited.add(s.id)
    visited.add(s.partnerId)
    threads.push({
      from: [s.x, 1.7, s.z],
      to: [p.x, 1.7, p.z],
    })
  }

  return (
    <>
      {/* Dark reflective floor */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial
          color="#0a0a0f"
          roughness={0.08}
          metalness={0.72}
        />
      </mesh>

      {/* Floor grid lines */}
      <gridHelper args={[90, 45, "#0a1c1c", "#0d1818"]} position={[0, 0.003, 0]} />
      <gridHelper args={[90, 9, "#133030", "#133030"]} position={[0, 0.005, 0]} />

      {/* Backdrop wall — massive gold "THE COUNCIL · INTELLIGENCE EXCHANGE" */}
      <group position={[0, 0, -16]}>
        {/* Subtle dark plane behind the text for contrast */}
        <mesh position={[0, 5, -0.2]} receiveShadow>
          <planeGeometry args={[36, 12]} />
          <meshStandardMaterial
            color="#050508"
            roughness={0.85}
            metalness={0.1}
          />
        </mesh>
        <Text
          position={[0, 6.2, 0]}
          fontSize={2.4}
          color="#c9a84c"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.04}
          outlineColor="#1a1408"
          outlineWidth={0.02}
        >
          THE COUNCIL
          <meshStandardMaterial
            attach="material"
            color="#c9a84c"
            emissive="#c9a84c"
            emissiveIntensity={0.45}
            roughness={0.6}
            metalness={0.4}
          />
        </Text>
        <Text
          position={[0, 4.0, 0]}
          fontSize={0.95}
          color="#c9a84c"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.32}
        >
          INTELLIGENCE EXCHANGE
          <meshStandardMaterial
            attach="material"
            color="#c9a84c"
            emissive="#c9a84c"
            emissiveIntensity={0.32}
            roughness={0.7}
          />
        </Text>
        {/* A faint underline glow rule */}
        <mesh position={[0, 3.45, 0.01]}>
          <planeGeometry args={[12, 0.04]} />
          <meshStandardMaterial
            color="#c9a84c"
            emissive="#c9a84c"
            emissiveIntensity={0.6}
          />
        </mesh>
      </group>

      {/* Fog */}
      <fog attach="fog" args={["#0a0a0f", 24, 46]} />

      {/* Lights */}
      <ambientLight intensity={0.22} />
      <directionalLight
        position={[0, 20, 10]}
        intensity={0.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        color="#B8C8FF"
      />
      {/* Gold accent above the backdrop */}
      <pointLight position={[0, 11, -12]} intensity={1.0} distance={20} color="#c9a84c" />
      {/* Violet overhead */}
      <pointLight position={[0, 12, 0]} intensity={1.0} distance={26} color="#7C5CFF" />
      {/* Cyan front fill */}
      <pointLight position={[0, 5, 14]} intensity={0.4} distance={22} color="#29E6D1" />

      {/* Desks */}
      {desks.map((d) => (
        <Desk
          key={d.agent.id}
          data={d}
          isHovered={hoveredId === d.agent.id}
          onHover={(v) => setHoveredId(v ? d.agent.id : null)}
          onClick={() =>
            onAgentClick
              ? onAgentClick(d.agent.id)
              : router.push(`/agents/${d.agent.id}`)
          }
        />
      ))}

      {/* Humanoid agent figures — all 11, FSM-driven walk/talk/idle */}
      {desks.map((d, i) => (
        <group
          key={d.agent.id}
          ref={(node) => {
            if (node) groupRefs.current.set(d.agent.id, node)
            else groupRefs.current.delete(d.agent.id)
          }}
        >
          <AgentFigure
            agent={d.agent}
            position={[0, 0, 0]} /* outer group transform handled by parent */
            rotationY={0}
            phase={i * 0.83}
            state={displayState[d.agent.id] ?? "idle"}
            onClick={() =>
              onAgentClick
                ? onAgentClick(d.agent.id)
                : router.push(`/agents/${d.agent.id}`)
            }
          />
        </group>
      ))}

      {/* Connection threads between talking pairs */}
      {threads.map((t, i) => (
        <Line key={i} from={t.from} to={t.to} color="#29E6D1" />
      ))}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={30}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 1, 0]}
      />
    </>
  )
}

// Simple line segment between two world points — used to visualize the
// connection between two talking agents.
function Line({
  from,
  to,
  color,
}: {
  from: [number, number, number]
  to: [number, number, number]
  color: string
}) {
  const ref = useRef<THREE.BufferGeometry>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.setFromPoints([
        new THREE.Vector3(...from),
        new THREE.Vector3(...to),
      ])
    }
  }, [from, to])
  return (
    <line>
      <bufferGeometry ref={ref} />
      <lineBasicMaterial color={color} linewidth={2} transparent opacity={0.55} />
    </line>
  )
}
