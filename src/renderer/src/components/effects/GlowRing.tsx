interface GlowRingProps {
  color?: string
  size?: number
  strokeWidth?: number
  animated?: boolean
}

/** Slowly rotating gradient ring with a soft glow (login logo halo). */
export function GlowRing({
  color = '#6366f1',
  size = 120,
  strokeWidth = 1.5,
  animated = true
}: GlowRingProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      style={animated ? { animation: 'spin-slow 8s linear infinite' } : undefined}
    >
      <defs>
        <linearGradient id="glow-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <stop offset="50%" stopColor={color} stopOpacity="0.1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </linearGradient>
        <filter id="glow-ring-blur">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - strokeWidth}
        stroke="url(#glow-ring-grad)"
        strokeWidth={strokeWidth}
        filter="url(#glow-ring-blur)"
      />
    </svg>
  )
}
