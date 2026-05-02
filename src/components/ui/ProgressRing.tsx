"use client"
import { useEffect, useState } from 'react'

interface ProgressRingProps {
  progress: number
  size?: number
  strokeWidth?: number
  color?: 'green' | 'blue' | 'amber'
  showLabel?: boolean
}

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 4,
  color = 'green',
  showLabel = true,
}: ProgressRingProps) {
  const [animated, setAnimated] = useState(0)

  const radius      = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset      = circumference - (animated / 100) * circumference

  const strokeColor = {
    green: 'var(--green)',
    blue:  'var(--blue)',
    amber: 'var(--amber)',
  }[color]

  useEffect(() => {
    const t = setTimeout(() => setAnimated(Math.min(progress, 100)), 100)
    return () => clearTimeout(t)
  }, [progress])

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        width={size}
        height={size}
      >
        <circle
          fill="transparent"
          stroke="var(--line)"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset 1s ease-out',
          }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
            {Math.round(animated)}%
          </span>
        </div>
      )}
    </div>
  )
}
