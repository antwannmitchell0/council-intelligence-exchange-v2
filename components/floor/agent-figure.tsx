// Ported wholesale from v1 council-exchange.vercel.app
// (components/floor/AgentCharacter.tsx). The v1 build is the operator's
// own prior work and is what they want this scene to look like.
//
// Adaptations from v1:
//   - Imports CouncilAgent from lib/floor/agents-data (v2 adapter) instead
//     of v1's static agents-data.
//   - Personality table P extended with E (ECHO) and U (PULSE) — v2 has
//     11 agents vs v1's 9.
//   - All animation logic (DESK / MOVING / TALKING / RETURNING FSM,
//     proximity-based encounter, gesture animations) preserved verbatim.

"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Text, Billboard } from "@react-three/drei"
import * as THREE from "three"
import type { CouncilAgent } from "@/lib/floor/agents-data"

// Personality per agent — determines how they move and socialize.
// Letters match the `code` field on CouncilAgent. Original v1 entries
// preserved; E + U added for v2's two extra agents (ECHO + PULSE).
const P: Record<
  string,
  {
    deskTime: [number, number]
    speed: number
    talkTime: [number, number]
    wander: number
    social: number
    phase: number
  }
> = {
  A: { deskTime: [1.5, 3], speed: 1.4, talkTime: [2, 4], wander: 6, social: 0.85, phase: 0.0 },
  B: { deskTime: [3, 6], speed: 0.8, talkTime: [2, 3], wander: 3, social: 0.4, phase: 1.2 },
  C: { deskTime: [2, 4], speed: 1.1, talkTime: [3, 5], wander: 5, social: 0.7, phase: 0.5 },
  E: { deskTime: [4, 8], speed: 0.7, talkTime: [3, 6], wander: 3, social: 0.45, phase: 1.5 },
  F: { deskTime: [4, 8], speed: 0.6, talkTime: [4, 7], wander: 2, social: 0.25, phase: 2.1 },
  H: { deskTime: [1.5, 3], speed: 1.2, talkTime: [1.5, 3], wander: 5, social: 0.75, phase: 0.8 },
  N: { deskTime: [1, 2], speed: 1.6, talkTime: [2, 3], wander: 7, social: 0.9, phase: 0.3 },
  P: { deskTime: [3, 5], speed: 0.9, talkTime: [3, 5], wander: 3, social: 0.55, phase: 1.7 },
  S: { deskTime: [3, 6], speed: 0.7, talkTime: [5, 8], wander: 3, social: 0.5, phase: 2.5 },
  U: { deskTime: [5, 9], speed: 0.6, talkTime: [4, 8], wander: 2, social: 0.3, phase: 2.7 },
  W: { deskTime: [2, 4], speed: 1.1, talkTime: [2, 4], wander: 5, social: 0.65, phase: 1.0 },
}

const BOUNDS = { x: [-9, 9], z: [-7, 3] }
const TALK_DIST = 0.9

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function clamp(v: THREE.Vector3) {
  v.x = THREE.MathUtils.clamp(v.x, BOUNDS.x[0], BOUNDS.x[1])
  v.z = THREE.MathUtils.clamp(v.z, BOUNDS.z[0], BOUNDS.z[1])
  return v
}

type S = "DESK" | "MOVING" | "TALKING" | "RETURNING"

export interface AgentCharacterProps {
  agent: CouncilAgent
  onSelect: (a: CouncilAgent) => void
  selected: boolean
  posRef: React.MutableRefObject<Map<string, THREE.Vector3>>
  allCodes: string[]
}

export function AgentCharacter({
  agent,
  onSelect,
  selected,
  posRef,
  allCodes,
}: AgentCharacterProps) {
  const group = useRef<THREE.Group>(null)
  const head = useRef<THREE.Mesh>(null)
  const lArm = useRef<THREE.Group>(null)
  const rArm = useRef<THREE.Group>(null)
  const lLeg = useRef<THREE.Group>(null)
  const rLeg = useRef<THREE.Group>(null)
  const glowRing = useRef<THREE.Mesh>(null)

  const pers = P[agent.code] ?? P.A
  const home = new THREE.Vector3(agent.deskPosition[0], 0, agent.deskPosition[2])

  const state = useRef<S>("DESK")
  const timer = useRef(pers.phase)
  const target = useRef(home.clone())
  const partner = useRef<string | null>(null)

  useFrame((_, dt) => {
    if (!group.current) return
    const pos = group.current.position
    const t = performance.now() / 1000

    posRef.current.set(agent.code, pos.clone())

    if (glowRing.current) {
      const speed =
        agent.status === "signal" ? 5 : agent.status === "active" ? 2 : 0.8
      ;(glowRing.current.material as THREE.MeshBasicMaterial).opacity =
        (Math.sin(t * speed) * 0.5 + 0.5) * 0.22
    }

    timer.current -= dt

    // ── DESK ───────────────────────────────────────────────
    if (state.current === "DESK") {
      if (lArm.current) lArm.current.rotation.x = Math.sin(t * 2.5) * 0.12
      if (rArm.current) rArm.current.rotation.x = Math.sin(t * 2.5 + Math.PI) * 0.12
      if (head.current) {
        head.current.rotation.x = 0
        head.current.rotation.y = 0
      }
      group.current.position.y = 0

      if (timer.current <= 0) {
        if (Math.random() < pers.social) {
          const others = allCodes.filter((c) => c !== agent.code)
          const code = others[Math.floor(Math.random() * others.length)]
          const op = posRef.current.get(code)
          target.current = op
            ? clamp(
                op
                  .clone()
                  .add(
                    new THREE.Vector3(
                      (Math.random() - 0.5) * 1.2,
                      0,
                      (Math.random() - 0.5) * 1.2
                    )
                  )
              )
            : clamp(
                home
                  .clone()
                  .add(
                    new THREE.Vector3(
                      (Math.random() - 0.5) * pers.wander * 2,
                      0,
                      (Math.random() - 0.5) * pers.wander * 2
                    )
                  )
              )
        } else {
          const angle = Math.random() * Math.PI * 2
          const dist = rand(1.5, pers.wander)
          target.current = clamp(
            home
              .clone()
              .add(
                new THREE.Vector3(
                  Math.cos(angle) * dist,
                  0,
                  Math.sin(angle) * dist
                )
              )
          )
        }
        state.current = "MOVING"
      }
      return
    }

    // ── MOVING / RETURNING ────────────────────────────────
    if (state.current === "MOVING" || state.current === "RETURNING") {
      const dir = target.current.clone().sub(pos)
      dir.y = 0
      const dist = dir.length()

      if (dist > 0.18) {
        dir.normalize()
        const sp = pers.speed * (state.current === "RETURNING" ? 0.75 : 1)
        pos.x += dir.x * sp * dt
        pos.z += dir.z * sp * dt
        group.current.rotation.y = THREE.MathUtils.lerp(
          group.current.rotation.y,
          Math.atan2(dir.x, dir.z),
          0.12
        )

        const wf = 6 * sp
        if (lLeg.current) lLeg.current.rotation.x = Math.sin(t * wf) * 0.45
        if (rLeg.current) rLeg.current.rotation.x = -Math.sin(t * wf) * 0.45
        if (lArm.current) lArm.current.rotation.x = -Math.sin(t * wf) * 0.38
        if (rArm.current) rArm.current.rotation.x = Math.sin(t * wf) * 0.38
        group.current.position.y = Math.abs(Math.sin(t * wf)) * 0.035

        if (state.current === "MOVING") {
          for (const code of allCodes) {
            if (code === agent.code) continue
            const op = posRef.current.get(code)
            if (op && op.distanceTo(pos) < TALK_DIST) {
              partner.current = code
              state.current = "TALKING"
              timer.current = rand(pers.talkTime[0], pers.talkTime[1])
              if (lLeg.current) lLeg.current.rotation.x = 0
              if (rLeg.current) rLeg.current.rotation.x = 0
              group.current.position.y = 0
              break
            }
          }
        }
      } else {
        if (lLeg.current) lLeg.current.rotation.x = 0
        if (rLeg.current) rLeg.current.rotation.x = 0
        if (lArm.current) lArm.current.rotation.x = 0
        if (rArm.current) rArm.current.rotation.x = 0
        group.current.position.y = 0

        if (state.current === "RETURNING") {
          state.current = "DESK"
          timer.current = rand(pers.deskTime[0], pers.deskTime[1])
        } else {
          target.current = home.clone()
          state.current = "RETURNING"
        }
      }
      return
    }

    // ── TALKING ───────────────────────────────────────────
    if (state.current === "TALKING") {
      const pp = partner.current ? posRef.current.get(partner.current) : null
      if (pp) {
        const dir = pp.clone().sub(pos)
        if (dir.length() > 0.01) {
          group.current.rotation.y = THREE.MathUtils.lerp(
            group.current.rotation.y,
            Math.atan2(dir.x, dir.z),
            0.2
          )
        }
      }
      if (lArm.current) lArm.current.rotation.x = Math.sin(t * 3.0) * 0.42 - 0.2
      if (rArm.current)
        rArm.current.rotation.x = Math.sin(t * 2.4 + 1.1) * 0.38 - 0.15
      if (head.current) {
        head.current.rotation.x = Math.sin(t * 2.2) * 0.09
        head.current.rotation.y = Math.sin(t * 1.6) * 0.12
      }
      group.current.position.y = 0

      if (timer.current <= 0) {
        partner.current = null
        if (head.current) {
          head.current.rotation.x = 0
          head.current.rotation.y = 0
        }
        target.current = home.clone()
        state.current = "RETURNING"
      }
    }
  })

  const statusColor = {
    active: "#22c55e",
    signal: "#f59e0b",
    scanning: "#60a5fa",
    idle: "#6b7280",
  }[agent.status]
  const [sx, , sz] = agent.deskPosition

  return (
    <group ref={group} position={[sx, 0, sz]} onClick={() => onSelect(agent)}>
      {/* Floor glow ring */}
      <mesh
        ref={glowRing}
        position={[0, 0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.22, 0.42, 32]} />
        <meshBasicMaterial color={agent.color} transparent opacity={0.18} />
      </mesh>

      {/* Left leg + shoe */}
      <group ref={lLeg} position={[-0.1, 0.3, 0]}>
        <mesh>
          <capsuleGeometry args={[0.063, 0.28, 4, 8]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.2, 0.05]}>
          <boxGeometry args={[0.1, 0.06, 0.17]} />
          <meshStandardMaterial color="#0d0d0d" metalness={0.3} roughness={0.5} />
        </mesh>
      </group>

      {/* Right leg + shoe */}
      <group ref={rLeg} position={[0.1, 0.3, 0]}>
        <mesh>
          <capsuleGeometry args={[0.063, 0.28, 4, 8]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.2, 0.05]}>
          <boxGeometry args={[0.1, 0.06, 0.17]} />
          <meshStandardMaterial color="#0d0d0d" metalness={0.3} roughness={0.5} />
        </mesh>
      </group>

      {/* Torso */}
      <mesh position={[0, 0.62, 0]}>
        <capsuleGeometry args={[0.135, 0.27, 4, 8]} />
        <meshStandardMaterial
          color={agent.color + "77"}
          emissive={new THREE.Color(agent.color)}
          emissiveIntensity={0.07}
          roughness={0.7}
        />
      </mesh>

      {/* Shirt accent stripe */}
      <mesh position={[0, 0.67, 0.135]}>
        <boxGeometry args={[0.07, 0.19, 0.01]} />
        <meshStandardMaterial
          color={agent.color}
          emissive={new THREE.Color(agent.color)}
          emissiveIntensity={0.5}
          roughness={0.3}
        />
      </mesh>

      {/* Left arm + hand */}
      <group ref={lArm} position={[-0.2, 0.68, 0]}>
        <mesh>
          <capsuleGeometry args={[0.053, 0.21, 4, 8]} />
          <meshStandardMaterial color={agent.color + "77"} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.16, 0]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#c8a07a" roughness={0.9} />
        </mesh>
      </group>

      {/* Right arm + hand */}
      <group ref={rArm} position={[0.2, 0.68, 0]}>
        <mesh>
          <capsuleGeometry args={[0.053, 0.21, 4, 8]} />
          <meshStandardMaterial color={agent.color + "77"} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.16, 0]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#c8a07a" roughness={0.9} />
        </mesh>
      </group>

      {/* Head */}
      <mesh ref={head} position={[0, 0.97, 0]}>
        <sphereGeometry args={[0.135, 16, 16]} />
        <meshStandardMaterial color="#c8a07a" roughness={0.9} />
      </mesh>

      {/* Eyes */}
      {([-0.052, 0.052] as const).map((x, i) => (
        <mesh key={i} position={[x, 1.0, 0.127]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color="#180800" />
        </mesh>
      ))}

      {/* Status dot on forehead */}
      <mesh position={[0, 1.09, 0.125]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshBasicMaterial color={statusColor} />
      </mesh>

      {/* Floating name tag */}
      <Billboard position={[0, 1.45, 0]}>
        <mesh position={[0, 0, -0.007]}>
          <planeGeometry args={[0.72, 0.23]} />
          <meshBasicMaterial color={agent.color} transparent opacity={0.5} />
        </mesh>
        <mesh position={[0, 0, -0.004]}>
          <planeGeometry args={[0.7, 0.21]} />
          <meshBasicMaterial color="#040410" transparent opacity={0.9} />
        </mesh>
        <Text
          fontSize={0.1}
          color={agent.color}
          anchorX="center"
          anchorY="middle"
          position={[0, 0.035, 0]}
        >
          {agent.isNova ? `${agent.name} 👑` : agent.name}
        </Text>
        <Text
          fontSize={0.06}
          color="#ffffff55"
          anchorX="center"
          anchorY="middle"
          position={[0, -0.062, 0]}
        >
          {agent.specialty}
        </Text>
      </Billboard>

      {/* Selected ring */}
      {selected && (
        <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.56, 48]} />
          <meshBasicMaterial color={agent.color} transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  )
}

// Backwards-compat default export — older code imports `AgentFigure`.
export const AgentFigure = AgentCharacter
export default AgentCharacter
export type AgentState = S
