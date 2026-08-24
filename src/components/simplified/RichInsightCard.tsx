"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { timings, springs } from "@/lib/animations"
import type { SpendingInsight } from "@/lib/spendingInsights"
import { GlassCard } from "@/components/ui/GlassCard"
import type { GlassGlow } from "@/components/ui/GlassCard"
import { FONT_FAMILY, typography, spacing, fontWeights } from '@/styles/typography'
import { textColors } from "@/styles/colors"
import { spacingScale } from "@/styles/layout"

// ============================================================================
// Types
// ============================================================================

export interface RichInsightCardProps {
  /** The spending insight to display. */
  insight: SpendingInsight
  /** Called when the user dismisses the card. */
  onDismiss?: (insightId: string) => void
}

// ============================================================================
// Helpers
// ============================================================================

const DISMISS_KEY_PREFIX = "folio-insight-dismissed-"

/** Check if an insight has been dismissed (persisted in localStorage). */
function isInsightDismissed(insightId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(DISMISS_KEY_PREFIX + insightId) === "1"
  } catch {
    return false
  }
}

/** Persist dismissal to localStorage. */
function dismissInsight(insightId: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(DISMISS_KEY_PREFIX + insightId, "1")
  } catch {
    // best-effort
  }
}

/** Map insight tone to GlassCard glow preset. */
function toneToGlow(tone: SpendingInsight["tone"]): GlassGlow {
  switch (tone) {
    case "positive":
      return "healthy"
    case "cautionary":
      return "caution"
    default:
      return "none"
  }
}

/** Generate a compact metric string based on insight type. */
function getMetricLabel(insight: SpendingInsight): string | null {
  switch (insight.type) {
    case "under_budget_streak": {
      // Extract streak number from title like "Under budget 12 days running"
      const match = insight.title.match(/(\d+)\s*days?/)
      return match ? `${match[1]} days` : null
    }
    case "category_trend": {
      // Extract percent from title like "Food spending down 20%"
      const match = insight.title.match(/(\d+)%/)
      if (!match) return null
      const isDown = insight.title.toLowerCase().includes("down")
      return isDown ? `â†“${match[1]}%` : `â†‘${match[1]}%`
    }
    case "spending_velocity": {
      const match = insight.message.match(/~(\d+)%/)
      if (!match) return null
      const isSlowed = insight.type === "spending_velocity" && insight.tone === "positive"
      return isSlowed ? `â†“${match[1]}%` : `â†‘${match[1]}%`
    }
    case "merchant_frequency": {
      // Extract count like "8th" from title
      const match = insight.title.match(/(\d+)(?:st|nd|rd|th)/)
      return match ? `${match[1]}Ã—` : null
    }
    case "day_of_week": {
      const match = insight.message.match(/(\d+)%\s*more/)
      return match ? `+${match[1]}%` : null
    }
    default:
      return null
  }
}

/** Generate "tell me more" expanded detail text based on insight type. */
function getExpandedDetail(insight: SpendingInsight): string {
  switch (insight.type) {
    case "under_budget_streak":
      return "Staying under your daily budget builds momentum. Each day counts toward a healthy rhythm â€” keep going at your pace."
    case "category_trend":
      return insight.tone === "positive"
        ? "Your spending in this category has shifted compared to last month. Trends like this can help you spot where your habits are working well."
        : "Spending in this category has grown compared to last month. This is just awareness â€” no action needed unless you want to adjust."
    case "spending_velocity":
      return insight.tone === "positive"
        ? "Your daily spending pace has slowed down compared to last week. A natural ebb and flow is totally healthy."
        : "Your spending pace picked up this week. Sometimes that's seasonal or event-driven â€” nothing to worry about on its own."
    case "merchant_frequency":
      return "This merchant appears frequently in your recent transactions. Not a problem â€” just helpful to know where your money flows regularly."
    case "day_of_week":
      return "One day of the week tends to have higher spending. This is common â€” weekends, paydays, or social days often look different."
    default:
      return "This pattern was detected from your recent spending data. It's here to help you stay aware, not to judge."
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * RichInsightCard â€” A dismissible, expandable card for displaying a single
 * spending insight with a metric highlight and warm copy.
 *
 * Features:
 * - Displays emoji, title, warm message, and a compact metric number
 * - "Tell me more" expansion reveals extra context
 * - Dismissible (persisted to localStorage by insight ID)
 * - Uses GlassCard with glow based on tone (positive/cautionary/neutral)
 * - Animated entrance/exit with framer-motion
 * - Accessible: ARIA labels, reduced-motion support via framer-motion defaults
 *
 * Requirements: 19.4
 */
export function RichInsightCard({ insight, onDismiss }: RichInsightCardProps) {
  const [dismissed, setDismissed] = useState(() => isInsightDismissed(insight.id))
  const [expanded, setExpanded] = useState(false)

  const handleDismiss = useCallback(() => {
    dismissInsight(insight.id)
    setDismissed(true)
    onDismiss?.(insight.id)
  }, [insight.id, onDismiss])

  const metricLabel = getMetricLabel(insight)
  const expandedDetail = getExpandedDetail(insight)
  const glow = toneToGlow(insight.tone)

  if (dismissed) return null

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.section
          aria-label={`Spending insight: ${insight.title}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={timings.normal}
        >
          <GlassCard elevation="low" glow={glow} style={{ padding: "14px 18px", borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.sm }}>
              {/* Emoji */}
              <span style={{ fontSize: typography.subhead.fontSize, lineHeight: 1.3 }} aria-hidden="true">
                {insight.emoji}
              </span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title + metric row */}
                <div style={{ display: "flex", alignItems: "baseline", gap: spacing.xs }}>
                  <p
                    style={{
                      ...typography["body-sm"],
                      fontWeight: fontWeights.medium,
                      color: textColors.text,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {insight.title}
                  </p>
                  {metricLabel && (
                    <span
                      style={{
                        fontFamily: FONT_FAMILY,
                        fontSize: typography['body-sm'].fontSize,
                        fontWeight: fontWeights.semibold,
                        color: insight.tone === "positive"
                          ? "var(--success)"
                          : insight.tone === "cautionary"
                          ? "var(--caution)"
                          : textColors.sub,
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                      aria-label={`Metric: ${metricLabel}`}
                    >
                      {metricLabel}
                    </span>
                  )}
                </div>

                {/* Message */}
                <p
                  style={{
                    ...typography.caption,
                    fontWeight: fontWeights.regular,
                    color: textColors.sub,
                    marginTop: spacingScale["4"],
                    lineHeight: 1.45,
                  }}
                >
                  {insight.message}
                </p>

                {/* Tell me more button */}
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  aria-expanded={expanded}
                  aria-label={expanded ? "Show less" : "Tell me more about this insight"}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    marginTop: spacingScale["8"],
                    cursor: "pointer",
                    fontFamily: FONT_FAMILY,
                    fontSize: typography.caption.fontSize,
                    fontWeight: fontWeights.medium,
                    color: "var(--accent)",
                    opacity: 0.85,
                    lineHeight: 1,
                  }}
                >
                  {expanded ? "show less" : "tell me more"}
                </button>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={timings.normal}
                      style={{ overflow: "hidden" }}
                    >
                      <p
                        style={{
                          fontFamily: FONT_FAMILY,
                          fontSize: typography.caption.fontSize,
                          color: textColors.muted,
                          lineHeight: 1.5,
                          marginTop: spacingScale["8"],
                          paddingTop: spacingScale["8"],
                          borderTop: "1px solid var(--fill-06)",
                        }}
                      >
                        {expandedDetail}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Dismiss button */}
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss insight"
                style={{
                  background: "none",
                  border: "none",
                  padding: 4,
                  cursor: "pointer",
                  fontSize: typography.body.fontSize,
                  color: "var(--sub)",
                  opacity: 0.6,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                âœ•
              </button>
            </div>
          </GlassCard>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
