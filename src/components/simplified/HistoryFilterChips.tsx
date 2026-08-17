"use client"

/**
 * HistoryFilterChips — enhanced filter chip system for the History screen.
 *
 * Renders horizontally scrollable chip bars for:
 * 1. Category filter (multi-select, OR logic)
 * 2. Date range filter (presets + custom date picker)
 * 3. Amount range filter (presets + custom range)
 * 4. Type filter (All / Expenses / Income / Refunds)
 *
 * Plus an active filter summary bar showing what's applied with result count
 * and a "Clear all" button.
 *
 * Requirements: 22.2
 */

import { useState, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TRANSACTION_CATEGORIES } from "@/types"
import type { TransactionCategory, Transaction } from "@/types"
import { FONT_FAMILY } from "@/styles/typography"
import { springs } from "@/lib/animations"
import { getHomeCurrency } from "@/lib/currencyPreferences"
import { getCurrencySymbol, normalizeCode } from "@/lib/currencyUtils"

// ============================================================================
// Types
// ============================================================================

export type DateRangePreset = "today" | "this_week" | "this_month" | "last_month" | "custom" | null

export interface CustomDateRange {
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
}

export type AmountRangePreset = "under_10" | "10_50" | "50_100" | "over_100" | "custom" | null

export interface CustomAmountRange {
  min: number | null
  max: number | null
}

export type TypeFilter = "all" | "expenses" | "income" | "refunds"

export interface HistoryFilters {
  categories: TransactionCategory[]
  dateRange: DateRangePreset
  customDateRange: CustomDateRange | null
  amountRange: AmountRangePreset
  customAmountRange: CustomAmountRange | null
  type: TypeFilter
  /** Filter to a specific currency code, or null for no filter (show all) */
  currency: string | null
}

export const EMPTY_FILTERS: HistoryFilters = {
  categories: [],
  dateRange: null,
  customDateRange: null,
  amountRange: null,
  customAmountRange: null,
  type: "all",
  currency: null,
}

export interface HistoryFilterChipsProps {
  filters: HistoryFilters
  onFiltersChange: (filters: HistoryFilters) => void
  /** Count of results after filtering (shown in summary) */
  resultCount: number
  /** Total transaction count (unfiltered) */
  totalCount: number
  /** All transactions — used to detect which currencies appear in data */
  transactions?: Transaction[]
}

// ============================================================================
// Filter logic (exported for use in HistoryScreen)
// ============================================================================

/** Apply all filters to a transaction array */
export function applyHistoryFilters(transactions: Transaction[], filters: HistoryFilters): Transaction[] {
  return transactions.filter((tx) => {
    // Category filter (OR logic — matches any selected category)
    if (filters.categories.length > 0 && !filters.categories.includes(tx.category)) {
      return false
    }

    // Type filter
    if (filters.type !== "all") {
      if (filters.type === "expenses" && tx.type !== "expense") return false
      if (filters.type === "income" && tx.type !== "income") return false
      // "refunds" — treat as negative expense or amount < 0 with expense type
      if (filters.type === "refunds") {
        // A refund is an income with category !== 'income' (i.e., money back on a purchase)
        const isRefund = tx.type === "income" && tx.category !== "income"
        if (!isRefund) return false
      }
    }

    // Date range filter
    if (filters.dateRange) {
      const txDate = tx.date // YYYY-MM-DD
      const range = getDateRangeBounds(filters.dateRange, filters.customDateRange)
      if (range) {
        if (range.start && txDate < range.start) return false
        if (range.end && txDate > range.end) return false
      }
    }

    // Amount range filter
    if (filters.amountRange) {
      const bounds = getAmountBounds(filters.amountRange, filters.customAmountRange)
      if (bounds) {
        if (bounds.min !== null && tx.amount < bounds.min) return false
        if (bounds.max !== null && tx.amount > bounds.max) return false
      }
    }

    // Currency filter (Task 423.2)
    if (filters.currency !== null) {
      const homeCurrency = getHomeCurrency()
      const txCurrency = normalizeCode(tx.currency) || normalizeCode(homeCurrency)
      if (txCurrency !== normalizeCode(filters.currency)) return false
    }

    return true
  })
}

function getDateRangeBounds(preset: DateRangePreset, custom: CustomDateRange | null): { start: string | null; end: string | null } | null {
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

function getAmountBounds(preset: AmountRangePreset, custom: CustomAmountRange | null): { min: number | null; max: number | null } | null {
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
// Chip style helper
// ============================================================================

function chipStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0,
    padding: "7px 14px",
    fontFamily: FONT_FAMILY,
    fontSize: "13px",
    fontWeight: 500,
    borderRadius: 99,
    border: "1px solid",
    borderColor: active ? "rgba(129, 140, 248, 0.4)" : "rgba(255, 255, 255, 0.1)",
    color: active ? "var(--text)" : "var(--sub)",
    background: active ? "rgba(129, 140, 248, 0.12)" : "rgba(255, 255, 255, 0.04)",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  }
}

const scrollRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  scrollbarWidth: "none",
  padding: "0 2px",
  msOverflowStyle: "none",
}

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: FONT_FAMILY,
  fontWeight: 600,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  paddingLeft: 2,
}

// ============================================================================
// Keyboard navigation helper for chip toolbars
// ============================================================================

function useToolbarKeyNav(itemCount: number) {
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex: number | null = null

      if (e.key === "ArrowRight") {
        e.preventDefault()
        nextIndex = (index + 1) % itemCount
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        nextIndex = (index - 1 + itemCount) % itemCount
      } else if (e.key === "Home") {
        e.preventDefault()
        nextIndex = 0
      } else if (e.key === "End") {
        e.preventDefault()
        nextIndex = itemCount - 1
      }

      if (nextIndex !== null) {
        itemsRef.current[nextIndex]?.focus()
      }
    },
    [itemCount]
  )

  return { itemsRef, handleKeyDown }
}

// ============================================================================
// HistoryFilterChips Component
// ============================================================================

export function HistoryFilterChips({
  filters,
  onFiltersChange,
  resultCount,
  totalCount,
  transactions = [],
}: HistoryFilterChipsProps) {
  const [showCustomDate, setShowCustomDate] = useState(false)
  const [showCustomAmount, setShowCustomAmount] = useState(false)

  // Local state for custom inputs
  const [customDateStart, setCustomDateStart] = useState(filters.customDateRange?.start ?? "")
  const [customDateEnd, setCustomDateEnd] = useState(filters.customDateRange?.end ?? "")
  const [customAmountMin, setCustomAmountMin] = useState(filters.customAmountRange?.min?.toString() ?? "")
  const [customAmountMax, setCustomAmountMax] = useState(filters.customAmountRange?.max?.toString() ?? "")

  // Dedupe categories (TRANSACTION_CATEGORIES has duplicate 'income' entries)
  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>()
    return TRANSACTION_CATEGORIES.filter((c) => {
      if (seen.has(c.category)) return false
      seen.add(c.category)
      return true
    })
  }, [])

  // Toolbar keyboard helpers for each filter section
  const categoryNav = useToolbarKeyNav(uniqueCategories.length + 1)
  const dateNav = useToolbarKeyNav(5) // 5 date presets
  const amountNav = useToolbarKeyNav(5) // 5 amount presets
  const typeNav = useToolbarKeyNav(4) // 4 type options

  // Detect currencies present in transaction data (Task 423.2)
  const availableCurrencies = useMemo(() => {
    const homeCurrency = getHomeCurrency()
    const codes = new Set<string>()
    for (const tx of transactions) {
      const code = normalizeCode(tx.currency) || normalizeCode(homeCurrency)
      codes.add(code)
    }
    // Sort: home currency first, then alphabetical
    const sorted = Array.from(codes).sort((a, b) => {
      if (a === normalizeCode(homeCurrency)) return -1
      if (b === normalizeCode(homeCurrency)) return 1
      return a.localeCompare(b)
    })
    return sorted
  }, [transactions])

  const currencyNav = useToolbarKeyNav(availableCurrencies.length + 1) // +1 for "All"

  const hasActiveFilters = filters.categories.length > 0 ||
    filters.dateRange !== null ||
    filters.amountRange !== null ||
    filters.type !== "all" ||
    filters.currency !== null

  // ── Handlers ──────────────────────────────────────────────────────

  const toggleCategory = useCallback((cat: TransactionCategory) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat]
    onFiltersChange({ ...filters, categories: next })
  }, [filters, onFiltersChange])

  const clearCategories = useCallback(() => {
    onFiltersChange({ ...filters, categories: [] })
  }, [filters, onFiltersChange])

  const setDateRange = useCallback((preset: DateRangePreset) => {
    if (preset === "custom") {
      setShowCustomDate(true)
      onFiltersChange({ ...filters, dateRange: "custom" })
    } else {
      setShowCustomDate(false)
      onFiltersChange({
        ...filters,
        dateRange: preset === filters.dateRange ? null : preset,
        customDateRange: null,
      })
    }
  }, [filters, onFiltersChange])

  const applyCustomDate = useCallback(() => {
    onFiltersChange({
      ...filters,
      dateRange: "custom",
      customDateRange: { start: customDateStart, end: customDateEnd },
    })
    setShowCustomDate(false)
  }, [filters, onFiltersChange, customDateStart, customDateEnd])

  const setAmountRange = useCallback((preset: AmountRangePreset) => {
    if (preset === "custom") {
      setShowCustomAmount(true)
      onFiltersChange({ ...filters, amountRange: "custom" })
    } else {
      setShowCustomAmount(false)
      onFiltersChange({
        ...filters,
        amountRange: preset === filters.amountRange ? null : preset,
        customAmountRange: null,
      })
    }
  }, [filters, onFiltersChange])

  const applyCustomAmount = useCallback(() => {
    const min = customAmountMin ? parseFloat(customAmountMin) : null
    const max = customAmountMax ? parseFloat(customAmountMax) : null
    onFiltersChange({
      ...filters,
      amountRange: "custom",
      customAmountRange: { min, max },
    })
    setShowCustomAmount(false)
  }, [filters, onFiltersChange, customAmountMin, customAmountMax])

  const setTypeFilter = useCallback((type: TypeFilter) => {
    onFiltersChange({ ...filters, type })
  }, [filters, onFiltersChange])

  const setCurrencyFilter = useCallback((code: string | null) => {
    onFiltersChange({ ...filters, currency: code === filters.currency ? null : code })
  }, [filters, onFiltersChange])

  const clearAll = useCallback(() => {
    onFiltersChange(EMPTY_FILTERS)
    setShowCustomDate(false)
    setShowCustomAmount(false)
  }, [onFiltersChange])

  // ── Build summary text ────────────────────────────────────────────

  const summaryParts = useMemo(() => {
    const parts: string[] = []

    if (filters.categories.length > 0) {
      const labels = filters.categories.map(
        (cat) => TRANSACTION_CATEGORIES.find((c) => c.category === cat)?.label ?? cat
      )
      parts.push(labels.join(", "))
    }

    if (filters.dateRange) {
      const dateLabels: Record<string, string> = {
        today: "Today",
        this_week: "This week",
        this_month: "This month",
        last_month: "Last month",
        custom: "Custom dates",
      }
      parts.push(dateLabels[filters.dateRange] ?? filters.dateRange)
    }

    if (filters.amountRange) {
      const amountLabels: Record<string, string> = {
        under_10: "Under $10",
        "10_50": "$10–50",
        "50_100": "$50–100",
        over_100: "Over $100",
        custom: "Custom amount",
      }
      parts.push(amountLabels[filters.amountRange] ?? filters.amountRange)
    }

    if (filters.type !== "all") {
      const typeLabels: Record<string, string> = {
        expenses: "Expenses",
        income: "Income",
        refunds: "Refunds",
      }
      parts.push(typeLabels[filters.type] ?? filters.type)
    }

    if (filters.currency) {
      parts.push(`${getCurrencySymbol(filters.currency)} ${filters.currency}`)
    }

    return parts
  }, [filters])

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
      role="region"
      aria-label="Transaction filters"
    >
      {/* Category chips */}
      <div style={sectionStyle}>
        <span style={labelStyle} id="filter-category-label">Category</span>
        <div style={scrollRowStyle} role="toolbar" aria-labelledby="filter-category-label">
          <motion.button
            type="button"
            ref={(el: HTMLButtonElement | null) => { categoryNav.itemsRef.current[0] = el }}
            whileTap={{ scale: 0.96 }}
            transition={springs.snappy}
            onClick={clearCategories}
            onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => categoryNav.handleKeyDown(e, 0)}
            tabIndex={filters.categories.length === 0 ? 0 : -1}
            style={chipStyle(filters.categories.length === 0)}
            aria-pressed={filters.categories.length === 0}
            aria-label="All categories"
          >
            All
          </motion.button>
          {uniqueCategories.map((cat, i) => (
            <motion.button
              key={cat.category}
              type="button"
              ref={(el: HTMLButtonElement | null) => { categoryNav.itemsRef.current[i + 1] = el }}
              whileTap={{ scale: 0.96 }}
              transition={springs.snappy}
              onClick={() => toggleCategory(cat.category)}
              onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => categoryNav.handleKeyDown(e, i + 1)}
              tabIndex={filters.categories.includes(cat.category) ? 0 : -1}
              style={chipStyle(filters.categories.includes(cat.category))}
              aria-pressed={filters.categories.includes(cat.category)}
              aria-label={`Filter by ${cat.label}`}
            >
              {cat.emoji} {cat.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Date range chips */}
      <div style={sectionStyle}>
        <span style={labelStyle} id="filter-date-label">Date range</span>
        <div style={scrollRowStyle} role="toolbar" aria-labelledby="filter-date-label">
          {([
            { key: "today", label: "Today" },
            { key: "this_week", label: "This week" },
            { key: "this_month", label: "This month" },
            { key: "last_month", label: "Last month" },
            { key: "custom", label: "Custom" },
          ] as { key: DateRangePreset; label: string }[]).map((item, i) => (
            <motion.button
              key={item.key}
              type="button"
              ref={(el: HTMLButtonElement | null) => { dateNav.itemsRef.current[i] = el }}
              whileTap={{ scale: 0.96 }}
              transition={springs.snappy}
              onClick={() => setDateRange(item.key)}
              onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => dateNav.handleKeyDown(e, i)}
              tabIndex={filters.dateRange === item.key ? 0 : (filters.dateRange === null && i === 0 ? 0 : -1)}
              style={chipStyle(filters.dateRange === item.key)}
              aria-pressed={filters.dateRange === item.key}
              aria-label={`Date range: ${item.label}`}
            >
              {item.label}
            </motion.button>
          ))}
        </div>

        {/* Custom date picker */}
        <AnimatePresence>
          {showCustomDate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden" }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 0",
                }}
              >
                <input
                  type="date"
                  value={customDateStart}
                  onChange={(e) => setCustomDateStart(e.target.value)}
                  aria-label="Start date"
                  style={dateInputStyle}
                />
                <span style={{ fontSize: 12, color: "var(--sub)", fontFamily: FONT_FAMILY }}>to</span>
                <input
                  type="date"
                  value={customDateEnd}
                  onChange={(e) => setCustomDateEnd(e.target.value)}
                  aria-label="End date"
                  style={dateInputStyle}
                />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  transition={springs.snappy}
                  onClick={applyCustomDate}
                  style={{
                    ...chipStyle(true),
                    padding: "6px 12px",
                    fontSize: 12,
                  }}
                  aria-label="Apply custom date range"
                >
                  Apply
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Amount range chips */}
      <div style={sectionStyle}>
        <span style={labelStyle} id="filter-amount-label">Amount</span>
        <div style={scrollRowStyle} role="toolbar" aria-labelledby="filter-amount-label">
          {([
            { key: "under_10", label: "Under $10" },
            { key: "10_50", label: "$10–50" },
            { key: "50_100", label: "$50–100" },
            { key: "over_100", label: "Over $100" },
            { key: "custom", label: "Custom" },
          ] as { key: AmountRangePreset; label: string }[]).map((item, i) => (
            <motion.button
              key={item.key}
              type="button"
              ref={(el: HTMLButtonElement | null) => { amountNav.itemsRef.current[i] = el }}
              whileTap={{ scale: 0.96 }}
              transition={springs.snappy}
              onClick={() => setAmountRange(item.key)}
              onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => amountNav.handleKeyDown(e, i)}
              tabIndex={filters.amountRange === item.key ? 0 : (filters.amountRange === null && i === 0 ? 0 : -1)}
              style={chipStyle(filters.amountRange === item.key)}
              aria-pressed={filters.amountRange === item.key}
              aria-label={`Amount: ${item.label}`}
            >
              {item.label}
            </motion.button>
          ))}
        </div>

        {/* Custom amount picker */}
        <AnimatePresence>
          {showCustomAmount && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden" }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 0",
                }}
              >
                <input
                  type="number"
                  placeholder="Min"
                  value={customAmountMin}
                  onChange={(e) => setCustomAmountMin(e.target.value)}
                  min={0}
                  step={1}
                  aria-label="Minimum amount"
                  style={amountInputStyle}
                />
                <span style={{ fontSize: 12, color: "var(--sub)", fontFamily: FONT_FAMILY }}>to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={customAmountMax}
                  onChange={(e) => setCustomAmountMax(e.target.value)}
                  min={0}
                  step={1}
                  aria-label="Maximum amount"
                  style={amountInputStyle}
                />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  transition={springs.snappy}
                  onClick={applyCustomAmount}
                  style={{
                    ...chipStyle(true),
                    padding: "6px 12px",
                    fontSize: 12,
                  }}
                  aria-label="Apply custom amount range"
                >
                  Apply
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Type filter chips */}
      <div style={sectionStyle}>
        <span style={labelStyle} id="filter-type-label">Type</span>
        <div style={scrollRowStyle} role="toolbar" aria-labelledby="filter-type-label">
          {([
            { key: "all", label: "All" },
            { key: "expenses", label: "Expenses" },
            { key: "income", label: "Income" },
            { key: "refunds", label: "Refunds" },
          ] as { key: TypeFilter; label: string }[]).map((item, i) => (
            <motion.button
              key={item.key}
              type="button"
              ref={(el: HTMLButtonElement | null) => { typeNav.itemsRef.current[i] = el }}
              whileTap={{ scale: 0.96 }}
              transition={springs.snappy}
              onClick={() => setTypeFilter(item.key)}
              onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => typeNav.handleKeyDown(e, i)}
              tabIndex={filters.type === item.key ? 0 : -1}
              style={chipStyle(filters.type === item.key)}
              aria-pressed={filters.type === item.key}
              aria-label={`Type: ${item.label}`}
            >
              {item.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Currency filter chips (Task 423.2) — only shown when multiple currencies exist */}
      {availableCurrencies.length > 1 && (
        <div style={sectionStyle}>
          <span style={labelStyle} id="filter-currency-label">Currency</span>
          <div style={scrollRowStyle} role="toolbar" aria-labelledby="filter-currency-label">
            <motion.button
              type="button"
              ref={(el: HTMLButtonElement | null) => { currencyNav.itemsRef.current[0] = el }}
              whileTap={{ scale: 0.96 }}
              transition={springs.snappy}
              onClick={() => setCurrencyFilter(null)}
              onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => currencyNav.handleKeyDown(e, 0)}
              tabIndex={filters.currency === null ? 0 : -1}
              style={chipStyle(filters.currency === null)}
              aria-pressed={filters.currency === null}
              aria-label="All currencies"
            >
              All
            </motion.button>
            {availableCurrencies.map((code, i) => (
              <motion.button
                key={code}
                type="button"
                ref={(el: HTMLButtonElement | null) => { currencyNav.itemsRef.current[i + 1] = el }}
                whileTap={{ scale: 0.96 }}
                transition={springs.snappy}
                onClick={() => setCurrencyFilter(code)}
                onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => currencyNav.handleKeyDown(e, i + 1)}
                tabIndex={filters.currency === code ? 0 : -1}
                style={chipStyle(filters.currency === code)}
                aria-pressed={filters.currency === code}
                aria-label={`Filter by ${code}`}
              >
                {getCurrencySymbol(code)} {code}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Active filter summary bar */}
      <AnimatePresence>
        {hasActiveFilters && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 14px",
              background: "rgba(129, 140, 248, 0.08)",
              border: "1px solid rgba(129, 140, 248, 0.2)",
              borderRadius: 12,
            }}
            role="status"
            aria-live="polite"
            aria-label="Active filters summary"
          >
            <span
              style={{
                fontSize: 12,
                fontFamily: FONT_FAMILY,
                fontWeight: 500,
                color: "var(--text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              Showing: {summaryParts.join(" + ")}{" "}
              <span style={{ color: "var(--sub)" }}>
                ({resultCount} {resultCount === 1 ? "match" : "matches"})
              </span>
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              transition={springs.snappy}
              onClick={clearAll}
              style={{
                flexShrink: 0,
                padding: "5px 12px",
                fontSize: 12,
                fontFamily: FONT_FAMILY,
                fontWeight: 500,
                color: "var(--accent)",
                background: "rgba(129, 140, 248, 0.12)",
                border: "1px solid rgba(129, 140, 248, 0.3)",
                borderRadius: 99,
                cursor: "pointer",
              }}
              aria-label="Clear all filters"
            >
              Clear all
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// Input styles
// ============================================================================

const dateInputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 8,
  outline: "none",
  colorScheme: "dark",
}

const amountInputStyle: React.CSSProperties = {
  width: 80,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 8,
  outline: "none",
}
