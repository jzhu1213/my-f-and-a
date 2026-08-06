// ============================================================================
// Locale-aware Formatting — single entry point for numbers, currency & dates
// ============================================================================
//
// Task 196.1 — Locale-aware formatting (Group 28: Internationalization).
//
// This module is the thin locale-resolving layer that the UI should route all
// display formatting through. It resolves the user's chosen locale once (via
// `localePreferences`) and delegates to the pure, deterministic helpers:
//   • numbers  → Intl.NumberFormat
//   • currency → currencyUtils.formatCurrency (Task 195)
//   • dates    → dateUtils.formatLocalizedDate / getRelativeDate (Task 94.1)
//
// Backward compatibility: with no stored locale the resolved locale is "en-US"
// and, with no currency argument, amounts format as USD — i.e. the exact
// default single-currency US experience, unchanged.

import {
  formatCurrency,
  DEFAULT_HOME_CURRENCY,
  type FormatCurrencyOptions,
} from './currencyUtils'
import { formatLocalizedDate, getRelativeDate } from './dateUtils'
import { getLocale, DEFAULT_LOCALE } from './localePreferences'

// ============================================================================
// Numbers
// ============================================================================

/**
 * Format a plain number for the user's locale (grouping + decimal separators).
 * e.g. in "en-US" → "1,234.5", in "de-DE" → "1.234,5".
 *
 * @param value - The number to format (non-finite values coerce to 0)
 * @param options - Intl.NumberFormat options
 * @param locale - Override the resolved locale (defaults to the user's locale)
 */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale: string = getLocale()
): string {
  const safe = Number.isFinite(value) ? value : 0
  try {
    return new Intl.NumberFormat(locale || DEFAULT_LOCALE, options).format(safe)
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(safe)
  }
}

// ============================================================================
// Currency
// ============================================================================

/**
 * Locale-aware currency formatting. Resolves the user's locale automatically so
 * separators match their locale, while the currency argument controls the
 * symbol/decimals. Defaults to the user's home-currency default (USD) so the
 * single-currency experience is unchanged.
 *
 * @param amount - The amount to format
 * @param code - ISO 4217 code (defaults to the home-currency default, USD)
 * @param options - formatCurrency options (locale here defaults to user locale)
 */
export function formatMoney(
  amount: number,
  code: string | undefined | null = DEFAULT_HOME_CURRENCY,
  options: FormatCurrencyOptions = {}
): string {
  return formatCurrency(amount, code, {
    locale: getLocale(),
    ...options,
  })
}

// ============================================================================
// Dates
// ============================================================================

/**
 * Locale-aware date formatting. Delegates to the canonical dateUtils helper
 * using the user's resolved locale.
 *
 * @param date - A Date object or YYYY-MM-DD string
 * @param options - Intl.DateTimeFormat options (defaults to a short "Jun 15")
 * @param locale - Override the resolved locale (defaults to the user's locale)
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
  locale: string = getLocale()
): string {
  return formatLocalizedDate(date, options, locale)
}

/**
 * Locale-aware relative date label ("Today" / "Yesterday" / a short date),
 * using the user's resolved locale for the fallback short date.
 *
 * @param dateStr - YYYY-MM-DD string
 * @param locale - Override the resolved locale (defaults to the user's locale)
 */
export function formatRelativeDate(
  dateStr: string,
  locale: string = getLocale()
): string {
  return getRelativeDate(dateStr, locale)
}
