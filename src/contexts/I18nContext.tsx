"use client"
// ============================================================================
// I18nContext — the React binding for Folio's lightweight i18n layer
// ============================================================================
//
// Task 197.1 — i18n scaffolding (Group 28: Internationalization).
//
// Mirrors the existing lightweight Context pattern (ThemeContext / ToastContext)
// — no new state library, no heavy i18n framework. It reads the active language
// from the locale the user already set in Task 196.1 (`localePreferences`) and
// exposes a typed `t()` helper plus a `setLanguage` that updates that same
// stored locale, so language and formatting stay in sync from one source.
//
// Default experience is unchanged: with no stored locale the language is "en"
// and every string renders its English copy, exactly as before.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getLocale, setLocale, DEFAULT_LOCALE } from '../lib/localePreferences'
import {
  DEFAULT_LANGUAGE,
  getActiveLanguage,
  translate,
  type Language,
  type TranslateFn,
} from '../lib/i18n'
import { getDirection, isRTL as checkRTL, type Direction } from '../lib/rtl'

interface I18nContextType {
  /** The active base language ("en" | "es"), derived from the stored locale. */
  language: Language
  /** Switch language; persists by updating the shared locale preference. */
  setLanguage: (language: Language) => void
  /** Translate a key (with optional `{placeholder}` values), English fallback. */
  t: TranslateFn
  /** The layout direction ('ltr' | 'rtl') derived from the active locale. */
  direction: Direction
  /** True when the active locale is a right-to-left language. */
  isRTL: boolean
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

/**
 * Apply a language choice to the shared locale preference, preserving the
 * region subtag when one exists (e.g. active "en-GB" + "es" → "es-GB").
 * Choosing the default language restores the default locale, keeping the
 * standard experience byte-for-byte unchanged.
 */
function persistLanguage(language: Language): void {
  if (language === DEFAULT_LANGUAGE) {
    // Restore the default locale (clears any stored override).
    setLocale(DEFAULT_LOCALE)
    return
  }
  const current = getLocale()
  const parts = current.split('-')
  parts[0] = language
  setLocale(parts.join('-'))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads the stored locale. This provider renders inside
  // ThemeProvider, which gates the subtree until mount, so on the client this
  // resolves to the user's real language on first paint (no flash).
  const [language, setLanguageState] = useState<Language>(() =>
    typeof window === 'undefined' ? DEFAULT_LANGUAGE : getActiveLanguage()
  )

  const setLanguage = useCallback((next: Language) => {
    persistLanguage(next)
    setLanguageState(next)
  }, [])

  const t = useCallback<TranslateFn>(
    (key, values) => translate(language, key, values),
    [language]
  )

  // Compute direction from the full stored locale (not just the base language).
  const locale = typeof window === 'undefined' ? DEFAULT_LOCALE : getLocale()
  const direction = getDirection(locale)
  const rtl = checkRTL(locale)

  // Sync <html> dir and lang attributes whenever language/direction changes.
  useEffect(() => {
    const html = document.documentElement
    html.setAttribute('dir', direction)
    html.setAttribute('lang', locale)
  }, [direction, locale])

  const value = useMemo<I18nContextType>(
    () => ({ language, setLanguage, t, direction, isRTL: rtl }),
    [language, setLanguage, t, direction, rtl]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/**
 * Access the i18n API (language, setLanguage, t). Must be used within an
 * I18nProvider.
 */
export function useI18n(): I18nContextType {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

/**
 * Convenience hook for components that only need the translate function.
 */
export function useTranslation(): TranslateFn {
  return useI18n().t
}

/**
 * Convenience hook for components that need layout direction information.
 * Returns the direction ('ltr' | 'rtl') and a boolean isRTL flag.
 */
export function useDirection(): { direction: Direction; isRTL: boolean } {
  const { direction, isRTL } = useI18n()
  return { direction, isRTL }
}
