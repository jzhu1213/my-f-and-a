// ============================================================================
// i18n Core — language resolution, resource registry & the t() helper
// ============================================================================
//
// Task 197.1 — i18n scaffolding (Group 28: Internationalization).
//
// Pure, framework-free translation logic. The React binding lives in
// `contexts/I18nContext.tsx`; everything here is deterministic and testable
// without a component tree, mirroring how `localeFormat`/`localePreferences`
// keep formatting logic out of the UI.

import { getLocale } from '../localePreferences'
import { en } from './locales/en'
import { es } from './locales/es'
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type Language,
  type PartialTranslationResource,
  type TranslationKey,
  type TranslationResource,
  type TranslationValues,
} from './types'

// ============================================================================
// Resource registry
// ============================================================================

/**
 * All loaded translation bundles keyed by language. English is the canonical
 * full resource; every other language is partial and falls back to English.
 */
const RESOURCES: Record<Language, TranslationResource | PartialTranslationResource> = {
  en,
  es,
}

// ============================================================================
// Language resolution
// ============================================================================

/**
 * True when `value` is one of the languages we ship a bundle for.
 */
export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

/**
 * Reduce a BCP-47 locale (or bare language tag) to a supported base language.
 * e.g. "es-MX" → "es", "en-GB" → "en", "fr-FR" → "en" (unsupported → default).
 * Never throws; unknown or malformed input resolves to the default language.
 */
export function resolveLanguage(locale: string | undefined | null): Language {
  if (typeof locale !== 'string' || locale.trim() === '') return DEFAULT_LANGUAGE
  const primary = locale.toLowerCase().split('-')[0]
  return isSupportedLanguage(primary) ? primary : DEFAULT_LANGUAGE
}

/**
 * The active base language derived from the user's stored locale (Task 196.1).
 * With no stored locale this is the default ("en") — the unchanged experience.
 */
export function getActiveLanguage(): Language {
  return resolveLanguage(getLocale())
}

// ============================================================================
// Interpolation
// ============================================================================

/**
 * Substitute `{name}` placeholders in `template` with `values`. Missing values
 * leave the placeholder untouched so gaps are visible rather than silently
 * blank. Values are coerced to strings.
 */
function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name]
    return value === undefined || value === null ? match : String(value)
  })
}

// ============================================================================
// Lookup
// ============================================================================

/**
 * Resolve a translation key for `language`, with graceful fallback:
 *   1. the requested language's string, if present
 *   2. the English string (canonical), if present
 *   3. the raw key, so nothing ever renders blank
 *
 * Placeholders are interpolated with `values`.
 *
 * @param language - The active base language
 * @param key - The translation key (typed against the English bundle)
 * @param values - Optional interpolation values for `{placeholder}` tokens
 */
export function translate(
  language: Language,
  key: TranslationKey,
  values?: TranslationValues
): string {
  const bundle = RESOURCES[language] ?? en
  const template = bundle[key] ?? en[key] ?? key
  return interpolate(template, values)
}

// Re-export the public types and constants for a single import surface.
export {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type Language,
  type TranslationKey,
  type TranslationValues,
  type TranslateFn,
} from './types'
