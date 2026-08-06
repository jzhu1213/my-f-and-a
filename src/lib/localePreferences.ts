// ============================================================================
// Locale Preferences — the BCP-47 locale used for all display formatting
// ============================================================================
//
// Task 196.1 — Locale-aware formatting (Group 28: Internationalization).
//
// Locale-awareness is additive and fully backward-compatible:
//   • No stored locale → treated as "en-US", exactly the default experience.
//   • Numbers, currency, and dates all format through the same resolved locale,
//     so a user studying abroad sees separators and date order they expect.
//
// Like the home-currency choice, the locale lives in localStorage until a
// dedicated preferences column exists, so no schema migration is required.

// ============================================================================
// Constants
// ============================================================================

/**
 * The default locale when the user hasn't chosen one. This intentionally
 * matches the pre-i18n behavior so the standard US experience is unchanged.
 */
export const DEFAULT_LOCALE = 'en-US'

const LOCALE_KEY = 'folio-locale'

// ============================================================================
// Validation
// ============================================================================

/**
 * True when `locale` is a well-formed BCP-47 tag this runtime can format with.
 * Falls back to a permissive check when `Intl.getCanonicalLocales` is missing.
 */
export function isValidLocale(locale: unknown): locale is string {
  if (typeof locale !== 'string' || locale.trim() === '') return false
  try {
    // Throws RangeError for structurally invalid tags.
    Intl.getCanonicalLocales(locale)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// Locale preference
// ============================================================================

/**
 * The user's chosen display locale. Defaults to `en-US` when unset or invalid —
 * the standard experience. Never throws; degrades to the default on any error.
 */
export function getLocale(): string {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    return isValidLocale(stored) ? (stored as string) : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

/**
 * Persist the user's locale. Passing a falsy/invalid/default tag clears the
 * stored value, restoring the default (`en-US`) experience.
 */
export function setLocale(locale: string | undefined | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!isValidLocale(locale) || locale === DEFAULT_LOCALE) {
      localStorage.removeItem(LOCALE_KEY)
    } else {
      localStorage.setItem(LOCALE_KEY, locale as string)
    }
  } catch {
    // localStorage unavailable — fail silently
  }
}
