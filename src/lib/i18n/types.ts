// ============================================================================
// i18n Types — the shape of the translation layer
// ============================================================================
//
// Task 197.1 — i18n scaffolding (Group 28: Internationalization).
//
// This is a lightweight, in-house string-extraction layer. It intentionally
// avoids pulling in a heavy i18n framework — Folio's steering rules say not to
// introduce new state libraries or architectural patterns, so we mirror the
// existing lightweight Context pattern (ThemeContext / ToastContext) and the
// locale plumbing already established by Task 196.1 (`localePreferences`).
//
// Design:
//   • English ("en") is the canonical resource and the single source of truth
//     for the set of translation keys. Its keys drive `TranslationKey`, so any
//     new UI string is added to English first and the compiler tracks it.
//   • Other languages ("es") are typed as a *partial* map of the same keys, so
//     a translation can ship incrementally and any missing key falls back to
//     English gracefully — the default single-language experience never breaks.

import type { en } from './locales/en'

// ============================================================================
// Language identity
// ============================================================================

/**
 * The set of base languages Folio ships translations for. This is the primary
 * subtag of a BCP-47 locale (e.g. "en-US" → "en", "es-MX" → "es"). Kept small
 * and explicit; extend by adding a resource file and a member here.
 */
export type Language = 'en' | 'es'

/** The default language when none is chosen or a locale is unrecognized. */
export const DEFAULT_LANGUAGE: Language = 'en'

/** All languages that currently have a resource bundle, default first. */
export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'es'] as const

// ============================================================================
// Translation keys & resources
// ============================================================================

/**
 * Every translatable string key. Derived from the English bundle so English is
 * the authoritative list — a missing English key is a compile error, and every
 * other language is checked against exactly this set.
 */
export type TranslationKey = keyof typeof en

/**
 * A full resource bundle: every key present. Only the canonical language (en)
 * is required to satisfy this shape.
 */
export type TranslationResource = Record<TranslationKey, string>

/**
 * A partial resource bundle for non-default languages. Any key omitted here
 * falls back to English at lookup time, so translations can ship incrementally
 * without ever showing an empty string.
 */
export type PartialTranslationResource = Partial<Record<TranslationKey, string>>

/**
 * Values interpolated into a translated string. Placeholders in the copy use
 * `{name}` syntax, e.g. "Nice! You've got {amount} left today." Values are
 * coerced to strings at substitution time.
 */
export type TranslationValues = Record<string, string | number>

/**
 * The translation function exposed to components: look up `key` for the active
 * language, interpolate any `{placeholder}` values, and fall back to English
 * (then to the raw key) when a translation is missing.
 */
export type TranslateFn = (key: TranslationKey, values?: TranslationValues) => string
