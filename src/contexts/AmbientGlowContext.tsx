"use client"

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

/**
 * AmbientGlowContext
 *
 * Enforces the single-glow-per-viewport constraint (Requirement 3.4):
 * at most one AmbientGlow renders its radial gradient at a time, measured
 * at the 390 × 844 CSS px reference viewport. Additional glow-eligible
 * components render their opaque fallback fill instead.
 *
 * The context tracks which glow instance is currently "active" (first one
 * visible in the viewport wins). Visibility is reported by each glow
 * instance via IntersectionObserver.
 */

interface AmbientGlowContextType {
  /**
   * Register a glow instance as visible. Returns `true` if this instance
   * becomes the active glow (first to register). Returns `false` if another
   * glow is already active (this one should render suppressed).
   */
  registerGlow: (id: string) => boolean
  /** Unregister a glow instance (it left the viewport or unmounted). */
  unregisterGlow: (id: string) => void
  /** Check if a given glow ID is the currently active one. */
  isActiveGlow: (id: string) => boolean
}

const AmbientGlowContext = createContext<AmbientGlowContextType | undefined>(undefined)

export function AmbientGlowProvider({ children }: { children: ReactNode }) {
  // Track the currently active (first visible) glow ID
  const [activeGlowId, setActiveGlowId] = useState<string | null>(null)
  // Track all visible glow IDs in registration order (FIFO)
  const visibleGlows = useRef<string[]>([])

  const registerGlow = useCallback((id: string): boolean => {
    if (!visibleGlows.current.includes(id)) {
      visibleGlows.current.push(id)
    }
    // First visible glow becomes active
    if (visibleGlows.current.length === 1 || visibleGlows.current[0] === id) {
      setActiveGlowId(id)
      return true
    }
    return false
  }, [])

  const unregisterGlow = useCallback((id: string) => {
    visibleGlows.current = visibleGlows.current.filter(gId => gId !== id)
    setActiveGlowId(prev => {
      if (prev === id) {
        // Promote next visible glow, or null if none remain
        return visibleGlows.current[0] ?? null
      }
      return prev
    })
  }, [])

  const isActiveGlow = useCallback((id: string): boolean => {
    return activeGlowId === id
  }, [activeGlowId])

  return (
    <AmbientGlowContext.Provider value={{ registerGlow, unregisterGlow, isActiveGlow }}>
      {children}
    </AmbientGlowContext.Provider>
  )
}

export function useAmbientGlow() {
  const context = useContext(AmbientGlowContext)
  if (!context) {
    throw new Error('useAmbientGlow must be used within an AmbientGlowProvider')
  }
  return context
}

/**
 * Hook that returns a no-op implementation for use outside the provider.
 * This allows AmbientGlow to work standalone (always active) if no provider
 * is present — backward-compatible behavior.
 */
export function useAmbientGlowSafe() {
  const context = useContext(AmbientGlowContext)
  return context
}
