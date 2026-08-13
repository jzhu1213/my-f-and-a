/**
 * Period Summary PDF export for Folio (Task 361.2)
 *
 * Generates a clean monthly/period summary PDF with:
 *  - Income total
 *  - Spending by category (with visual bars)
 *  - Daily allowance trend (remaining per day over the period)
 *  - Goal progress (name, target, current, percentage)
 *
 * Branded with Folio warm purple styling. Uses jsPDF via dynamic import so
 * the library only loads when a user actually exports.
 *
 * Validates: Requirements 19.6
 */

import type { Transaction, TransactionCategory, Goal, Budget } from '@/types'
import { TRANSACTION_CATEGORIES } from '@/types'

// ============================================================================
// Types
// ============================================================================

export interface PeriodSummaryOptions {
  /** Period start date (YYYY-MM-DD). */
  start: string
  /** Period end date (YYYY-MM-DD). */
  end: string
  /** User's savings goals. */
  goals?: Goal[]
  /** User's budgets for the period. */
  budgets?: Budget[]
  /** Monthly income amount (used for daily allowance trend). */
  monthlyIncome?: number
}

interface CategoryTotal {
  category: TransactionCategory
  label: string
  emoji: string
  total: number
  count: number
}

// ============================================================================
// Helpers
// ============================================================================

function categoryMeta(category: TransactionCategory): { label: string; emoji: string } {
  const match = TRANSACTION_CATEGORIES.find((c) => c.category === category)
  return { label: match?.label ?? category, emoji: match?.emoji ?? '📦' }
}

function money(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function friendlyDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function periodLabel(start: string, end: string): string {
  const startDate = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} – ${end}`
  }

  // Check if it's a full calendar month
  if (
    startDate.getDate() === 1 &&
    endDate.getMonth() === startDate.getMonth() &&
    endDate.getFullYear() === startDate.getFullYear()
  ) {
    return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' Summary'
  }

  return `${friendlyDate(start)} – ${friendlyDate(end)}`
}

/** Count days between two YYYY-MM-DD strings, inclusive. */
function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00').getTime()
  const e = new Date(end + 'T00:00:00').getTime()
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1)
}

// ============================================================================
// Main export
// ============================================================================

/**
 * Generate and download a branded Folio period summary PDF.
 * Returns the number of transactions in the period.
 */
export async function exportPeriodSummaryPDF(
  transactions: Transaction[],
  options: PeriodSummaryOptions
): Promise<number> {
  const { start, end, goals = [], budgets = [] } = options

  // Filter to period
  const periodTx = transactions.filter(t => t.date >= start && t.date <= end)

  // Roll up totals
  let totalIncome = 0
  let totalExpense = 0
  const catMap = new Map<TransactionCategory, { total: number; count: number }>()

  for (const tx of periodTx) {
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

  const categoryTotals: CategoryTotal[] = Array.from(catMap.entries())
    .map(([category, { total, count }]) => {
      const meta = categoryMeta(category)
      return { category, label: meta.label, emoji: meta.emoji, total, count }
    })
    .sort((a, b) => b.total - a.total)

  // Daily allowance trend: compute cumulative spend vs daily budget
  const totalDays = daysBetween(start, end)
  const monthlyPool = totalIncome || options.monthlyIncome || 0
  const totalBudgetLimit = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
  const dailyBudget = (totalBudgetLimit > 0 ? totalBudgetLimit : monthlyPool) / totalDays

  // Group expenses by date
  const spendByDate = new Map<string, number>()
  for (const tx of periodTx) {
    if (tx.type === 'expense') {
      spendByDate.set(tx.date, (spendByDate.get(tx.date) ?? 0) + tx.amount)
    }
  }

  // Build daily trend (cumulative remaining)
  const dailyTrend: { date: string; remaining: number; spent: number }[] = []
  let cumulativeSpent = 0
  const startMs = new Date(start + 'T00:00:00').getTime()
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startMs + i * 86_400_000)
    const dateStr = d.toISOString().split('T')[0]
    const daySpend = spendByDate.get(dateStr) ?? 0
    cumulativeSpent += daySpend
    const expectedBudget = dailyBudget * (i + 1)
    const remaining = Math.max(0, expectedBudget - cumulativeSpent)
    dailyTrend.push({ date: dateStr, remaining: Math.round(remaining * 100) / 100, spent: daySpend })
  }

  // ── PDF Generation ─────────────────────────────────────────────────────

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 48
  const contentWidth = pageWidth - marginX * 2
  const bottomLimit = pageHeight - 56

  // Folio brand colors
  const accent: [number, number, number] = [129, 140, 248]
  const ink: [number, number, number] = [26, 26, 46]
  const sub: [number, number, number] = [110, 110, 130]
  const barBg: [number, number, number] = [40, 40, 60]

  let y = 56

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage()
      y = 56
    }
  }

  // ── Header ────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...accent)
  doc.text('Folio', marginX, y)

  doc.setFontSize(16)
  doc.setTextColor(...ink)
  doc.text(periodLabel(start, end), marginX + 52, y)

  y += 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...sub)
  const generated = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  doc.text(`Generated ${generated}  ·  ${periodTx.length} transactions`, marginX, y)

  y += 20
  doc.setDrawColor(...accent)
  doc.setLineWidth(1)
  doc.line(marginX, y, marginX + contentWidth, y)
  y += 24

  // ── Income & Spending Overview ────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...ink)
  doc.text('Overview', marginX, y)
  y += 20

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...ink)
  doc.text(`Income:`, marginX, y)
  doc.text(money(totalIncome), marginX + 120, y)
  y += 18
  doc.text(`Spending:`, marginX, y)
  doc.text(money(totalExpense), marginX + 120, y)
  y += 18
  const net = totalIncome - totalExpense
  doc.setTextColor(net >= 0 ? 76 : 239, net >= 0 ? 175 : 68, net >= 0 ? 80 : 68)
  doc.text(`Net:`, marginX, y)
  doc.text(money(net), marginX + 120, y)
  y += 28

  // ── Spending by Category (with bars) ──────────────────────────────────
  if (categoryTotals.length > 0) {
    ensureSpace(40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...ink)
    doc.text('Spending by category', marginX, y)
    y += 20

    const maxCatSpend = categoryTotals[0].total
    const barMaxWidth = contentWidth - 180

    for (const cat of categoryTotals) {
      ensureSpace(24)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(...ink)
      doc.text(`${cat.emoji} ${cat.label}`, marginX, y)
      doc.text(money(cat.total), marginX + contentWidth, y, { align: 'right' })

      // Draw bar
      const barWidth = maxCatSpend > 0 ? (cat.total / maxCatSpend) * barMaxWidth : 0
      y += 6
      doc.setFillColor(...barBg)
      doc.roundedRect(marginX + 130, y - 4, barMaxWidth, 6, 3, 3, 'F')
      doc.setFillColor(...accent)
      doc.roundedRect(marginX + 130, y - 4, Math.max(4, barWidth), 6, 3, 3, 'F')
      y += 16
    }
    y += 12
  }

  // ── Daily Allowance Trend ─────────────────────────────────────────────
  if (dailyTrend.length > 0 && dailyBudget > 0) {
    ensureSpace(60)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...ink)
    doc.text('Daily allowance trend', marginX, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...sub)
    doc.text(`Based on ${money(dailyBudget)}/day budget`, marginX, y)
    y += 18

    // Show a sampling of days (max ~14 rows to fit a page)
    const step = Math.max(1, Math.floor(dailyTrend.length / 14))
    doc.setFontSize(9)
    doc.setTextColor(...sub)
    doc.text('DATE', marginX, y)
    doc.text('SPENT', marginX + 150, y)
    doc.text('REMAINING', marginX + 260, y)
    y += 6
    doc.setDrawColor(220, 220, 228)
    doc.setLineWidth(0.5)
    doc.line(marginX, y, marginX + contentWidth, y)
    y += 12

    doc.setFontSize(10)
    for (let i = 0; i < dailyTrend.length; i += step) {
      ensureSpace(16)
      const day = dailyTrend[i]
      const shortDate = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
      })
      doc.setTextColor(...ink)
      doc.text(shortDate, marginX, y)
      doc.text(money(day.spent), marginX + 150, y)
      doc.setTextColor(day.remaining > 0 ? 76 : 239, day.remaining > 0 ? 175 : 68, day.remaining > 0 ? 80 : 68)
      doc.text(money(day.remaining), marginX + 260, y)
      y += 14
    }
    y += 16
  }

  // ── Goal Progress ─────────────────────────────────────────────────────
  if (goals.length > 0) {
    ensureSpace(50)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...ink)
    doc.text('Goal progress', marginX, y)
    y += 20

    const barMaxWidth = contentWidth - 60

    for (const goal of goals) {
      ensureSpace(36)
      const pct = goal.targetAmount > 0
        ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
        : 0

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(...ink)
      doc.text(`${goal.emoji ?? '⭐'} ${goal.name}`, marginX, y)
      doc.setTextColor(...sub)
      doc.text(`${money(goal.currentAmount)} / ${money(goal.targetAmount)} (${pct}%)`, marginX + contentWidth, y, { align: 'right' })
      y += 10

      // Progress bar
      doc.setFillColor(...barBg)
      doc.roundedRect(marginX, y, barMaxWidth, 8, 4, 4, 'F')
      const progressWidth = (pct / 100) * barMaxWidth
      doc.setFillColor(...accent)
      doc.roundedRect(marginX, y, Math.max(4, progressWidth), 8, 4, 4, 'F')
      y += 22
    }
    y += 8
  }

  // ── Footer ────────────────────────────────────────────────────────────
  ensureSpace(30)
  doc.setDrawColor(...accent)
  doc.setLineWidth(0.5)
  doc.line(marginX, y, marginX + contentWidth, y)
  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...sub)
  doc.text('Made with Folio — your money, on your terms.', marginX, y)

  // Save
  const stamp = new Date().toISOString().split('T')[0]
  doc.save(`folio-summary-${stamp}.pdf`)

  return periodTx.length
}
