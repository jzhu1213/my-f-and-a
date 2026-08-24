"use client"

/**
 * DepthSurfaceSkeleton â€” Loading placeholder for depth surface screens.
 *
 * Displays a skeleton that matches the general layout of a depth surface:
 * - Back button area (44px height, 80px width)
 * - Title area (headline tier ~24px height, 200px width)
 * - 3-4 section groups with section header + list row skeletons
 *
 * Used as the `loading` fallback in `next/dynamic()` calls for depth surfaces.
 * The transition container (DepthSurfaceTransition) animates in immediately,
 * while this skeleton fills the content until the real component mounts.
 *
 * Requirements: 17.6, 17.7, 17.11
 */

import { Skeleton } from "@/components/ui/Skeleton"
import { CONTENT_MAX_WIDTH, HORIZONTAL_PADDING } from "@/styles/layout"
import { spacing } from "@/styles/typography"

// ============================================================================
// Section skeleton â€” repeatable group of header + list rows
// ============================================================================

function SectionGroupSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
      {/* Section header */}
      <Skeleton width={120} height={11} radius={6} />
      {/* List rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              padding: `${spacing.sm}px 0`,
              borderBottom: i < rows - 1 ? "1px solid var(--border)" : undefined,
            }}
          >
            {/* Leading icon placeholder */}
            <Skeleton width={36} height={36} radius={9999} />
            {/* Text content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <Skeleton width="65%" height={12} radius={6} />
              <Skeleton width="40%" height={9} radius={4} />
            </div>
            {/* Trailing value */}
            <Skeleton width={48} height={14} radius={6} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function DepthSurfaceSkeleton() {
  return (
    <div
      aria-hidden="true"
      role="status"
      aria-label="Loading"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing.xl,
        padding: `${spacing.lg}px ${HORIZONTAL_PADDING}px 80px`,
        maxWidth: CONTENT_MAX_WIDTH,
        width: "100%",
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      {/* Back button area */}
      <Skeleton width={80} height={44} radius={9999} />

      {/* Title area */}
      <Skeleton width={200} height={24} radius={8} />

      {/* Section groups */}
      <SectionGroupSkeleton rows={3} />
      <SectionGroupSkeleton rows={4} />
      <SectionGroupSkeleton rows={3} />
      <SectionGroupSkeleton rows={2} />
    </div>
  )
}
