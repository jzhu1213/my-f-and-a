// ============================================================================
// Currency Preferences — home-currency choice + per-transaction local currency
// ============================================================================
//
// Task 195.1 — Multi-currency support (Group 28: Internationalization).
//
// Multi-currency is an advanced, opt-in feature that lives behind Tools/Settings
// and never clutters the home screen. It is fully backward-compatible:
//   • No home currency set → treated as USD, exactly the default experience.
//   • No stored per-transaction currency → the transaction is single-currency.
//
// Like tags, the per-transaction currency + captured exchange rate are stored in
// localStorage keyed by transaction id until a dedicated DB column exists, so no
// schema migration is required to ship this additively.

import type { Transaction } from '@/types'
import {
  DEFAULT_HOME_CURRENCY,
  normalizeCode,
  isValidExchangeRate,
} from './currencyUtils'

// ============================================================================
// Keys
// ============================================================================

const HOME_CURRENCY_KEY = 'folio-home-currency'
const TX_CURRENCY_KEY = 'folio-tx-currency'

// ============================================================================
// Home currency preference
// ============================================================================

/**
 * The user's chosen home currency (the currency the daily allowance and all
 * totals are shown in). Defaults to USD when unset — the standard experience.
 */
export function getHomeCurrency(): string {
  if (typeof window === 'undefined') return DEFAULT_HOME_CURRENCY
  try {
    const stored = normalizeCode(localStorage.getItem(HOME_CURRENCY_KEY))
    return stored || DEFAULT_HOME_CURRENCY
  } catch {
    return DEFAULT_HOME_CURRENCY
  }
}

/** Persist the user's home currency. Passing a falsy code resets to default. */
export function setHomeCurrency(code: string | undefined | null): void {
  if (typeof window === 'undefined') return
  try {
    const normalized = normalizeCode(code)
    if (!normalized || normalized === DEFAULT_HOME_CURRENCY) {
      localStorage.removeItem(HOME_CURRENCY_KEY)
    } else {
      localStorage.setItem(HOME_CURRENCY_KEY, normalized)
    }
  } catch {
    // localStorage unavailable — fail silently
  }
}

// ============================================================================
// Per-transaction currency annotation
// ============================================================================

/** The stored foreign-currency annotation for a single transaction. */
export interface TransactionCurrency {
  /** ISO 4217 code of the currency spent. */
  currency: string
  /** Home-currency units per 1 unit of `currency`, captured at log time. */
  exchangeRate: number
}

type TxCurrencyMap = Record<string, TransactionCurrency>

function getTxCurrencyMap(): TxCurrencyMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(TX_CURRENCY_KEY)
    return raw ? (JSON.parse(raw) as TxCurrencyMap) : {}
  } catch {
    return {}
  }
}

function saveTxCurrencyMap(map: TxCurrencyMap): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(TX_CURRENCY_KEY, JSON.stringify(map))
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/** Read the stored currency annotation for a transaction, if any. */
export function getTransactionCurrency(txId: string): TransactionCurrency | undefined {
  return getTxCurrencyMap()[txId]
}

/**
 * Save (or clear) the currency annotation for a transaction. Passing an invalid
 * rate or a falsy currency clears the annotation, restoring single-currency
 * behavior for that transaction.
 */
export function saveTransactionCurrency(
  txId: string,
  currency: string | undefined | null,
  exchangeRate: number | undefined | null
): void {
  const map = getTxCurrencyMap()
  const code = normalizeCode(currency)
  if (!code || !isValidExchangeRate(exchangeRate)) {
    delete map[txId]
  } else {
    map[txId] = { currency: code, exchangeRate: exchangeRate as number }
  }
  saveTxCurrencyMap(map)
}

/**
 * Merge stored currency annotations onto a transactions array (hydration).
 * Never overwrites a currency already present on the transaction object (e.g.
 * from a future DB column). Transactions with no annotation are returned as-is,
 * preserving the default single-currency experience.
 */
export function hydrateTransactionCurrencies(transactions: Transaction[]): Transaction[] {
  const map = getTxCurrencyMap()
  if (Object.keys(map).length === 0) return transactions

  return transactions.map((tx) => {
    if (tx.currency) return tx
    const stored = map[tx.id]
    if (!stored) return tx
    return { ...tx, currency: stored.currency, exchangeRate: stored.exchangeRate }
  })
}
