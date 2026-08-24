"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useReducedMotion } from "@/lib/animations"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'

// ============================================================================
// Types
// ============================================================================

interface InlineEducationCalloutProps {
  /** Short 1-2 sentence educational text (already rendered with user data) */
  content: string
  /** Optional emoji for visual context */
  emoji?: string
  /** Optional title for the callout */
  title?: string
  /** Called when user dismisses the callout */
  onDismiss?: () => void
}

/**
 * InlineEducationCallout — a subtle inline educational moment for calculator,
 * debt, or projection screens.
 *
 * Explains what the user is looking at using their own numbers. Appears as a
 * soft informational box that doesn't block interaction.
 *
 * Requirements: 26.2
 */
export function InlineEducationCallout({
  content,
  emoji = '📖',
  title,
  onDismiss,
}: InlineEducationCalloutProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: spacing.sm,
            padding: '12px 14px',
            background: 'var(--blue-50)',
            border: '1px solid var(--blue-100)',
            borderRadius: radius.control,
            position: 'relative',
          }}
          role="note"
          aria-label={title ?? 'Educational insight'}
        >
          <span style={{ fontSize: typography.body.fontSize, flexShrink: 0, marginTop: 1 }} aria-hidden="true">
            {emoji}
          </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            {title && (
              <p
                style={{
                  margin: '0 0 2px 0',
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.semibold,
                  color: 'var(--text)',
                  fontFamily: FONT_FAMILY,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </p>
            )}
            <p
              style={{
                margin: 0,
                fontSize: typography['body-sm'].fontSize,
                lineHeight: 1.5,
                color: 'var(--sub)',
                fontFamily: FONT_FAMILY,
              }}
            >
              {content}
            </p>
          </div>

          {onDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                color: 'var(--muted)',
                fontSize: typography['body-sm'].fontSize,
                lineHeight: 1,
              }}
              aria-label="Dismiss educational insight"
            >
              ✕
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
