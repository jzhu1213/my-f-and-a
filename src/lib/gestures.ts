"use client"

/**
 * Gesture detection system for Folio.
 *
 * Provides pure functions and classes for detecting and resolving touch/pointer
 * gestures: horizontal swipe, sheet pull-dismiss, row reveal, pull-to-refresh,
 * and rubber-band overscroll.
 *
 * This module contains detection logic only — no React hooks or visual effects.
 * Visual presentation is handled by the motion system; the useGesture hook
 * manages lifecycle state.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.11
 */

// ============================================================================
// Types
// ============================================================================

/** A 2D point representing pointer position. */
export interface Point {
  readonly x: number
  readonly y: number
}

/** Velocity in px/s for both axes. */
export interface Velocity {
  readonly x: number
  readonly y: number
}

/** Gesture lifecycle state. */
export type GesturePhase = 'idle' | 'detecting' | 'tracking' | 'committed' | 'cancelled'

/** The direction a gesture resolves to. */
export type GestureDirection = 'left' | 'right' | 'up' | 'down' | 'none'

/** Types of gestures the system can detect. */
export type GestureType =
  | 'horizontal-swipe'
  | 'sheet-pull'
  | 'row-reveal'
  | 'pull-to-refresh'
  | 'rubber-band'

/** Resolution outcome of a completed gesture. */
export type GestureResolution = 'commit' | 'spring-back'

// ============================================================================
// Configuration
// ============================================================================

/** Options for horizontal swipe gesture (navigation between destinations). */
export interface HorizontalSwipeConfig {
  /** Minimum displacement to claim the gesture (px). Default: 10 */
  readonly threshold: number
  /** Maximum angle from horizontal to qualify (degrees). Default: 30 */
  readonly maxAngle: number
  /** Fraction of viewport width to commit. Default: 0.3 */
  readonly commitDistanceFraction: number
  /** Minimum release velocity to commit (px/s). Default: 400 */
  readonly commitVelocity: number
  /** Maximum settle time after release (ms). Default: 400 */
  readonly settleMs: number
}

/** Options for sheet pull-dismiss gesture. */
export interface SheetPullConfig {
  /** Fraction of sheet height to commit dismiss. Default: 0.4 */
  readonly commitDistanceFraction: number
  /** Minimum release velocity to commit dismiss (px/s). Default: 500 */
  readonly commitVelocity: number
  /** Maximum settle time after release (ms). Default: 400 */
  readonly settleMs: number
}

/** Options for row reveal gesture (swipe-to-reveal actions). */
export interface RowRevealConfig {
  /** Minimum displacement to claim the gesture (px). Default: 10 */
  readonly threshold: number
  /** Maximum reveal width (px). Default: 160 */
  readonly maxRevealWidth: number
  /** Fraction of maxRevealWidth to latch open. Default: 0.5 */
  readonly latchFraction: number
}

/** Options for pull-to-refresh gesture. */
export interface PullToRefreshConfig {
  /** Pull distance to trigger refresh (px). Default: 80 */
  readonly triggerDistance: number
  /** Maximum pull translation (px). Default: 120 */
  readonly maxDistance: number
  /** Resistance factor (0-1). Higher = more resistance. Default: 0.5 */
  readonly resistance: number
}

/** Options for rubber-band overscroll. */
export interface RubberBandConfig {
  /** Max fraction of scrollable dimension for overscroll. Default: 0.25 */
  readonly maxFraction: number
  /** Return settle time (ms). Default: 400 */
  readonly settleMs: number
}

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_HORIZONTAL_SWIPE: HorizontalSwipeConfig = {
  threshold: 10,
  maxAngle: 30,
  commitDistanceFraction: 0.3,
  commitVelocity: 400,
  settleMs: 400,
} as const

export const DEFAULT_SHEET_PULL: SheetPullConfig = {
  commitDistanceFraction: 0.4,
  commitVelocity: 500,
  settleMs: 400,
} as const

export const DEFAULT_ROW_REVEAL: RowRevealConfig = {
  threshold: 10,
  maxRevealWidth: 160,
  latchFraction: 0.5,
} as const

export const DEFAULT_PULL_TO_REFRESH: PullToRefreshConfig = {
  triggerDistance: 80,
  maxDistance: 120,
  resistance: 0.5,
} as const

export const DEFAULT_RUBBER_BAND: RubberBandConfig = {
  maxFraction: 0.25,
  settleMs: 400,
} as const

// ============================================================================
// Pure Detection Functions
// ============================================================================

/**
 * Calculate the angle (in degrees) of a displacement vector from the horizontal axis.
 * Returns a value between 0 (perfectly horizontal) and 90 (perfectly vertical).
 */
export function angleFromHorizontal(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0
  const radians = Math.atan2(Math.abs(dy), Math.abs(dx))
  return radians * (180 / Math.PI)
}

/**
 * Determine if a displacement qualifies as horizontal based on distance and angle.
 */
export function isHorizontalDrag(
  dx: number,
  dy: number,
  threshold: number,
  maxAngle: number,
): boolean {
  const distance = Math.abs(dx)
  if (distance < threshold) return false
  return angleFromHorizontal(dx, dy) <= maxAngle
}

/**
 * Determine if a displacement qualifies as vertical (for sheet pull, pull-to-refresh).
 */
export function isVerticalDrag(
  dx: number,
  dy: number,
  threshold: number,
): boolean {
  const distance = Math.abs(dy)
  if (distance < threshold) return false
  // Vertical if angle from horizontal > 60°
  return angleFromHorizontal(dx, dy) > 60
}

/**
 * Calculate velocity from a series of timed points.
 * Uses the last two points for instantaneous velocity at release.
 */
export function calculateVelocity(
  points: ReadonlyArray<{ point: Point; time: number }>,
): Velocity {
  if (points.length < 2) return { x: 0, y: 0 }

  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  const dt = (last.time - prev.time) / 1000 // seconds

  if (dt <= 0) return { x: 0, y: 0 }

  return {
    x: (last.point.x - prev.point.x) / dt,
    y: (last.point.y - prev.point.y) / dt,
  }
}

/**
 * Resolve a horizontal swipe: should it commit or spring back?
 */
export function resolveHorizontalSwipe(
  displacement: number,
  velocity: number,
  viewportWidth: number,
  config: HorizontalSwipeConfig = DEFAULT_HORIZONTAL_SWIPE,
): GestureResolution {
  const absDisplacement = Math.abs(displacement)
  const absVelocity = Math.abs(velocity)

  if (absDisplacement >= viewportWidth * config.commitDistanceFraction) {
    return 'commit'
  }
  if (absVelocity >= config.commitVelocity) {
    return 'commit'
  }
  return 'spring-back'
}

/**
 * Resolve a sheet pull-dismiss: should it dismiss or spring back?
 */
export function resolveSheetPull(
  displacement: number,
  velocity: number,
  sheetHeight: number,
  config: SheetPullConfig = DEFAULT_SHEET_PULL,
): GestureResolution {
  const absDisplacement = Math.abs(displacement)
  const absVelocity = Math.abs(velocity)

  if (absDisplacement >= sheetHeight * config.commitDistanceFraction) {
    return 'commit'
  }
  if (absVelocity >= config.commitVelocity) {
    return 'commit'
  }
  return 'spring-back'
}

/**
 * Resolve a row reveal: should it latch open or close?
 */
export function resolveRowReveal(
  displacement: number,
  config: RowRevealConfig = DEFAULT_ROW_REVEAL,
): GestureResolution {
  const absDisplacement = Math.abs(displacement)
  const latchPoint = config.maxRevealWidth * config.latchFraction

  if (absDisplacement >= latchPoint) {
    return 'commit'
  }
  return 'spring-back'
}

/**
 * Determine if a pull-to-refresh gesture should trigger.
 */
export function shouldTriggerRefresh(
  pullDistance: number,
  config: PullToRefreshConfig = DEFAULT_PULL_TO_REFRESH,
): boolean {
  return pullDistance >= config.triggerDistance
}

/**
 * Apply rubber-band resistance curve to a pull/overscroll distance.
 *
 * Uses a diminishing-returns formula:
 *   translated = max * (1 - e^(-raw * resistance / max))
 *
 * This gives the iOS-like feel where initial pull is 1:1 but
 * progressively resists as you pull further.
 */
export function applyRubberBandResistance(
  rawDistance: number,
  maxDistance: number,
  resistance: number = 0.5,
): number {
  if (rawDistance <= 0) return 0
  if (maxDistance <= 0) return 0

  return maxDistance * (1 - Math.exp((-rawDistance * resistance) / maxDistance))
}

/**
 * Calculate the rubber-band overscroll limit for a scrollable dimension.
 */
export function rubberBandLimit(
  scrollableDimension: number,
  config: RubberBandConfig = DEFAULT_RUBBER_BAND,
): number {
  return scrollableDimension * config.maxFraction
}

/**
 * Clamp a row reveal displacement to the maximum reveal width.
 */
export function clampRowReveal(
  displacement: number,
  config: RowRevealConfig = DEFAULT_ROW_REVEAL,
): number {
  const sign = displacement < 0 ? -1 : 1
  return sign * Math.min(Math.abs(displacement), config.maxRevealWidth)
}

/**
 * Apply pull-to-refresh resistance and capping.
 * Returns the translated (visual) distance, capped at maxDistance.
 */
export function applyPullToRefreshResistance(
  rawPull: number,
  config: PullToRefreshConfig = DEFAULT_PULL_TO_REFRESH,
): number {
  if (rawPull <= 0) return 0
  const translated = applyRubberBandResistance(
    rawPull,
    config.maxDistance,
    config.resistance,
  )
  return Math.min(translated, config.maxDistance)
}

// ============================================================================
// Velocity Tracker
// ============================================================================

/**
 * Tracks pointer positions over time to compute release velocity.
 * Keeps only the last N samples to stay lightweight.
 */
export class VelocityTracker {
  private samples: Array<{ point: Point; time: number }> = []
  private readonly maxSamples: number

  constructor(maxSamples: number = 10) {
    this.maxSamples = maxSamples
  }

  /** Record a pointer position at the current time. */
  addPoint(point: Point, time: number = performance.now()): void {
    this.samples.push({ point, time })
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }
  }

  /** Get the current velocity estimate (px/s). */
  getVelocity(): Velocity {
    return calculateVelocity(this.samples)
  }

  /** Reset all tracked samples. */
  reset(): void {
    this.samples = []
  }
}

// ============================================================================
// Gesture Detector
// ============================================================================

/** Result of a gesture detection attempt. */
export interface GestureDetectionResult {
  readonly detected: boolean
  readonly type: GestureType | null
  readonly direction: GestureDirection
}

/**
 * Detect which gesture type a drag displacement represents.
 * Used during the 'detecting' phase to determine gesture claim.
 */
export function detectGestureType(
  dx: number,
  dy: number,
  context: {
    readonly isAtScrollTop?: boolean
    readonly isOnRow?: boolean
    readonly isOnSheet?: boolean
    readonly horizontalSwipe?: HorizontalSwipeConfig
    readonly rowReveal?: RowRevealConfig
  } = {},
): GestureDetectionResult {
  const {
    isAtScrollTop = false,
    isOnRow = false,
    isOnSheet = false,
    horizontalSwipe = DEFAULT_HORIZONTAL_SWIPE,
    rowReveal = DEFAULT_ROW_REVEAL,
  } = context

  // Check horizontal gestures first
  if (isHorizontalDrag(dx, dy, horizontalSwipe.threshold, horizontalSwipe.maxAngle)) {
    if (isOnRow) {
      return {
        detected: true,
        type: 'row-reveal',
        direction: dx > 0 ? 'right' : 'left',
      }
    }
    return {
      detected: true,
      type: 'horizontal-swipe',
      direction: dx > 0 ? 'right' : 'left',
    }
  }

  // Check vertical gestures (pull-to-refresh, sheet pull, rubber-band)
  if (dy > 0 && isAtScrollTop) {
    const verticalThreshold = 10 // Match horizontal threshold for consistency
    if (Math.abs(dy) >= verticalThreshold) {
      if (isOnSheet) {
        return { detected: true, type: 'sheet-pull', direction: 'down' }
      }
      return { detected: true, type: 'pull-to-refresh', direction: 'down' }
    }
  }

  // Rubber-band: over-scroll in any direction at boundaries
  if (isAtScrollTop && dy > 10) {
    return { detected: true, type: 'rubber-band', direction: 'down' }
  }

  return { detected: false, type: null, direction: 'none' }
}

// ============================================================================
// Reduced Motion Helpers
// ============================================================================

/**
 * Get the settle duration for reduced motion mode.
 * All spring/elastic transitions become instant state changes ≤100ms.
 */
export function getReducedMotionSettleMs(): number {
  return 100
}

/**
 * Get the appropriate settle time based on motion preference.
 */
export function getSettleMs(
  normalMs: number,
  reducedMotion: boolean,
): number {
  return reducedMotion ? getReducedMotionSettleMs() : normalMs
}
