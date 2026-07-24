"use client"

/**
 * AppShell
 *
 * Top-level layout wrapper for the simplified Folio experience. It stitches
 * together the premium visual chrome:
 *
 *   - a fixed {@link GradientMesh} background (drives the ambient mesh)
 *   - a minimal floating glass **top bar** (user avatar left, settings right)
 *   - a scrollable content area for the current screen
 *   - a floating dock-style **glass navigation** (home / history / settings)
 *
 * The chrome is intentionally low-clutter: icon-only controls, generous
 * safe-area-aware spacing for notched / Dynamic Island devices, subtle
 * divider gradients between sections, and a soft upward shadow + blur backdrop
 * on the dock so it reads as floating above the mesh.
 *
 * Motion: the active nav item gets a spring scale + glow micro-interaction via
 * framer-motion, and a shared-layout highlight pill slides between items. All
 * motion respects `prefers-reduced-motion` through {@link useReducedMotion}.
 *
 * Accessibility: the dock is a real `<nav>` with `aria-current="page"` on the
 * active item; every icon-only control carries an `aria-label`. The mesh is
 * decorative (`aria-hidden` inside GradientMesh).
 *
 * The dock/top-bar visual treatment lives in `.app-shell*`, `.app-topbar*`,
 * `.app-dock*` and `.section-divider` classes in globals.css.
 *
 * Requirements: 9.1 (single scrollable view), 9.3 (settings access),
 * 9.6 (profile access), 8.4 (friendlier, rounded, warm chrome).
 */

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { GradientMesh, type GradientMeshVariant } from './GradientMesh'
import { useReducedMotion, springs, timings } from '@/lib/animations'

/** The four primary destinations reachable from the dock. */
export type AppNavKey = 'home' | 'history' | 'tools' | 'settings'

export interface AppShellProps {
  /** The current screen content rendered in the scrollable area. */
  children: ReactNode
  /** Which dock item is currently active. */
  activeNav: AppNavKey
  /** Called with the destination when a dock item is tapped. */
  onNavChange: (nav: AppNavKey) => void
  /**
   * Optional handler for the top-bar settings icon. Falls back to
   * `onNavChange('settings')` when omitted.
   */
  onOpenSettings?: () => void
  /** Optional avatar image URL shown in the top bar. */
  avatarUrl?: string
  /**
   * Fallback avatar initial (e.g. first letter of the user's name/email) shown
   * when `avatarUrl` is not provided. Defaults to a generic person icon.
   */
  avatarInitial?: string
  /** Mesh intensity for the current screen, passed through to GradientMesh. */
  meshVariant?: GradientMeshVariant
  /** Hide the floating top bar (e.g. for full-bleed screens). Defaults false. */
  hideTopBar?: boolean
  /** Extra classes for the scrollable content wrapper. */
  contentClassName?: string
  /**
   * Handler for the quick-log FAB (Floating Action Button). When provided, a
   * persistent "+" button is rendered centered above the dock for one-tap
   * expense logging from any screen.
   */
  onQuickLog?: () => void
}

/** A single dock destination with its icon + accessible label. */
interface NavItem {
  key: AppNavKey
  label: string
  icon: ReactNode
}

/* ── Icons (stroke, currentColor) ───────────────────────────────── */

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

function ToolsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.314 3.134-6 7-6s7 2.686 7 6" />
    </svg>
  )
}

export function AppShell({
  children,
  activeNav,
  onNavChange,
  onOpenSettings,
  avatarUrl,
  avatarInitial,
  meshVariant = 'home',
  hideTopBar = false,
  contentClassName = '',
  onQuickLog,
}: AppShellProps) {
  const { prefersReducedMotion } = useReducedMotion()

  const navItems: NavItem[] = [
    { key: 'home', label: 'Home', icon: <HomeIcon /> },
    { key: 'history', label: 'History', icon: <HistoryIcon /> },
    { key: 'tools', label: 'Tools', icon: <ToolsIcon /> },
    { key: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ]

  const handleSettingsTop = onOpenSettings ?? (() => onNavChange('settings'))

  return (
    <div className="app-shell">
      {/* Fixed animated mesh background */}
      <GradientMesh variant={meshVariant} />

      {/* ── Floating glass top bar ─────────────────────────────── */}
      {!hideTopBar && (
        <header className="app-topbar">
          <div className="app-topbar__avatar">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="app-topbar__avatar-img" />
            ) : avatarInitial ? (
              <span className="app-topbar__avatar-initial" aria-hidden="true">
                {avatarInitial.slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <PersonIcon />
            )}
          </div>

          <button
            type="button"
            className="app-topbar__btn"
            onClick={handleSettingsTop}
            aria-label="Open settings"
          >
            <SettingsIcon />
          </button>
        </header>
      )}

      {/* ── Scrollable content ─────────────────────────────────── */}
      <main
        className={`app-content ${hideTopBar ? 'app-content--no-topbar' : ''} ${contentClassName}`.trim()}
      >
        {children}
      </main>

      {/* ── Quick-log FAB (always visible, centered above dock) ──── */}
      {onQuickLog && (
        <motion.button
          type="button"
          className="app-dock-fab"
          onClick={onQuickLog}
          aria-label="Log expense"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.88 }}
          transition={springs.snappy}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </motion.button>
      )}

      {/* ── Floating dock navigation ───────────────────────────── */}
      <nav className="app-dock" aria-label="Primary">
        <ul
          className="app-dock__list"
          onKeyDown={(e) => {
            const keys = navItems.map(n => n.key)
            const currentIndex = keys.indexOf(activeNav)
            let nextIndex = -1
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault()
              nextIndex = currentIndex < keys.length - 1 ? currentIndex + 1 : 0
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault()
              nextIndex = currentIndex > 0 ? currentIndex - 1 : keys.length - 1
            }
            if (nextIndex >= 0) {
              onNavChange(keys[nextIndex])
              const container = e.currentTarget
              const buttons = container.querySelectorAll<HTMLButtonElement>('button')
              buttons[nextIndex]?.focus()
            }
          }}
        >
          {navItems.map(({ key, label, icon }) => {
            const isActive = activeNav === key
            return (
              <li key={key} className="app-dock__item-wrap">
                <motion.button
                  type="button"
                  className={`app-dock__item ${isActive ? 'is-active' : ''}`}
                  onClick={() => onNavChange(key)}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                  tabIndex={isActive ? 0 : -1}
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : { scale: isActive ? 1.12 : 1 }
                  }
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                  transition={springs.snappy}
                >
                  {isActive && (
                    <motion.span
                      layoutId={prefersReducedMotion ? undefined : 'app-dock-active'}
                      className="app-dock__glow"
                      aria-hidden="true"
                      transition={springs.gentle}
                    />
                  )}
                  <motion.span
                    className="app-dock__icon"
                    aria-hidden="true"
                    animate={
                      prefersReducedMotion ? undefined : { opacity: isActive ? 1 : 0.6 }
                    }
                    transition={timings.fast}
                  >
                    {icon}
                  </motion.span>
                </motion.button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
