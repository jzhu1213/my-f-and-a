"use client"

/**
 * TimeHorizonPills — compact secondary stat pills below the hero.
 *
 * Shows multiple student-relevant time-horizon stats as frosted-glass pills:
 * weekend, until-payday, and until-term-end. Only renders pills that are
 * configured and contextually relevant.
 *
 * Follows the existing weekend pill / spend-down pill pattern in HomeScreen.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { timings } from '@/lib/animations'
import { FONT_FAMILY, typography } from '@/styles/typography'
import type { TimeHorizonStats } from '@/lib/timeHorizonStats'

// ============================================================================
// Props
// ============================================================================

export interface TimeHorizonPillsProps {
  stats: TimeHorizonStats
}

// ============================================================================
// Pill style (shared frosted glass pattern)
// ============================================================================

const pillStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '6px 14px',
  background: 'var(--fill-04)',
  border: '1px solid var(--fill-08)',
  borderRadius: 'var(--radius-full)',
  width: 'fit-content',
}

const textStyle: React.CSSProperties = {
  fontSize: typography['body-sm'].fontSize,
  color: 'var(--sub)',
  fontFamily: FONT_FAMILY,
  opacity: 0.85,
  fontVariantNumeric: 'tabular-nums',
}

// ============================================================================
// Component
// ============================================================================

export function TimeHorizonPills({ stats }: TimeHorizonPillsProps) {
  const prefersReducedMotion = useReducedMotion()
  const { weekend, payday, term } = stats

  // Collect visible pills (max 3)
  const pills: { key: string; emoji: string; text: string; ariaLabel: string }[] = []

  if (weekend) {
    pills.push({
      key: 'weekend',
      emoji: '🎉',
      text: `$${weekend.amount} ${weekend.label.toLowerCase()}`,
      ariaLabel: `${weekend.label}: $${weekend.amount} safe to spend`,
    })
  }

  if (payday) {
    pills.push({
      key: 'payday',
      emoji: '💵',
      text: `$${Math.round(payday.dailyAmount)}/day • ${payday.daysLeft}d to payday`,
      ariaLabel: `$${Math.round(payday.dailyAmount)} per day until payday, ${payday.daysLeft} days left`,
    })
  }

  if (term) {
    pills.push({
      key: 'term',
      emoji: '📚',
      text: `$${Math.round(term.dailyAmount)}/day • ${term.daysLeft}d left`,
      ariaLabel: `${term.label}: $${Math.round(term.dailyAmount)} per day, ${term.daysLeft} days remaining`,
    })
  }

  if (pills.length === 0) return null

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: -4 } as const,
        animate: { opacity: 1, y: 0 } as const,
        transition: timings.normal,
      }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
      }}
    >
      {pills.map((pill) => (
        <motion.div
          key={pill.key}
          role="status"
          aria-label={pill.ariaLabel}
          {...motionProps}
          style={pillStyle}
        >
          <span style={{ fontSize: typography['body-sm'].fontSize }} aria-hidden="true">
            {pill.emoji}
          </span>
          <span style={textStyle}>{pill.text}</span>
        </motion.div>
      ))}
    </div>
  )
}
