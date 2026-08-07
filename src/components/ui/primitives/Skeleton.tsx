"use client"

/**
 * Skeleton — Feedback primitive
 *
 * Loading placeholder that matches the shape of content it replaces.
 * Uses a CSS keyframe pulse animation via opacity tokens. Respects
 * `prefers-reduced-motion` by reducing to a gentle static opacity.
 *
 * Variants:
 * - `text` — rectangular placeholder for text lines (default height 14px)
 * - `circle` — circular placeholder for avatars/icons
 * - `rect` — generic rectangular placeholder
 *
 * All visual values resolve from the Design Token System — no arbitrary style props.
 *
 * Validates: Requirements 16.1, 16.2, 16.4
 */

import type { CSSProperties } from "react"
import { radius } from "@/styles/surfaces"
import { spacingScale } from "@/styles/layout"
import { colorRamp } from "@/styles/colors"

// ============================================================================
// Types
// ============================================================================

export type SkeletonVariant = "text" | "circle" | "rect"

export interface SkeletonProps {
  /** Shape variant. */
  variant?: SkeletonVariant
  /** Width — number (px) or CSS length string. Defaults to '100%' for text/rect, size for circle. */
  width?: number | string
  /** Height — number (px) or CSS length string. Defaults to 14px for text, 40px for circle, 48px for rect. */
  height?: number | string
  /** Explicit size for circle variant (diameter). Overrides width/height. */
  size?: number
  /** Number of text lines to render (only for text variant). */
  lines?: number
  /** Gap between text lines in px. Default 8. */
  gap?: number
  /** Additional inline styles for positioning. */
  style?: CSSProperties
}

// ============================================================================
// Helpers
// ============================================================================

function toLength(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === "number" ? `${value}px` : value
}

// ============================================================================
// Keyframe CSS (injected once)
// ============================================================================

const KEYFRAME_ID = "skeleton-pulse-keyframes"

function ensureKeyframes() {
  if (typeof document === "undefined") return
  if (document.getElementById(KEYFRAME_ID)) return

  const style = document.createElement("style")
  style.id = KEYFRAME_ID
  style.textContent = `
    @keyframes skeleton-pulse {
      0%, 100% { opacity: var(--opacity-40); }
      50% { opacity: var(--opacity-20); }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton-primitive {
        animation: none !important;
        opacity: var(--opacity-40) !important;
      }
    }
  `
  document.head.appendChild(style)
}

// ============================================================================
// Base skeleton element
// ============================================================================

function SkeletonBox({
  width,
  height,
  borderRadius: br,
  style,
}: {
  width: string
  height: string
  borderRadius: string
  style?: CSSProperties
}) {
  // Inject keyframes on first render (client only)
  if (typeof document !== "undefined") {
    ensureKeyframes()
  }

  return (
    <span
      aria-hidden="true"
      className="skeleton-primitive"
      style={{
        display: "block",
        width,
        height,
        borderRadius: br,
        background: colorRamp.accent[50],
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  )
}

// ============================================================================
// Component
// ============================================================================

export function Skeleton({
  variant = "rect",
  width,
  height,
  size,
  lines = 1,
  gap = 8,
  style,
}: SkeletonProps) {
  // Circle variant
  if (variant === "circle") {
    const diameter = size ?? (typeof height === "number" ? height : 40)
    const dim = toLength(diameter) ?? "40px"
    return (
      <SkeletonBox
        width={dim}
        height={dim}
        borderRadius={radius.full}
        style={{ flexShrink: 0, ...style }}
      />
    )
  }

  // Text variant (may render multiple lines)
  if (variant === "text") {
    const lineHeight = toLength(height) ?? "14px"
    const lineWidth = toLength(width) ?? "100%"

    if (lines > 1) {
      return (
        <span
          aria-hidden="true"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: `${gap}px`,
            ...style,
          }}
        >
          {Array.from({ length: lines }).map((_, i) => (
            <SkeletonBox
              key={i}
              width={i === lines - 1 ? "60%" : lineWidth}
              height={lineHeight}
              borderRadius={radius.min}
            />
          ))}
        </span>
      )
    }

    return (
      <SkeletonBox
        width={lineWidth}
        height={lineHeight}
        borderRadius={radius.min}
        style={style}
      />
    )
  }

  // Rect variant (default)
  const rectWidth = toLength(width) ?? "100%"
  const rectHeight = toLength(height) ?? "48px"

  return (
    <SkeletonBox
      width={rectWidth}
      height={rectHeight}
      borderRadius={radius.control}
      style={style}
    />
  )
}
