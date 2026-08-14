"use client"

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, timings } from '@/lib/animations'
import { FONT_FAMILY } from '@/styles/typography'
import { spacingScale } from '@/styles/layout'
import { textColors, colorRamp } from '@/styles/colors'
import { radius } from '@/styles/surfaces'
import type { ToolIntroduction } from '@/lib/toolIntroductions'
import { markToolIntroductionShown } from '@/lib/toolIntroductions'

// ============================================================================
// Tool Introduction Toast (Task 394.1)
//
// A brief, 1-tap dismissible toast that surfaces when a checklist step is
// completed — introducing a related tool. Non-blocking, auto-dismisses after
// 6 seconds. Uses framer-motion for enter/exit animation.
// ============================================================================

/** Auto-dismiss timeout in ms */
const AUTO_DISMISS_MS = 6000

export interface ToolIntroductionToastProps {
  /** The introduction to display (null = hidden) */
  introduction: ToolIntroduction | null
  /** Called when the user taps the toast (navigate to tool) */
  onNavigate?: (toolId: string) => void
  /** Called when the toast is dismissed (by tap or timeout) */
  onDismiss?: () => void
}

export function ToolIntroductionToast({
  introduction,
  onNavigate,
  onDismiss,
}: ToolIntroductionToastProps) {
  const [visible, setVisible] = useState(false)

  // Show when a new introduction arrives
  useEffect(() => {
    if (introduction) {
      setVisible(true)
    }
  }, [introduction])

  // Auto-dismiss after timeout
  useEffect(() => {
    if (!visible || !introduction) return

    const timer = setTimeout(() => {
      handleDismiss()
    }, AUTO_DISMISS_MS)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, introduction])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    if (introduction) {
      markToolIntroductionShown(introduction.id)
    }
    onDismiss?.()
  }, [introduction, onDismiss])

  const handleTap = useCallback(() => {
    if (introduction) {
      markToolIntroductionShown(introduction.id)
      onNavigate?.(introduction.relatedToolId)
    }
    setVisible(false)
    onDismiss?.()
  }, [introduction, onNavigate, onDismiss])

  return (
    <AnimatePresence>
      {visible && introduction && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={springs.gentle}
          role="status"
          aria-live="polite"
          aria-label={introduction.message}
          style={{
            position: 'fixed',
            bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            left: spacingScale['16'],
            right: spacingScale['16'],
            zIndex: 1000,
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            onClick={handleTap}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '14px 16px',
              background: colorRamp.accent[100],
              border: `1px solid ${colorRamp.accent[300]}`,
              borderRadius: radius.card,
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Emoji */}
            <span
              style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}
              aria-hidden="true"
            >
              {introduction.emoji}
            </span>

            {/* Message */}
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 500,
                color: textColors.text,
                fontFamily: FONT_FAMILY,
                lineHeight: 1.4,
              }}
            >
              {introduction.message}
            </span>

            {/* Dismiss X */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleDismiss()
              }}
              aria-label="Dismiss"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 6px',
                fontSize: 14,
                color: textColors.muted,
                lineHeight: 1,
                flexShrink: 0,
                borderRadius: 4,
              }}
            >
              ×
            </button>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
