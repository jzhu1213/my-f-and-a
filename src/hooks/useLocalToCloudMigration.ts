/**
 * useLocalToCloudMigration hook
 *
 * Runs the one-way local → cloud migration once when the user transitions
 * from unauthenticated to authenticated. Uses a ref to avoid running twice
 * in React StrictMode.
 *
 * Task 292.1 — One-way local→cloud migration
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { runLocalToCloudMigration } from '@/lib/localToCloudMigration'

export function useLocalToCloudMigration(): void {
  const { user } = useAuth()
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (!user?.id) return
    if (hasRunRef.current) return
    hasRunRef.current = true

    // Fire-and-forget — never blocks the app
    runLocalToCloudMigration(user.id).catch(() => {
      // Already handled internally with console.warn
    })
  }, [user?.id])
}
