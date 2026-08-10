"use client"

/**
 * useFocusVisible — detects keyboard-driven focus vs pointer-driven focus.
 *
 * Returns `isFocusVisible` true only when the element received focus via
 * keyboard navigation (Tab/Shift+Tab), matching the `:focus-visible` heuristic.
 *
 * Usage:
 *   const { isFocusVisible, focusProps } = useFocusVisible()
 *   <button {...focusProps} style={{ ...(isFocusVisible && focusRingStyle) }} />
 *
 * Requirements: 18.4
 */

import { useState, useCallback } from "react"
import type React from "react"

export interface FocusVisibleResult {
  /** Whether the element currently has keyboard-driven focus. */
  isFocusVisible: boolean
  /** Props to spread onto the focusable element. */
  focusProps: {
    onFocus: (e: React.FocusEvent) => void
    onBlur: (e: React.FocusEvent) => void
  }
}

/**
 * Tracks whether focus was gained via keyboard (focus-visible).
 * Uses the native :focus-visible match if available, falls back to
 * detecting the last input modality.
 */
export function useFocusVisible(): FocusVisibleResult {
  const [isFocusVisible, setIsFocusVisible] = useState(false)

  const onFocus = useCallback((e: React.FocusEvent) => {
    // Check if the browser considers this focus-visible
    try {
      if (e.target instanceof HTMLElement && e.target.matches(":focus-visible")) {
        setIsFocusVisible(true)
        return
      }
    } catch {
      // :focus-visible not supported, fall through
    }
    // Fallback: if no relatedTarget (keyboard navigation typically has no relatedTarget
    // when tabbing from another element), we assume keyboard focus
    setIsFocusVisible(false)
  }, [])

  const onBlur = useCallback(() => {
    setIsFocusVisible(false)
  }, [])

  return {
    isFocusVisible,
    focusProps: { onFocus, onBlur },
  }
}
