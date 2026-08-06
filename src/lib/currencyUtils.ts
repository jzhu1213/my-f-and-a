// ============================================================================
// Currency Utilities — log in a local currency, view in your home currency
// ============================================================================
//
// Task 195.1 — Multi-currency support (Group 28: Internationalization).
//
// Serves international students and study-abroad terms. This module is a PURE,
// deterministic helper: it performs conversion and formatting only, and never
// makes a network call. Exchange rates are captured once at log time and stored
// on the transaction (`Transaction.exchangeRate`), so display is always offline.
//
// Design contract (keeps the default single-currency experience unchanged):
//   • `Transaction.amount` is ALWAYS in the user's home currency. Every existing
//     daily-allowance / budget / rollover calculation therefore works untouched.
//   • `Transaction.currency` is the OPTIONAL local currency the user spent in.
//   • `Transaction.exchangeRate` is home-currency units per 1 unit of `currency`.
//   • The original local amount is derived for display only: amount / rate.
//
// A transaction with no `currency` (or one matching the home currency) is a
// plain single-currency transaction and formats exactly as before.

import type { Transaction } from '@/types'

// ============================================================================
// Types
// ============================================================================

/** A supported currency for logging and display (ISO 4217). */
export interface Currency {
  /** ISO 4217 code, e.g. "USD", "THB". */
  code: string
  /** Display symbol, e.g. "$", "฿". */
  symbol: string
  /** Friendly name, e.g. "US Dollar". */
  name: string
  /** Typical number of decimal digits (0 for JPY/KRW, 2 for most). */
  decimalDigits: number
}

/**
 * The fully-resolved view of a possibly-foreign transaction amount: both the
 * local (spent) value and the home-currency value, plus the rate used.
 */
export interface CurrencyConversion {
  /** Amount in the transaction's local currency (what the user spent). */
  localAmount: number
  /** ISO code of the local currency. */
  localCurrency: string
  /** Amount in the user's home currency (the canonical `Transaction.amount`). */
  homeAmount: number
  /** ISO code of the home currency. */
  homeCurrency: string
  /** Home-currency units per 1 unit of the local currency. */
  exchangeRate: number
  /** True when the local currency differs from the home currency. */
  isForeign: boolean
}

// ============================================================================
// Constants
// ============================================================================

/** The default home currency when the user hasn't chosen one. */
export const DEFAULT_HOME_CURRENCY = 'USD'

/**
 * Curated list of currencies most relevant to college students and common
 * study-abroad destinations. Not exhaustive — formatting still works for any
 * valid ISO code via `Intl.NumberFormat`.
 */
export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', decimalDigits: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', decimalDigits: 2 },
  { code: 'GBP', symbol: '£', name: 'British Pound', decimalDigits: 2 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimalDigits: 0 },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', decimalDigits: 2 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimalDigits: 2 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimalDigits: 2 },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', decimalDigits: 2 },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', decimalDigits: 0 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimalDigits: 2 },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', decimalDigits: 2 },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', decimalDigits: 2 },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', decimalDigits: 2 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', decimalDigits: 2 },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', decimalDigits: 2 },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', decimalDigits: 2 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', decimalDigits: 2 },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', decimalDigits: 2 },
]

const CURRENCY_BY_CODE: Record<string, Currency> = CURRENCIES.reduce(
  (acc, c) => {
    acc[c.code] = c
    return acc
  },
  {} as Record<string, Currency>
)

// ============================================================================
// Lookups
// ============================================================================

/** Normalize a currency code to uppercase, trimmed. */
export function normalizeCode(code: string | undefined | null): string {
  return (code ?? '').trim().toUpperCase()
}

/** Returns the known `Currency` for a code, or `undefined` if not curated. */
export function getCurrency(code: string | undefined | null): Currency | undefined {
  return CURRENCY_BY_CODE[normalizeCode(code)]
}

/** Returns the display symbol for a code, falling back to the code itself. */
export function getCurrencySymbol(code: string | undefined | null): string {
  const c = getCurrency(code)
  return c ? c.symbol : normalizeCode(code)
}

/** True when a code is one Folio has curated metadata for. */
export function isSupportedCurrency(code: string | undefined | null): boolean {
  return getCurrency(code) !== undefined
}

// ============================================================================
// Validation
// ============================================================================

/** A valid exchange rate is a finite, strictly positive number. */
export function isValidExchangeRate(rate: unknown): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0
}

// ============================================================================
// Conversion (pure)
// ============================================================================

/**
 * Convert a local amount to the home currency using a stored rate.
 * `rate` is home-currency units per 1 unit of the local currency.
 */
export function convertToHome(localAmount: number, rate: number): number {
  if (!isValidExchangeRate(rate)) return localAmount
  return localAmount * rate
}

/**
 * Convert a home-currency amount back to the local currency using a stored rate.
 * Inverse of `convertToHome`. Returns the input unchanged for an invalid rate.
 */
export function convertToLocal(homeAmount: number, rate: number): number {
  if (!isValidExchangeRate(rate)) return homeAmount
  return homeAmount / rate
}

/**
 * True when a transaction carries a usable foreign-currency annotation relative
 * to the given home currency. Backward-compatible: a transaction with no
 * `currency`/`exchangeRate`, or one whose currency matches home, is NOT foreign.
 */
export function isForeignTransaction(
  tx: Pick<Transaction, 'currency' | 'exchangeRate'>,
  homeCurrency: string = DEFAULT_HOME_CURRENCY
): boolean {
  const code = normalizeCode(tx.currency)
  if (!code) return false
  if (code === normalizeCode(homeCurrency)) return false
  return isValidExchangeRate(tx.exchangeRate)
}

/**
 * Resolve a transaction's amount into a full `CurrencyConversion`.
 *
 * `Transaction.amount` is the canonical home-currency value, so the local
 * amount is derived as `amount / exchangeRate`. For a non-foreign transaction
 * the local and home amounts are identical.
 */
export function resolveTransactionAmount(
  tx: Pick<Transaction, 'amount' | 'currency' | 'exchangeRate'>,
  homeCurrency: string = DEFAULT_HOME_CURRENCY
): CurrencyConversion {
  const home = normalizeCode(homeCurrency) || DEFAULT_HOME_CURRENCY
  if (!isForeignTransaction(tx, home)) {
    return {
      localAmount: tx.amount,
      localCurrency: home,
      homeAmount: tx.amount,
      homeCurrency: home,
      exchangeRate: 1,
      isForeign: false,
    }
  }
  const rate = tx.exchangeRate as number
  return {
    localAmount: convertToLocal(tx.amount, rate),
    localCurrency: normalizeCode(tx.currency),
    homeAmount: tx.amount,
    homeCurrency: home,
    exchangeRate: rate,
    isForeign: true,
  }
}

// ============================================================================
// Formatting (pure, deterministic)
// ============================================================================

/** Options for {@link formatCurrency}. */
export interface FormatCurrencyOptions {
  /** BCP-47 locale for grouping/decimal separators. Defaults to "en-US". */
  locale?: string
  /** Override the number of fraction digits (defaults to the currency's own). */
  fractionDigits?: number
}

/**
 * Format an amount in a given currency, e.g. `formatCurrency(14, 'USD')` →
 * "$14.00". Uses `Intl.NumberFormat` when possible and degrades gracefully to a
 * symbol + fixed-decimal string for any code Intl can't render.
 */
export function formatCurrency(
  amount: number,
  code: string | undefined | null = DEFAULT_HOME_CURRENCY,
  options: FormatCurrencyOptions = {}
): string {
  const currencyCode = normalizeCode(code) || DEFAULT_HOME_CURRENCY
  const locale = options.locale ?? 'en-US'
  const meta = getCurrency(currencyCode)
  const digits =
    options.fractionDigits ?? (meta ? meta.decimalDigits : 2)
  const safeAmount = Number.isFinite(amount) ? amount : 0

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(safeAmount)
  } catch {
    // Unknown ISO code for this runtime — fall back to symbol + fixed decimals.
    const symbol = getCurrencySymbol(currencyCode)
    const fixed = safeAmount.toFixed(digits)
    return symbol ? `${symbol}${fixed}` : `${fixed} ${currencyCode}`
  }
}

/**
 * Format a resolved conversion for display. Returns the home-currency string
 * plus, for foreign transactions, the original local-currency string.
 */
export interface FormattedConversion {
  /** Home-currency string, e.g. "$14.00". */
  home: string
  /** Local-currency string for foreign transactions, e.g. "฿500.00". */
  local?: string
  /** Whether the transaction was in a foreign currency. */
  isForeign: boolean
}

/**
 * Produce both display strings for a transaction amount. For single-currency
 * transactions `local` is omitted and `home` matches existing formatting.
 */
export function formatTransactionAmount(
  tx: Pick<Transaction, 'amount' | 'currency' | 'exchangeRate'>,
  homeCurrency: string = DEFAULT_HOME_CURRENCY,
  options: FormatCurrencyOptions = {}
): FormattedConversion {
  const conv = resolveTransactionAmount(tx, homeCurrency)
  const home = formatCurrency(conv.homeAmount, conv.homeCurrency, options)
  if (!conv.isForeign) {
    return { home, isForeign: false }
  }
  return {
    home,
    local: formatCurrency(conv.localAmount, conv.localCurrency, options),
    isForeign: true,
  }
}

/**
 * A warm, shame-free one-liner describing a foreign amount, e.g.
 * "฿500.00 · about $14.00". For non-foreign transactions returns just the
 * home-currency string.
 */
export function describeConversion(
  tx: Pick<Transaction, 'amount' | 'currency' | 'exchangeRate'>,
  homeCurrency: string = DEFAULT_HOME_CURRENCY,
  options: FormatCurrencyOptions = {}
): string {
  const parts = formatTransactionAmount(tx, homeCurrency, options)
  if (!parts.isForeign || !parts.local) return parts.home
  return `${parts.local} · about ${parts.home}`
}
