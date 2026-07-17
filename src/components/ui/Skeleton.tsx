"use client"

/**
 * Skeleton
 *
 * Premium loading placeholders with a gradient shimmer sweep. Skeletons
 * mirror the shape of the real content they stand in for, so the transition
 * to loaded content feels calm rather than jarring.
 *
 * Performance: the shimmer sweep is a GPU-composited `transform: translateX`
 * on a pseudo-element (see `.skeleton` in globals.css), keeping animation on
 * the compositor thread at ~60fps.
 *
 * Accessibility: skeletons are decorative and marked `aria-hidden`. The
 * `prefers-reduced-motion` media query swaps the sweep for a gentle static
 * opacity pulse. Real content fades in via `FadeInContent` instead of a hard
 * pop-in.
 *
 * Validates: Requirements 13.1, 8.4
 */

import type { CSSProperties, ReactNode } from "react"

// ── Base ──────────────────────────────────────────────────────────────────

export interface SkeletonProps {
  /** Width — number (px) or any CSS length. Defaults to 100%. */
  width?: number | string
  /** Height — number (px) or any CSS length. Defaults to 16px. */
  height?: number | string
  /** Border radius override — number (px) or any CSS length. */
  radius?: number | string
  /** Additional class names. */
  className?: string
  /** Inline style overrides. */
  style?: CSSProperties
}

/** Normalizes a number to a px string, passing through string values. */
function toLength(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === "number" ? `${value}px` : value
}

/**
 * Base shimmer placeholder. A neutral rounded surface with a highlight
 * sweeping left-to-right.
 */
export function Skeleton({
  width = "100%",
  height = 16,
  radius,
  className = "",
  style,
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton ${className}`.trim()}
      style={{
        display: "block",
        width: toLength(width),
        height: toLength(height),
        borderRadius: toLength(radius),
        ...style,
      }}
    />
  )
}

// ── Circle ──────────────────────────────────────────────────────────────────

export interface SkeletonCircleProps {
  /** Diameter — number (px) or any CSS length. Defaults to 40px. */
  size?: number | string
  className?: string
  style?: CSSProperties
}

/** Circular placeholder for avatars, icons, and rings. */
export function SkeletonCircle({ size = 40, className = "", style }: SkeletonCircleProps) {
  const dimension = toLength(size)
  return (
    <span
      aria-hidden="true"
      className={`skeleton skeleton--circle ${className}`.trim()}
      style={{
        display: "block",
        width: dimension,
        height: dimension,
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

// ── Text ──────────────────────────────────────────────────────────────────

export interface SkeletonTextProps {
  /** Number of text lines to render. Defaults to 1. */
  lines?: number
  /** Width of the final line (shorter looks more natural). Defaults to "60%". */
  lastLineWidth?: number | string
  /** Gap between lines in px. Defaults to 8. */
  gap?: number
  /** Height of each line — number (px) or CSS length. Defaults to 12px. */
  lineHeight?: number | string
  className?: string
  style?: CSSProperties
}

/** One or more text lines. The last line is shortened for a natural look. */
export function SkeletonText({
  lines = 1,
  lastLineWidth = "60%",
  gap = 8,
  lineHeight = 12,
  className = "",
  style,
}: SkeletonTextProps) {
  const count = Math.max(1, lines)
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: "flex", flexDirection: "column", gap, ...style }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className="skeleton--text"
          height={lineHeight}
          width={i === count - 1 && count > 1 ? lastLineWidth : "100%"}
        />
      ))}
    </span>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────

export interface SkeletonCardProps {
  /** Height of the card — number (px) or CSS length. Defaults to 88px. */
  height?: number | string
  className?: string
  style?: CSSProperties
  /** Optional custom skeleton content rendered inside the card surface. */
  children?: ReactNode
}

/** Raised card-shaped placeholder for content blocks and rows. */
export function SkeletonCard({
  height = 88,
  className = "",
  style,
  children,
}: SkeletonCardProps) {
  if (children) {
    // Container-only variant: render children on a raised card surface
    // without the shimmer on the container itself (children shimmer instead).
    return (
      <div
        aria-hidden="true"
        className={className}
        style={{
          background: "var(--raised)",
          borderRadius: "var(--radius-md)",
          padding: 16,
          minHeight: toLength(height),
          ...style,
        }}
      >
        {children}
      </div>
    )
  }
  return (
    <Skeleton
      className={`skeleton--card ${className}`.trim()}
      height={height}
      style={style}
    />
  )
}

// ── Crossfade wrapper ─────────────────────────────────────────────────────

export interface FadeInContentProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * Wraps freshly-loaded content so it fades in gently instead of popping.
 * Use to render real content once loading completes:
 *
 *   {loading ? <HomeScreenSkeleton /> : <FadeInContent>{content}</FadeInContent>}
 */
export function FadeInContent({ children, className = "", style }: FadeInContentProps) {
  return (
    <div className={`skeleton-content-in ${className}`.trim()} style={style}>
      {children}
    </div>
  )
}

// ── Logo pulse ──────────────────────────────────────────────────────────────

export interface LogoPulseProps {
  /** Diameter of the logo mark in px. Defaults to 72. */
  size?: number
  /** Optional label announced to screen readers. Defaults to "Loading". */
  label?: string
  className?: string
  style?: CSSProperties
  /** Optional custom logo content. Defaults to the Folio wordmark initial. */
  children?: ReactNode
}

/**
 * A glowing, breathing app logo shown during initial auth/data loading.
 * The pulse is CSS-driven (transform + opacity + drop-shadow) and calms
 * to a slow opacity fade under `prefers-reduced-motion`.
 */
export function LogoPulse({
  size = 72,
  label = "Loading",
  className = "",
  style,
  children,
}: LogoPulseProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`logo-pulse ${className}`.trim()}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, var(--raised), var(--surface))",
        border: "1px solid var(--border)",
        color: "var(--text)",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 700,
        fontSize: size * 0.42,
        ...style,
      }}
    >
      {children ?? <span aria-hidden="true">F</span>}
    </div>
  )
}

// ── Home screen skeleton ─────────────────────────────────────────────────────

export interface HomeScreenSkeletonProps {
  className?: string
  style?: CSSProperties
}

/**
 * Full-screen loading state that mirrors the intended Home screen layout:
 * a centered allowance ring/hero, a grid of category pills, and a list of
 * recent transaction rows. Keeps the same spacing and shapes as the real
 * content so the crossfade to loaded content is seamless.
 */
export function HomeScreenSkeleton({ className = "", style }: HomeScreenSkeletonProps) {
  // Mirrors the QuickLogArea category grid and the recent-transactions list.
  const categoryCount = 6
  const transactionCount = 4

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading your day"
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
        padding: "24px 20px",
        ...style,
      }}
    >
      {/* ── Allowance ring / hero ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          paddingTop: 8,
        }}
      >
        <SkeletonCircle size={180} />
        <Skeleton width={140} height={14} radius={7} />
        <Skeleton width={90} height={10} radius={5} />
      </div>

      {/* ── Category pills grid ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Skeleton width={92} height={12} radius={6} />
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${categoryCount}, 1fr)` }}
        >
          {Array.from({ length: categoryCount }).map((_, i) => (
            <Skeleton key={i} height={80} radius="var(--radius-sm)" />
          ))}
        </div>
      </div>

      {/* ── Recent transactions list ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Skeleton width={120} height={12} radius={6} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {Array.from({ length: transactionCount }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <SkeletonCircle size={38} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <Skeleton width="55%" height={12} radius={6} />
                <Skeleton width="32%" height={10} radius={5} />
              </div>
              <Skeleton width={54} height={14} radius={7} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
