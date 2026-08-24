"use client"

import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react"
import { useTranslation } from "@/contexts/I18nContext"
import type { Transaction, TransactionCategory } from "@/types"
import type { DailyAllowance } from "@/types/folio"
import type { FundingSource } from "@/lib/fundingSources"
import { motion, AnimatePresence } from "framer-motion"
import { useReducedMotion, timings } from "@/lib/animations"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { spacingScale } from "@/styles/layout"
import { DOCK_PADDING_BOTTOM } from "@/styles/shared"
import { radius } from '@/styles/surfaces'
import { HistoryView } from "@/components/accounting/HistoryView"
import { InsightTrendCard } from "./InsightTrendCard"
import { InsightBreakdownCard } from "./InsightBreakdownCard"
import { HistorySearchBar } from "./HistorySearchBar"
import { HistoryFilterChips, EMPTY_FILTERS } from "./HistoryFilterChips"
import type { HistoryFilters } from "./HistoryFilterChips"
import { searchTransactions, scheduleIndexBuild } from "@/lib/transactionSearch"
import { useFilteredTransactions } from "@/lib/useFilteredTransactions"
import type { QuickFilter } from "@/lib/transactionSearch"
import { HistoryViewToggle } from "./HistoryViewToggle"
import type { HistoryGroupingView } from "./HistoryViewToggle"
import { HistoryByCategoryView } from "./HistoryByCategoryView"
import { HistoryByMerchantView } from "./HistoryByMerchantView"
import { clearHistoryScrollPosition } from "@/lib/useScrollVirtualization"
import { ExportSummarySheet } from "./ExportSummarySheet"
import { buildExportSummary, exportTransactionsCsv } from "@/lib/csvExport"
import type { ExportSummary } from "@/lib/csvExport"
import { getTravelCurrency, isTravelModeActive } from "@/lib/travelMode"
import { TripSpendingSummary } from "./TripSpendingSummary"

// ── Session storage key for filter persistence ───────────────────
const SESSION_HISTORY_FILTERS_KEY = "folio-history-screen-filters"

function loadHistoryFilters(): HistoryFilters | null {
  try {
    const raw = sessionStorage.getItem(SESSION_HISTORY_FILTERS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as HistoryFilters
  } catch {
    return null
  }
}

function saveHistoryFilters(filters: HistoryFilters): void {
  try {
    sessionStorage.setItem(SESSION_HISTORY_FILTERS_KEY, JSON.stringify(filters))
  } catch {
    // Silently fail if sessionStorage is unavailable
  }
}

// ============================================================================
// HistoryScreen Props
// ============================================================================

export interface HistoryScreenProps {
  /** All user transactions passed to HistoryView */
  transactions: Transaction[]
  /** Whether data is still loading */
  isLoading: boolean
  /** Called when user edits a transaction */
  onEditTransaction: (tx: Transaction) => void
  /** Called when user deletes a transaction */
  onDeleteTransaction: (id: string) => void
  /** Called when the FAB is tapped to log a new expense */
  onLogExpense: () => void
  /** Called when user wants to repeat a transaction across dates (Task 93.1) */
  onRepeatTransaction?: (tx: Transaction) => void
  /** Daily allowance data — reinforces the core "can I afford this?" identity (Task 117.1) */
  allowance?: DailyAllowance | null
  /** Funding sources for search/filter in TransactionList (Task 129) */
  fundingSources?: FundingSource[]
  /** Bulk delete multiple transactions (Task 131) */
  onBulkDelete?: (ids: string[]) => void
  /** Bulk recategorize multiple transactions (Task 131) */
  onBulkRecategorize?: (ids: string[], category: TransactionCategory) => void
  /** Bulk tag multiple transactions (Task 131) */
  onBulkTag?: (ids: string[], tags: string[]) => void
  /** Map of transactionId → split info for split indicators (Task 401.3) */
  splitMap?: Map<string, { splitId: string; participantCount: number }>
  /** Callback when split indicator is tapped (Task 401.3) */
  onViewSplit?: (splitId: string) => void
  /** Load next page of historical transactions (Task 469.1) */
  onLoadMore?: () => Promise<void>
  /** Whether more historical transactions are available (Task 469.1) */
  hasMore?: boolean
  /** Whether a page load is in progress (Task 469.1) */
  isLoadingMore?: boolean
}

// ============================================================================
// HistoryScreen Component
// ============================================================================

/**
 * HistoryScreen — wraps the existing HistoryView for the simplified AppShell layout.
 *
 * Adds proper padding/layout for the AppShell context plus a floating "+" FAB
 * in the bottom-right corner (above the dock) to quickly log a new expense.
 *
 * Requirements: 9.2, 11.1
 */
export const HistoryScreen = memo(function HistoryScreen({
  transactions,
  isLoading,
  onEditTransaction,
  onDeleteTransaction,
  onLogExpense,
  onRepeatTransaction,
  allowance,
  fundingSources,
  onBulkDelete,
  onBulkRecategorize,
  onBulkTag,
  splitMap,
  onViewSplit,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: HistoryScreenProps) {
  const t = useTranslation()
  const { prefersReducedMotion, listContainer, listItem } = useReducedMotion()

  // ── Search state ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("")

  // ── Grouping view state (Task 402) ────────────────────────────────
  const [groupingView, setGroupingView] = useState<HistoryGroupingView>("timeline")

  // Scroll to top on view mode switch (Task 404.2)
  const handleViewChange = useCallback((view: HistoryGroupingView) => {
    setGroupingView(view)
    clearHistoryScrollPosition()
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // ── Filter chip state (persisted in session storage) ──────────────
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>(() => {
    return loadHistoryFilters() ?? EMPTY_FILTERS
  })

  // Persist filter changes to sessionStorage
  useEffect(() => {
    saveHistoryFilters(historyFilters)
  }, [historyFilters])

  // Task 472.2: Pre-warm the search index in the background when transactions
  // change. This offloads the O(n) index build from the search interaction so
  // the first keystroke is instant.
  useEffect(() => {
    if (transactions.length > 0) {
      scheduleIndexBuild(transactions)
    }
  }, [transactions])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    return searchTransactions(transactions, searchQuery)
  }, [transactions, searchQuery])

  // Memoized, optimized filter computation (Task 405.1)
  const filteredTransactions = useFilteredTransactions(
    transactions,
    searchResults,
    historyFilters
  )

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleQuickFilter = useCallback((filter: QuickFilter) => {
    // For quick filters, just set the query text — the search index handles
    // natural language dates, category names, amounts, and types.
    setSearchQuery(filter.query)
  }, [])

  const handleFiltersChange = useCallback((newFilters: HistoryFilters) => {
    setHistoryFilters(newFilters)
  }, [])

  // Tag filter callback: when a tag chip is tapped in a transaction row,
  // set the search query to the tag name so history filters to that tag (Task 401.2)
  const handleTagFilter = useCallback((tag: string) => {
    setSearchQuery(tag)
  }, [])

  // ── Export state (Task 406) ────────────────────────────────────────
  const [exportSheetOpen, setExportSheetOpen] = useState(false)
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null)

  const handleExportClick = useCallback(() => {
    const summary = buildExportSummary(filteredTransactions, historyFilters, searchQuery)
    setExportSummary(summary)
    setExportSheetOpen(true)
  }, [filteredTransactions, historyFilters, searchQuery])

  const handleExportConfirm = useCallback(() => {
    exportTransactionsCsv(filteredTransactions)
    setExportSheetOpen(false)
  }, [filteredTransactions])

  const handleExportClose = useCallback(() => {
    setExportSheetOpen(false)
  }, [])

  // ── Live region announcement for filter/search state changes ─────
  const [filterAnnouncement, setFilterAnnouncement] = useState("")
  const prevFilteredCountRef = useRef(filteredTransactions.length)

  // ── Infinite scroll: IntersectionObserver for load-more sentinel (Task 469.1) ─
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!onLoadMore || !hasMore) return
    const sentinel = loadMoreRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMore) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [onLoadMore, hasMore, isLoadingMore])

  useEffect(() => {
    // Only announce if count actually changed (avoid initial render)
    if (prevFilteredCountRef.current !== filteredTransactions.length) {
      const hasFilters = searchQuery.trim() || historyFilters.categories.length > 0 ||
        historyFilters.dateRange !== null || historyFilters.amountRange !== null ||
        historyFilters.type !== "all" || historyFilters.currency !== null

      if (hasFilters) {
        setFilterAnnouncement(
          t('history.showing', {
            count: filteredTransactions.length,
            noun: filteredTransactions.length === 1 ? t('history.transaction') : t('history.transactions'),
            total: transactions.length,
          })
        )
      } else {
        setFilterAnnouncement(
          `Showing all ${filteredTransactions.length} transactions`
        )
      }
    }
    prevFilteredCountRef.current = filteredTransactions.length
  }, [filteredTransactions.length, transactions.length, searchQuery, historyFilters])

  return (
    <motion.div
      className="history-screen"
      variants={listContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Visually-hidden h1 for screen reader heading hierarchy (Req 27.1) */}
      <h1 style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        borderWidth: 0,
      }}>{t('history.title')}</h1>
      {/* Visually-hidden live region for screen readers: announces filter/result changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          borderWidth: 0,
        }}
      >
        {filterAnnouncement}
      </div>
      {/* Prominent search bar at the top of History (Task 398.2, 398.3) */}
      <motion.div variants={listItem} style={{ padding: `${spacing.md}px 16px 0` }}>
        <HistorySearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          resultCount={searchResults?.length}
          totalCount={transactions.length}
          onQuickFilter={handleQuickFilter}
        />
      </motion.div>

      {/* Filter chips below search (Task 399) */}
      <motion.div variants={listItem} style={{ padding: `${spacing.sm}px 16px 0` }}>
        <HistoryFilterChips
          filters={historyFilters}
          onFiltersChange={handleFiltersChange}
          resultCount={filteredTransactions.length}
          totalCount={transactions.length}
          transactions={transactions}
        />
      </motion.div>

      {/* View toggle: Timeline / By Category / By Merchant (Task 402.3) */}
      <motion.div variants={listItem} style={{ padding: `${spacing.sm}px 16px 0`, display: "flex", alignItems: "center", gap: spacing.sm }}>
        <div style={{ flex: 1 }}>
          <HistoryViewToggle value={groupingView} onChange={handleViewChange} />
        </div>
        {/* Export button (Task 406) — only shows when there are transactions */}
        {filteredTransactions.length > 0 && (
          <button
            onClick={handleExportClick}
            aria-label="Export transactions as CSV"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: radius.control,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              cursor: "pointer",
              color: "var(--sub)",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        )}
      </motion.div>
      {/* Compact daily allowance reinforcement — keeps the core identity visible (Task 117.1) */}
      {allowance && (
        <motion.div variants={listItem}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.xs,
            padding: `${spacing.md}px 16px ${spacing.xxs}px`,
            fontFamily: FONT_FAMILY,
          }}
          aria-label={`Today's remaining: $${Math.round(allowance.amount)}`}
        >
          <span
            style={{
              fontSize: typography['body-sm'].fontSize,
              color: "var(--sub)",
              fontWeight: fontWeights.regular,
            }}
          >
            Today&rsquo;s budget:
          </span>
          <span
            style={{
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.semibold,
              color: allowance.amount > 0 ? "var(--success)" : "var(--error)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${Math.round(allowance.amount)}
          </span>
        </div>
        </motion.div>
      )}
      {/* Month-over-month trend insight (Requirement 9.4) */}
      <motion.div variants={listItem} style={{ padding: `${spacing.md}px 16px 0` }}>
        <InsightTrendCard transactions={transactions} />
      </motion.div>

      {/* Spending breakdown insight (Requirement 9.4) */}
      <motion.div variants={listItem} style={{ padding: `${spacing.sm}px 16px 0` }}>
        <InsightBreakdownCard transactions={transactions} />
      </motion.div>

      {/* Trip spending summary — shown when travel mode is active (Task 423.3) */}
      {isTravelModeActive() && getTravelCurrency() && (
        <motion.div variants={listItem} style={{ padding: `${spacing.sm}px 16px 0` }}>
          <TripSpendingSummary
            transactions={transactions}
            tripCurrency={getTravelCurrency()!}
          />
        </motion.div>
      )}

      <motion.div variants={listItem} style={{ marginTop: spacingScale["32"] }}>
      {/* Conditional view rendering based on grouping mode (Task 402) */}
      <AnimatePresence mode="wait">
        {groupingView === "timeline" && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={timings.fast}
          >
            <HistoryView
              transactions={filteredTransactions}
              isLoading={isLoading}
              onEditTransaction={onEditTransaction}
              onDeleteTransaction={onDeleteTransaction}
              onRepeatTransaction={onRepeatTransaction}
              fundingSources={fundingSources}
              onBulkDelete={onBulkDelete}
              onBulkRecategorize={onBulkRecategorize}
              onBulkTag={onBulkTag}
              onTagFilter={handleTagFilter}
              splitMap={splitMap}
              onViewSplit={onViewSplit}
            />
          </motion.div>
        )}
        {groupingView === "category" && (
          <motion.div
            key="category"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={timings.fast}
            style={{ padding: `0 ${spacing.md}px`, paddingBottom: DOCK_PADDING_BOTTOM }}
          >
            <HistoryByCategoryView
              transactions={filteredTransactions}
              onEditTransaction={onEditTransaction}
            />
          </motion.div>
        )}
        {groupingView === "merchant" && (
          <motion.div
            key="merchant"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={timings.fast}
            style={{ padding: `0 ${spacing.md}px`, paddingBottom: DOCK_PADDING_BOTTOM }}
          >
            <HistoryByMerchantView
              transactions={filteredTransactions}
              onEditTransaction={onEditTransaction}
            />
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>

      {/* Infinite scroll sentinel (Task 469.1) — triggers loadMore when visible */}
      {onLoadMore && hasMore && (
        <div
          ref={loadMoreRef}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px 0',
            minHeight: 48,
          }}
        >
          {isLoadingMore && (
            <div
              aria-label="Loading more transactions"
              role="status"
              style={{
                width: 24,
                height: 24,
                border: '2px solid var(--fill-15)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
        </div>
      )}

      {/* Export summary confirmation sheet (Task 406.2) */}
      <ExportSummarySheet
        open={exportSheetOpen}
        summary={exportSummary}
        onConfirm={handleExportConfirm}
        onClose={handleExportClose}
      />
    </motion.div>
  )
})
