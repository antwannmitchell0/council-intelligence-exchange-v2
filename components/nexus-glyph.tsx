import { council } from "@/design/tokens"
import { cn } from "@/lib/utils"

type NexusGlyphProps = {
  className?: string
  size?: number
  ariaLabel?: string
}

export function NexusGlyph({
  className,
  size = 160,
  ariaLabel = "The Council Nexus Glyph",
}: NexusGlyphProps) {
  const agents = council.agent
  const outerR = 72
  const innerR = 32
  const coreR = 6

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox="-96 -96 192 192"
      width={size}
      height={size}
      className={cn("council-glyph", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="glyph-core" cx="0" cy="0" r="0.5">
          <stop offset="0%" stopColor={council.color.cyan} stopOpacity="0.95" />
          <stop offset="60%" stopColor={council.color.violet} stopOpacity="0.35" />
          <stop offset="100%" stopColor={council.color.void} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="glyph-stroke" x1="0" y1="-1" x2="0" y2="1">
          <stop offset="0%" stopColor={council.color.violetGlow} />
          <stop offset="100%" stopColor={council.color.violetDeep} />
        </linearGradient>
      </defs>

      {/* Depth aura */}
      <circle cx="0" cy="0" r={outerR + 10} fill="url(#glyph-core)" opacity="0.5" />

      {/* Outer hex — breathing ring */}
      <g style={{ animation: "council-breathe 4s var(--ease-council) infinite" }}>
        <polygon
          points={hexPoints(outerR)}
          fill="none"
          stroke="url(#glyph-stroke)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>

      {/* Rotated hex — 30deg offset for dimensionality */}
      <polygon
        points={hexPoints(outerR - 6)}
        fill="none"
        stroke={council.color.violet}
        strokeWidth="0.75"
        strokeOpacity="0.45"
        strokeLinejoin="round"
        transform="rotate(30)"
      />

      {/* Nine-point ring — one node per agent */}
      {agents.map((agent, i) => {
        const angle = (i / agents.length) * Math.PI * 2 - Math.PI / 2
        const x = Math.cos(angle) * innerR
        const y = Math.sin(angle) * innerR
        return (
          <circle
            key={agent.id}
            cx={x}
            cy={y}
            r="2.5"
            fill={agent.hex}
            opacity="0.9"
          >
            <title>{agent.name}</title>
          </circle>
        )
      })}

      {/* Inner connecting polygon */}
      <polygon
        points={agents
          .map((_, i) => {
            const angle = (i / agents.length) * Math.PI * 2 - Math.PI / 2
            return `${Math.cos(angle) * innerR},${Math.sin(angle) * innerR}`
          })
          .join(" ")}
        fill="none"
        stroke={council.color.violetGlow}
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />

      {/* Data-flow trace — subtle, reduced-motion-safe */}
      <circle
        cx="0"
        cy="0"
        r={outerR - 3}
        fill="none"
        stroke={council.color.cyan}
        strokeWidth="0.75"
        strokeDasharray="12 228"
        style={{
          animation: "council-trace 6s var(--ease-council) infinite",
          transformOrigin: "center",
        }}
      />

      {/* Core — the verified-signal diamond */}
      <g style={{ animation: "council-pulse 3s var(--ease-council) infinite" }}>
        <polygon
          points={`0,-${coreR} ${coreR},0 0,${coreR} -${coreR},0`}
          fill={council.color.cyan}
        />
      </g>
    </svg>
  )
}

function hexPoints(r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2
    pts.push(`${(Math.cos(angle) * r).toFixed(2)},${(Math.sin(angle) * r).toFixed(2)}`)
  }
  return pts.join(" ")
}
