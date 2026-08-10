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
 *   - a floating dock-style **glass navigation** (home / history / tools / settings)
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
 * Scroll-responsive chrome (Task 14.2): the top bar, FAB, and divider react
 * continuously to scroll position between 24–64px using framer-motion
 * MotionValues (GPU-composited transform + opacity only). Collapses top chrome
 * ~40%, scales FAB down ~10%, and reveals a 3:1 contrast divider at the scroll
 * boundary. All transforms restore with a gentle spring settle (200–400ms)
 * when scroll returns to ≤24px. Reduced-motion users see static resting state.
 *
 * Accessibility: the dock is a real `<nav>` with `aria-current="page"` on the
 * active item; every icon-only control carries an `aria-label`. The mesh is
 * decorative (`aria-hidden` inside GradientMesh).
 *
 * The dock/top-bar visual treatment lives in `.app-shell*`, `.app-topbar*`,
 * `.app-dock*` and `.section-divider` classes in globals.css.
 *
 * Requirements: 9.1 (single scrollable view), 9.3 (settings access),
 * 9.6 (profile access), 8.4 (friendlier, rounded, warm chrome),
 * 11.3, 11.4, 11.9 (scroll-responsive chrome).
 */

import { type ReactNode, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useTransform, useMotionValue, useSpring } from 'framer-motion'
import { GradientMesh, type GradientMeshVariant } from './GradientMesh'
import { Icon } from './Icon'
import { NavigationDock } from './composed/NavigationDock'
import { useReducedMotion, springs } from '@/lib/animations'
import { sheetPresentationConfig } from '@/lib/transitions'
import { useRubberBand } from '@/hooks/useRubberBand'
import { useScrollProgress } from '@/hooks/useScrollProgress'
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation'
import { useScrollPreservation } from '@/hooks/useScrollPreservation'

/**
 * App navigation keys.
 *
 * The 4-tab primary dock exposes `home`, `history`, `tools`, and `settings`
 * via the NavigationDock composed component. Each destination has a dedicated
 * tab with spring-driven highlight animation (Requirement 10.3, 11.1).
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

  // ── Underlying surface scale-down during sheet presentation (Task 14.4) ────
  // When a sheet is open (hideDock=true), the main content area scales down 3%
  // (middle of 2–4% spec range) using the sheet spring for smooth choreography.
  const underlyingScaleTarget = useMotionValue(hideDock ? sheetPresentationConfig.underlyingScale : 1)
  const underlyingScale = useSpring(underlyingScaleTarget, {
    stiffness: (sheetPresentationConfig.underlyingTransition as { stiffness: number }).stiffness,
    damping: (sheetPresentationConfig.underlyingTransition as { damping: number }).damping,
    mass: (sheetPresentationConfig.underlyingTransition as { mass: number }).mass,
  })

  // Update the motion value when hideDock changes
  // (useMotionValue initial value only sets once; we need to track changes)
  const prevHideDock = useRef(hideDock)
  if (prevHideDock.current !== hideDock) {
    prevHideDock.current = hideDock
    underlyingScaleTarget.set(hideDock ? sheetPresentationConfig.underlyingScale : 1)
  }

  // Rubber-band overscroll on the main content scroll area (Task 242.3)
  const { containerRef: rubberBandRef, style: rubberBandStyle } = useRubberBand({
    disabled: prefersReducedMotion,
    elasticity: 0.25,
    maxStretch: 60,
  })

  // ── Swipe navigation between adjacent destinations (Task 14.3) ────────────
  const { gestureRef: swipeRef } = useSwipeNavigation({
    activeNav,
    onNavChange,
  })

  // Merged ref for the <main> element: sets both rubberBandRef and swipeRef
  const mainRef = useRef<HTMLElement | null>(null)
  const mergedMainRef = useCallback(
    (node: HTMLElement | null) => {
      mainRef.current = node
      // Set the rubber-band hook's ref
      ;(rubberBandRef as React.MutableRefObject<HTMLElement | null>).current = node
      // Set the swipe navigation hook's ref
      ;(swipeRef as React.MutableRefObject<HTMLElement | null>).current = node
    },
    [rubberBandRef, swipeRef],
  )

  // ── Scroll position preservation per destination (Task 14.3) ───────────────
  useScrollPreservation(activeNav, mainRef)

  // ── Scroll-responsive chrome (Task 14.2) ──────────────────────────────────
  // Progress ramps 0→1 over 24–64px scroll offset. Spring smoothing gives a
  // soft 200–400ms settle when scroll returns to ≤24px (gentle spring).
  const { progress } = useScrollProgress({
    start: 24,
    end: 64,
    spring: true,
  })

  // Top chrome collapse: translateY shifts header up ~40% of its height (56px)
  // to partially collapse it. Opacity dims slightly for depth.
  const topBarY = useTransform(progress, [0, 1], [0, -22])
  const topBarOpacity = useTransform(progress, [0, 1], [1, 0.7])

  // Divider reveal: fades in after ~30% scroll progress for a 3:1 contrast edge.
  // Uses the existing ::after pseudo-element via a CSS variable driven by inline opacity.
  const dividerOpacity = useTransform(progress, [0, 0.3, 1], [0, 0, 1])

  // Quick-log FAB scale-down: 10% reduction (within 8–12% spec range)
  const fabScale = useTransform(progress, [0, 1], [1, 0.9])

  const handleSettingsTop = onOpenSettings ?? (() => onNavChange('settings'))

  return (
    <div className="app-shell">
      {/* Fixed animated mesh background */}
      <GradientMesh variant={meshVariant} />

      {/* ── Floating glass top bar ─────────────────────────────── */}
      {!hideTopBar && (
        <motion.header
          className="app-topbar"
          style={
            prefersReducedMotion
              ? undefined
              : { y: topBarY, opacity: topBarOpacity }
          }
        >
          {/* Scroll-driven divider — sits at the bottom of the header */}
          <motion.div
            className="app-topbar__divider"
            style={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: dividerOpacity }
            }
            aria-hidden="true"
          />

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
        </motion.header>
      )}

      {/* ── Scrollable content ─────────────────────────────────── */}
      <motion.main
        ref={mergedMainRef}
        className={`app-content ${hideTopBar ? 'app-content--no-topbar' : ''} ${contentClassName}`.trim()}
        style={{
          ...rubberBandStyle,
          scale: prefersReducedMotion ? undefined : underlyingScale,
          transformOrigin: 'center top',
        }}
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
            aria-hidden={hideDock ? true : undefined}
            tabIndex={hideDock ? -1 : undefined}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
            transition={springs.snappy}
            style={
              prefersReducedMotion
                ? undefined
                : { scale: fabScale }
            }
          >
            <Icon name="action:add" size={26} strokeWidth={2.2} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Floating dock navigation ───────────────────────────── */}
      <NavigationDock
        active={activeNav}
        onNavigate={onNavChange}
        hidden={hideDock}
      />
    </div>
  )
}
