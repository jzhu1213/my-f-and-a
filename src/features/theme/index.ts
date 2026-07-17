/**
 * Feature: Theme System
 *
 * Warm / dark theme management with system preference detection,
 * localStorage persistence, and CSS variable-driven color tokens.
 */

// Context
export { ThemeProvider, useTheme } from '@/contexts/ThemeContext'

// UI primitives driven by the theme
export { GradientMesh } from '@/components/ui/GradientMesh'
export type { GradientMeshVariant, GradientMeshProps } from '@/components/ui/GradientMesh'
export { GlassCard } from '@/components/ui/GlassCard'
export type { GlassCardProps, GlassElevation, GlassGlow } from '@/components/ui/GlassCard'
export { AmbientGlow } from '@/components/ui/AmbientGlow'
export type { AmbientGlowProps, AmbientGlowStatus } from '@/components/ui/AmbientGlow'

// Shared animation config
export { springs, timings, useReducedMotion } from '@/lib/animations'

// Typography tokens
export { typography as typeScale, spacing } from '@/styles/typography'

// Types
export type { ThemeConfiguration, ThemeColors, ThemeTypography, ThemeSpacing } from '@/types/folio'
