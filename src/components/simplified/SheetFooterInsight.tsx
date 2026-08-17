"use client"

import { motion } from "framer-motion"
import { useReducedMotion } from "@/lib/animations"
import { FONT_FAMILY } from "@/styles/typography"
import { borderRadius } from "@/styles/shared"

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
        gap: 8,
        padding: '10px 14px',
        background: 'rgba(99, 179, 237, 0.06)',
        border: '1px solid rgba(99, 179, 237, 0.12)',
        borderRadius: borderRadius.sm,
        cursor: onLearnMore ? 'pointer' : 'default',
      }}
      onClick={onLearnMore}
      role={onLearnMore ? 'button' : undefined}
      aria-label={onLearnMore ? `Learn more: ${insight}` : undefined}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true">
        {emoji}
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 12,
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
            fontSize: 11,
            color: 'var(--accent)',
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
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
