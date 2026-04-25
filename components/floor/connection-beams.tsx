// Ported from v1 council-exchange/components/floor/ConnectionBeams.tsx.
// The v1 implementation pre-creates a beam mesh per agent-pair and shows
// or hides each one per-frame based on distance. We use the simpler
// `ActiveBeams` variant since it doesn't allocate mid-render.

"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { CouncilAgent } from "@/lib/floor/agents-data"

interface ActiveBeamsProps {
  agents: CouncilAgent[]
  posRef: React.MutableRefObject<Map<string, THREE.Vector3>>
}

export function ActiveBeams({ agents, posRef }: ActiveBeamsProps) {
  const codes = agents.map((a) => a.code)
  const colorByCode = Object.fromEntries(agents.map((a) => [a.code, a.color]))

  const pairs: Array<{ a: string; b: string; color: string }> = []
  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      pairs.push({
        a: codes[i],
        b: codes[j],
        color: colorByCode[codes[i]] ?? "#c9a84c",
      })
    }
  }

  return (
    <>
      {pairs.map(({ a, b, color }) => (
        <DynamicBeam
          key={`${a}-${b}`}
          codeA={a}
          codeB={b}
          color={color}
          posRef={posRef}
        />
      ))}
    </>
  )
}

function DynamicBeam({
  codeA,
  codeB,
  color,
  posRef,
}: {
  codeA: string
  codeB: string
  color: string
  posRef: React.MutableRefObject<Map<string, THREE.Vector3>>
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const p1Ref = useRef<THREE.Mesh>(null)
  const p2Ref = useRef<THREE.Mesh>(null)
  const p3Ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const pa = posRef.current.get(codeA)
    const pb = posRef.current.get(codeB)
    if (!pa || !pb || !meshRef.current || !matRef.current) return

    const dist = pa.distanceTo(pb)
    const active = dist < 2.0

    meshRef.current.visible = active
    if (p1Ref.current) p1Ref.current.visible = active
    if (p2Ref.current) p2Ref.current.visible = active
    if (p3Ref.current) p3Ref.current.visible = active

    if (!active) return

    const t = state.clock.getElapsedTime()
    const mid = pa.clone().add(pb).multiplyScalar(0.5)
    mid.y = 0.65

    meshRef.current.position.copy(mid)
    meshRef.current.scale.x = dist

    const angle = Math.atan2(pb.x - pa.x, pb.z - pa.z)
    meshRef.current.rotation.y = angle + Math.PI / 2

    matRef.current.opacity = 0.15 + Math.sin(t * 4 + dist) * 0.1

    const offsets = [0, 0.33, 0.66]
    const particles = [p1Ref, p2Ref, p3Ref]
    particles.forEach((pRef, i) => {
      if (!pRef.current) return
      const frac = (t * 0.5 + offsets[i]) % 1
      const pos = pa.clone().lerp(pb, frac)
      pos.y = 0.65
      pRef.current.position.copy(pos)
      ;(pRef.current.material as THREE.MeshBasicMaterial).opacity =
        Math.sin(frac * Math.PI) * 0.85
    })
  })

  return (
    <>
      <mesh ref={meshRef} position={[0, 0.65, 0]}>
        <boxGeometry args={[1, 0.008, 0.008]} />
        <meshBasicMaterial ref={matRef} color={color} transparent opacity={0} />
      </mesh>
      {[p1Ref, p2Ref, p3Ref].map((pRef, i) => (
        <mesh key={i} ref={pRef}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0} />
        </mesh>
      ))}
    </>
  )
}
