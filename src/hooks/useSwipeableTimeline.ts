"use client"

/**
 * useSwipeableTimeline — State management for swipe-to-reveal, inline editing,
 * and undo affordance on the Timeline Surface.
 *
 * Manages:
 * - Which row is currently revealed (at most one at a time)
 * - Which row is being inline-edited
 * - Pending deletions with undo window (5+ seconds)
 * - Persistence failure: restore entry with prior values, show error, retain input
 *
 * Requirements: 14.5, 14.6, 14.7, 14.10, 14.11, 14.12
 */

import { useState, useCallback, useRef } from "react"
import type { Transaction } from "@/types"

// ============================================================================
// Types
// ============================================================================

export interface PendingDeletion {
  /** The transaction that was deleted. */
  transaction: Transaction
  /** Timestamp of when the deletion was initiated. */
  deletedAt: number
}

export interface UseSwipeableTimelineOptions {
  /** Called to persist a deletion. Should return true on success, false on failure. */
  onPersistDelete?: (tx: Transaction) => Promise<boolean>
  /** Called to persist an edit. Should return true on success, false on failure. */
  onPersistEdit?: (tx: Transaction, updates: Partial<Transaction>) => Promise<boolean>
  /** Called when a persistence failure occurs (for error display). */
  onPersistenceError?: (message: string) => void
}

export interface UseSwipeableTimelineReturn {
  /** ID of the row currently showing revealed actions (null if none). */
  revealedRowId: string | null
  /** ID of the row currently in inline-edit mode (null if none). */
  editingRowId: string | null
  /** The pending deletion waiting for undo dismissal (null if none). */
  pendingDeletion: PendingDeletion | null
  /** Set of transaction IDs currently in removal animation. */
  removingIds: Set<string>
  /** Unsaved edit values retained on persistence failure (Req 14.12). */
  unsavedInput: Partial<Transaction> | null
  /** Reveal a row's actions. Closes any other revealed row. */
  revealRow: (txId: string) => void
  /** Close all revealed rows. */
  closeReveal: () => void
  /** Initiate deletion of a transaction (starts undo window). */
  deleteTransaction: (tx: Transaction) => void
  /** Undo the pending deletion (restores the entry). */
  undoDelete: () => void
  /** Dismiss the undo toast (finalises the deletion). */
  dismissUndo: () => void
  /** Begin inline editing of a transaction. */
  startEdit: (txId: string) => void
  /** Commit an edit. Handles persistence and failure recovery. */
  commitEdit: (updates: Partial<Transaction>) => Promise<void>
  /** Cancel inline editing. */
  cancelEdit: () => void
  /** Check if a transaction is currently pending deletion (hidden from list). */
  isDeleted: (txId: string) => boolean
}

// ============================================================================
// Hook
// ============================================================================

export function useSwipeableTimeline(
  options: UseSwipeableTimelineOptions = {}
): UseSwipeableTimelineReturn {
  const { onPersistDelete, onPersistEdit, onPersistenceError } = options

  const [revealedRowId, setRevealedRowId] = useState<string | null>(null)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [unsavedInput, setUnsavedInput] = useState<Partial<Transaction> | null>(null)

  // Store the edited transaction for persistence failure recovery
  const editingTxRef = useRef<Transaction | null>(null)

  // ========================================================================
  // Reveal management (only one row revealed at a time)
  // ========================================================================

  const revealRow = useCallback((txId: string) => {
    setRevealedRowId(txId)
  }, [])

  const closeReveal = useCallback(() => {
    setRevealedRowId(null)
  }, [])

  // ========================================================================
  // Deletion with undo (Req 14.11)
  // ========================================================================

  const deleteTransaction = useCallback((tx: Transaction) => {
    // Mark as removing (triggers exit animation)
    setRemovingIds((prev) => new Set(prev).add(tx.id))
    setRevealedRowId(null)

    // After animation completes (~400ms), mark as pending deletion with undo
    setTimeout(() => {
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(tx.id)
        return next
      })
      setPendingDeletion({ transaction: tx, deletedAt: Date.now() })
    }, 400)
  }, [])

  const undoDelete = useCallback(() => {
    // Restore — the transaction was never persisted as deleted
    setPendingDeletion(null)
  }, [])

  const dismissUndo = useCallback(async () => {
    if (!pendingDeletion) return

    const tx = pendingDeletion.transaction
    setPendingDeletion(null)

    // Persist the deletion
    if (onPersistDelete) {
      const success = await onPersistDelete(tx)
      if (!success) {
        // Persistence failure: restore entry with prior values (Req 14.12)
        onPersistenceError?.("Couldn't delete — the change was not saved")
      }
    }
  }, [pendingDeletion, onPersistDelete, onPersistenceError])

  const isDeleted = useCallback(
    (txId: string) => {
      return pendingDeletion?.transaction.id === txId
    },
    [pendingDeletion]
  )

  // ========================================================================
  // Inline edit (Req 14.6)
  // ========================================================================

  const startEdit = useCallback((txId: string) => {
    setEditingRowId(txId)
    setRevealedRowId(null)
    setUnsavedInput(null)
  }, [])

  const commitEdit = useCallback(
    async (updates: Partial<Transaction>) => {
      if (!editingRowId) return

      setUnsavedInput(updates)

      if (onPersistEdit && editingTxRef.current) {
        const success = await onPersistEdit(editingTxRef.current, updates)
        if (success) {
          setEditingRowId(null)
          setUnsavedInput(null)
        } else {
          // Persistence failure: retain unsaved input, show error (Req 14.12)
          onPersistenceError?.("Couldn't save — your changes are preserved")
        }
      } else {
        // No persistence handler, just close
        setEditingRowId(null)
        setUnsavedInput(null)
      }
    },
    [editingRowId, onPersistEdit, onPersistenceError]
  )

  const cancelEdit = useCallback(() => {
    setEditingRowId(null)
    setUnsavedInput(null)
    editingTxRef.current = null
  }, [])

  return {
    revealedRowId,
    editingRowId,
    pendingDeletion,
    removingIds,
    unsavedInput,
    revealRow,
    closeReveal,
    deleteTransaction,
    undoDelete,
    dismissUndo,
    startEdit,
    commitEdit,
    cancelEdit,
    isDeleted,
  }
}
