"use client"

/**
 * useFocusTrap — traps keyboard focus within a container element.
 *
 * When enabled, Tab/Shift+Tab cycles within the container.
 * Also stores and restores the previously focused element on open/close.
 *
 * Usage:
 *   const trapRef = useFocusTrap(isOpen)
 *   <div ref={trapRef}> ... </div>
 *
 * Requirements: 511.1 (Tab order audit — focus trap for plain-div overlays)
 */

import { useRef, useEffect, useCallback } from "react"

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  enabled: boolean
): React.RefCallback<T> {
  const containerRef = useRef<T | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Store/restore previous focus
  useEffect(() => {
    if (enabled) {
      previousFocusRef.current = document.activeElement as HTMLElement | null

      // Auto-focus first focusable element after a short delay (let render complete)
      const timer = setTimeout(() => {
        if (containerRef.current) {
          const first = containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
          if (first) {
            first.focus()
          } else {
            // If no focusable element, focus the container itself
            containerRef.current.setAttribute('tabindex', '-1')
            containerRef.current.focus()
          }
        }
      }, 50)

      return () => clearTimeout(timer)
    } else {
      // Restore focus on close
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
    }
  }, [enabled])

  // Tab trap handler
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const container = containerRef.current
      if (!container) return

      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      )
      if (focusableElements.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last || !container.contains(document.activeElement)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled])

  // RefCallback that stores the container DOM element
  const refCallback = useCallback((node: T | null) => {
    containerRef.current = node
  }, [])

  return refCallback
}
