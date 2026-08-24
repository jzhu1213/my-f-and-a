"use client"

/**
 * MilestoneGallery — A visual, collectible-feeling screen showing all
 * milestones: earned (colored with date) and unearned (greyed with progress).
 *
 * Accessible from ToolsScreen. Not competitive — just a record of personal growth.
 *
 * Requirements: 25.4
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/animations'
import { Card } from '@/components/ui'
import { contentColumn, spacingScale } from '@/styles/layout'
import { typography } from '@/styles/typography'
import { textColors, colorRamp, surfaceColors } from '@/styles/colors'
import { radius } from '@/styles/surfaces'
import { safeAreaBottom } from '@/styles/layout'
import type { Transaction, Goal } from '@/types'
import {
  computeAllMilestoneProgress,
  getCategoryLabel,
  type MilestoneCategory,
  type MilestoneProgress,
} from '@/lib/milestones'

// ============================================================================
// Types
// ============================================================================

export interface MilestoneGalleryProps {
  /** All user transactions for progress computation */
  transactions?: Transaction[]
  /** User's goals for savings milestone progress */
  goals?: Goal[]
  /** Callback to close the gallery */
  onClose?: () => void
}

// ============================================================================
// Category order for display
// ============================================================================

const CATEGORY_ORDER: MilestoneCategory[] = [
  'tracking',
  'awareness',
  'consistency',
  'saving',
  'streaks',
  'challenges',
]

const CATEGORY_EMOJIS: Record<MilestoneCategory, string> = {
  tracking: '📝',
  awareness: '👀',
  consistency: '📅',
  saving: '🎯',
  streaks: '🔥',
  challenges: '⚡',
}

// ============================================================================
// MilestoneGallery Component
// ============================================================================

export function MilestoneGallery({
  transactions = [],
  goals = [],
  onClose,
}: MilestoneGalleryProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const milestoneProgress = useMemo(
    () => computeAllMilestoneProgress(transactions, goals),
    [transactions, goals]
  )

  // Group milestones by category
  const grouped = useMemo(() => {
    const map = new Map<MilestoneCategory, MilestoneProgress[]>()
    for (const cat of CATEGORY_ORDER) {
      map.set(cat, [])
    }
    for (const mp of milestoneProgress) {
      const existing = map.get(mp.definition.category) ?? []
      existing.push(mp)
      map.set(mp.definition.category, existing)
    }
    return map
  }, [milestoneProgress])

  const earnedCount = milestoneProgress.filter((m) => m.isEarned).length
  const totalCount = milestoneProgress.length

  return (
    <div
      style={{
        ...contentColumn,
        paddingTop: spacingScale['24'],
        paddingBottom: safeAreaBottom(100),
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: spacingScale['24'] }}>
        <h2 style={{ ...typography.title, color: textColors.text, marginBottom: spacingScale['8'] }}>
          Milestones
        </h2>
        <p style={{ ...typography['body-sm'], color: textColors.sub }}>
          Your personal growth, one milestone at a time.
        </p>
        <p style={{ ...typography.caption, color: textColors.muted, marginTop: spacingScale['8'] }}>
          {earnedCount} of {totalCount} earned
        </p>
      </div>

      {/* ── Category Sections ──────────────────────────────────────── */}
      {CATEGORY_ORDER.map((category) => {
        const milestones = grouped.get(category) ?? []
        if (milestones.length === 0) return null

        return (
          <div key={category} style={{ marginBottom: spacingScale['32'] }}>
            <p
              style={{
                ...typography.overline,
                color: textColors.muted,
                marginBottom: spacingScale['12'],
              }}
            >
              {CATEGORY_EMOJIS[category]} {getCategoryLabel(category)}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: spacingScale['12'],
              }}
            >
              {milestones.map((mp) => (
                <MilestoneTile
                  key={mp.definition.id}
                  milestone={mp}
                  prefersReducedMotion={prefersReducedMotion}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// MilestoneTile
// ============================================================================

interface MilestoneTileProps {
  milestone: MilestoneProgress
  prefersReducedMotion: boolean
}

function MilestoneTile({ milestone, prefersReducedMotion }: MilestoneTileProps) {
  const { definition, isEarned, dateEarned, progressFraction } = milestone

  const formattedDate = dateEarned
    ? new Date(dateEarned + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        style={{
          padding: spacingScale['16'],
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: spacingScale['8'],
          opacity: isEarned ? 1 : 0.5,
          borderRadius: radius.card,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Emoji badge */}
        <span
          style={{
            fontSize: typography.title.fontSize,
            lineHeight: 1,
            filter: isEarned ? 'none' : 'grayscale(1)',
          }}
          role="img"
          aria-label={definition.title}
        >
          {definition.emoji}
        </span>

        {/* Title */}
        <p
          style={{
            ...typography.caption,
            color: isEarned ? textColors.text : textColors.muted,
            fontWeight: isEarned ? 600 : 400,
          }}
        >
          {definition.title}
        </p>

        {/* Date earned or progress */}
        {isEarned && formattedDate ? (
          <p style={{ ...typography.caption, color: colorRamp.accent[500], fontSize: '0.625rem' }}>
            {formattedDate}
          </p>
        ) : (
          <div style={{ width: '100%' }}>
            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: '4px',
                borderRadius: radius.full,
                background: surfaceColors.sunken,
                overflow: 'hidden',
              }}
              role="progressbar"
              aria-valuenow={Math.round(progressFraction * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${definition.title} progress: ${Math.round(progressFraction * 100)}%`}
            >
              <div
                style={{
                  width: `${Math.round(progressFraction * 100)}%`,
                  height: '100%',
                  borderRadius: radius.full,
                  background: colorRamp.accent[400],
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <p
              style={{
                ...typography.caption,
                color: textColors.muted,
                fontSize: '0.625rem',
                marginTop: spacingScale['4'],
              }}
            >
              {definition.description}
            </p>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
