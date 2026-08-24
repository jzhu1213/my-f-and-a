"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion as useAppReducedMotion } from "@/lib/animations"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import { getUnseenWhatsNew, dismissWhatsNew } from "@/lib/whatsNew"
import type { WhatsNewItem } from "@/lib/whatsNew"

// ============================================================================
// WhatsNewCard Component
// ============================================================================

export interface WhatsNewCardProps {
  /** Called when user taps "Try it →" link (passes the linkTo ID) */
  onNavigate?: (linkTo: string) => void
}

/**
 * WhatsNewCard — a compact, 1-tap dismissible card shown once per version
 * when a major new feature ships.
 *
 * - Shows emoji + title + 1-line description + optional "Try it →" link
 * - Dismissible in 1 tap
 * - Max once per version (persisted in localStorage)
 * - Never a full re-onboarding flow
 *
 * Validates: Task 395.2 — Re-onboarding for major updates
 */
export function WhatsNewCard({ onNavigate }: WhatsNewCardProps) {
  const [item, setItem] = useState<WhatsNewItem | null>(null)
  const [visible, setVisible] = useState(false)
  const { prefersReducedMotion } = useAppReducedMotion()

  useEffect(() => {
    const unseen = getUnseenWhatsNew()
    if (unseen) {
      setItem(unseen)
      setVisible(true)
    }
  }, [])

  const handleDismiss = useCallback(() => {
    if (item) {
      dismissWhatsNew(item.version)
    }
    setVisible(false)
  }, [item])

  const handleTryIt = useCallback(() => {
    if (item?.linkTo && onNavigate) {
      onNavigate(item.linkTo)
    }
    // Dismiss after navigating
    handleDismiss()
  }, [item, onNavigate, handleDismiss])

  if (!item) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          aria-label={`What's new: ${item.title}. ${item.message}`}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={prefersReducedMotion ? timings.fast : springs.gentle}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "flex-start",
            gap: spacing.sm,
            padding: "12px 16px",
            background: "var(--blue-100)",
            border: "1px solid var(--blue-200)",
            borderRadius: radius.control,
            textAlign: "start",
          }}
        >
          {/* Emoji */}
          <span style={{ fontSize: typography.subhead.fontSize, flexShrink: 0, marginTop: 1 }} aria-hidden="true">
            {item.emoji}
          </span>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.semibold,
                color: "var(--text)",
                fontFamily: FONT_FAMILY,
                lineHeight: 1.3,
                marginBottom: 2,
              }}
            >
              What&apos;s new: {item.title}
            </div>
            <div
              style={{
                fontSize: typography['body-sm'].fontSize,
                color: "var(--muted)",
                fontFamily: FONT_FAMILY,
                lineHeight: 1.4,
              }}
            >
              {item.message}
            </div>

            {/* "Try it →" link */}
            {item.linkTo && onNavigate && (
              <button
                type="button"
                onClick={handleTryIt}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: spacing.xxs,
                  marginTop: 6,
                  padding: 0,
                  fontSize: typography['body-sm'].fontSize,
                  fontFamily: FONT_FAMILY,
                  fontWeight: fontWeights.medium,
                  color: "var(--blue-500)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                aria-label={`Try ${item.title}`}
              >
                Try it →
              </button>
            )}
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss what's new card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: typography.caption.fontSize,
                color: "var(--muted)",
                fontFamily: FONT_FAMILY,
              }}
              aria-hidden="true"
            >
              ✕
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
