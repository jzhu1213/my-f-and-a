"use client"
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { timings, layoutTransition, useReducedMotion } from '@/lib/animations'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import type { ChecklistStep } from '@/lib/setupChecklist'

// ============================================================================
// Setup Checklist Card (Task 392 — redesigned progressive checklist)
// ============================================================================

/** Legacy step metadata (backward compat for old skippedSteps system) */
const LEGACY_STEP_META: Record<string, { label: string; emoji: string }> = {
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
 * Normalizes legacy step IDs to deduplicated, user-facing categories.
 */
function dedupeSteps(skippedSteps: string[]): { id: string; label: string; emoji: string }[] {
  const seen = new Set<string>()
  const result: { id: string; label: string; emoji: string }[] = []

  for (const stepId of skippedSteps) {
    const meta = LEGACY_STEP_META[stepId]
    if (!meta) continue
    if (seen.has(meta.label)) continue
    seen.add(meta.label)
    result.push({ id: stepId, label: meta.label, emoji: meta.emoji })
  }

  return result
}

// ============================================================================
// Legacy Props (backward compatibility)
// ============================================================================

export interface SetupChecklistCardProps {
  /** Step IDs the user skipped during onboarding (legacy system) */
  skippedSteps: string[]
  /** Called when the user taps a specific step to resume it */
  onResumeStep: (stepId: string) => void
  /** Called when the user dismisses the checklist card */
  onDismiss: () => void
  /** Whether to render in compact "home" mode or expanded "settings" mode */
  variant?: 'home' | 'settings'
}

// ============================================================================
// New Progressive Checklist Props (Task 392)
// ============================================================================

export interface ProgressiveChecklistCardProps {
  /** All steps with their completion status */
  steps: (ChecklistStep & { completed: boolean })[]
  /** Number of completed steps */
  completedCount: number
  /** Total number of steps */
  totalCount: number
  /** Called when the user taps a step to perform it */
  onStepAction: (stepId: string, action: string) => void
  /** Called when the user dismisses the checklist */
  onDismiss: () => void
  /** Called when a step is completed (for celebration triggers) */
  onStepComplete?: (stepId: string) => void
}

// ============================================================================
// Progress Ring (compact circular indicator)
// ============================================================================

function ProgressRing({ completed, total, size = 32 }: { completed: number; total: number; size?: number }) {
  const strokeWidth = 3
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? completed / total : 0
  const offset = circumference * (1 - progress)

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent-200)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent-500)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
    </svg>
  )
}

// ============================================================================
// Progressive Checklist Card (Task 392.3 — redesigned)
// ============================================================================

/**
 * A compact, warm checklist card showing progressive setup steps.
 * Shows at most 2 next steps with a "see all" expansion. Uses a progress ring
 * to indicate overall completion. Dismissible with a gentle message.
 */
export function ProgressiveChecklistCard({
  steps,
  completedCount,
  totalCount,
  onStepAction,
  onDismiss,
}: ProgressiveChecklistCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const { prefersReducedMotion } = useReducedMotion()

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    onDismiss()
  }, [onDismiss])

  if (dismissed) return null

  const incompleteSteps = steps.filter(s => !s.completed)
  const completedSteps = steps.filter(s => s.completed)
  const visibleSteps = expanded ? incompleteSteps : incompleteSteps.slice(0, 2)
  const hasMore = incompleteSteps.length > 2

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={timings.normal}
        role="region"
        aria-label="Setup checklist — finish setting up at your own pace"
        style={{
          position: 'relative',
          padding: '14px 16px',
          background: 'var(--accent-100)',
          border: '1px solid var(--accent-200)',
          borderRadius: radius.control,
        }}
      >
        {/* Header with progress ring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 10 }}>
          <ProgressRing completed={completedCount} total={totalCount} size={30} />
          <div style={{ flex: 1 }}>
            <span
              style={{
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.semibold,
                color: 'var(--text)',
                fontFamily: FONT_FAMILY,
              }}
            >
              {completedCount}/{totalCount} done
            </span>
            <p
              style={{
                fontSize: typography.caption.fontSize,
                color: 'var(--sub)',
                fontFamily: FONT_FAMILY,
                margin: '2px 0 0 0',
                lineHeight: 1.3,
              }}
            >
              No rush — explore at your own pace
            </p>
          </div>
        </div>

        {/* Incomplete steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <AnimatePresence initial={false}>
            {visibleSteps.map((step) => (
              <motion.div
                key={step.id}
                layout={!prefersReducedMotion ? "position" : false}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { opacity: timings.fast, height: timings.normal } }}
                transition={layoutTransition}
              >
                <button
                  type="button"
                  onClick={() => onStepAction(step.id, step.action)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: '8px 10px',
                    background: 'var(--fill-03)',
                    border: '1px solid var(--fill-06)',
                    borderRadius: radius.control,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: "start",
                  }}
                  aria-label={`${step.label}: ${step.description}`}
                >
                  <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">{step.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: typography['body-sm'].fontSize,
                        color: 'var(--text)',
                        fontFamily: FONT_FAMILY,
                        fontWeight: fontWeights.medium,
                        display: 'block',
                      }}
                    >
                      {step.label}
                    </span>
                    <span
                      style={{
                        fontSize: typography.caption.fontSize,
                        color: 'var(--sub)',
                        fontFamily: FONT_FAMILY,
                        display: 'block',
                        marginTop: 1,
                      }}
                    >
                      {step.description}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: typography['body-sm'].fontSize,
                      color: 'var(--accent)',
                      fontFamily: FONT_FAMILY,
                      opacity: 0.9,
                      flexShrink: 0,
                    }}
                  >
                    →
                  </span>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Completed steps (only in expanded view) */}
          {expanded && completedSteps.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {completedSteps.map((step) => (
                <div
                  key={step.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: '6px 10px',
                    opacity: 0.6,
                  }}
                >
                  <span style={{ fontSize: typography['body-sm'].fontSize }} aria-hidden="true">✓</span>
                  <span
                    style={{
                      fontSize: typography['body-sm'].fontSize,
                      color: 'var(--sub)',
                      fontFamily: FONT_FAMILY,
                      textDecoration: 'line-through',
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* See all / collapse toggle */}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              marginTop: spacing.xs,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: typography['body-sm'].fontSize,
              color: 'var(--accent)',
              fontFamily: FONT_FAMILY,
              fontWeight: fontWeights.medium,
              padding: '4px 0',
            }}
          >
            {expanded ? 'Show less' : `See all (${incompleteSteps.length} remaining)`}
          </button>
        )}

        {/* Gentle dismiss */}
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            marginTop: 10,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: typography.caption.fontSize,
            color: 'var(--muted)',
            fontFamily: FONT_FAMILY,
            padding: '4px 0',
            display: 'block',
          }}
        >
          Got it, I&apos;ll explore on my own
        </button>
      </motion.div>
    </AnimatePresence>
  )
}

// ============================================================================
// Legacy SetupChecklistCard (backward compatibility)
// ============================================================================

/**
 * Legacy checklist card for the old skippedSteps system.
 * Kept as a fallback — new users go through ProgressiveChecklistCard.
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
          background: 'var(--accent-100)',
          border: '1px solid var(--accent-200)',
          borderRadius: radius.control,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
          <span
            style={{
              fontSize: typography['body-sm'].fontSize,
              fontWeight: fontWeights.semibold,
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
                fontSize: typography.body.fontSize,
                color: 'var(--muted)',
                padding: '2px 6px',
                lineHeight: 1,
                borderRadius: radius.min,
              }}
              aria-label="Dismiss setup checklist"
            >
              ×
            </button>
          )}
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontSize: typography['body-sm'].fontSize,
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
                  gap: spacing.xs,
                  padding: '8px 10px',
                  background: 'var(--fill-03)',
                  border: '1px solid var(--fill-06)',
                  borderRadius: radius.control,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: "start",
                }}
                aria-label={`Resume: ${item.label}`}
              >
                <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">{item.emoji}</span>
                <span
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    color: 'var(--text)',
                    fontFamily: FONT_FAMILY,
                    fontWeight: fontWeights.medium,
                    flex: 1,
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: typography.caption.fontSize,
                    color: 'var(--accent)',
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
