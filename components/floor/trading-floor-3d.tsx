// Ported from v1 council-exchange/components/floor/TradingFloor3D.tsx.
// All sub-components — FloorGrid, BackWall, Walls, CeilingLights,
// WorkStations, DataParticles, DataStreams, Stars — are preserved verbatim.
//
// Adaptations from v1:
//   - Accepts agents from props instead of importing static COUNCIL_AGENTS.
//   - Lane labels on the desk grid kept generic (not hardcoded to v1's
//     "CRYPTO DESK / EQUITIES / …") since v2's specialty mapping is
//     different.
//   - The Canvas wrapper lives in floor-client.tsx now; this file
//     exports the Scene contents only.

"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import {
  Grid,
  OrbitControls,
  Stars,
  Text,
} from "@react-three/drei"
// Environment removed — fetches an HDR map from a CDN at runtime which
// crashes the scene on networks that block third-party HDR hosts.
// Ambient lighting from ambientLight + directionalLight is enough.
import * as THREE from "three"
import { AgentCharacter } from "./agent-figure"
import { ActiveBeams } from "./connection-beams"
import type { CouncilAgent } from "@/lib/floor/agents-data"

interface Props {
  agents: CouncilAgent[]
  selectedAgent: CouncilAgent | null
  onSelectAgent: (agent: CouncilAgent | null) => void
}

// Lane labels on the desk grid — generic v2 categories, positioned at
// each desk slot so visitors see what each desk is "for".
const LANE_LABELS: Array<{ pos: [number, number, number]; label: string }> = [
  { pos: [-7.5, 0, -4], label: "INSTITUTIONAL" },
  { pos: [-4.5, 0, -4], label: "ON-CHAIN" },
  { pos: [-1.5, 0, -4], label: "CATALYSTS" },
  { pos: [1.5, 0, -4], label: "MONETARY" },
  { pos: [4.5, 0, -4], label: "EMPLOYMENT" },
  { pos: [7.5, 0, -4], label: "GLOBAL" },
  { pos: [-6, 0, 0], label: "INSIDER" },
  { pos: [-3, 0, 0], label: "Δ POSITIONS" },
  { pos: [0, 0, 0], label: "CONGRESS" },
  { pos: [3, 0, 0], label: "RATES" },
  { pos: [6, 0, 0], label: "ATTENTION" },
]

function FloorGrid() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[50, 40]} />
        <meshStandardMaterial color="#050508" metalness={0.8} roughness={0.4} />
      </mesh>
      <Grid
        position={[0, 0, 0]}
        args={[50, 40]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="#c9a84c0a"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#c9a84c1a"
        fadeDistance={35}
        fadeStrength={1}
        infiniteGrid={false}
      />
    </>
  )
}

function WorkStations() {
  return (
    <>
      {LANE_LABELS.map(({ pos, label }) => (
        <group key={label} position={pos}>
          {/* Desk surface */}
          <mesh position={[0, 0.38, 0]}>
            <boxGeometry args={[1.8, 0.06, 0.9]} />
            <meshStandardMaterial color="#0d0d18" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Desk glow edge */}
          <mesh position={[0, 0.41, 0]}>
            <boxGeometry args={[1.82, 0.01, 0.92]} />
            <meshBasicMaterial color="#c9a84c" transparent opacity={0.15} />
          </mesh>
          {/* Monitor */}
          <mesh position={[0, 0.85, -0.35]}>
            <boxGeometry args={[1.2, 0.75, 0.04]} />
            <meshStandardMaterial
              color="#050510"
              emissive={new THREE.Color("#0a1628")}
              emissiveIntensity={0.6}
              metalness={0.3}
              roughness={0.8}
            />
          </mesh>
          <pointLight
            position={[0, 0.85, -0.2]}
            intensity={0.3}
            distance={2}
            color="#4060ff"
          />
          {/* Keyboard */}
          <mesh position={[0, 0.42, 0.05]}>
            <boxGeometry args={[0.9, 0.02, 0.3]} />
            <meshStandardMaterial color="#0a0a18" metalness={0.5} roughness={0.6} />
          </mesh>
          {/* Desk lane label */}
          <Text
            position={[0, 0.55, 0.46]}
            fontSize={0.08}
            color="#c9a84c88"
            anchorX="center"
            anchorY="middle"
            rotation={[-0.3, 0, 0]}
          >
            {label}
          </Text>
        </group>
      ))}
    </>
  )
}

function DataStreams() {
  const streamRef = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (streamRef.current) {
      streamRef.current.children.forEach((child, i) => {
        child.position.y =
          ((state.clock.getElapsedTime() * 0.3 + i * 0.7) % 4) - 0.5
        const mat = (child as THREE.Mesh).material as
          | THREE.MeshBasicMaterial
          | undefined
        if (mat) {
          mat.opacity =
            0.3 + Math.sin(state.clock.getElapsedTime() + i) * 0.2
        }
      })
    }
  })

  return (
    <group ref={streamRef}>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            (Math.random() - 0.5) * 18,
            0,
            (Math.random() - 0.5) * 10,
          ]}
        >
          <planeGeometry args={[0.02, 0.4]} />
          <meshBasicMaterial color="#c9a84c" transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function DataParticles() {
  const pointsRef = useRef<THREE.Points>(null)
  const count = 300
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 22
    positions[i * 3 + 1] = Math.random() * 5
    positions[i * 3 + 2] = (Math.random() - 0.5) * 14
  }

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.008
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.025}
        color="#c9a84c"
        transparent
        opacity={0.35}
        sizeAttenuation
      />
    </points>
  )
}

function BackWall() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (ref.current) {
      ;(ref.current.material as THREE.MeshBasicMaterial).opacity =
        0.06 + Math.sin(state.clock.getElapsedTime() * 0.5) * 0.02
    }
  })
  return (
    <group position={[0, 2, -8]}>
      <mesh>
        <planeGeometry args={[24, 9]} />
        <meshStandardMaterial color="#06060f" metalness={0.3} roughness={0.8} />
      </mesh>
      {/* Scan lines */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh
          ref={i === 0 ? ref : undefined}
          key={i}
          position={[0, i - 4, 0.01]}
        >
          <planeGeometry args={[22, 0.008]} />
          <meshBasicMaterial color="#c9a84c" transparent opacity={0.06} />
        </mesh>
      ))}
      {/* THE COUNCIL gold text */}
      <Text
        position={[0, 1.5, 0.1]}
        fontSize={0.9}
        color="#c9a84c"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.15}
      >
        THE COUNCIL
      </Text>
      <Text
        position={[0, 0.4, 0.1]}
        fontSize={0.32}
        color="#ffffff22"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.3}
      >
        INTELLIGENCE EXCHANGE
      </Text>
      {/* Underline rule */}
      <mesh position={[0, -0.1, 0.1]}>
        <planeGeometry args={[8, 0.015]} />
        <meshBasicMaterial color="#c9a84c" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

function Walls() {
  return (
    <>
      <mesh position={[-13, 2, -2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial color="#05050d" metalness={0.2} roughness={0.9} />
      </mesh>
      <mesh position={[13, 2, -2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial color="#05050d" metalness={0.2} roughness={0.9} />
      </mesh>
      <mesh position={[0, 5, -2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[28, 18]} />
        <meshStandardMaterial color="#030308" roughness={1} />
      </mesh>
    </>
  )
}

function CeilingLights() {
  const positions: Array<[number, number, number]> = [
    [-7.5, 4.8, -4],
    [-4.5, 4.8, -4],
    [-1.5, 4.8, -4],
    [1.5, 4.8, -4],
    [4.5, 4.8, -4],
    [7.5, 4.8, -4],
    [-6, 4.8, 0],
    [-3, 4.8, 0],
    [0, 4.8, 0],
    [3, 4.8, 0],
    [6, 4.8, 0],
  ]
  return (
    <>
      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.08, 0.15, 8]} />
            <meshStandardMaterial color="#111122" metalness={0.9} roughness={0.2} />
          </mesh>
          <pointLight intensity={0.6} distance={5} color="#c9a84c" decay={2} />
          <mesh position={[0, -0.08, 0]}>
            <circleGeometry args={[0.09, 16]} />
            <meshBasicMaterial color="#ffe8a0" transparent opacity={0.9} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export function TradingFloor3D({
  agents,
  selectedAgent,
  onSelectAgent,
}: Props) {
  const posRef = useRef<Map<string, THREE.Vector3>>(new Map())
  const allCodes = agents.map((a) => a.code)

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.12} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={0.25}
        color="#c9a84c"
        castShadow
      />
      <pointLight position={[0, 8, 0]} intensity={0.2} color="#0a0a20" />
      <fog attach="fog" args={["#050508", 18, 40]} />

      <FloorGrid />
      <BackWall />
      <Walls />
      <CeilingLights />
      <WorkStations />
      <DataParticles />
      <DataStreams />
      <Stars
        radius={80}
        depth={40}
        count={1000}
        factor={2}
        saturation={0}
        fade
        speed={0.2}
      />

      {/* Beams between agents in proximity */}
      <ActiveBeams agents={agents} posRef={posRef} />

      {/* The 11 agent characters */}
      {agents.map((agent) => (
        <AgentCharacter
          key={agent.code}
          agent={agent}
          selected={selectedAgent?.code === agent.code}
          onSelect={(a) =>
            onSelectAgent(selectedAgent?.code === a.code ? null : a)
          }
          posRef={posRef}
          allCodes={allCodes}
        />
      ))}

      <OrbitControls
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={4}
        maxDistance={25}
        enablePan={true}
        panSpeed={0.5}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        target={[0, 0.5, -2]}
      />
    </>
  )
}
