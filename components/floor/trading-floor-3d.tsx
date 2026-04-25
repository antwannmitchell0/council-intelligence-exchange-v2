"use client"

import { Html, OrbitControls } from "@react-three/drei"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import * as THREE from "three"
import { AgentFigure } from "./agent-figure"
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

export function TradingFloor3D({ agents, onAgentClick }: Props) {
  const router = useRouter()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const desks = useMemo(() => computeDesks(agents), [agents])

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

      {/* Cyan grid lines */}
      <gridHelper args={[90, 45, "#0a1c1c", "#0d1818"]} position={[0, 0.003, 0]} />
      <gridHelper args={[90, 9, "#133030", "#133030"]} position={[0, 0.005, 0]} />

      {/* Fog */}
      <fog attach="fog" args={["#0a0a0f", 22, 42]} />

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
      {/* Violet overhead */}
      <pointLight position={[0, 12, 0]} intensity={1.1} distance={26} color="#7C5CFF" />
      {/* Cyan front fill */}
      <pointLight position={[0, 5, 14]} intensity={0.4} distance={22} color="#29E6D1" />
      {/* Warm back accent */}
      <pointLight position={[0, 5, -14]} intensity={0.25} distance={20} color="#7C5CFF" />

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

      {/* Agent figures — verified only, placed on outer (chair) side of each desk */}
      {desks
        .filter((d) => d.agent.status === "verified")
        .map((d, i) => {
          const agentR = d.radius + 1.12
          return (
            <AgentFigure
              key={d.agent.id}
              agent={d.agent}
              position={[agentR * Math.sin(d.angle), 0, agentR * Math.cos(d.angle)]}
              phase={i * 0.83}
              onClick={() =>
            onAgentClick
              ? onAgentClick(d.agent.id)
              : router.push(`/agents/${d.agent.id}`)
          }
            />
          )
        })}

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
