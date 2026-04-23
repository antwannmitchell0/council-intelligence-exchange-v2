"use client"

import { Html, OrbitControls } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { council } from "@/design/tokens"
import type { AgentRow } from "@/lib/supabase/types"

type Props = {
  agents: AgentRow[]
  onAgentClick: (agentId: string) => void
}

const GRID_COLS = 6
const DESK_SPACING_X = 3.2
const DESK_SPACING_Z = 3.6

const SPEECH_POOL = [
  "Signal verified",
  "Flow detected",
  "Confluence confirmed",
  "Integrity gate clear",
  "Heartbeat stable",
  "Pattern surfaced",
  "Corroboration x2",
  "Trace sealed",
]

type AgentState = {
  id: string
  hex: string
  name: string
  homeX: number
  homeZ: number
  x: number
  z: number
  targetX: number
  targetZ: number
  mode: "at_desk" | "walking_out" | "talking" | "walking_back"
  partnerId: string | null
  phraseUntil: number
  nextDecisionAt: number
  phrase: string | null
}

function orderAgents(agents: AgentRow[]): AgentRow[] {
  const order = { verified: 0, pending: 1, unverified: 2 } as const
  return [...agents].sort((a, b) => {
    const diff =
      (order[a.status as keyof typeof order] ?? 3) -
      (order[b.status as keyof typeof order] ?? 3)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })
}

function Desk({
  agent,
  onClick,
  position,
  isHovered,
  onHover,
}: {
  agent: AgentRow
  onClick: () => void
  position: [number, number, number]
  isHovered: boolean
  onHover: (v: boolean) => void
}) {
  const isVerified = agent.status === "verified"
  const deskColor = isVerified ? "#1C1E28" : "#12131A"
  const glowColor = isVerified ? agent.hex : "#4F5260"

  return (
    <group position={position}>
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
        <boxGeometry args={[2.4, 0.14, 1.4]} />
        <meshStandardMaterial
          color={deskColor}
          emissive={isVerified ? glowColor : "#000000"}
          emissiveIntensity={isVerified ? 0.12 : 0}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>

      {/* Monitor */}
      <mesh position={[0, 0.5, -0.35]} castShadow>
        <boxGeometry args={[1.1, 0.65, 0.08]} />
        <meshStandardMaterial
          color="#0A0B0F"
          emissive={isVerified ? agent.hex : "#1C1E28"}
          emissiveIntensity={isVerified ? 0.45 : 0.05}
          roughness={0.1}
        />
      </mesh>
      {/* Monitor stand */}
      <mesh position={[0, 0.18, -0.35]} castShadow>
        <boxGeometry args={[0.2, 0.24, 0.2]} />
        <meshStandardMaterial color="#12131A" />
      </mesh>

      {/* Chair (hint of where the agent sits) */}
      <mesh position={[0, 0.15, 1.1]} castShadow>
        <boxGeometry args={[0.9, 0.3, 0.9]} />
        <meshStandardMaterial color="#12131A" />
      </mesh>

      {/* Desk light halo when verified */}
      {isVerified ? (
        <pointLight
          position={[0, 0.6, 0]}
          distance={2.5}
          intensity={0.6}
          color={agent.hex}
        />
      ) : null}

      {/* Hover label */}
      {isHovered ? (
        <Html
          position={[0, 2.2, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: "none" }}
        >
          <div
            className="mono pointer-events-none whitespace-nowrap rounded-full border border-graphite bg-void/90 px-3 py-1 text-[10px] uppercase tracking-[0.18em] backdrop-blur-sm"
            style={{ color: isVerified ? agent.hex : "#8A8D9A" }}
          >
            {agent.name} · {isVerified ? "verified" : "in verification"}
          </div>
        </Html>
      ) : null}
    </group>
  )
}

function Avatar({
  state,
  onClick,
}: {
  state: AgentState
  onClick: () => void
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!groupRef.current) return
    // Live position update
    groupRef.current.position.x = state.x
    groupRef.current.position.z = state.z
  })

  return (
    <group
      ref={groupRef}
      position={[state.x, 0, state.z]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = "pointer"
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default"
      }}
    >
      {/* Body (torso) */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.55, 0.8, 0.4]} />
        <meshStandardMaterial
          color={state.hex}
          emissive={state.hex}
          emissiveIntensity={0.35}
          roughness={0.4}
        />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial
          color={state.hex}
          emissive={state.hex}
          emissiveIntensity={0.5}
          roughness={0.3}
        />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.14, 0.25, 0]} castShadow>
        <boxGeometry args={[0.22, 0.5, 0.3]} />
        <meshStandardMaterial color={state.hex} emissive={state.hex} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0.14, 0.25, 0]} castShadow>
        <boxGeometry args={[0.22, 0.5, 0.3]} />
        <meshStandardMaterial color={state.hex} emissive={state.hex} emissiveIntensity={0.2} />
      </mesh>

      {/* Ground glow */}
      <pointLight
        position={[0, 0.05, 0]}
        distance={1.2}
        intensity={0.5}
        color={state.hex}
      />

      {/* Speech bubble */}
      {state.phrase ? (
        <Html
          position={[0, 2.6, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: "none" }}
        >
          <div className="mono pointer-events-none whitespace-nowrap rounded-full border border-cyan/60 bg-void/95 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan backdrop-blur-sm">
            {state.phrase}
          </div>
        </Html>
      ) : null}
    </group>
  )
}

function ConnectionThread({
  from,
  to,
}: {
  from: [number, number, number]
  to: [number, number, number]
}) {
  const lineRef = useRef<THREE.BufferGeometry>(null)
  const points = useMemo(() => {
    return new Float32Array([...from, ...to])
  }, [from, to])

  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.setAttribute(
        "position",
        new THREE.BufferAttribute(points, 3)
      )
      lineRef.current.computeBoundingSphere()
    }
  }, [points])

  return (
    <line>
      <bufferGeometry ref={lineRef} />
      <lineBasicMaterial
        color="#29E6D1"
        linewidth={2}
        transparent
        opacity={0.6}
      />
    </line>
  )
}

function Scene({
  agents,
  onAgentClick,
}: {
  agents: AgentRow[]
  onAgentClick: (id: string) => void
}) {
  const [hoveredDesk, setHoveredDesk] = useState<string | null>(null)
  const [, setTick] = useState(0)
  const statesRef = useRef<Map<string, AgentState>>(new Map())

  const ordered = useMemo(() => orderAgents(agents), [agents])

  const desks = useMemo(() => {
    return ordered.map((agent, i) => {
      const col = i % GRID_COLS
      const row = Math.floor(i / GRID_COLS)
      const totalCols = Math.min(GRID_COLS, ordered.length)
      const totalRows = Math.ceil(ordered.length / GRID_COLS)
      const x = (col - (totalCols - 1) / 2) * DESK_SPACING_X
      const z = (row - (totalRows - 1) / 2) * DESK_SPACING_Z
      return { agent, x, z }
    })
  }, [ordered])

  const verifiedIds = useMemo(
    () =>
      ordered.filter((a) => a.status === "verified").map((a) => a.id),
    [ordered]
  )

  // Initialize agent states for verified agents
  useEffect(() => {
    const next = new Map<string, AgentState>()
    for (const d of desks) {
      if (d.agent.status !== "verified") continue
      const prev = statesRef.current.get(d.agent.id)
      next.set(d.agent.id, {
        id: d.agent.id,
        hex: d.agent.hex,
        name: d.agent.name,
        homeX: d.x,
        homeZ: d.z + 1.1, // in front of the desk where the chair is
        x: prev?.x ?? d.x,
        z: prev?.z ?? d.z + 1.1,
        targetX: prev?.targetX ?? d.x,
        targetZ: prev?.targetZ ?? d.z + 1.1,
        mode: prev?.mode ?? "at_desk",
        partnerId: prev?.partnerId ?? null,
        phraseUntil: prev?.phraseUntil ?? 0,
        nextDecisionAt:
          prev?.nextDecisionAt ?? Date.now() + 4000 + Math.random() * 8000,
        phrase: prev?.phrase ?? null,
      })
    }
    statesRef.current = next
  }, [desks])

  // Animation loop
  useFrame(() => {
    const now = Date.now()
    const states = statesRef.current
    const deskMap = new Map(desks.map((d) => [d.agent.id, d]))

    for (const s of states.values()) {
      switch (s.mode) {
        case "at_desk":
          if (now >= s.nextDecisionAt) {
            if (verifiedIds.length > 1) {
              const others = verifiedIds.filter((id) => id !== s.id)
              const target = others[Math.floor(Math.random() * others.length)]
              const td = deskMap.get(target)
              if (td) {
                s.mode = "walking_out"
                s.targetX = td.x
                s.targetZ = td.z + 1.4
                s.partnerId = target
              }
            } else {
              s.mode = "walking_out"
              s.targetX = s.homeX + (Math.random() - 0.5) * 2
              s.targetZ = s.homeZ + (Math.random() - 0.5) * 1.5
              s.partnerId = null
            }
          }
          break
        case "walking_out": {
          const dx = s.targetX - s.x
          const dz = s.targetZ - s.z
          const d = Math.hypot(dx, dz)
          if (d < 0.05) {
            s.x = s.targetX
            s.z = s.targetZ
            if (s.partnerId) {
              s.mode = "talking"
              s.phraseUntil = now + 3500
              s.phrase =
                SPEECH_POOL[Math.floor(Math.random() * SPEECH_POOL.length)]
            } else {
              s.mode = "walking_back"
              s.targetX = s.homeX
              s.targetZ = s.homeZ
            }
          } else {
            s.x += dx * 0.04
            s.z += dz * 0.04
          }
          break
        }
        case "talking":
          if (now >= s.phraseUntil) {
            s.mode = "walking_back"
            s.targetX = s.homeX
            s.targetZ = s.homeZ
            s.phrase = null
            s.partnerId = null
          }
          break
        case "walking_back": {
          const dx = s.targetX - s.x
          const dz = s.targetZ - s.z
          const d = Math.hypot(dx, dz)
          if (d < 0.05) {
            s.x = s.homeX
            s.z = s.homeZ
            s.mode = "at_desk"
            s.nextDecisionAt = now + 6000 + Math.random() * 14000
          } else {
            s.x += dx * 0.04
            s.z += dz * 0.04
          }
          break
        }
      }
    }
    setTick((t) => (t + 1) % 10000)
  })

  // Gather active connection threads
  const threads: { from: [number, number, number]; to: [number, number, number] }[] =
    []
  const seenPairs = new Set<string>()
  for (const s of statesRef.current.values()) {
    if (s.mode !== "talking" || !s.partnerId) continue
    const p = statesRef.current.get(s.partnerId)
    if (!p) continue
    const key = [s.id, s.partnerId].sort().join("-")
    if (seenPairs.has(key)) continue
    seenPairs.add(key)
    threads.push({
      from: [s.x, 2.2, s.z],
      to: [p.x, 2.2, p.z],
    })
  }

  return (
    <>
      {/* Floor plane */}
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      >
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0A0B0F" roughness={0.9} />
      </mesh>

      {/* Subtle grid */}
      <gridHelper
        args={[60, 30, "#1C1E28", "#12131A"]}
        position={[0, 0.01, 0]}
      />

      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[10, 12, 8]}
        intensity={0.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[0, 8, 0]} intensity={0.4} color="#7C5CFF" />

      {/* Desks */}
      {desks.map((d) => (
        <Desk
          key={d.agent.id}
          agent={d.agent}
          position={[d.x, 0, d.z]}
          onClick={() => onAgentClick(d.agent.id)}
          isHovered={hoveredDesk === d.agent.id}
          onHover={(v) => setHoveredDesk(v ? d.agent.id : null)}
        />
      ))}

      {/* Avatars (verified only) */}
      {Array.from(statesRef.current.values()).map((s) => (
        <Avatar key={s.id} state={s} onClick={() => onAgentClick(s.id)} />
      ))}

      {/* Connection threads */}
      {threads.map((t, i) => (
        <ConnectionThread key={i} from={t.from} to={t.to} />
      ))}
    </>
  )
}

export default function Floor3D({ agents, onAgentClick }: Props) {
  return (
    <Canvas
      shadows
      camera={{
        position: [8, 9, 11],
        fov: 42,
      }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <fog attach="fog" args={["#0A0B0F", 18, 36]} />
      <Scene agents={agents} onAgentClick={onAgentClick} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={22}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2 - 0.1}
        target={[0, 0.5, 0]}
      />
    </Canvas>
  )
}
