"use client"

/**
 * useGesture — State machine hook for gesture lifecycle management.
 *
 * Manages the gesture lifecycle: idle → detecting → tracking → committed/cancelled.
 * Uses the pure detection functions from `src/lib/gestures.ts` for all threshold
 * and resolution logic.
 *
 * This hook handles:
 * - Pointer event binding and cleanup
 * - Phase transitions via a state machine
 * - Velocity tracking across the gesture
 * - Resolution (commit vs spring-back) on release
 * - Reduced motion mode: replaces springs with instant state changes ≤100ms
 *
 * It does NOT handle:
 * - Visual effects or animations (that's the motion system's job)
 * - DOM manipulation (consumers bind the returned values to motion components)
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.11
 */

import { useRef, useCallback, useState, useEffect } from "react"
import { useReducedMotion } from "@/lib/animations"
import {
  type Point,
  type Velocity,
  type GesturePhase,
  type GestureType,
  type GestureDirection,
  type GestureResolution,
  type HorizontalSwipeConfig,
  type SheetPullConfig,
  type RowRevealConfig,
  type PullToRefreshConfig,
  type RubberBandConfig,
  DEFAULT_HORIZONTAL_SWIPE,
  DEFAULT_SHEET_PULL,
  DEFAULT_ROW_REVEAL,
  DEFAULT_PULL_TO_REFRESH,
  DEFAULT_RUBBER_BAND,
  VelocityTracker,
  detectGestureType,
  resolveHorizontalSwipe,
  resolveSheetPull,
  resolveRowReveal,
  shouldTriggerRefresh,
  applyPullToRefreshResistance,
  applyRubberBandResistance,
  rubberBandLimit,
  clampRowReveal,
  getSettleMs,
} from "@/lib/gestures"

// ============================================================================
// Types
// ============================================================================

/** Current state of the gesture state machine. */
export interface GestureState {
  /** Current lifecycle phase. */
  readonly phase: GesturePhase
  /** Detected gesture type (null until detection completes). */
  readonly type: GestureType | null
  /** Direction of the gesture. */
  readonly direction: GestureDirection
  /** Current displacement from start point (px). */
  readonly displacement: Point
  /** Current translated distance (after resistance curves, capping). */
  readonly translation: number
  /** Progress as a fraction (0-1) toward commit threshold. */
  readonly progress: number
  /** Final resolution of the gesture (null until resolved). */
  readonly resolution: GestureResolution | null
  /** Release velocity at the moment of pointer up. */
  readonly velocity: Velocity
  /** Settle duration in ms (respects reduced motion). */
  readonly settleMs: number
}

/** Configuration for the gesture hook. */
export interface UseGestureOptions {
  /** Enable/disable the gesture system. Default: true */
  readonly enabled?: boolean
  /** Horizontal swipe config. */
  readonly horizontalSwipe?: Partial<HorizontalSwipeConfig>
  /** Sheet pull-dismiss config. */
  readonly sheetPull?: Partial<SheetPullConfig>
  /** Row reveal config. */
  readonly rowReveal?: Partial<RowRevealConfig>
  /** Pull-to-refresh config. */
  readonly pullToRefresh?: Partial<PullToRefreshConfig>
  /** Rubber-band config. */
  readonly rubberBand?: Partial<RubberBandConfig>
  /** Context flags for gesture detection. */
  readonly context?: {
    /** Whether the scrollable area is at the top. */
    readonly isAtScrollTop?: boolean
    /** Whether the gesture starts on a swipeable row. */
    readonly isOnRow?: boolean
    /** Whether the gesture starts on a sheet. */
    readonly isOnSheet?: boolean
  }
  /** Viewport width (for commit threshold calculation). Default: window.innerWidth */
  readonly viewportWidth?: number
  /** Sheet height (for pull-dismiss threshold). Required for sheet gestures. */
  readonly sheetHeight?: number
  /** Scrollable dimension (for rubber-band limit). */
  readonly scrollableDimension?: number

  // Callbacks
  /** Called when the gesture commits (swipe, dismiss, reveal, refresh). */
  readonly onCommit?: (state: GestureState) => void
  /** Called when the gesture springs back (cancelled). */
  readonly onCancel?: (state: GestureState) => void
  /** Called on each frame while tracking (for driving animations). */
  readonly onUpdate?: (state: GestureState) => void
  /** Called when pull-to-refresh triggers. */
  readonly onRefresh?: () => void
}

/** Return value of the useGesture hook. */
export interface UseGestureReturn {
  /** Current gesture state (read-only). */
  readonly state: GestureState
  /** Ref to attach to the gesture target element. */
  readonly gestureRef: React.RefObject<HTMLElement | null>
  /** Manually reset the gesture state to idle. */
  readonly reset: () => void
  /** Whether reduced motion is active. */
  readonly reducedMotion: boolean
}

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_STATE: GestureState = {
  phase: 'idle',
  type: null,
  direction: 'none',
  displacement: { x: 0, y: 0 },
  translation: 0,
  progress: 0,
  resolution: null,
  velocity: { x: 0, y: 0 },
  settleMs: 0,
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useGesture(options: UseGestureOptions = {}): UseGestureReturn {
  const {
    enabled = true,
    horizontalSwipe: swipeOpts,
    sheetPull: sheetOpts,
    rowReveal: rowOpts,
    pullToRefresh: pullOpts,
    rubberBand: rubberOpts,
    context = {},
    viewportWidth,
    sheetHeight,
    scrollableDimension,
    onCommit,
    onCancel,
    onUpdate,
    onRefresh,
  } = options

  // Merge configs with defaults
  const swipeConfig: HorizontalSwipeConfig = { ...DEFAULT_HORIZONTAL_SWIPE, ...swipeOpts }
  const sheetConfig: SheetPullConfig = { ...DEFAULT_SHEET_PULL, ...sheetOpts }
  const rowConfig: RowRevealConfig = { ...DEFAULT_ROW_REVEAL, ...rowOpts }
  const pullConfig: PullToRefreshConfig = { ...DEFAULT_PULL_TO_REFRESH, ...pullOpts }
  const rubberConfig: RubberBandConfig = { ...DEFAULT_RUBBER_BAND, ...rubberOpts }

  const { prefersReducedMotion } = useReducedMotion()
  const gestureRef = useRef<HTMLElement | null>(null)
  const velocityTracker = useRef(new VelocityTracker())
  const startPoint = useRef<Point>({ x: 0, y: 0 })

  const [state, setState] = useState<GestureState>(INITIAL_STATE)

  // Store callbacks in refs to avoid re-binding event listeners
  const callbacksRef = useRef({ onCommit, onCancel, onUpdate, onRefresh })
  callbacksRef.current = { onCommit, onCancel, onUpdate, onRefresh }

  // Store context in ref for event handlers
  const contextRef = useRef(context)
  contextRef.current = context

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
    velocityTracker.current.reset()
  }, [])

  /**
   * Calculate translation based on gesture type and displacement.
   */
  const calculateTranslation = useCallback(
    (type: GestureType | null, dx: number, dy: number): number => {
      switch (type) {
        case 'horizontal-swipe':
          return dx
        case 'sheet-pull':
          return Math.max(0, dy) // Only downward
        case 'row-reveal':
          return clampRowReveal(dx, rowConfig)
        case 'pull-to-refresh':
          return applyPullToRefreshResistance(Math.max(0, dy), pullConfig)
        case 'rubber-band': {
          const limit = rubberBandLimit(scrollableDimension ?? 800, rubberConfig)
          return applyRubberBandResistance(Math.max(0, dy), limit, rubberConfig.maxFraction)
        }
        default:
          return 0
      }
    },
    [rowConfig, pullConfig, rubberConfig, scrollableDimension],
  )

  /**
   * Calculate progress (0-1) toward commit threshold.
   */
  const calculateProgress = useCallback(
    (type: GestureType | null, translation: number): number => {
      const vw = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 390)

      switch (type) {
        case 'horizontal-swipe': {
          const threshold = vw * swipeConfig.commitDistanceFraction
          return Math.min(1, Math.abs(translation) / threshold)
        }
        case 'sheet-pull': {
          const height = sheetHeight ?? 600
          const threshold = height * sheetConfig.commitDistanceFraction
          return Math.min(1, Math.abs(translation) / threshold)
        }
        case 'row-reveal': {
          const latchPoint = rowConfig.maxRevealWidth * rowConfig.latchFraction
          return Math.min(1, Math.abs(translation) / latchPoint)
        }
        case 'pull-to-refresh': {
          return Math.min(1, translation / pullConfig.triggerDistance)
        }
        case 'rubber-band': {
          const limit = rubberBandLimit(scrollableDimension ?? 800, rubberConfig)
          return Math.min(1, translation / limit)
        }
        default:
          return 0
      }
    },
    [
      viewportWidth,
      sheetHeight,
      scrollableDimension,
      swipeConfig,
      sheetConfig,
      rowConfig,
      pullConfig,
      rubberConfig,
    ],
  )

  /**
   * Resolve the gesture on pointer release.
   */
  const resolveGesture = useCallback(
    (type: GestureType | null, displacement: Point, velocity: Velocity): GestureResolution => {
      const vw = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 390)

      switch (type) {
        case 'horizontal-swipe':
          return resolveHorizontalSwipe(displacement.x, velocity.x, vw, swipeConfig)
        case 'sheet-pull':
          return resolveSheetPull(displacement.y, velocity.y, sheetHeight ?? 600, sheetConfig)
        case 'row-reveal':
          return resolveRowReveal(displacement.x, rowConfig)
        case 'pull-to-refresh': {
          const translated = applyPullToRefreshResistance(
            Math.max(0, displacement.y),
            pullConfig,
          )
          return shouldTriggerRefresh(translated, pullConfig) ? 'commit' : 'spring-back'
        }
        case 'rubber-band':
          return 'spring-back' // Rubber-band always springs back
        default:
          return 'spring-back'
      }
    },
    [viewportWidth, sheetHeight, swipeConfig, sheetConfig, rowConfig, pullConfig],
  )

  // ========================================================================
  // Event Handlers
  // ========================================================================

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!enabled) return

      startPoint.current = { x: e.clientX, y: e.clientY }
      velocityTracker.current.reset()
      velocityTracker.current.addPoint(startPoint.current)

      setState({
        ...INITIAL_STATE,
        phase: 'detecting',
      })
    },
    [enabled],
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!enabled) return

      const currentPoint: Point = { x: e.clientX, y: e.clientY }
      velocityTracker.current.addPoint(currentPoint)

      const dx = currentPoint.x - startPoint.current.x
      const dy = currentPoint.y - startPoint.current.y

      setState((prev) => {
        // Already resolved — ignore further movement
        if (prev.phase === 'committed' || prev.phase === 'cancelled' || prev.phase === 'idle') {
          return prev
        }

        // Detection phase: try to identify the gesture type
        if (prev.phase === 'detecting') {
          const detection = detectGestureType(dx, dy, {
            ...contextRef.current,
            horizontalSwipe: swipeConfig,
            rowReveal: rowConfig,
          })

          if (!detection.detected) return prev

          const translation = calculateTranslation(detection.type, dx, dy)
          const progress = calculateProgress(detection.type, translation)

          const newState: GestureState = {
            phase: 'tracking',
            type: detection.type,
            direction: detection.direction,
            displacement: { x: dx, y: dy },
            translation,
            progress,
            resolution: null,
            velocity: { x: 0, y: 0 },
            settleMs: 0,
          }

          callbacksRef.current.onUpdate?.(newState)
          return newState
        }

        // Tracking phase: update displacement and translation
        if (prev.phase === 'tracking') {
          const translation = calculateTranslation(prev.type, dx, dy)
          const progress = calculateProgress(prev.type, translation)

          const newState: GestureState = {
            ...prev,
            displacement: { x: dx, y: dy },
            translation,
            progress,
          }

          callbacksRef.current.onUpdate?.(newState)
          return newState
        }

        return prev
      })
    },
    [enabled, swipeConfig, rowConfig, calculateTranslation, calculateProgress],
  )

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!enabled) return

      const currentPoint: Point = { x: e.clientX, y: e.clientY }
      velocityTracker.current.addPoint(currentPoint)

      setState((prev) => {
        // Not in a trackable state
        if (prev.phase !== 'tracking' && prev.phase !== 'detecting') {
          return INITIAL_STATE
        }

        // If still detecting (didn't reach threshold), cancel
        if (prev.phase === 'detecting') {
          return { ...INITIAL_STATE, phase: 'cancelled' }
        }

        const velocity = velocityTracker.current.getVelocity()
        const resolution = resolveGesture(prev.type, prev.displacement, velocity)

        const normalSettleMs = prev.type === 'horizontal-swipe'
          ? swipeConfig.settleMs
          : prev.type === 'sheet-pull'
            ? sheetConfig.settleMs
            : prev.type === 'rubber-band'
              ? rubberConfig.settleMs
              : 400

        const settleMs = getSettleMs(normalSettleMs, prefersReducedMotion)

        const finalState: GestureState = {
          ...prev,
          phase: resolution === 'commit' ? 'committed' : 'cancelled',
          resolution,
          velocity,
          settleMs,
        }

        // Fire callbacks
        if (resolution === 'commit') {
          callbacksRef.current.onCommit?.(finalState)
          if (prev.type === 'pull-to-refresh') {
            callbacksRef.current.onRefresh?.()
          }
        } else {
          callbacksRef.current.onCancel?.(finalState)
        }

        return finalState
      })
    },
    [
      enabled,
      prefersReducedMotion,
      resolveGesture,
      swipeConfig.settleMs,
      sheetConfig.settleMs,
      rubberConfig.settleMs,
    ],
  )

  const handlePointerCancel = useCallback(() => {
    setState((prev) => {
      if (prev.phase === 'idle') return prev
      const cancelled: GestureState = {
        ...prev,
        phase: 'cancelled',
        resolution: 'spring-back',
        settleMs: getSettleMs(400, prefersReducedMotion),
      }
      callbacksRef.current.onCancel?.(cancelled)
      return cancelled
    })
  }, [prefersReducedMotion])

  // ========================================================================
  // Event Binding
  // ========================================================================

  useEffect(() => {
    if (!enabled) return

    const el = gestureRef.current
    if (!el) return

    el.addEventListener('pointerdown', handlePointerDown)
    el.addEventListener('pointermove', handlePointerMove)
    el.addEventListener('pointerup', handlePointerUp)
    el.addEventListener('pointercancel', handlePointerCancel)

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown)
      el.removeEventListener('pointermove', handlePointerMove)
      el.removeEventListener('pointerup', handlePointerUp)
      el.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [enabled, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel])

  return {
    state,
    gestureRef,
    reset,
    reducedMotion: prefersReducedMotion,
  }
}
