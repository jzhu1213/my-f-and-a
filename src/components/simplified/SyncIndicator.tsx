'use client'

import React from 'react'

// ============================================================================
// SyncIndicator — subtle sync status display for offline queue
// Requirements: 10.3, 10.4
// ============================================================================

interface SyncIndicatorProps {
  /** Number of transactions awaiting sync */
  pendingCount: number
  /** Whether any items have permanently failed */
  hasFailed: boolean
  /** Callback to retry failed transactions */
  onRetry: () => void
}

export function SyncIndicator({
  pendingCount,
  hasFailed,
  onRetry,
}: SyncIndicatorProps) {
  // Render nothing when everything is synced
  if (pendingCount === 0) return null

  // Failed state — show retry prompt
  if (hasFailed) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm">
        <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
        <span className="text-red-300">
          Some transactions couldn&apos;t sync.
        </span>
        <button
          onClick={onRetry}
          className="ml-auto rounded-md bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/30"
        >
          Retry
        </button>
      </div>
    )
  }

  // Pending/syncing state — subtle indicator
  return (
    <div className="flex items-center gap-2 rounded-lg bg-indigo-500/10 px-3 py-2 text-sm">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
      <span className="text-indigo-300">
        Syncing {pendingCount} {pendingCount === 1 ? 'transaction' : 'transactions'}…
      </span>
    </div>
  )
}
