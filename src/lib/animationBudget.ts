"use client"

/**
 * Animation Budget System — animationBudget.ts
 *
 * Enforces the max 3 simultaneous animations per viewport budget (Req 28.5).
 * Provides runtime tracking and visibility-based pause/resume for CSS animations.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ANIMATION BUDGET: MAX 3 SIMULTANEOUS ANIMATIONS PER VIEWPORT            │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │                                                                          │
 * │ Budgeted (count toward the 3-animation limit):                          │
 * │   • Sheet transitions (present/dismiss)                                  │
 * │   • Celebration overlays                                                 │
 * │   • Value-change animations (number roll)                                │
 * │   • Emphasis pops                                                        │
 * │   • Page/nav transitions                                                 │
 * │                                                                          │
 * │ Exempt (do NOT count toward the limit):                                  │
 * │   • Staggered sequences — they're sequenced, not simultaneous            │
 * │   • Skeleton/loading spinners — transient states only                    │
 * │   • The breathing glow (.hero-breathe) — explicitly allowed              │
 * │   • Hero gradient shift (.hero-amount) — part of breathing glow family  │
 * │   • Hero shimmer particles — ambient, GPU-composited accents             │
 * │   • Gradient mesh orbs — decorative background, GPU-composited only      │
 * │   • Chip pulse ring — micro-interaction feedback (active state only)     │
 * │   • FAB breathe — hover-only, not idle                                   │
 * │                                                                          │
 * │ Idle State Rule:                                                         │
 * │   At idle (no user interaction, no transitions in flight), there should  │
 * │   be ZERO budgeted animations running. The only infinite loops allowed   │
 * │   at idle are exempt animations listed above.                            │
 * │                                                                          │
 * │ Off-screen Pause Rule:                                                   │
 * │   Infinite CSS animations on elements not in the viewport SHOULD be      │
 * │   paused via `animation-play-state: paused` to conserve GPU resources.   │
 * │   This is enforced via the `.anim-pause-offscreen` CSS class and the     │
 * │   `useVisibilityPause` hook (IntersectionObserver-based).                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Validates: Requirements 28.5
 */

import { useCallback, useEffect, useRef, useState } from "react"

// ============================================================================
// Constants
// ============================================================================

/** Maximum simultaneous budgeted animations per viewport. */
export const MAX_SIMULTANEOUS_ANIMATIONS = 3

/**
 * Animation categories for budget tracking.
 */
export type AnimationCategory =
  | "sheet-transition"
  | "celebration"
  | "value-change"
  | "emphasis-pop"
  | "page-transition"
  | "nav-transition"

/**
 * Exempt animation identifiers (not counted toward budget).
 */
export type ExemptAnimation =
  | "stagger-sequence"
  | "skeleton-loading"
  | "breathing-glow"
  | "hero-gradient"
  | "hero-shimmer"
  | "gradient-mesh"
  | "chip-pulse"
  | "fab-breathe"
  | "loading-spinner"
  | "sync-spinner"
  | "pull-to-refresh"

// ============================================================================
// Animation Budget Tracker (singleton)
// ============================================================================

interface AnimationSlot {
  id: string
  category: AnimationCategory
  startedAt: number
}

class AnimationBudgetTracker {
  private slots: Map<string, AnimationSlot> = new Map()
  private listeners: Set<() => void> = new Set()

  /** Current number of active budgeted animations. */
  get activeCount(): number {
    return this.slots.size
  }

  /** Whether a new budgeted animation can start within the budget. */
  get canAnimate(): boolean {
    return this.slots.size < MAX_SIMULTANEOUS_ANIMATIONS
  }

  /**
   * Register a budgeted animation. Returns false if budget is exceeded.
   * Animations that exceed the budget are still allowed but logged as a warning.
   */
  register(id: string, category: AnimationCategory): boolean {
    const withinBudget = this.canAnimate
    this.slots.set(id, { id, category, startedAt: Date.now() })
    this.notify()

    if (!withinBudget && process.env.NODE_ENV === "development") {
      console.warn(
        `[AnimationBudget] Exceeded budget (${this.slots.size}/${MAX_SIMULTANEOUS_ANIMATIONS}). ` +
        `Animation "${id}" (${category}) started while budget full.`
      )
    }

    return withinBudget
  }

  /** Deregister a budgeted animation when it completes. */
  deregister(id: string): void {
    this.slots.delete(id)
    this.notify()
  }

  /** Subscribe to budget changes. Returns unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn())
  }
}

/** Singleton budget tracker instance. */
export const animationBudget = new AnimationBudgetTracker()

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook to register a budgeted animation with the tracker.
 *
 * Returns `{ isActive, start, stop, canAnimate }`.
 * Call `start()` when the animation begins and `stop()` when it ends.
 * `canAnimate` reflects whether the budget allows a new animation.
 *
 * @example
 * ```tsx
 * const { start, stop, canAnimate } = useAnimationBudget("sheet-open", "sheet-transition")
 * // In onAnimationStart: start()
 * // In onAnimationComplete: stop()
 * ```
 */
export function useAnimationBudget(id: string, category: AnimationCategory) {
  const [isActive, setIsActive] = useState(false)
  const [canAnimate, setCanAnimate] = useState(animationBudget.canAnimate)
  const idRef = useRef(id)
  idRef.current = id

  useEffect(() => {
    const unsub = animationBudget.subscribe(() => {
      setCanAnimate(animationBudget.canAnimate)
    })
    return unsub
  }, [])

  const start = useCallback(() => {
    animationBudget.register(idRef.current, category)
    setIsActive(true)
  }, [category])

  const stop = useCallback(() => {
    animationBudget.deregister(idRef.current)
    setIsActive(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isActive) {
        animationBudget.deregister(idRef.current)
      }
    }
  }, [isActive])

  return { isActive, start, stop, canAnimate }
}

/**
 * Hook that pauses CSS animations on an element when it's not visible
 * in the viewport, using IntersectionObserver.
 *
 * Applies `animation-play-state: paused` when the element scrolls out of view,
 * and `running` when it re-enters. This ensures idle state has zero running
 * animations from off-screen elements.
 *
 * @param threshold - Intersection threshold (0–1). Default 0 (any pixel visible).
 * @returns A ref to attach to the target element.
 *
 * @example
 * ```tsx
 * function TipCard() {
 *   const pauseRef = useVisibilityPause<HTMLDivElement>()
 *   return <div ref={pauseRef} className="tip-emoji-float">🎯</div>
 * }
 * ```
 */
export function useVisibilityPause<T extends HTMLElement>(threshold = 0) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Check if IntersectionObserver is available (SSR safety)
    if (typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          el.style.animationPlayState = entry.isIntersecting ? "running" : "paused"
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return ref
}
