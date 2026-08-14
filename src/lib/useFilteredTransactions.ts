/**
 * useFilteredTransactions — high-performance memoized transaction filtering hook.
 *
 * Optimizations over the original inline `applyHistoryFilters`:
 * 1. Precomputes date range bounds and amount bounds ONCE per filter change,
 *    not per transaction iteration.
 * 2. Uses a Set for category lookups (O(1) vs O(n) with .includes()).
 * 3. Granular useMemo dependencies — recomputes only when actual filter values change.
 * 4. Development-mode performance guard logs when filtering exceeds 50ms.
 *
 * Requirements: 22.6
 */

import { useMemo } from "react"
import type { Transaction, TransactionCategory } from "@/types"
import type { HistoryFilters, DateRangePreset, CustomDateRange, AmountRangePreset, CustomAmountRange } from "@/components/simplified/HistoryFilterChips"
import type { SearchResult } from "@/lib/transactionSearch"

// ============================================================================
// Precomputation helpers (exported for testing)
// ============================================================================

export function computeDateBounds(
  preset: DateRangePreset,
  custom: CustomDateRange | null
): { start: string | null; end: string | null } | null {
  if (!preset) return null
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  switch (preset) {
    case "today":
      return { start: todayStr, end: todayStr }
    case "this_week": {
      const start = new Date(now)
      const day = start.getDay()
      start.setDate(start.getDate() - ((day + 6) % 7)) // Monday
      return { start: start.toISOString().slice(0, 10), end: todayStr }
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: start.toISOString().slice(0, 10), end: todayStr }
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
    }
    case "custom":
      if (custom) return { start: custom.start || null, end: custom.end || null }
      return null
    default:
      return null
  }
}

export function computeAmountBounds(
  preset: AmountRangePreset,
  custom: CustomAmountRange | null
): { min: number | null; max: number | null } | null {
  if (!preset) return null

  switch (preset) {
    case "under_10":
      return { min: null, max: 10 }
    case "10_50":
      return { min: 10, max: 50 }
    case "50_100":
      return { min: 50, max: 100 }
    case "over_100":
      return { min: 100, max: null }
    case "custom":
      if (custom) return { min: custom.min, max: custom.max }
      return null
    default:
      return null
  }
}

// ============================================================================
// Optimized filter function (exported for testing/benchmarking)
// ============================================================================

export interface PrecomputedFilterParams {
  categorySet: Set<TransactionCategory> | null
  typeFilter: HistoryFilters["type"]
  dateBounds: { start: string | null; end: string | null } | null
  amountBounds: { min: number | null; max: number | null } | null
}

/**
 * Apply filters using precomputed bounds. This avoids recomputing date/amount
 * bounds on every transaction and uses Set.has() for O(1) category lookups.
 */
export function applyOptimizedFilters(
  transactions: Transaction[],
  params: PrecomputedFilterParams
): Transaction[] {
  const { categorySet, typeFilter, dateBounds, amountBounds } = params

  // Fast path: no filters active
  if (!categorySet && typeFilter === "all" && !dateBounds && !amountBounds) {
    return transactions
  }

  return transactions.filter((tx) => {
    // Category filter — O(1) Set lookup
    if (categorySet && !categorySet.has(tx.category)) {
      return false
    }

    // Type filter
    if (typeFilter !== "all") {
      if (typeFilter === "expenses" && tx.type !== "expense") return false
      if (typeFilter === "income" && tx.type !== "income") return false
      if (typeFilter === "refunds") {
        const isRefund = tx.type === "income" && tx.category !== "income"
        if (!isRefund) return false
      }
    }

    // Date range filter — bounds precomputed outside loop
    if (dateBounds) {
      if (dateBounds.start && tx.date < dateBounds.start) return false
      if (dateBounds.end && tx.date > dateBounds.end) return false
    }

    // Amount range filter — bounds precomputed outside loop
    if (amountBounds) {
      if (amountBounds.min !== null && tx.amount < amountBounds.min) return false
      if (amountBounds.max !== null && tx.amount > amountBounds.max) return false
    }

    return true
  })
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Memoized, optimized transaction filtering hook.
 *
 * Uses granular dependencies so filter recomputation only triggers when
 * individual filter values actually change, not when the filter object
 * reference changes.
 */
export function useFilteredTransactions(
  transactions: Transaction[],
  searchResults: SearchResult[] | null,
  filters: HistoryFilters
): Transaction[] {
  // Destructure for granular dependency tracking
  const { categories, dateRange, customDateRange, amountRange, customAmountRange, type } = filters

  // Precompute category Set — only when categories array changes
  const categorySet = useMemo<Set<TransactionCategory> | null>(() => {
    if (categories.length === 0) return null
    return new Set(categories)
  }, [categories])

  // Precompute date bounds — only when date range settings change
  const dateBounds = useMemo(() => {
    return computeDateBounds(dateRange, customDateRange)
  }, [dateRange, customDateRange])

  // Precompute amount bounds — only when amount range settings change
  const amountBounds = useMemo(() => {
    return computeAmountBounds(amountRange, customAmountRange)
  }, [amountRange, customAmountRange])

  // Main filtered result — recomputes only when actual inputs change
  const filteredTransactions = useMemo(() => {
    const baseList = searchResults
      ? searchResults.map(r => r.transaction)
      : transactions

    const params: PrecomputedFilterParams = {
      categorySet,
      typeFilter: type,
      dateBounds,
      amountBounds,
    }

    // Performance measurement in development
    if (process.env.NODE_ENV === "development") {
      const start = performance.now()
      const result = applyOptimizedFilters(baseList, params)
      const elapsed = performance.now() - start
      if (elapsed > 50) {
        console.warn(
          `[useFilteredTransactions] Filtering ${baseList.length} transactions took ${elapsed.toFixed(1)}ms (exceeds 50ms budget)`
        )
      }
      return result
    }

    return applyOptimizedFilters(baseList, params)
  }, [transactions, searchResults, categorySet, type, dateBounds, amountBounds])

  return filteredTransactions
}
