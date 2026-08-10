"use client"

/**
 * useTransactionFeedback — Hook for orchestrating transaction feedback flow
 *
 * Provides an imperative API for the Home Surface to trigger the full feedback
 * sequence: radial pulse, spring-driven hero update, undo window, haptic,
 * celebration, and over-budget status.
 *
 * Usage:
 * ```tsx
 * const feedback = useTransactionFeedback({
 *   onUndoTransaction: (txId) => { ... },
 *   previousAmount: allowanceBeforeLog,
 * })
 *
 * // When a transaction is committed:
 * feedback.commit(transactionId, { x: tapX, y: tapY }, celebrationEvent)
 *
 * // Pass state to TransactionFeedback component:
 * <TransactionFeedback {...feedback.feedbackProps} />
 * ```
 *
 * Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.9, 9.10, 9.11
 */

import { useState, useCallback, useRef } from "react"
import type { CelebrationEvent } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface UseTransactionFeedbackOptions {
  /** Called when the user activates undo — should remove the transaction and restore prior amount. */
  onUndoTransaction: (transactionId: string) => void
  /** Undo display duration in ms (default 7000, must be 5000–10000 per Req 9.4). */
  undoDurationMs?: number
}

export interface TransactionFeedbackState {
  /** Radial pulse origin (viewport coords). Null when not pulsing. */
  pulseOrigin: { x: number; y: number } | null
  /** Whether a transaction was just committed. */
  committed: boolean
  /** Active celebration event (if any). */
  celebration: CelebrationEvent | null
  /** Whether the current status is over-budget. */
  isOverBudget: boolean
  /** Actionable next step for over-budget status. */
  overBudgetNextStep: string
}

export interface UseTransactionFeedbackResult {
  /** Trigger the full feedback flow for a newly committed transaction. */
  commit: (
    transactionId: string,
    origin: { x: number; y: number },
    celebration?: CelebrationEvent | null,
    isOverBudget?: boolean,
    overBudgetNextStep?: string
  ) => void
  /** Reset feedback state (e.g., after navigation). */
  reset: () => void
  /** Props to spread on the TransactionFeedback component. */
  feedbackProps: {
    pulseOrigin: { x: number; y: number } | null
    committed: boolean
    celebration: CelebrationEvent | null
    isOverBudget: boolean
    overBudgetNextStep: string
    onUndo: () => void
    onUndoExpired: () => void
    onCelebrationEnd: () => void
    onPulseEnd: () => void
    undoDurationMs: number
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useTransactionFeedback({
  onUndoTransaction,
  undoDurationMs = 7000,
}: UseTransactionFeedbackOptions): UseTransactionFeedbackResult {
  const [state, setState] = useState<TransactionFeedbackState>({
    pulseOrigin: null,
    committed: false,
    celebration: null,
    isOverBudget: false,
    overBudgetNextStep: "Try a no-spend evening to get back on track",
  })

  // Track which transaction ID is the most recent (for undo)
  const lastTransactionIdRef = useRef<string | null>(null)

  /**
   * Trigger the full feedback flow.
   * Called immediately after a transaction log is committed.
   */
  const commit = useCallback(
    (
      transactionId: string,
      origin: { x: number; y: number },
      celebration?: CelebrationEvent | null,
      isOverBudget?: boolean,
      overBudgetNextStep?: string
    ) => {
      lastTransactionIdRef.current = transactionId

      setState({
        pulseOrigin: origin,
        committed: true,
        celebration: celebration ?? null,
        isOverBudget: isOverBudget ?? false,
        overBudgetNextStep:
          overBudgetNextStep ?? "Try a no-spend evening to get back on track",
      })
    },
    []
  )

  /**
   * Reset all feedback state.
   */
  const reset = useCallback(() => {
    lastTransactionIdRef.current = null
    setState({
      pulseOrigin: null,
      committed: false,
      celebration: null,
      isOverBudget: false,
      overBudgetNextStep: "Try a no-spend evening to get back on track",
    })
  }, [])

  /**
   * Handle undo activation — remove transaction, restore prior amount (Req 9.11).
   */
  const handleUndo = useCallback(() => {
    const txId = lastTransactionIdRef.current
    if (txId) {
      onUndoTransaction(txId)
    }
    // Reset committed state after undo
    setState((prev) => ({ ...prev, committed: false, pulseOrigin: null }))
  }, [onUndoTransaction])

  /**
   * Handle undo window expiration.
   */
  const handleUndoExpired = useCallback(() => {
    setState((prev) => ({ ...prev, committed: false }))
  }, [])

  /**
   * Handle celebration completion.
   */
  const handleCelebrationEnd = useCallback(() => {
    setState((prev) => ({ ...prev, celebration: null }))
  }, [])

  /**
   * Handle radial pulse completion.
   */
  const handlePulseEnd = useCallback(() => {
    setState((prev) => ({ ...prev, pulseOrigin: null }))
  }, [])

  return {
    commit,
    reset,
    feedbackProps: {
      pulseOrigin: state.pulseOrigin,
      committed: state.committed,
      celebration: state.celebration,
      isOverBudget: state.isOverBudget,
      overBudgetNextStep: state.overBudgetNextStep,
      onUndo: handleUndo,
      onUndoExpired: handleUndoExpired,
      onCelebrationEnd: handleCelebrationEnd,
      onPulseEnd: handlePulseEnd,
      undoDurationMs,
    },
  }
}
