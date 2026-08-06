"use client"
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { timings, layoutTransition, useReducedMotion } from '@/lib/animations'
import { FONT_FAMILY } from '@/styles/typography'
import { borderRadius } from '@/styles/shared'

// ============================================================================
// Setup Checklist Card (Task 223)
// ============================================================================

/** Maps internal step IDs to user-friendly labels and emoji */
const STEP_META: Record<string, { label: string; emoji: string }> = {
  'setup-income': { label: 'Add your income', emoji: '💰' },
  'express-income': { label: 'Add your income', emoji: '💰' },
  'optional-recent-income': { label: 'Add your income', emoji: '💰' },
  'setup-budget-style': { label: 'Pick budget limits', emoji: '📊' },
  'paycheck-mode': { label: 'Connect your paycheck', emoji: '📅' },
  'paycheck-schedule': { label: 'Connect your paycheck', emoji: '📅' },
  'paycheck-allocation': { label: 'Connect your paycheck', emoji: '📅' },
  'paycheck-confirmation': { label: 'Connect your paycheck', emoji: '📅' },
  'optional-goal': { label: 'Pick a savings goal', emoji: '🎯' },
  'terminal-goal': { label: 'Pick your focus', emoji: '🎯' },
  'income-anchor': { label: 'Set your last payday', emoji: '📅' },
}

/**
 * Normalizes step IDs to deduplicated, user-facing categories.
 * Multiple internal step IDs can map to the same user-visible item
 * (e.g., paycheck-mode, paycheck-schedule → "Set up paycheck").
 */
function dedupeSteps(skippedSteps: string[]): { id: string; label: string; emoji: string }[] {
  const seen = new Set<string>()
  const result: { id: string; label: string; emoji: string }[] = []

  for (const stepId of skippedSteps) {
    const meta = STEP_META[stepId]
    if (!meta) continue
    // Use the label as dedup key (multiple IDs → same user-facing item)
    if (seen.has(meta.label)) continue
    seen.add(meta.label)
    result.push({ id: stepId, label: meta.label, emoji: meta.emoji })
  }

  return result
}

export interface SetupChecklistCardProps {
  /** Step IDs the user skipped during onboarding */
  skippedSteps: string[]
  /** Called when the user taps a specific step to resume it */
  onResumeStep: (stepId: string) => void
  /** Called when the user dismisses the checklist card */
  onDismiss: () => void
  /** Whether to render in compact "home" mode or expanded "settings" mode */
  variant?: 'home' | 'settings'
}

/**
 * A warm, compact checklist card showing skipped setup steps.
 * Lives in the home-screen tip slot (dismissible) and settings (persistent).
 *
 * Never shaming — encourages the user to finish at their own pace.
 */
export function SetupChecklistCard({
  skippedSteps,
  onResumeStep,
  onDismiss,
  variant = 'home',
}: SetupChecklistCardProps) {
  const items = dedupeSteps(skippedSteps)
  const [dismissed, setDismissed] = useState(false)
  const { prefersReducedMotion } = useReducedMotion()

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    onDismiss()
  }, [onDismiss])

  if (items.length === 0 || dismissed) return null

  const isHome = variant === 'home'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={timings.normal}
        role="region"
        aria-label="Finish setting up — whenever you're ready"
        style={{
          position: 'relative',
          padding: isHome ? '12px 14px' : '14px 16px',
          background: 'rgba(167, 139, 250, 0.06)',
          border: '1px solid rgba(167, 139, 250, 0.12)',
          borderRadius: borderRadius.lg,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              fontFamily: FONT_FAMILY,
            }}
          >
            {items.length === 1 ? 'One thing left' : `${items.length} things left`}
          </span>
          {isHome && (
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                color: 'var(--muted)',
                padding: '2px 6px',
                lineHeight: 1,
                borderRadius: 4,
              }}
              aria-label="Dismiss setup checklist"
            >
              ×
            </button>
          )}
        </div>

        {/* Subtitle — warm and encouraging */}
        <p
          style={{
            fontSize: 12,
            color: 'var(--sub)',
            fontFamily: FONT_FAMILY,
            margin: '0 0 10px 0',
            lineHeight: 1.4,
          }}
        >
          Whenever you&apos;re ready — no rush
        </p>

        {/* Checklist items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout={!prefersReducedMotion ? "position" : false}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { opacity: timings.fast, height: timings.normal } }}
              transition={layoutTransition}
            >
              <button
                type="button"
                onClick={() => onResumeStep(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: borderRadius.md,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
                aria-label={`Resume: ${item.label}`}
              >
                <span style={{ fontSize: 14 }} aria-hidden="true">{item.emoji}</span>
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text)',
                    fontFamily: FONT_FAMILY,
                    fontWeight: 500,
                    flex: 1,
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--accent, #a78bfa)',
                    fontFamily: FONT_FAMILY,
                    opacity: 0.9,
                  }}
                >
                  →
                </span>
              </button>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
