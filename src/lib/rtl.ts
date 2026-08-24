// ============================================================================
// RTL — direction detection for right-to-left locales
// ============================================================================
//
// Task 458.1 — RTL layout support (Group 27: Internationalization).
//
// Provides utility functions to determine text direction from a BCP-47 locale.
// RTL languages include Arabic, Hebrew, Farsi/Persian, Urdu, and others whose
// primary script flows right-to-left.
//
// Requirements: 27.5

import type { CSSProperties } from 'react'

/**
 * BCP-47 primary language subtags whose default script is RTL.
 * This covers the most common RTL languages; extend as needed.
 */
const RTL_LANGUAGES: ReadonlySet<string> = new Set([
  'ar',  // Arabic
  'he',  // Hebrew
  'fa',  // Farsi / Persian
  'ur',  // Urdu
  'ps',  // Pashto
  'yi',  // Yiddish
  'sd',  // Sindhi
  'ug',  // Uyghur
  'dv',  // Divehi / Maldivian
  'ku',  // Kurdish (Sorani)
  'ckb', // Central Kurdish
])

/** Layout direction type. */
export type Direction = 'ltr' | 'rtl'

/**
 * Determine whether a BCP-47 locale represents a right-to-left language.
 *
 * Extracts the primary language subtag (e.g. "ar" from "ar-SA") and checks
 * it against known RTL languages. Unknown or malformed input returns false
 * (LTR assumed), keeping the default experience unchanged.
 */
export function isRTL(locale: string | undefined | null): boolean {
  if (typeof locale !== 'string' || locale.trim() === '') return false
  const primary = locale.toLowerCase().split('-')[0]
  return RTL_LANGUAGES.has(primary)
}

/**
 * Get the layout direction for a BCP-47 locale.
 *
 * Returns `'rtl'` for Arabic, Hebrew, Farsi, Urdu, etc.
 * Returns `'ltr'` for everything else (including unknown/invalid input).
 */
export function getDirection(locale: string | undefined | null): Direction {
  return isRTL(locale) ? 'rtl' : 'ltr'
}

/**
 * All known RTL language subtags, exposed for testing or locale pickers.
 */
export const RTL_LANGUAGE_CODES: readonly string[] = [...RTL_LANGUAGES]

// ============================================================================
// RTL-Aware CSS Helpers
// ============================================================================

/**
 * Convert directional CSS properties to logical equivalents.
 *
 * In components using inline styles, use this to produce RTL-safe styles:
 * - `marginLeft` → `marginInlineStart`
 * - `marginRight` → `marginInlineEnd`
 * - `paddingLeft` → `paddingInlineStart`
 * - `paddingRight` → `paddingInlineEnd`
 * - `left` (positioned) → `insetInlineStart`
 * - `right` (positioned) → `insetInlineEnd`
 * - `borderLeft` → `borderInlineStart`
 * - `borderRight` → `borderInlineEnd`
 * - `textAlign: 'left'` → `textAlign: 'start'`
 * - `textAlign: 'right'` → `textAlign: 'end'`
 *
 * This is opt-in: components that use logical properties directly don't need it.
 */
export function logicalStyle(style: CSSProperties): CSSProperties {
  const result = { ...style }

  // Text alignment
  if (result.textAlign === 'left') {
    result.textAlign = 'start' as CSSProperties['textAlign']
  } else if (result.textAlign === 'right') {
    result.textAlign = 'end' as CSSProperties['textAlign']
  }

  // Margin inline
  if ('marginLeft' in result && result.marginLeft !== 'auto') {
    (result as Record<string, unknown>).marginInlineStart = result.marginLeft
    delete result.marginLeft
  }
  if ('marginRight' in result && result.marginRight !== 'auto') {
    (result as Record<string, unknown>).marginInlineEnd = result.marginRight
    delete result.marginRight
  }

  // Padding inline
  if ('paddingLeft' in result) {
    (result as Record<string, unknown>).paddingInlineStart = result.paddingLeft
    delete result.paddingLeft
  }
  if ('paddingRight' in result) {
    (result as Record<string, unknown>).paddingInlineEnd = result.paddingRight
    delete result.paddingRight
  }

  // Position inset
  if ('left' in result) {
    (result as Record<string, unknown>).insetInlineStart = result.left
    delete result.left
  }
  if ('right' in result) {
    (result as Record<string, unknown>).insetInlineEnd = result.right
    delete result.right
  }

  // Border inline
  if ('borderLeft' in result) {
    (result as Record<string, unknown>).borderInlineStart = result.borderLeft
    delete result.borderLeft
  }
  if ('borderRight' in result) {
    (result as Record<string, unknown>).borderInlineEnd = result.borderRight
    delete result.borderRight
  }

  return result
}
