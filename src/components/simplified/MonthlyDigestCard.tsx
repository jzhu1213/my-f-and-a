"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { timings } from "@/lib/animations"
import type { MonthlyDigest } from "@/lib/monthlyDigest"
import { dismissDigest, isDigestDismissed } from "@/lib/monthlyDigest"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY, typography, spacing, fontWeights } from '@/styles/typography'
import { textColors } from "@/styles/colors"
import { spacingScale } from "@/styles/layout"

// ============================================================================
// Types
// ============================================================================

export interface MonthlyDigestCardProps {
  /** The compiled monthly digest to display. */
  digest: MonthlyDigest
  /** Called after dismiss is persisted. */
  onDismiss?: () => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * MonthlyDigestCard — A compact, celebratory "Your month in review" card
 * shown at the end of each budget period.
 *
 * Features:
 * - Title: "Your month in review ✨"
 * - Shows 3–5 bullet highlights (wins first, trends second)
 * - Ends with a single actionable tip
 * - Warm, celebratory tone (GlassCard with celebration glow)
 * - Dismissible, persisted with month key (shows once per period)
 * - Animated with framer-motion
 * - Accessible: proper ARIA labels
 *
 * Requirements: 19.4
 */
export function MonthlyDigestCard({ digest, onDismiss }: MonthlyDigestCardProps) {
  const [dismissed, setDismissed] = useState(() => isDigestDismissed(digest.month))

  const handleDismiss = useCallback(() => {
    dismissDigest(digest.month)
    setDismissed(true)
    onDismiss?.()
  }, [digest.month, onDismiss])

  if (dismissed) return null

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.section
          aria-label="Monthly spending review"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={timings.normal}
        >
          <GlassCard elevation="low" glow="celebration" style={{ padding: "16px 18px", borderRadius: 14 }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacingScale["12"] }}>
              <span style={{ fontSize: typography.subhead.fontSize, lineHeight: 1.3 }} aria-hidden="true">
                🎉
              </span>
              <p
                style={{
                  ...typography["body-sm"],
                  fontWeight: fontWeights.semibold,
                  color: textColors.text,
                  flex: 1,
                }}
              >
                {digest.title}
              </p>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss monthly review"
                style={{
                  background: "none",
                  border: "none",
                  padding: 4,
                  minWidth: 44,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: typography.body.fontSize,
                  color: "var(--sub)",
                  opacity: 0.6,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Highlights list */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacingScale["6"],
                paddingInlineStart: 30, // align with text after emoji
              }}
            >
              {digest.highlights.map((highlight, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: spacing.xs,
                  }}
                >
                  <span style={{ fontSize: typography['body-sm'].fontSize, lineHeight: 1.5, flexShrink: 0 }} aria-hidden="true">
                    {highlight.emoji}
                  </span>
                  <p
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: typography['body-sm'].fontSize,
                      color: textColors.sub,
                      lineHeight: 1.5,
                    }}
                  >
                    {highlight.text}
                  </p>
                </div>
              ))}

              {/* Actionable tip — visually distinct */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: spacing.xs,
                  marginTop: spacingScale["4"],
                  paddingTop: spacingScale["8"],
                  borderTop: "1px solid var(--fill-06)",
                }}
              >
                <span style={{ fontSize: typography['body-sm'].fontSize, lineHeight: 1.5, flexShrink: 0 }} aria-hidden="true">
                  💡
                </span>
                <p
                  style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: typography['body-sm'].fontSize,
                    fontWeight: fontWeights.medium,
                    color: textColors.text,
                    lineHeight: 1.5,
                    opacity: 0.9,
                  }}
                >
                  {digest.actionableTip}
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
