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
import { motion, AnimatePresence } from 'framer-motion'
import { GradientMesh, type GradientMeshVariant } from './GradientMesh'
import { Icon } from './Icon'
import { useReducedMotion, springs, timings } from '@/lib/animations'
import { useRubberBand } from '@/hooks/useRubberBand'

/**
 * App navigation keys.
 *
 * The primary dock exposes only `home`, `history`, and `settings` (a 3-tab
 * dock per the simplification spec). `tools` remains a valid destination but is
 * reached through progressive disclosure from the Settings screen rather than a
 * dedicated dock tab (Requirement 9.5), so it is intentionally absent from the
 * dock's `navItems`.
 */
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
  /**
   * When true, hides the floating dock navigation (e.g. when a bottom sheet is
   * open and would overlap with it due to z-index stacking).
   */
  hideDock?: boolean
}

/** A single dock destination with its icon + accessible label. */
interface NavItem {
  key: AppNavKey
  label: string
  icon: ReactNode
}

/* ── Icons ───────────────────────────────────────────────────────
 * All chrome/nav icons now come from the central icon registry via the
 * shared <Icon> wrapper (stroke-based, currentColor). See src/lib/icons.ts.
 */

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
  hideDock = false,
}: AppShellProps) {
  const { prefersReducedMotion } = useReducedMotion()

  // Rubber-band overscroll on the main content scroll area (Task 242.3)
  const { containerRef: rubberBandRef, style: rubberBandStyle } = useRubberBand({
    disabled: prefersReducedMotion,
    elasticity: 0.25,
    maxStretch: 60,
  })

  // 3-tab primary dock: Home / History / Settings. Advanced features (the Tools
  // surface, which includes Learn) are reached via progressive disclosure from
  // the Settings screen, not a dedicated dock tab (Requirement 9.5).
  const navItems: NavItem[] = [
    { key: 'home', label: 'Home', icon: <Icon name="nav:home" size={22} /> },
    { key: 'history', label: 'History', icon: <Icon name="nav:history" size={22} /> },
    { key: 'settings', label: 'Settings', icon: <Icon name="nav:settings" size={22} /> },
  ]

  const handleSettingsTop = onOpenSettings ?? (() => onNavChange('settings'))

  // The Tools surface has no dedicated dock tab; it is reached from Settings, so
  // keep the Settings dock item highlighted while it is open. This preserves a
  // valid `aria-current="page"` target and keyboard roving-tabindex focus.
  const dockActiveNav: AppNavKey = activeNav === 'tools' ? 'settings' : activeNav

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
              <Icon name="chrome:person" size={20} />
            )}
          </div>

          <span className="app-topbar__wordmark" aria-label="Folio">
            folio
            <span className="app-topbar__wordmark-dot" aria-hidden="true" />
          </span>

          <button
            type="button"
            className="app-topbar__btn"
            onClick={handleSettingsTop}
            aria-label="Open settings"
          >
            <Icon name="nav:settings" size={22} />
          </button>
        </header>
      )}

      {/* ── Scrollable content ─────────────────────────────────── */}
      <motion.main
        ref={rubberBandRef as React.RefObject<HTMLElement>}
        className={`app-content ${hideTopBar ? 'app-content--no-topbar' : ''} ${contentClassName}`.trim()}
        style={rubberBandStyle}
      >
        {children}
      </motion.main>

      {/* ── Quick-log FAB (always visible, centered above dock) ──── */}
      <AnimatePresence>
        {onQuickLog && (
          <motion.button
            key="quick-log-fab"
            type="button"
            className="app-dock-fab"
            onClick={onQuickLog}
            aria-label="Log expense"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.88 }}
            transition={springs.snappy}
          >
            <Icon name="action:add" size={26} strokeWidth={2.2} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Floating dock navigation ───────────────────────────── */}
      {!hideDock && (
      <nav className="app-dock" aria-label="Primary">
        <ul
          className="app-dock__list"
          onKeyDown={(e) => {
            const keys = navItems.map(n => n.key)
            const currentIndex = keys.indexOf(dockActiveNav)
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
            const isActive = dockActiveNav === key
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
      )}
    </div>
  )
}
