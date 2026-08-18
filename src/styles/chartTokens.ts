/**
 * Shared chart & data-visualization tokens for Folio.
 *
 * Establishes a unified visual language across all chart and progress-bar
 * components (CompoundGrowthCalculator, CashFlowForecastScreen,
 * TrajectoryScreen ProgressCurveCard, and future visualizations).
 *
 * Import these tokens instead of scattering ad-hoc rgba values, stroke widths,
 * and transition strings across individual components.
 *
 * Phase 6 — task 268.1
 */

import type { CSSProperties } from "react"
import { FONT_FAMILY } from "./typography"

// ============================================================================
// Chart color palette
// ============================================================================

/**
 * Semantic chart colors that all visualizations pull from.
 *
 * Uses CSS custom properties so colors respond to theme changes. The palette
 * keeps Folio's warm-purple aesthetic while providing enough contrast for
 * WCAG AA non-text elements (3:1 against --bg #12121f).
 */
export const chartColors = {
  /** Primary line / stroke for positive trends (savings, growth). */
  primary: "var(--success)",
  /** Primary area fill — translucent version of the primary line. */
  primaryFill: "rgba(74, 222, 128, 0.12)",
  /** Gradient start for area fills (top, more visible). */
  primaryGradientFrom: "rgba(74, 222, 128, 0.28)",
  /** Gradient end for area fills (bottom, nearly invisible). */
  primaryGradientTo: "rgba(74, 222, 128, 0.02)",

  /** Secondary line for neutral/informational charts (cash-flow, projections). */
  secondary: "rgba(139, 92, 246, 0.8)",
  /** Secondary area fill — translucent purple. */
  secondaryFill: "rgba(139, 92, 246, 0.10)",

  /** Negative/danger line (zero-line crossing, overspending). */
  danger: "rgba(239, 68, 68, 0.5)",

  /** Gridline and axis rule color. */
  grid: "rgba(255, 255, 255, 0.05)",

  /** Dot fill (endpoint indicators on curves). */
  dot: "var(--surface)",
  /** Dot stroke color (matches line color contextually). */
  dotStroke: "var(--success)",
} as const

// ============================================================================
// Chart dimensions
// ============================================================================

/** Standard chart heights for consistency across views. */
export const chartDimensions = {
  /** Standard SVG chart height (px) for full-width area/line charts. */
  height: 140,
  /** Compact chart height for inline/card charts. */
  heightCompact: 100,
  /** Padding above chart content area. */
  paddingTop: 16,
  /** Padding below chart content area (space for labels). */
  paddingBottom: 20,
} as const

// ============================================================================
// Stroke & line tokens
// ============================================================================

export const chartStrokes = {
  /** Primary line stroke width. */
  lineWidth: 2,
  /** Secondary/lighter line stroke width. */
  lineWidthLight: 1.5,
  /** Gridline stroke width. */
  gridWidth: 0.5,
  /** Zero/danger line stroke width. */
  dangerWidth: 0.8,
  /** Endpoint dot radius. */
  dotRadius: 3.5,
  /** Endpoint dot stroke width. */
  dotStrokeWidth: 2,
  /** Dashed gridline pattern (stroke-dasharray). */
  dashPattern: "4 3",
} as const

// ============================================================================
// Progress bar tokens
// ============================================================================

export const progressBar = {
  /** Standard progress bar track height (px). */
  height: 4,
  /** Compact progress bar height for inline rows. */
  heightCompact: 2,
  /** Border radius for progress bars. */
  borderRadius: 99,
  /** Track background (unfilled portion). */
  track: "rgba(255, 255, 255, 0.06)",
  /** Default fill color for positive progress. */
  fill: "var(--success)",
  /** Accent fill for goal-type / neutral progress. */
  fillAccent: "var(--accent, #818cf8)",
} as const

// ============================================================================
// Chart label typography
// ============================================================================

/** Axis and chart label style — consistent across all visualizations. */
export const chartLabel: CSSProperties = {
  fontFamily: FONT_FAMILY,
  fontSize: 11,
  fontWeight: 500,
  color: "var(--muted)",
  letterSpacing: "0.01em",
}

/** Chart value label (inline amounts next to bars/dots). */
export const chartValueLabel: CSSProperties = {
  fontFamily: FONT_FAMILY,
  fontSize: 12,
  fontWeight: 500,
  color: "var(--sub)",
  fontVariantNumeric: "tabular-nums",
}

// ============================================================================
// Chart motion / transition tokens
// ============================================================================

/**
 * Consistent chart animation timings. All visualizations use these
 * instead of scattered inline transition strings.
 */
export const chartMotion = {
  /** Width/bar growth transition (progress bars, bar charts). */
  barGrow: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
  /** Path draw / opacity entrance (SVG lines). */
  pathDraw: "opacity 0.5s ease-out",
  /** Dot scale-in on chart endpoints. */
  dotEnter: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const

/**
 * Shared chart entrance motion config — identical ≤400ms duration across all chart views.
 * Used as the framer-motion transition for chart content becoming visible inside ChartFrame.
 * Validates: Requirement 15.5
 */
export const chartEntranceMotion = {
  duration: 0.4,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
} as const

// ============================================================================
// SVG gradient helpers
// ============================================================================

/**
 * Standard gradient ID prefix for chart area fills.
 * Each chart should append a unique suffix (e.g., "chartGradient-cashflow").
 */
export const CHART_GRADIENT_PREFIX = "chartGradient" as const

// ============================================================================
// Color Vision Deficiency (CVD) support — Pattern & Shape differentiation
// ============================================================================

/**
 * Dash patterns for distinct line types in multi-series charts.
 * Each series gets a unique stroke-dasharray so lines are distinguishable
 * without relying on color alone.
 *
 * Requirement 27.6 — color-blind-safe differentiation
 */
export const chartLinePatterns = {
  /** Primary series — solid line (no dash) */
  solid: "none",
  /** Secondary series — long dashes */
  dashed: "8 4",
  /** Danger/negative series — short dots */
  dotted: "3 3",
  /** Tertiary series — dash-dot pattern */
  dashDot: "8 3 2 3",
  /** Projection/forecast — evenly spaced medium dashes */
  projection: "6 6",
} as const

/**
 * Marker shapes for chart data points. Components render these as SVG elements
 * at data point positions so series are distinguishable by shape as well as color.
 *
 * Each entry describes an SVG path relative to center (0,0) at the given size.
 *
 * Requirement 27.6 — color-blind-safe differentiation
 */
export const chartMarkerShapes = {
  /** Circle — primary/positive series */
  circle: {
    type: "circle" as const,
    label: "circle",
  },
  /** Square — secondary/neutral series */
  square: {
    type: "square" as const,
    label: "square",
  },
  /** Triangle (pointing up) — danger/negative series */
  triangle: {
    type: "triangle" as const,
    label: "triangle",
  },
  /** Diamond — tertiary/forecast series */
  diamond: {
    type: "diamond" as const,
    label: "diamond",
  },
} as const

export type ChartMarkerShape = keyof typeof chartMarkerShapes

/**
 * Renders an SVG marker at the given position. Returns JSX-compatible attributes
 * for use inside an <svg> element.
 *
 * @param shape - The marker shape key
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param size - Marker size (radius or half-width), default 4
 * @returns SVG path string for the marker
 */
export function getMarkerPath(shape: ChartMarkerShape, cx: number, cy: number, size = 4): string {
  switch (shape) {
    case "circle":
      // Approximate circle with 4 bezier curves
      const k = size * 0.5523 // control point offset for circle approximation
      return `M ${cx - size},${cy} C ${cx - size},${cy - k} ${cx - k},${cy - size} ${cx},${cy - size} C ${cx + k},${cy - size} ${cx + size},${cy - k} ${cx + size},${cy} C ${cx + size},${cy + k} ${cx + k},${cy + size} ${cx},${cy + size} C ${cx - k},${cy + size} ${cx - size},${cy + k} ${cx - size},${cy} Z`
    case "square":
      return `M ${cx - size},${cy - size} L ${cx + size},${cy - size} L ${cx + size},${cy + size} L ${cx - size},${cy + size} Z`
    case "triangle":
      return `M ${cx},${cy - size} L ${cx + size},${cy + size * 0.7} L ${cx - size},${cy + size * 0.7} Z`
    case "diamond":
      return `M ${cx},${cy - size} L ${cx + size},${cy} L ${cx},${cy + size} L ${cx - size},${cy} Z`
  }
}

/**
 * Maps chart series roles to their visual differentiation tokens (color, pattern, shape).
 * Components use this lookup to ensure every series is distinguishable without color.
 *
 * Requirement 27.6 — color-blind-safe differentiation
 */
export const chartSeriesStyles = {
  /** Primary positive series (savings, growth, income) */
  primary: {
    color: "var(--success)",
    fill: "rgba(74, 222, 128, 0.12)",
    dashPattern: chartLinePatterns.solid,
    marker: "circle" as ChartMarkerShape,
    strokeWidth: 2,
  },
  /** Secondary informational series (projections, cash flow) */
  secondary: {
    color: "rgba(139, 92, 246, 0.8)",
    fill: "rgba(139, 92, 246, 0.10)",
    dashPattern: chartLinePatterns.dashed,
    marker: "square" as ChartMarkerShape,
    strokeWidth: 1.5,
  },
  /** Negative/danger series (overspending, debt, zero-crossing) */
  danger: {
    color: "rgba(239, 68, 68, 0.5)",
    fill: "rgba(239, 68, 68, 0.08)",
    dashPattern: chartLinePatterns.dotted,
    marker: "triangle" as ChartMarkerShape,
    strokeWidth: 1.5,
  },
  /** Typical/baseline reference line */
  baseline: {
    color: "rgba(255, 255, 255, 0.2)",
    fill: "none",
    dashPattern: chartLinePatterns.dashDot,
    marker: "diamond" as ChartMarkerShape,
    strokeWidth: 1,
  },
} as const
