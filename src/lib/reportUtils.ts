/**
 * Report utilities for Folio — filtered, formatted spending reports.
 *
 * Task 185.1: builds on the CSV export (Phase 2 task 116.1) with a formatted
 * PDF report and filters by tag, merchant, or category. Reuses the existing
 * tag infrastructure (`tagUtils`) and category metadata, and the CSV export
 * for the spreadsheet path.
 *
 * Everything here is client-side and free — no paywall, no bank linking.
 * Copy stays warm and shame-free ("where it went", never "you overspent").
 *
 * _Requirements: new (extends Phase 2 task 116.1, Phase 3 task 129.x)_
 */

import type { Transaction, TransactionCategory } from '@/types'
import { TRANSACTION_CATEGORIES } from '@/types'
import { getTagsForTransaction } from './tagUtils'

// ============================================================================
// Types
// ============================================================================

/**
 * Report filters. Each field is optional — an unset field means "no filter".
 * These mirror the History search/filter dimensions (task 129.x): category is
 * an exact match, tag is an exact match against a transaction's tags, and
 * merchant is a case-insensitive substring match against the note/payee.
 */
export interface ReportFilters {
  /** Exact category match, or null for all categories. */
  category?: TransactionCategory | null
  /** Exact tag match (lower-cased), or null for any tag. */
  tag?: string | null
  /** Case-insensitive substring match against the transaction note/merchant. */
  merchant?: string | null
}

/** A single category's rolled-up total within the report. */
export interface ReportCategoryTotal {
  category: TransactionCategory
  label: string
  emoji: string
  total: number
  count: number
}

/** The computed shape of a filtered report, ready to render or export. */
export interface ReportSummary {
  /** Filtered transactions, sorted newest-first, tags hydrated. */
  transactions: Transaction[]
  totalExpense: number
  totalIncome: number
  /** income − expense (can be negative). */
  net: number
  count: number
  /** Expense categories with the most spend first. */
  categoryTotals: ReportCategoryTotal[]
  /** Earliest → latest transaction date, or null when empty. */
  dateRange: { start: string; end: string } | null
}

// ============================================================================
// Helpers
// ============================================================================

/** Look up display metadata for a category, with a graceful fallback. */
function categoryMeta(category: TransactionCategory): { label: string; emoji: string } {
  const match = TRANSACTION_CATEGORIES.find((c) => c.category === category)
  return { label: match?.label ?? category, emoji: match?.emoji ?? '📦' }
}

/** Resolve a transaction's tags, preferring inline tags then localStorage. */
function resolveTags(tx: Transaction): string[] {
  return tx.tags ?? getTagsForTransaction(tx.id) ?? []
}

/** Whole-dollar-friendly currency string (keeps cents when present). */
function money(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** Format a YYYY-MM-DD date as a short, friendly label. */
function friendlyDate(dateStr: string): string {
  // Parse as local date to avoid off-by-one from UTC parsing.
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ============================================================================
// Filtering
// ============================================================================

/**
 * Filter transactions by tag, merchant, and/or category.
 *
 * Reuses the tag hydration path from `tagUtils` so a filter works whether tags
 * live on the transaction object (DB) or in localStorage. Matching mirrors the
 * History search behavior (task 129.x): category and tag are exact matches,
 * merchant is a case-insensitive substring of the note.
 *
 * Pure — no side effects, safe to call during render/memo.
 */
export function filterTransactionsForReport(
  transactions: Transaction[],
  filters: ReportFilters
): Transaction[] {
  const merchantNorm = filters.merchant?.trim().toLowerCase() ?? ''
  const tagNorm = filters.tag?.trim().toLowerCase() ?? ''

  return transactions.filter((tx) => {
    if (filters.category && tx.category !== filters.category) return false

    if (tagNorm) {
      const tags = resolveTags(tx).map((t) => t.toLowerCase())
      if (!tags.includes(tagNorm)) return false
    }

    if (merchantNorm) {
      const note = (tx.note ?? '').toLowerCase()
      if (!note.includes(merchantNorm)) return false
    }

    return true
  })
}

// ============================================================================
// Summary
// ============================================================================

/**
 * Build a report summary from a transaction list and filters.
 *
 * Applies {@link filterTransactionsForReport}, sorts newest-first, hydrates
 * tags onto the returned rows, and rolls up totals + a per-category expense
 * breakdown. Pure and deterministic.
 */
export function buildReportSummary(
  transactions: Transaction[],
  filters: ReportFilters = {}
): ReportSummary {
  const filtered = filterTransactionsForReport(transactions, filters)
    .map((tx) => {
      const tags = resolveTags(tx)
      return tags.length > 0 ? { ...tx, tags } : tx
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  let totalExpense = 0
  let totalIncome = 0
  const catMap = new Map<TransactionCategory, { total: number; count: number }>()

  for (const tx of filtered) {
    if (tx.type === 'income') {
      totalIncome += tx.amount
    } else {
      totalExpense += tx.amount
      const entry = catMap.get(tx.category) ?? { total: 0, count: 0 }
      entry.total += tx.amount
      entry.count += 1
      catMap.set(tx.category, entry)
    }
  }

  const categoryTotals: ReportCategoryTotal[] = Array.from(catMap.entries())
    .map(([category, { total, count }]) => {
      const meta = categoryMeta(category)
      return { category, label: meta.label, emoji: meta.emoji, total, count }
    })
    .sort((a, b) => b.total - a.total)

  // Transactions are sorted newest-first, so last item is the earliest date.
  const dateRange =
    filtered.length > 0
      ? { start: filtered[filtered.length - 1].date, end: filtered[0].date }
      : null

  return {
    transactions: filtered,
    totalExpense,
    totalIncome,
    net: totalIncome - totalExpense,
    count: filtered.length,
    categoryTotals,
    dateRange,
  }
}

/**
 * Build a short, human description of the active filters, e.g.
 * "Food & Drinks · tagged "trip" · matching "chipotle"". Returns a warm
 * default when nothing is filtered.
 */
export function describeReportFilters(filters: ReportFilters): string {
  const parts: string[] = []
  if (filters.category) parts.push(categoryMeta(filters.category).label)
  if (filters.tag?.trim()) parts.push(`tagged "${filters.tag.trim()}"`)
  if (filters.merchant?.trim()) parts.push(`matching "${filters.merchant.trim()}"`)
  return parts.length > 0 ? parts.join(' · ') : 'All transactions'
}

// ============================================================================
// PDF export
// ============================================================================

/**
 * Generate and download a formatted PDF spending report for the filtered set.
 *
 * Uses jsPDF (already a project dependency) via dynamic import so the ~200KB
 * library only loads when a user actually exports. The layout is a warm,
 * printable summary: a header, the active filters, headline totals, a category
 * breakdown, and a transaction table with automatic pagination.
 *
 * Returns the number of transactions written so callers can surface a toast.
 */
export async function exportReportPDF(
  transactions: Transaction[],
  filters: ReportFilters = {}
): Promise<number> {
  const summary = buildReportSummary(transactions, filters)

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 48
  const contentWidth = pageWidth - marginX * 2
  const bottomLimit = pageHeight - 56

  // Warm purple accent + calm ink, matching the app's palette.
  const accent: [number, number, number] = [129, 140, 248]
  const ink: [number, number, number] = [26, 26, 46]
  const sub: [number, number, number] = [110, 110, 130]

  let y = 56

  // ── Header ────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...accent)
  doc.text('Folio spending report', marginX, y)

  y += 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...sub)
  doc.text(describeReportFilters(filters), marginX, y)

  y += 15
  const rangeLabel = summary.dateRange
    ? `${friendlyDate(summary.dateRange.start)} – ${friendlyDate(summary.dateRange.end)}`
    : 'No transactions in range'
  const generated = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  doc.text(`${rangeLabel}  ·  Generated ${generated}`, marginX, y)

  y += 24

  // ── Headline totals ───────────────────────────────────────────────────
  doc.setDrawColor(...accent)
  doc.setLineWidth(1)
  doc.line(marginX, y, marginX + contentWidth, y)
  y += 22

  doc.setFontSize(12)
  doc.setTextColor(...ink)
  doc.setFont('helvetica', 'bold')
  doc.text(`Spent: ${money(summary.totalExpense)}`, marginX, y)
  doc.text(`Received: ${money(summary.totalIncome)}`, marginX + 180, y)
  doc.text(`Net: ${money(summary.net)}`, marginX + 360, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...sub)
  doc.text(
    `${summary.count} ${summary.count === 1 ? 'transaction' : 'transactions'} — here's where it went, no judgment.`,
    marginX,
    y
  )
  y += 26

  // ── Category breakdown ──────────────────────────────────────────────────
  if (summary.categoryTotals.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...ink)
    doc.text('Where it went', marginX, y)
    y += 16

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    for (const cat of summary.categoryTotals) {
      if (y > bottomLimit) {
        doc.addPage()
        y = 56
      }
      doc.setTextColor(...ink)
      doc.text(`${cat.label}`, marginX, y)
      doc.setTextColor(...sub)
      doc.text(`${cat.count}×`, marginX + 220, y)
      doc.setTextColor(...ink)
      doc.text(money(cat.total), marginX + contentWidth, y, { align: 'right' })
      y += 16
    }
    y += 14
  }

  // ── Transaction table ───────────────────────────────────────────────────
  const drawTableHeader = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...ink)
    doc.text('Transactions', marginX, y)
    y += 16
    doc.setFontSize(9)
    doc.setTextColor(...sub)
    doc.text('DATE', marginX, y)
    doc.text('DETAIL', marginX + 90, y)
    doc.text('CATEGORY', marginX + 300, y)
    doc.text('AMOUNT', marginX + contentWidth, y, { align: 'right' })
    y += 6
    doc.setDrawColor(220, 220, 228)
    doc.setLineWidth(0.5)
    doc.line(marginX, y, marginX + contentWidth, y)
    y += 14
  }

  if (summary.transactions.length > 0) {
    drawTableHeader()

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    for (const tx of summary.transactions) {
      if (y > bottomLimit) {
        doc.addPage()
        y = 56
        drawTableHeader()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
      }

      const meta = categoryMeta(tx.category)
      const detailBase = tx.note?.trim() || meta.label
      const detail = doc.splitTextToSize(detailBase, 195)[0] as string
      const tags = (tx.tags ?? []).length > 0 ? `#${(tx.tags ?? []).join(' #')}` : ''
      const sign = tx.type === 'income' ? '+' : '−'

      doc.setTextColor(...ink)
      doc.text(friendlyDate(tx.date), marginX, y)
      doc.text(detail, marginX + 90, y)
      doc.text(meta.label, marginX + 300, y)
      doc.text(`${sign}${money(tx.amount)}`, marginX + contentWidth, y, { align: 'right' })

      if (tags) {
        y += 12
        doc.setTextColor(...accent)
        doc.setFontSize(8)
        doc.text(doc.splitTextToSize(tags, 200)[0] as string, marginX + 90, y)
        doc.setFontSize(10)
      }
      y += 16
    }
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...sub)
    doc.text('Nothing matched these filters yet — try widening them.', marginX, y)
  }

  const stamp = new Date().toISOString().split('T')[0]
  doc.save(`folio-report-${stamp}.pdf`)

  return summary.count
}
