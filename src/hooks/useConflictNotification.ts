/**
 * useConflictNotification — listens for conflict-resolved events and shows a toast.
 *
 * Task 524.4 (Phase 24, Group 177)
 * Requirements: 32.3
 *
 * Mount this hook in the app shell so that any conflict resolution (from
 * supabaseData.ts or offlineQueue.ts) surfaces a brief info toast.
 */

import { useEffect } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { CONFLICT_RESOLVED_EVENT, type ConflictResolvedDetail } from '@/lib/conflictResolution'

export function useConflictNotification(): void {
  const { showToast } = useToast()

  useEffect(() => {
    function handleConflict(event: Event) {
      const detail = (event as CustomEvent<ConflictResolvedDetail>).detail
      showToast(detail.message || 'Updated from another device', 'info')
    }

    window.addEventListener(CONFLICT_RESOLVED_EVENT, handleConflict)
    return () => {
      window.removeEventListener(CONFLICT_RESOLVED_EVENT, handleConflict)
    }
  }, [showToast])
}
