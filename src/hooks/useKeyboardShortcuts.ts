"use client"

import { useEffect, useCallback } from 'react'

/**
 * Keyboard shortcut configuration passed to the hook.
 */
export interface KeyboardShortcutActions {
  /** Open new expense sheet (E or N) */
  openExpense: () => void
  /** Open income sheet (I) */
  openIncome: () => void
  /** Switch nav tabs (1/2/3/4) */
  switchTab: (index: number) => void
  /** Close any open sheet/overlay (Esc) */
  closeOverlay: () => void
  /** Focus search input (/ or Ctrl+K) */
  focusSearch: () => void
  /** Toggle help overlay (?) */
  toggleHelp: () => void
}

/**
 * Returns true when an element that accepts text input is currently focused,
 * meaning keyboard shortcuts should NOT fire.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  // Check for role="combobox" (search bars use this)
  if (target.getAttribute('role') === 'combobox') return true
  return false
}

/**
 * useKeyboardShortcuts — global keyboard shortcuts for power users.
 *
 * Listens to `keydown` on the document and dispatches the configured actions.
 * Shortcuts are suppressed when an input/textarea/contenteditable is focused.
 *
 * Shortcuts:
 *   E / N    → open new expense sheet
 *   I        → open income sheet
 *   1/2/3/4  → switch nav tabs (home/history/tools/settings)
 *   Esc      → close any open sheet/overlay
 *   / or Ctrl+K → focus search
 *   ?        → toggle keyboard shortcuts help
 *
 * Requirements: 27.2
 */
export function useKeyboardShortcuts(actions: KeyboardShortcutActions): void {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target

    // Esc always works (even in inputs — standard for closing overlays)
    if (event.key === 'Escape') {
      actions.closeOverlay()
      return
    }

    // Ctrl+K works even in inputs (standard "go to search" shortcut)
    if (event.key === 'k' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      actions.focusSearch()
      return
    }

    // All other shortcuts are suppressed when editing text
    if (isEditableTarget(target)) return

    // Ignore when modifier keys are held (except for Ctrl+K above)
    if (event.ctrlKey || event.metaKey || event.altKey) return

    switch (event.key) {
      case 'e':
      case 'E':
      case 'n':
      case 'N':
        event.preventDefault()
        actions.openExpense()
        break

      case 'i':
      case 'I':
        event.preventDefault()
        actions.openIncome()
        break

      case '1':
        event.preventDefault()
        actions.switchTab(0)
        break
      case '2':
        event.preventDefault()
        actions.switchTab(1)
        break
      case '3':
        event.preventDefault()
        actions.switchTab(2)
        break
      case '4':
        event.preventDefault()
        actions.switchTab(3)
        break

      case '/':
        event.preventDefault()
        actions.focusSearch()
        break

      case '?':
        event.preventDefault()
        actions.toggleHelp()
        break

      default:
        break
    }
  }, [actions])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
