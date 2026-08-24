"use client"

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { fills, HORIZONTAL_PADDING } from '@/styles/shared'
import { radius } from '@/styles/surfaces'
import { springs } from '@/lib/animations'

// ============================================================================
// Types
// ============================================================================

export interface KeyboardShortcutsHelpProps {
  /** Whether the help overlay is visible */
  isOpen: boolean
  /** Called to close the overlay */
  onClose: () => void
}

// ============================================================================
// Shortcut Data
// ============================================================================

interface ShortcutGroup {
  title: string
  shortcuts: { keys: string[]; description: string }[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['1'], description: 'Go to Home' },
      { keys: ['2'], description: 'Go to History' },
      { keys: ['3'], description: 'Go to Tools' },
      { keys: ['4'], description: 'Go to Settings' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['E', 'N'], description: 'New expense' },
      { keys: ['I'], description: 'Log income' },
      { keys: ['/', 'Ctrl+K'], description: 'Focus search' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['Esc'], description: 'Close sheet or overlay' },
      { keys: ['?'], description: 'Toggle this help' },
    ],
  },
]

// ============================================================================
// Component
// ============================================================================

/**
 * KeyboardShortcutsHelp — overlay showing available keyboard shortcuts.
 *
 * Displayed when the user presses `?`. Closes on Esc or clicking outside.
 * Entirely optional power-user feature — no conflict with screen readers.
 *
 * Requirements: 27.2
 */
export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid catching the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen, onClose])

  // Trap focus inside when open
  useEffect(() => {
    if (!isOpen) return
    const panel = panelRef.current
    if (panel) panel.focus()
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-canvas)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          aria-hidden={!isOpen}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={springs.gentle}
            style={{
              width: '100%',
              maxWidth: 380,
              maxHeight: '80vh',
              overflowY: 'auto',
              margin: '0 20px',
              padding: '24px',
              background: 'var(--surface)',
              border: `1px solid ${fills[8]}`,
              borderRadius: radius.control,
              boxShadow: 'var(--shadow-xl)',
              outline: 'none',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: HORIZONTAL_PADDING,
              }}
            >
              <h2
                style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: typography.body.fontSize,
                  fontWeight: fontWeights.semibold,
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                Keyboard shortcuts
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close keyboard shortcuts help"
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: fills[6],
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 3L11 11M11 3L3 11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Shortcut groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: HORIZONTAL_PADDING }}>
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: typography.caption.fontSize,
                      fontWeight: fontWeights.semibold,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: spacing.xs,
                      margin: '0 0 8px 0',
                    }}
                  >
                    {group.title}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {group.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.description}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 0',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: FONT_FAMILY,
                            fontSize: typography['body-sm'].fontSize,
                            color: 'var(--text)',
                          }}
                        >
                          {shortcut.description}
                        </span>
                        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {shortcut.keys.map((key, i) => (
                            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {i > 0 && (
                                <span
                                  style={{
                                    fontFamily: FONT_FAMILY,
                                    fontSize: typography.caption.fontSize,
                                    color: 'var(--muted)',
                                  }}
                                >
                                  or
                                </span>
                              )}
                              <kbd
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: 24,
                                  height: 24,
                                  padding: '0 6px',
                                  fontFamily: FONT_FAMILY,
                                  fontSize: typography.caption.fontSize,
                                  fontWeight: fontWeights.medium,
                                  color: 'var(--text)',
                                  background: fills[6],
                                  border: `1px solid ${fills[10]}`,
                                  borderRadius: radius.min,
                                }}
                              >
                                {key}
                              </kbd>
                            </span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <p
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: typography.caption.fontSize,
                color: 'var(--muted)',
                marginTop: spacing.md,
                marginBottom: 0,
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              Shortcuts are disabled while typing in inputs
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
