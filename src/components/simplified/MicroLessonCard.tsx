"use client"

import { motion } from "framer-motion"
import { GlassCard } from "@/components/ui/GlassCard"
import { useReducedMotion } from "@/lib/animations"
import { FONT_FAMILY } from "@/styles/typography"
import type { MicroLesson } from "@/lib/microLessons"

interface MicroLessonCardProps {
  lesson: MicroLesson
  /** Called when the user taps "Learn more" — navigates to the full lesson. */
  onLearnMore: (lessonId: string) => void
  /** Called when the user taps "Got it" — dismisses and marks as read. */
  onDismiss: (id: string) => void
}

/**
 * MicroLessonCard — a compact educational card for a 30-second financial tip.
 *
 * Visually distinct from ContextualTipCard: uses a blue educational glow and
 * a slightly different layout. Dismissable with "Got it" and links to the
 * full lesson via "Learn more →".
 *
 * Respects reduced motion preferences.
 */
export function MicroLessonCard({ lesson, onLearnMore, onDismiss }: MicroLessonCardProps) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{ minWidth: 240, maxWidth: 280, flex: "0 0 auto" }}
    >
      <GlassCard elevation="medium" glow="rgba(99, 179, 237, 0.3)">
        <div style={{ padding: 16 }}>
          {/* Header: emoji + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }} role="img" aria-hidden="true">
              {lesson.emoji}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text)",
                fontFamily: FONT_FAMILY,
              }}
            >
              {lesson.title}
            </span>
          </div>

          {/* Content (1-2 sentences) */}
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--sub)",
              fontFamily: FONT_FAMILY,
              marginBottom: 12,
            }}
          >
            {lesson.content}
          </p>

          {/* Actions: "Learn more →" and "Got it" */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => onLearnMore(lesson.relatedLessonId)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--accent, #63b3ed)",
                fontFamily: FONT_FAMILY,
                padding: 0,
              }}
              aria-label={`Learn more about ${lesson.title}`}
            >
              Learn more →
            </button>
            <button
              type="button"
              onClick={() => onDismiss(lesson.id)}
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--muted)",
                fontFamily: FONT_FAMILY,
                padding: "4px 10px",
              }}
              aria-label={`Dismiss tip: ${lesson.title}`}
            >
              Got it
            </button>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}
