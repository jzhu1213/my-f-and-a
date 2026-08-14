/**
 * CSV export utilities for the History screen.
 *
 * Exports exactly what's currently shown: respects all active filters, search,
 * and grouping. Produces a simple CSV with columns: date, amount, category,
 * note, type, tags.
 *
 * Requirements: 22.7
 */

import type { Transaction, TransactionCategory } from '@/types'
import { TRANSACTION_CATEGORIES } from '@/types'
import { getTagsForTransaction } from './tagUtils'
import type { HistoryFilters } from '@/components/simplified/HistoryFilterChips'

// ============================================================================
// Types
// ============================================================================

export interface ExportSummary {
  /** Number of transactions to export. */
  count: number
  /** Friendly date range string, e.g. "Aug 1–14" or "Jun 3 – Jul 12". */
  dateRangeLabel: string
  /** Short description of active filters, e.g. "category: Food". */
  filterDescription: string
  /** Total amount (sum of all transaction amounts). */
  total: number
  /** Formatted total as currency string. */
  totalFormatted: string
}

// ============================================================================
// Helpers
// ============================================================================

/** Look up display label for a category. */
function categoryLabel(category: TransactionCategory): string {
  const match = TRANSACTION_CATEGORIES.find((c) => c.category === category)
  return match?.label ?? category
}

/** Resolve tags for a transaction — inline first, then localStorage fallback. */
function resolveTags(tx: Transaction): string[] {
  return tx.tags ?? getTagsForTransaction(tx.id) ?? []
}

/** Escape a CSV field: wrap in quotes if it contains commas, quotes, or newlines. */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Format a date string (YYYY-MM-DD) into a short friendly label. */
function friendlyShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Format currency. */
function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// ============================================================================
// CSV Generation
// ============================================================================

/**
 * Build a CSV string from the given (already filtered) transactions.
 * Columns: date, amount, category, note, type, tags
 */
export function buildCsvString(transactions: Transaction[]): string {
  const header = 'date,amount,category,note,type,tags'
  const rows = transactions.map((tx) => {
    const tags = resolveTags(tx)
    const fields = [
      tx.date,
      tx.amount.toFixed(2),
      categoryLabel(tx.category),
      escapeCsvField(tx.note ?? ''),
      tx.type,
      escapeCsvField(tags.join('; ')),
    ]
    return fields.join(',')
  })

  return [header, ...rows].join('\n')
}

/**
 * Trigger a browser download of the CSV content.
 */
export function downloadCsv(csvContent: string, filename?: string): void {
  const stamp = new Date().toISOString().split('T')[0]
  const name = filename ?? `folio-export-${stamp}.csv`

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 100)
}

/**
 * Full export flow: build CSV from transactions and trigger download.
 * Returns the number of transactions exported.
 */
export function exportTransactionsCsv(transactions: Transaction[]): number {
  const csv = buildCsvString(transactions)
  downloadCsv(csv)
  return transactions.length
}

// ============================================================================
// Export Summary
// ============================================================================

/**
 * Build a human-friendly export summary for the confirmation sheet.
 *
 * Shows count, date range, filter description, and total — warm copy style:
 * "Exporting 47 transactions from Aug 1–14, category: Food. Total: $312."
 */
export function buildExportSummary(
  transactions: Transaction[],
  filters: HistoryFilters,
  searchQuery: string
): ExportSummary {
  const count = transactions.length

  // Date range from the actual data
  let dateRangeLabel = ''
  if (count > 0) {
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
    const earliest = sorted[0].date
    const latest = sorted[sorted.length - 1].date

    const startDate = new Date(earliest + 'T00:00:00')
    const endDate = new Date(latest + 'T00:00:00')

    if (earliest === latest) {
      dateRangeLabel = friendlyShortDate(earliest)
    } else if (startDate.getFullYear() === endDate.getFullYear()) {
      if (startDate.getMonth() === endDate.getMonth()) {
        // Same month: "Aug 1–14"
        dateRangeLabel = `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${startDate.getDate()}–${endDate.getDate()}`
      } else {
        // Different months same year: "Jun 3 – Jul 12"
        dateRangeLabel = `${friendlyShortDate(earliest)} – ${friendlyShortDate(latest)}`
      }
    } else {
      // Different years
      dateRangeLabel = `${friendlyShortDate(earliest)}, ${startDate.getFullYear()} – ${friendlyShortDate(latest)}, ${endDate.getFullYear()}`
    }
  }

  // Filter description
  const parts: string[] = []
  if (filters.categories.length > 0) {
    const labels = filters.categories.map(categoryLabel)
    parts.push(`category: ${labels.join(', ')}`)
  }
  if (filters.type !== 'all') {
    parts.push(`type: ${filters.type}`)
  }
  if (filters.dateRange) {
    parts.push(`date filtered`)
  }
  if (filters.amountRange) {
    parts.push(`amount filtered`)
  }
  if (searchQuery.trim()) {
    parts.push(`search: "${searchQuery.trim()}"`)
  }
  const filterDescription = parts.length > 0 ? parts.join(', ') : ''

  // Total amount
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0)

  return {
    count,
    dateRangeLabel,
    filterDescription,
    total,
    totalFormatted: formatMoney(total),
  }
}
