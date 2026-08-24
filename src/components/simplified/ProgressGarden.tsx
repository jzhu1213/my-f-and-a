"use client"

/**
 * ProgressGarden — A decorative SVG garden that evolves with user engagement.
 *
 * Purely cosmetic visualization. Each plant/element grows based on real metrics:
 * - Savings Tree: goal completions
 * - Tracking Flower: streak length
 * - Consistency Grass: total active days
 * - Challenge Bushes: completed challenges
 * - Awareness Pond: total spending tracked
 *
 * Features:
 * - Season-adaptive color palette
 * - Reduced-motion safe (static rendering, no animated transitions)
 * - Compact mode for pinnable home card
 * - Accessible with descriptive aria-label
 *
 * Requirements: 25.3
 */

import { useMemo } from "react"
import { useReducedMotion } from "@/lib/animations"
import {
  computeGardenState,
  SEASON_PALETTES,
  type GardenMetrics,
  type GardenElement,
  type SeasonPalette,
} from "@/lib/gardenProgress"
import { FONT_FAMILY } from "@/styles/typography"
import { radius } from '@/styles/surfaces'

// ============================================================================
// Props
// ============================================================================

export interface ProgressGardenProps {
  /** Real engagement metrics */
  metrics: GardenMetrics
  /** Compact mode for pinnable home card (smaller, no labels) */
  compact?: boolean
}

// ============================================================================
// SVG Element Renderers
// ============================================================================

function SavingsTree({ stage, palette, x }: { stage: number; palette: SeasonPalette; x: number }) {
  if (stage === 0) {
    // Seed/dormant: small dot
    return <circle cx={x} cy={130} r={3} fill={palette.ground} opacity={0.5} />
  }
  // Tree grows taller and wider with stage
  const trunkHeight = 10 + stage * 10
  const canopyRadius = 6 + stage * 4
  const baseY = 135
  return (
    <g>
      {/* Trunk */}
      <rect
        x={x - 2}
        y={baseY - trunkHeight}
        width={4}
        height={trunkHeight}
        fill="#8B6914"
        rx={2}
      />
      {/* Canopy */}
      <circle
        cx={x}
        cy={baseY - trunkHeight - canopyRadius + 2}
        r={canopyRadius}
        fill={palette.foliage}
        opacity={0.85}
      />
      {stage >= 3 && (
        <circle
          cx={x - canopyRadius * 0.5}
          cy={baseY - trunkHeight - canopyRadius * 0.5}
          r={canopyRadius * 0.6}
          fill={palette.foliage}
          opacity={0.7}
        />
      )}
      {stage >= 5 && (
        <circle
          cx={x + canopyRadius * 0.4}
          cy={baseY - trunkHeight - canopyRadius * 1.2}
          r={canopyRadius * 0.5}
          fill={palette.accent}
          opacity={0.6}
        />
      )}
    </g>
  )
}

function TrackingFlower({ stage, palette, x }: { stage: number; palette: SeasonPalette; x: number }) {
  if (stage === 0) {
    // Seed
    return <circle cx={x} cy={133} r={2} fill={palette.ground} opacity={0.4} />
  }
  const stemHeight = 8 + stage * 6
  const petalCount = Math.min(stage + 2, 7)
  const petalRadius = 3 + stage
  const baseY = 135

  return (
    <g>
      {/* Stem */}
      <line
        x1={x}
        y1={baseY}
        x2={x}
        y2={baseY - stemHeight}
        stroke="#4ade80"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* Petals */}
      {Array.from({ length: petalCount }).map((_, i) => {
        const angle = (i * 360) / petalCount
        const rad = (angle * Math.PI) / 180
        const px = x + Math.cos(rad) * petalRadius
        const py = baseY - stemHeight + Math.sin(rad) * petalRadius
        return (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={petalRadius * 0.5}
            fill={palette.accent}
            opacity={0.8}
          />
        )
      })}
      {/* Center */}
      <circle cx={x} cy={baseY - stemHeight} r={petalRadius * 0.35} fill="#fbbf24" />
    </g>
  )
}

function ConsistencyGrass({ stage, palette, x }: { stage: number; palette: SeasonPalette; x: number }) {
  if (stage === 0) return null
  // More blades with higher stage
  const bladeCount = 3 + stage * 2
  const baseY = 137

  return (
    <g>
      {Array.from({ length: bladeCount }).map((_, i) => {
        const offset = (i - bladeCount / 2) * 4
        const height = 5 + (i % 3) * 3 + stage * 2
        const sway = (i % 2 === 0 ? -1 : 1) * 2
        return (
          <line
            key={i}
            x1={x + offset}
            y1={baseY}
            x2={x + offset + sway}
            y2={baseY - height}
            stroke={palette.foliage}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.7 + (i % 3) * 0.1}
          />
        )
      })}
    </g>
  )
}

function ChallengeBushes({ stage, palette, x }: { stage: number; palette: SeasonPalette; x: number }) {
  if (stage === 0) {
    return <circle cx={x} cy={134} r={2} fill={palette.ground} opacity={0.3} />
  }
  const bushCount = stage
  const baseY = 133

  return (
    <g>
      {Array.from({ length: bushCount }).map((_, i) => {
        const offset = (i - (bushCount - 1) / 2) * 14
        const bushRadius = 7 + stage * 2
        return (
          <ellipse
            key={i}
            cx={x + offset}
            cy={baseY}
            rx={bushRadius}
            ry={bushRadius * 0.7}
            fill={palette.foliage}
            opacity={0.6 + i * 0.1}
          />
        )
      })}
    </g>
  )
}

function AwarenessPond({ stage, palette, x }: { stage: number; palette: SeasonPalette; x: number }) {
  if (stage === 0) {
    return <ellipse cx={x} cy={136} rx={4} ry={2} fill={palette.water} opacity={0.2} />
  }
  const pondWidth = 12 + stage * 6
  const pondHeight = 5 + stage * 2

  return (
    <g>
      <ellipse
        cx={x}
        cy={136}
        rx={pondWidth}
        ry={pondHeight}
        fill={palette.water}
        opacity={0.4 + stage * 0.1}
      />
      {/* Ripple */}
      {stage >= 2 && (
        <ellipse
          cx={x}
          cy={136}
          rx={pondWidth * 0.6}
          ry={pondHeight * 0.6}
          fill="none"
          stroke={palette.water}
          strokeWidth={0.5}
          opacity={0.5}
        />
      )}
    </g>
  )
}

// ============================================================================
// Garden Label (full mode only)
// ============================================================================

function GardenLabel({ element, x, y }: { element: GardenElement; x: number; y: number }) {
  if (element.stage === 0) return null
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill="var(--sub, #94a3b8)"
      fontSize={8}
      fontFamily={FONT_FAMILY}
      opacity={0.8}
    >
      {element.label}
    </text>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ProgressGarden({ metrics, compact = false }: ProgressGardenProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const gardenState = useMemo(() => computeGardenState(metrics), [metrics])
  const palette = SEASON_PALETTES[gardenState.season]

  const width = compact ? 180 : 320
  const height = compact ? 80 : 160

  // Element X positions (spread across the garden)
  const positions = compact
    ? { tree: 30, flower: 65, grass: 100, bushes: 135, pond: 160 }
    : { tree: 50, flower: 110, grass: 165, bushes: 225, pond: 280 }

  const ariaLabel = `Your progress garden: ${gardenState.activeCount} of ${gardenState.totalCount} elements growing. Season: ${gardenState.season}. ${gardenState.elements.map(e => `${e.label} at stage ${e.stage} of ${e.maxStage}`).join(', ')}.`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="auto"
      role="img"
      aria-label={ariaLabel}
      style={{
        maxWidth: compact ? 180 : 320,
        display: 'block',
        borderRadius: radius.control,
        background: palette.sky,
      }}
    >
      {/* Ground */}
      <rect
        x={0}
        y={height * 0.82}
        width={width}
        height={height * 0.18}
        fill={palette.ground}
        opacity={0.6}
        rx={4}
      />

      {/* Scale for compact mode */}
      <g transform={compact ? 'scale(0.5) translate(0, -15)' : undefined}>
        {/* Awareness Pond (background layer) */}
        <AwarenessPond stage={gardenState.elements[4].stage} palette={palette} x={positions.pond} />

        {/* Consistency Grass */}
        <ConsistencyGrass stage={gardenState.elements[2].stage} palette={palette} x={positions.grass} />

        {/* Challenge Bushes */}
        <ChallengeBushes stage={gardenState.elements[3].stage} palette={palette} x={positions.bushes} />

        {/* Savings Tree */}
        <SavingsTree stage={gardenState.elements[0].stage} palette={palette} x={positions.tree} />

        {/* Tracking Flower */}
        <TrackingFlower stage={gardenState.elements[1].stage} palette={palette} x={positions.flower} />

        {/* Labels (full mode only) */}
        {!compact && (
          <g>
            <GardenLabel element={gardenState.elements[0]} x={positions.tree} y={155} />
            <GardenLabel element={gardenState.elements[1]} x={positions.flower} y={155} />
            <GardenLabel element={gardenState.elements[2]} x={positions.grass} y={155} />
            <GardenLabel element={gardenState.elements[3]} x={positions.bushes} y={155} />
            <GardenLabel element={gardenState.elements[4]} x={positions.pond} y={155} />
          </g>
        )}
      </g>
    </svg>
  )
}
