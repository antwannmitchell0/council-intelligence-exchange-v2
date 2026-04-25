// AgentFigure — Roblox-style humanoid 3D character.
//
// Replaces the earlier abstract pulsing primitive shape with a full
// humanoid: head, hair, eyes, torso, arms, legs. Skin tone + hair
// color vary across agents (deterministic by agent_id) so the floor
// reads as a roomful of distinct people, not clones.
//
// Animation states (driven by parent scene):
//   "idle"    — at desk, gentle bob + sway
//   "walking" — translating between positions, leg + arm swing
//   "talking" — facing partner, head nod, occasional gesture
//
// The parent scene owns position interpolation and target tracking;
// this component owns body + limb pose given the current state.

"use client"

import { Html } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import type { AgentRow } from "@/lib/supabase/types"

export type AgentState = "idle" | "walking" | "talking"

type Props = {
  agent: AgentRow
  // World position of the GROUP — parent scene owns lerp.
  position: [number, number, number]
  // Y rotation in radians — used to face the desk monitor at idle, the
  // walk direction during walking, or a partner during talking.
  rotationY?: number
  // Per-instance phase so adjacent identical agents don't sync.
  phase?: number
  state?: AgentState
  onClick?: () => void
}

// Skin-tone palette — 5 stops for diversity. Picked from agent_id hash.
const SKIN_TONES = [
  "#f5d4a3", // pale
  "#e8c39e", // light tan
  "#c69478", // medium
  "#8d5524", // deep
  "#3d2817", // darkest
]

// Hair palette — 3 stops.
const HAIR_TONES = ["#1a1a1a", "#3a2517", "#7a6a5a"]

// Cheap deterministic hash for picking palette indices stably.
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function AgentFigure({
  agent,
  position,
  rotationY = 0,
  phase = 0,
  state = "idle",
  onClick,
}: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const upperRef = useRef<THREE.Group>(null) // bobs in idle
  const headRef = useRef<THREE.Group>(null) // nods in talking
  const leftArmRef = useRef<THREE.Group>(null)
  const rightArmRef = useRef<THREE.Group>(null)
  const leftLegRef = useRef<THREE.Group>(null)
  const rightLegRef = useRef<THREE.Group>(null)

  const { skin, hair, accent } = useMemo(() => {
    const h = hash(agent.id)
    return {
      skin: SKIN_TONES[h % SKIN_TONES.length],
      hair: HAIR_TONES[(h >> 3) % HAIR_TONES.length],
      accent: agent.hex || "#7c3aed",
    }
  }, [agent.id, agent.hex])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + phase
    const group = groupRef.current
    if (!group) return

    group.position.set(position[0], position[1], position[2])
    group.rotation.y = rotationY

    if (state === "walking") {
      const swing = Math.sin(t * 6) * 0.5
      const armSwing = Math.sin(t * 6 + Math.PI) * 0.4
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing
      if (leftArmRef.current) leftArmRef.current.rotation.x = armSwing
      if (rightArmRef.current) rightArmRef.current.rotation.x = -armSwing
      if (upperRef.current)
        upperRef.current.position.y = 0.85 + Math.abs(Math.sin(t * 6)) * 0.04
      if (headRef.current) {
        headRef.current.rotation.x = 0
        headRef.current.rotation.y = 0
      }
    } else if (state === "talking") {
      if (headRef.current) {
        headRef.current.rotation.x = Math.sin(t * 2.5) * 0.08
        headRef.current.rotation.y = Math.sin(t * 1.3) * 0.05
      }
      if (rightArmRef.current)
        rightArmRef.current.rotation.x = -0.4 + Math.sin(t * 1.8) * 0.15
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0
      if (upperRef.current) upperRef.current.position.y = 0.85
    } else {
      // idle
      if (upperRef.current)
        upperRef.current.position.y = 0.85 + Math.sin(t * 1.2) * 0.04
      if (headRef.current) {
        headRef.current.rotation.x = 0
        headRef.current.rotation.y = Math.sin(t * 0.6) * 0.12
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0
    }
  })

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = "pointer"
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default"
      }}
    >
      {/* Legs — children of root so they stay planted while upper body bobs */}
      <group ref={leftLegRef} position={[-0.15, 0.4, 0]}>
        <mesh castShadow position={[0, -0.4, 0]}>
          <boxGeometry args={[0.22, 0.8, 0.22]} />
          <meshStandardMaterial color="#1f2230" roughness={0.7} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.15, 0.4, 0]}>
        <mesh castShadow position={[0, -0.4, 0]}>
          <boxGeometry args={[0.22, 0.8, 0.22]} />
          <meshStandardMaterial color="#1f2230" roughness={0.7} />
        </mesh>
      </group>

      {/* Upper body — bobs during idle / walking */}
      <group ref={upperRef} position={[0, 0.85, 0]}>
        {/* Torso */}
        <mesh castShadow>
          <boxGeometry args={[0.7, 0.85, 0.42]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.18}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>

        {/* Left arm — pivoted at shoulder */}
        <group ref={leftArmRef} position={[-0.45, 0.3, 0]}>
          <mesh castShadow position={[0, -0.32, 0]}>
            <boxGeometry args={[0.18, 0.7, 0.18]} />
            <meshStandardMaterial color={skin} roughness={0.65} />
          </mesh>
        </group>
        {/* Right arm */}
        <group ref={rightArmRef} position={[0.45, 0.3, 0]}>
          <mesh castShadow position={[0, -0.32, 0]}>
            <boxGeometry args={[0.18, 0.7, 0.18]} />
            <meshStandardMaterial color={skin} roughness={0.65} />
          </mesh>
        </group>

        {/* Head group — nods + turns */}
        <group ref={headRef} position={[0, 0.7, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.32, 24, 16]} />
            <meshStandardMaterial color={skin} roughness={0.6} />
          </mesh>
          {/* Hair slab on top + back */}
          <mesh castShadow position={[0, 0.16, -0.05]}>
            <boxGeometry args={[0.6, 0.18, 0.55]} />
            <meshStandardMaterial color={hair} roughness={0.85} />
          </mesh>
          {/* Eyes */}
          <mesh position={[-0.1, 0.02, 0.3]}>
            <sphereGeometry args={[0.04, 12, 8]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.3} />
          </mesh>
          <mesh position={[0.1, 0.02, 0.3]}>
            <sphereGeometry args={[0.04, 12, 8]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.3} />
          </mesh>
        </group>
      </group>

      {/* Ground halo — per-agent accent glow */}
      <pointLight
        position={[0, 0.05, 0]}
        intensity={0.4}
        distance={2.4}
        color={accent}
      />

      {/* Codename label above head */}
      <Html
        position={[0, 2.2, 0]}
        center
        distanceFactor={9}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div
          style={{
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            fontSize: "10px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: accent,
            background: "rgba(10,10,15,0.85)",
            border: `1px solid ${accent}55`,
            borderRadius: "9999px",
            padding: "2px 8px",
            whiteSpace: "nowrap",
            textShadow: "0 0 8px rgba(0,0,0,0.85)",
            backdropFilter: "blur(4px)",
          }}
        >
          {agent.name}
        </div>
      </Html>
    </group>
  )
}
