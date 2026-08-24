"use client"

import { motion } from "framer-motion"
import { useReducedMotion } from "@/lib/animations"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'

// ============================================================================
// Types
// ============================================================================

interface SheetFooterInsightProps {
  /** The 1-line insight text (already rendered with user data) */
  insight: string
  /** Optional emoji prefix */
  emoji?: string
  /** Called when the user taps the insight to expand/learn more */
  onLearnMore?: () => void
}

/**
 * SheetFooterInsight — a subtle 1-line educational moment at the bottom of
 * expense/income sheets.
 *
 * Examples:
 *   "Did you know: your food spending is 35% of your budget"
 *   "Your daily coffee habit costs $4.50/day — $135/month"
 *
 * Renders as a single-line pill with gentle educational glow.
 * Non-blocking, optional, dismissible by scrolling past.
 *
 * Requirements: 26.2
 */
export function SheetFooterInsight({ insight, emoji = '💡', onLearnMore }: SheetFooterInsightProps) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.xs,
        padding: '10px 14px',
        background: 'var(--blue-100)',
        border: '1px solid var(--blue-200)',
        borderRadius: radius.control,
        cursor: onLearnMore ? 'pointer' : 'default',
      }}
      onClick={onLearnMore}
      onKeyDown={onLearnMore ? (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onLearnMore()
        }
      } : undefined}
      role={onLearnMore ? 'button' : undefined}
      tabIndex={onLearnMore ? 0 : undefined}
      aria-label={onLearnMore ? `Learn more: ${insight}` : undefined}
    >
      <span style={{ fontSize: typography.body.fontSize, flexShrink: 0 }} aria-hidden="true">
        {emoji}
      </span>
      <p
        style={{
          margin: 0,
          fontSize: typography['body-sm'].fontSize,
          lineHeight: 1.4,
          color: 'var(--sub)',
          fontFamily: FONT_FAMILY,
          flex: 1,
        }}
      >
        {insight}
      </p>
      {onLearnMore && (
        <span
          style={{
            fontSize: typography.caption.fontSize,
            color: 'var(--accent)',
            fontFamily: FONT_FAMILY,
            fontWeight: fontWeights.medium,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Learn more
        </span>
      )}
    </motion.div>
  )
}
