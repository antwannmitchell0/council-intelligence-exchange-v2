import { cn } from "@/lib/utils"

type Props = {
  color: string
  size?: number
  dimmed?: boolean
  className?: string
  label?: string
}

/**
 * Minimalist geometric humanoid silhouette.
 * Rendered as inline SVG so the color fills correctly and it scales cleanly.
 */
export function SilhouetteAvatar({
  color,
  size = 36,
  dimmed = false,
  className,
  label,
}: Props) {
  const width = size
  const height = Math.round(size * 1.8)
  return (
    <svg
      viewBox="0 0 40 72"
      width={width}
      height={height}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={label}
    >
      <defs>
        <radialGradient
          id={`avatar-halo-${color.replace("#", "")}`}
          cx="50%"
          cy="90%"
          r="50%"
        >
          <stop offset="0%" stopColor={color} stopOpacity={dimmed ? 0.1 : 0.35} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ground halo beneath feet */}
      <ellipse
        cx="20"
        cy="68"
        rx="14"
        ry="3"
        fill={`url(#avatar-halo-${color.replace("#", "")})`}
      />

      {/* Body */}
      <g style={{ opacity: dimmed ? 0.38 : 1 }}>
        {/* Head */}
        <circle cx="20" cy="12" r="7" fill={color} />
        {/* Neck */}
        <rect x="18.5" y="18" width="3" height="3" fill={color} />
        {/* Torso — slight trapezoid suggesting a shoulder line */}
        <path
          d="M 10 22 L 30 22 L 32 44 L 8 44 Z"
          fill={color}
          opacity="0.88"
        />
        {/* Arms hinted */}
        <rect x="7" y="22" width="2.5" height="18" rx="1.2" fill={color} opacity="0.7" />
        <rect x="30.5" y="22" width="2.5" height="18" rx="1.2" fill={color} opacity="0.7" />
        {/* Legs */}
        <rect x="12" y="44" width="6" height="20" rx="1" fill={color} opacity="0.78" />
        <rect x="22" y="44" width="6" height="20" rx="1" fill={color} opacity="0.78" />
      </g>
    </svg>
  )
}
