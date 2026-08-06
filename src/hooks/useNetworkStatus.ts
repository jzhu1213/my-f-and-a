'use client'

import { useState, useEffect } from 'react'

// ============================================================================
// useNetworkStatus — tracks browser online/offline state
// Requirements: 10.2, 10.4 (extends offlineQueue)
// SSR-safe: defaults to online when running server-side
// ============================================================================

export interface UseNetworkStatusReturn {
  /** Whether the browser currently has network connectivity */
  isOnline: boolean
}

/**
 * Reactive hook that tracks `navigator.onLine` and listens for `online`/`offline`
 * window events. SSR-safe — defaults to `true` when `window` is unavailable.
 */
export function useNetworkStatus(): UseNetworkStatusReturn {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return navigator.onLine
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline }
}
