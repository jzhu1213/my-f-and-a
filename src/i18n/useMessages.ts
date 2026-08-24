// ============================================================================
// useMessages — Lightweight hook for accessing the i18n message catalog
// ============================================================================
//
// Task 514.2 — String extraction (Phase 23: Simplification).
//
// Provides a `t(key, vars?)` function that resolves dot-notation keys from
// the message catalog. This is a thin convenience wrapper around the existing
// i18n infrastructure (`src/lib/i18n` + `src/contexts/I18nContext`).
//
// Usage:
//   const t = useMessages()
//   t('home.hero.estimated')            → "Estimated"
//   t('home.spent', { amount: 42 })     → "You've spent $42 today"
//   t('plural.days', { count: 5 })      → "5 days"
//
// The hook re-exports `useTranslation()` from I18nContext — components that
// already import from there continue to work unchanged. New code can import
// from either location.

import { useTranslation } from '@/contexts/I18nContext'
import type { TranslateFn } from '@/lib/i18n'

/**
 * Access the translate function for the active locale.
 *
 * Supports:
 * - Dot-notation keys: `t('home.hero.title')`
 * - Interpolation: `t('home.spent', { amount: 42 })` with `{amount}` placeholders
 * - ICU-style plurals: `t('plural.days', { count: 5 })` → "5 days"
 * - Fallback: returns the key itself if not found (for development)
 */
export function useMessages(): TranslateFn {
  return useTranslation()
}

export type { TranslateFn }
