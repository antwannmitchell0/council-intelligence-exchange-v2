"use client"

import { Html } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useRef } from "react"
import * as THREE from "three"
import type { AgentRow } from "@/lib/supabase/types"

type Props = {
  agent: AgentRow
  position: [number, number, number]
  phase?: number
  onClick?: () => void
}

export function AgentFigure({ agent, position, phase = 0, onClick }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const torsoRef = useRef<THREE.MeshStandardMaterial>(null)
  const headRef = useRef<THREE.MeshStandardMaterial>(null)

  const isVerified = agent.status === "verified"
  const color = isVerified ? "#00ff88" : "#ffaa00"
  const [bx, by, bz] = position

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (groupRef.current) {
      groupRef.current.position.y = by + Math.sin(t * 1.4 + phase) * 0.06
    }
    const pulse = 0.38 + Math.sin(t * 2.2 + phase) * 0.18
    if (torsoRef.current) torsoRef.current.emissiveIntensity = pulse * 0.85
    if (headRef.current) headRef.current.emissiveIntensity = pulse
  })

  return (
    <group
      ref={groupRef}
      position={[bx, by, bz]}
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
      {/* Torso — cylinder */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.21, 0.68, 10]} />
        <meshStandardMaterial
          ref={torsoRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.38}
          roughness={0.4}
        />
      </mesh>

      {/* Head — sphere */}
      <mesh position={[0, 1.02, 0]} castShadow>
        <sphereGeometry args={[0.21, 14, 14]} />
        <meshStandardMaterial
          ref={headRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          roughness={0.3}
        />
      </mesh>

      {/* Ground glow */}
      <pointLight
        position={[0, 0.1, 0]}
        distance={2}
        intensity={isVerified ? 0.7 : 0.35}
        color={color}
      />

      {/* Name tag — always faces camera */}
      <Html
        position={[0, 1.62, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "9px",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color,
            whiteSpace: "nowrap",
            background: "rgba(10,10,15,0.88)",
            border: `1px solid ${color}66`,
            borderRadius: "9999px",
            padding: "2px 8px",
            backdropFilter: "blur(4px)",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {agent.name}
        </div>
      </Html>
    </group>
  )
}
