// ============================================================================
// i18n — barrel export for the message catalog and hook
// ============================================================================
//
// Task 514.1/514.2 — String extraction (Phase 23: Simplification).
//
// This module provides the public API for Folio's i18n layer:
//   - `useMessages()` — React hook returning the `t()` translate function
//   - `TranslateFn` — TypeScript type for the translate function signature
//
// The underlying infrastructure lives in `src/lib/i18n` (pure logic) and
// `src/contexts/I18nContext` (React binding). This barrel re-exports the
// convenience hook so new code has a single, discoverable import path.

export { useMessages, type TranslateFn } from './useMessages'
