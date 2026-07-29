/**
 * React hook for reading and updating feature flags.
 *
 * Reads from localStorage on mount and provides setters that update both
 * local state and persisted storage. No context provider needed.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  getFeatureFlags,
  setFeatureFlag,
  resetFeatureFlags,
  type FeatureFlags,
} from '@/lib/featureFlags'

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>(getFeatureFlags)

  // Sync from localStorage on mount (handles SSR hydration)
  useEffect(() => {
    setFlags(getFeatureFlags())
  }, [])

  const setFlag = useCallback((key: keyof FeatureFlags, enabled: boolean) => {
    setFeatureFlag(key, enabled)
    setFlags(prev => ({ ...prev, [key]: enabled }))
  }, [])

  const resetFlags = useCallback(() => {
    resetFeatureFlags()
    setFlags(getFeatureFlags())
  }, [])

  return { flags, setFlag, resetFlags }
}
