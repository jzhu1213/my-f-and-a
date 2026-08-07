/**
 * UI Component Library — Barrel Export
 *
 * Re-exports all 19 primitives and all composed components for convenient
 * consumption across the app. Also re-exports legacy components that are
 * still referenced during migration.
 *
 * Usage:
 * ```ts
 * import { Button, Card, NavigationDock } from '@/components/ui'
 * ```
 */

// ============================================================================
// Primitives (19 consolidated single-responsibility components)
// ============================================================================

export {
  Button,
  IconButton,
  Chip,
  Input,
  NumericInput,
  Select,
  Toggle,
  SegmentedControl,
  Card,
  ListRow,
  SectionHeader,
  Sheet,
  OverlayScreen,
  EmptyState,
  ErrorState,
  Skeleton,
  Badge,
  ProgressRing,
  ChartFrame,
} from './primitives'

export type {
  ButtonProps,
  ButtonVariant,
  ButtonSize,
  IconButtonProps,
  IconButtonVariant,
  IconButtonSize,
  ChipProps,
  ChipVariant,
  InputProps,
  InputVariant,
  NumericInputProps,
  NumericInputSize,
  SelectProps,
  SelectOption,
  ToggleProps,
  SegmentedControlProps,
  CardProps,
  CardElevation,
  ListRowProps,
  ListRowVariant,
  SectionHeaderProps,
  SheetProps,
  SheetSize,
  OverlayScreenProps,
  EmptyStateProps,
  ErrorStateProps,
  SkeletonProps,
  SkeletonVariant,
  BadgeProps,
  BadgeVariant,
  ProgressRingProps,
  ProgressRingSize,
  ProgressRingState,
  ChartFrameProps,
  ChartFrameType,
  ChartFrameState,
} from './primitives'

// ============================================================================
// Composed components (multi-primitive compositions)
// ============================================================================

export {
  NavigationDock,
  QuickLogControl,
  AllowanceHero,
  TransactionRow,
  CategoryChipRow,
} from './composed'

export type {
  NavigationDockProps,
  DockDestination,
  QuickLogControlProps,
  AllowanceHeroProps,
  TransactionRowProps,
  CategoryChipRowProps,
  CategoryChipItem,
} from './composed'

// ============================================================================
// Legacy components (retained during migration)
// ============================================================================

export { BottomSheet } from './BottomSheet'
export type { BottomSheetProps } from './BottomSheet'

export { Toast } from './Toast'

export { GradientMesh } from './GradientMesh'
export type { GradientMeshVariant, GradientMeshProps } from './GradientMesh'

export {
  Skeleton as LegacySkeleton,
  SkeletonCircle,
  SkeletonText,
  SkeletonCard,
  FadeInContent,
  LogoPulse,
  HomeScreenSkeleton,
} from './Skeleton'
export type {
  SkeletonProps as LegacySkeletonProps,
  SkeletonCircleProps,
  SkeletonTextProps,
  SkeletonCardProps,
  FadeInContentProps,
  LogoPulseProps,
  HomeScreenSkeletonProps,
} from './Skeleton'

export { GlassCard } from './GlassCard'
export type {
  GlassCardProps,
  GlassElevation,
  GlassGlow,
  GlowPreset,
  GlowColor,
} from './GlassCard'

export { Card as LegacyCard } from './Card'
export type { CardProps as LegacyCardProps } from './Card'

export { AppShell } from './AppShell'
export type { AppShellProps, AppNavKey } from './AppShell'

export { Icon } from './Icon'
export type { IconProps } from './Icon'

export { AmbientGlow } from './AmbientGlow'
export type {
  AmbientGlowProps,
  AmbientGlowStatus,
  AmbientGlowSize,
  AmbientGlowIntensity,
  AmbientGlowPosition,
} from './AmbientGlow'

export { ParallaxMesh, CondensingHeader, TopEdgeBlur, MomentumScroll } from './ScrollAware'
export type {
  ParallaxMeshProps,
  CondensingHeaderProps,
  TopEdgeBlurProps,
  MomentumScrollProps,
} from './ScrollAware'

export { ManagedListScreen } from './ManagedListScreen'
export type {
  ManagedListScreenProps,
  ManagedItem,
  ItemRenderContext,
} from './ManagedListScreen'

export { SettingsToggle } from './SettingsToggle'
export type { SettingsToggleProps } from './SettingsToggle'

export { SettingsRow } from './SettingsRow'
export type { SettingsRowProps } from './SettingsRow'
