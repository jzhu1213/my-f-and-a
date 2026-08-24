"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { GlassCard } from "@/components/ui/GlassCard"
import { useReducedMotion } from "@/lib/animations"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from "@/styles/surfaces"
import type { ContextualLesson } from "@/lib/contextualLessonContent"

// ============================================================================
// Types
// ============================================================================

interface EducationalMomentCardProps {
  /** The contextual lesson to display (already rendered with user data) */
  lesson: ContextualLesson
  /** Called when the user taps "Got it" â€” dismisses and marks as seen */
  onDismiss: (lessonId: string) => void
  /** Optional action button config (e.g., "Try it: set a food budget â†’") */
  action?: {
    label: string
    onAction: () => void
  }
}

/**
 * EducationalMomentCard â€” a contextual educational card with "Learn more"
 * accordion expansion.
 *
 * Renders a micro-lesson in the home screen tip slot. When the user taps
 * "Learn more", the card expands inline to reveal:
 *   - A 30-second explanation (deepDiveContent)
 *   - An optional action button ("Try it: set a food budget â†’")
 *
 * Visually distinct from ContextualTipCard: uses a blue educational glow
 * and expanded content area. Takes priority over regular tips when fresh.
 *
 * Requirements: 26.2
 */
export function EducationalMomentCard({
  lesson,
  onDismiss,
  action,
}: EducationalMomentCardProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [expanded, setExpanded] = useState(false)

  const hasDeepDive = Boolean(lesson.deepDiveContent)

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      layout={!prefersReducedMotion}
    >
      <GlassCard elevation="medium" glow="var(--blue-300)">
        <div style={{ padding: 16 }}>
          {/* Header: emoji + title + dismiss */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: 8 }}>
            <span style={{ fontSize: typography.subhead.fontSize }} role="img" aria-hidden="true">
              {lesson.emoji}
            </span>
            <span
              style={{
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.semibold,
                color: 'var(--text)',
                fontFamily: FONT_FAMILY,
                flex: 1,
              }}
            >
              {lesson.title}
            </span>
            <button
              type="button"
              onClick={() => onDismiss(lesson.id)}
              style={{
                background: 'var(--fill-06)',
                border: '1px solid var(--fill-08)',
                borderRadius: radius.control,
                cursor: 'pointer',
                fontSize: typography.caption.fontSize,
                fontWeight: fontWeights.medium,
                color: 'var(--muted)',
                fontFamily: FONT_FAMILY,
                padding: '4px 10px',
                flexShrink: 0,
              }}
              aria-label={`Dismiss: ${lesson.title}`}
            >
              Got it
            </button>
          </div>

          {/* Micro-content (always visible) */}
          <p
            style={{
              fontSize: typography['body-sm'].fontSize,
              lineHeight: 1.5,
              color: 'var(--sub)',
              fontFamily: FONT_FAMILY,
              marginBottom: hasDeepDive || action ? 12 : 0,
            }}
          >
            {lesson.microContent}
          </p>

          {/* Deep dive expansion (accordion) */}
          <AnimatePresence initial={false}>
            {expanded && lesson.deepDiveContent && (
              <motion.div
                key="deep-dive"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  style={{
                    padding: '12px 0 8px 0',
                    borderTop: '1px solid var(--fill-06)',
                    marginTop: 4,
                  }}
                >
                  {/* Deep dive content */}
                  <p
                    style={{
                      fontSize: typography['body-sm'].fontSize,
                      lineHeight: 1.6,
                      color: 'var(--sub)',
                      fontFamily: FONT_FAMILY,
                      margin: 0,
                    }}
                  >
                    {lesson.deepDiveContent}
                  </p>

                  {/* Optional action button */}
                  {action && (
                    <motion.button
                      type="button"
                      onClick={action.onAction}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                      style={{
                        marginTop: spacing.sm,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'var(--blue-100)',
                        border: '1px solid var(--blue-200)',
                        borderRadius: radius.control,
                        padding: '8px 14px',
                        cursor: 'pointer',
                        fontSize: typography['body-sm'].fontSize,
                        fontWeight: fontWeights.medium,
                        color: 'var(--accent)',
                        fontFamily: FONT_FAMILY,
                      }}
                      aria-label={action.label}
                    >
                      {action.label}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2.5 7h9M8 3.5L11.5 7 8 10.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* "Learn more" toggle button */}
          {hasDeepDive && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.medium,
                color: 'var(--accent)',
                fontFamily: FONT_FAMILY,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              aria-expanded={expanded}
              aria-label={expanded ? 'Show less' : `Learn more about ${lesson.title}`}
            >
              {expanded ? 'Show less' : 'Learn more'}
              <motion.span
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'inline-flex', fontSize: typography['body-sm'].fontSize }}
                aria-hidden="true"
              >
                â–¾
              </motion.span>
            </button>
          )}
        </div>
      </GlassCard>
    </motion.div>
  )
}
