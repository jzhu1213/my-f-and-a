"use client"

import { motion } from 'framer-motion'
import { timings } from '@/lib/animations'
import { FONT_FAMILY, typography, fontWeights } from '@/styles/typography'
import { spacingScale } from '@/styles/layout'
import { textColors, colorRamp } from '@/styles/colors'
import { radius } from '@/styles/surfaces'
import type { ToolReadinessState } from '@/lib/toolReadiness'

// ============================================================================
// Tool Not-Ready State (Task 394.2)
//
// A friendly empty-state component for tools that don't have enough data yet.
// Shows a warm emoji, encouraging message, and optional progress hint.
// NOT a locked gate — never blocks navigation or implies restriction.
// ============================================================================

export interface ToolNotReadyStateProps {
  /** The readiness state from getToolReadinessState (should have ready: false) */
  readiness: ToolReadinessState
  /** Optional tool name to personalize the heading */
  toolName?: string
}

export function ToolNotReadyState({ readiness, toolName }: ToolNotReadyStateProps) {
  if (readiness.ready) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={timings.normal}
      role="status"
      aria-label={readiness.message}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: `${spacingScale['48']} ${spacingScale['24']}`,
        gap: spacingScale['16'],
      }}
    >
      {/* Large emoji */}
      <span
        style={{ fontSize: 48, lineHeight: 1 }}
        aria-hidden="true"
      >
        {readiness.emoji}
      </span>

      {/* Warm message */}
      <p
        style={{
          fontSize: typography.body.fontSize,
          fontWeight: fontWeights.medium,
          color: textColors.text,
          fontFamily: FONT_FAMILY,
          lineHeight: 1.5,
          maxWidth: 280,
          margin: 0,
        }}
      >
        {readiness.message}
      </p>

      {/* Progress hint (if available) */}
      {readiness.progressHint && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: colorRamp.accent[50],
            border: `1px solid ${colorRamp.accent[200]}`,
            borderRadius: radius.full,
          }}
        >
          <span
            style={{
              fontSize: typography['body-sm'].fontSize,
              fontWeight: fontWeights.medium,
              color: textColors.sub,
              fontFamily: FONT_FAMILY,
            }}
          >
            {readiness.progressHint}
          </span>
        </div>
      )}

      {/* Subtle reassurance */}
      <p
        style={{
          fontSize: typography['body-sm'].fontSize,
          color: textColors.muted,
          fontFamily: FONT_FAMILY,
          lineHeight: 1.4,
          maxWidth: 240,
          margin: 0,
        }}
      >
        This will fill in automatically as you use Folio — no extra setup needed
      </p>
    </motion.div>
  )
}
