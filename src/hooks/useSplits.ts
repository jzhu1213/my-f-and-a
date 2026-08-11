'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AppSplit, AppSplitParticipant } from '@/lib/social/splits.types'
import {
  listSplitsForUser,
  createSplit,
  settleParticipant,
  settleSplit,
  deleteSplit,
  getOptimisticSplits,
  type CreateSplitInput,
} from '@/lib/social/splits'
import {
  settleLinkedReimbursement,
  type SettlementResult,
} from '@/lib/social/settlements'

// ============================================================================
// useSplits — lightweight hook for split data
// Requirements: Task 294.1 — keep social data in dedicated hooks, not useHomeData
// ============================================================================

export interface SplitWithParticipants {
  split: AppSplit
  participants: AppSplitParticipant[]
}

export interface UseSplitsReturn {
  /** All splits for the current user (owned + participating) */
  splits: SplitWithParticipants[]
  /** Optimistic splits not yet confirmed by server */
  optimisticSplits: AppSplit[]
  /** Whether any fetch is in progress */
  loading: boolean
  /** Create a new split */
  create: (input: CreateSplitInput) => Promise<SplitWithParticipants | null>
  /** Settle a single participant's share */
  settleOne: (participantId: string) => Promise<AppSplitParticipant | null>
  /** Settle an entire split (all participants) */
  settleAll: (splitId: string) => Promise<AppSplit | null>
  /** Settle via the linked reimbursement (two-sided) */
  settleLinked: (
    userId: string,
    reimbursementId: string,
    linkedTransactionId: string | undefined,
    fundingSourceId?: string
  ) => Promise<SettlementResult>
  /** Delete a split (owner only) */
  remove: (splitId: string) => Promise<boolean>
  /** Manually refresh all split data */
  refresh: () => Promise<void>
}

export function useSplits(): UseSplitsReturn {
  const [splits, setSplits] = useState<SplitWithParticipants[]>([])
  const [optimisticSplits, setOptimisticSplits] = useState<AppSplit[]>([])
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listSplitsForUser()
      if (mountedRef.current) {
        setSplits(data)
        setOptimisticSplits(getOptimisticSplits())
      }
    } catch {
      // Offline or network error — keep existing state
      console.error('[useSplits] refresh failed')
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => {
      mountedRef.current = false
    }
  }, [refresh])

  // Re-fetch on window focus (visibilitychange)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refresh])

  // ── Actions ────────────────────────────────────────────────────────────────

  const create = useCallback(
    async (input: CreateSplitInput): Promise<SplitWithParticipants | null> => {
      const result = await createSplit(input)
      // Update optimistic state
      if (mountedRef.current) {
        setOptimisticSplits(getOptimisticSplits())
      }
      if (result) {
        // Add the confirmed split to state
        setSplits((prev) => [{ split: result.split, participants: result.participants }, ...prev])
      }
      return result
    },
    []
  )

  const settleOne = useCallback(
    async (participantId: string): Promise<AppSplitParticipant | null> => {
      // Optimistic: mark participant as settled in local state
      setSplits((prev) =>
        prev.map((item) => ({
          ...item,
          participants: item.participants.map((p) =>
            p.id === participantId ? { ...p, settled: true } : p
          ),
        }))
      )

      const result = await settleParticipant(participantId)
      if (!result) {
        // Revert on failure
        setSplits((prev) =>
          prev.map((item) => ({
            ...item,
            participants: item.participants.map((p) =>
              p.id === participantId ? { ...p, settled: false } : p
            ),
          }))
        )
      }
      return result
    },
    []
  )

  const settleAll = useCallback(
    async (splitId: string): Promise<AppSplit | null> => {
      // Optimistic: mark entire split as settled
      setSplits((prev) =>
        prev.map((item) =>
          item.split.id === splitId
            ? {
                split: { ...item.split, settled: true },
                participants: item.participants.map((p) => ({ ...p, settled: true })),
              }
            : item
        )
      )

      const result = await settleSplit(splitId)
      if (!result) {
        // Revert on failure
        setSplits((prev) =>
          prev.map((item) =>
            item.split.id === splitId
              ? {
                  split: { ...item.split, settled: false },
                  participants: item.participants.map((p) => ({ ...p, settled: false })),
                }
              : item
          )
        )
      }
      return result
    },
    []
  )

  const settleLinked = useCallback(
    async (
      userId: string,
      reimbursementId: string,
      linkedTransactionId: string | undefined,
      fundingSourceId?: string
    ): Promise<SettlementResult> => {
      const result = await settleLinkedReimbursement(
        userId,
        reimbursementId,
        linkedTransactionId,
        fundingSourceId
      )
      // Refresh splits to pick up any settlement changes
      if (result.success) {
        await refresh()
      }
      return result
    },
    [refresh]
  )

  const remove = useCallback(
    async (splitId: string): Promise<boolean> => {
      // Optimistic: remove from state
      const removedItem = splits.find((item) => item.split.id === splitId)
      setSplits((prev) => prev.filter((item) => item.split.id !== splitId))

      const success = await deleteSplit(splitId)
      if (!success && removedItem) {
        // Revert on failure
        setSplits((prev) => [...prev, removedItem])
      }
      return success
    },
    [splits]
  )

  return {
    splits,
    optimisticSplits,
    loading,
    create,
    settleOne,
    settleAll,
    settleLinked,
    remove,
    refresh,
  }
}
