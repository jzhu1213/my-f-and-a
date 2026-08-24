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
import { motion } from "framer-motion"
import { FONT_FAMILY, spacing, fontWeights } from '@/styles/typography'
import { HORIZONTAL_PADDING } from "@/styles/shared"

// â”€â”€ Base â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SkeletonProps {
  /** Width â€” number (px) or any CSS length. Defaults to 100%. */
  width?: number | string
  /** Height â€” number (px) or any CSS length. Defaults to 16px. */
  height?: number | string
  /** Border radius override â€” number (px) or any CSS length. */
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

// â”€â”€ Circle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SkeletonCircleProps {
  /** Diameter â€” number (px) or any CSS length. Defaults to 40px. */
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

// â”€â”€ Text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SkeletonTextProps {
  /** Number of text lines to render. Defaults to 1. */
  lines?: number
  /** Width of the final line (shorter looks more natural). Defaults to "60%". */
  lastLineWidth?: number | string
  /** Gap between lines in px. Defaults to 8. */
  gap?: number
  /** Height of each line â€” number (px) or CSS length. Defaults to 12px. */
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

// â”€â”€ Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SkeletonCardProps {
  /** Height of the card â€” number (px) or CSS length. Defaults to 88px. */
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
          padding: spacing.md,
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

// â”€â”€ Crossfade wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface FadeInContentProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * Wraps freshly-loaded content so it fades in gently instead of popping.
 * Uses framer-motion for a 250ms opacity tween (within the 150â€“300ms spec).
 * When used inside AnimatePresence, guarantees the skeleton is fully unmounted
 * before content appears (CLS â‰¤ 0.02).
 *
 * Usage with AnimatePresence in the parent:
 *   <AnimatePresence mode="wait">
 *     {loading ? <HomeScreenSkeleton key="skeleton" /> : <FadeInContent key="content">{...}</FadeInContent>}
 *   </AnimatePresence>
 *
 * Validates: Requirements 17.2, 17.3
 */
export function FadeInContent({ children, className = "", style }: FadeInContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
      className={className || undefined}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// â”€â”€ Logo pulse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        fontFamily: FONT_FAMILY,
        fontWeight: fontWeights.bold,
        fontSize: size * 0.42,
        ...style,
      }}
    >
      {children ?? <span aria-hidden="true">F</span>}
    </div>
  )
}

// â”€â”€ Home screen skeleton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface HomeScreenSkeletonProps {
  className?: string
  style?: CSSProperties
}

/**
 * Full-screen loading state that accurately mirrors the real Home screen
 * layout so the crossfade to loaded content is a calm, shift-free transition.
 *
 * Sections (top â†’ bottom, matching HomeScreen):
 *  1. Hero â€” GlassCard high elevation with ring, amount, message
 *  2. Quick actions â€” row of 2 pill buttons + tertiary link
 *  3. Category budget cards â€” 2Ã—2 grid with icon, name, progress bar
 *  4. Recent transactions â€” header + glass card with timeline rows
 *  5. Tip card â€” single card placeholder at the bottom
 *
 * Spacing uses the real layout constants: SECTION_SPACING (32px gap),
 * HORIZONTAL_PADDING (20px sides), spacing.lg (24px top), DOCK_PADDING_BOTTOM
 * (120px bottom clearance for the floating dock).
 *
 * When used inside AnimatePresence, exits with a 250ms opacity fade so the
 * skeleton-to-content crossfade is seamless (CLS â‰¤ 0.02).
 *
 * Validates: Requirements 17.1, 17.2, 17.3
 */
export function HomeScreenSkeleton({ className = "", style }: HomeScreenSkeletonProps) {
  const transactionCount = 4

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
      role="status"
      aria-busy="true"
      aria-label="Loading your day"
      className={className || undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing.xl, // SECTION_SPACING
        padding: "24px 20px 120px", // paddingTop: spacing.lg, sides: HORIZONTAL_PADDING, bottom: DOCK_PADDING_BOTTOM
        maxWidth: 560, // CONTENT_MAX_WIDTH
        width: "100%",
        marginLeft: "auto",
        marginRight: "auto",
        ...style,
      }}
    >
      {/* â”€â”€ 1. Hero (GlassCard elevation="high") â”€â”€ */}
      <div
        className="glass-card glass-card--high"
        style={{
          padding: "28px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        {/* Allowance ring circle */}
        <SkeletonCircle size={180} />
        {/* Hero dollar amount */}
        <Skeleton width={160} height={40} radius={8} />
        {/* Encouraging message */}
        <Skeleton width={200} height={14} radius={7} />
        {/* Context text (spent today / rollover) */}
        <Skeleton width={120} height={10} radius={5} />
      </div>

      {/* â”€â”€ 2. Quick Actions (2 pills + tertiary link) â”€â”€ */}
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
        <div style={{ display: "flex", gap: spacing.md, alignItems: "center" }}>
          {/* Log expense â€” larger pill */}
          <Skeleton
            width="62%"
            height={54}
            radius={9999}
            style={{ flexShrink: 0, flex: "1.6" }}
          />
          {/* Log income â€” smaller ghost pill */}
          <Skeleton
            width="38%"
            height={50}
            radius={9999}
            style={{ flexShrink: 0, flex: "1" }}
          />
        </div>
        {/* Tertiary link row */}
        <div style={{ display: "flex", justifyContent: "center", gap: spacing.sm }}>
          <Skeleton width={80} height={28} radius={9999} />
          <Skeleton width={130} height={28} radius={9999} />
        </div>
      </div>

      {/* â”€â”€ 3. Category Budget Cards (2Ã—2 grid) â”€â”€ */}
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
        {/* Section header */}
        <Skeleton width={92} height={11} radius={6} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: spacing.sm,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass-card glass-card--low"
              style={{
                padding: 14,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: spacing.xxs + 2,
              }}
            >
              {/* Category icon (44px) */}
              <SkeletonCircle size={44} />
              {/* Category name */}
              <Skeleton width={52} height={10} radius={5} />
              {/* Progress bar */}
              <Skeleton width="100%" height={4} radius={2} />
              {/* Amount remaining */}
              <Skeleton width={60} height={9} radius={4} />
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ 4. Recent Transactions (header + glass card with timeline) â”€â”€ */}
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
        {/* Section header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Skeleton width={56} height={11} radius={6} />
          <Skeleton width={50} height={10} radius={5} />
        </div>
        {/* Transaction list inside a glass card */}
        <div
          className="glass-card glass-card--low"
          style={{ padding: "12px 0" }}
        >
          {/* Date group header */}
          <div style={{ padding: "8px 16px 4px" }}>
            <Skeleton width={48} height={9} radius={4} />
          </div>
          {/* Transaction rows with timeline */}
          <div style={{ position: "relative", paddingLeft: spacing.md }}>
            {/* Vertical timeline line */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 28,
                top: 8,
                bottom: 8,
                width: 1.5,
                borderRadius: 1,
                background: "var(--surface)",
              }}
            />
            {Array.from({ length: transactionCount }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px 10px 20px",
                  position: "relative",
                  borderBottom:
                    i < transactionCount - 1
                      ? "1px solid var(--border)"
                      : undefined,
                }}
              >
                {/* Timeline node dot */}
                <span
                  aria-hidden="true"
                  className="skeleton skeleton--circle"
                  style={{
                    position: "absolute",
                    left: 9,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 7,
                    height: 7,
                    display: "block",
                    flexShrink: 0,
                  }}
                />
                {/* Category icon */}
                <SkeletonCircle size={32} />
                {/* Text column */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.xxs,
                    marginLeft: spacing.xs,
                  }}
                >
                  <Skeleton width="55%" height={12} radius={6} />
                  <Skeleton width="32%" height={9} radius={4} />
                </div>
                {/* Amount */}
                <Skeleton width={50} height={14} radius={7} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* â”€â”€ 5. Tip card placeholder â”€â”€ */}
      <div
        className="glass-card glass-card--low"
        style={{
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: spacing.sm,
        }}
      >
        <Skeleton width={140} height={12} radius={6} />
        <Skeleton width="90%" height={10} radius={5} />
        <Skeleton width="70%" height={10} radius={5} />
      </div>
    </motion.div>
  )
}
