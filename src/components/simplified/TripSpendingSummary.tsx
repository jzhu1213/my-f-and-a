"use client"

/**
 * TripSpendingSummary — shows a summary of spending in a foreign currency
 * during travel mode (or viewable anytime from history).
 *
 * Displays:
 * - Total spent in foreign currency
 * - Total in home currency
 * - Effective exchange rate
 * - Daily average while abroad
 *
 * Requirements: 24.3
 * Task 423.3
 */

import { useMemo } from "react"
import { motion } from "framer-motion"
import type { Transaction } from "@/types"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import { springs } from "@/lib/animations"
import { getHomeCurrency } from "@/lib/currencyPreferences"
import {
  isForeignTransaction,
  resolveTransactionAmount,
  formatCurrency,
  getCurrencySymbol,
  normalizeCode,
} from "@/lib/currencyUtils"

// ============================================================================
// Types
// ============================================================================

export interface TripSpendingSummaryProps {
  /** All transactions to analyze */
  transactions: Transaction[]
  /** The foreign currency to summarize (e.g. "EUR", "THB") */
  tripCurrency: string
  /** Optional label like "Europe Trip" or "Thailand Semester" */
  label?: string
}

interface TripStats {
  /** Total spent in the foreign currency */
  totalForeign: number
  /** Total spent in home currency (sum of tx.amount for matching txns) */
  totalHome: number
  /** Effective (weighted average) exchange rate: totalHome / totalForeign */
  effectiveRate: number
  /** Number of distinct days with spending */
  daysSpent: number
  /** Daily average in foreign currency */
  dailyAverageForeign: number
  /** Daily average in home currency */
  dailyAverageHome: number
  /** Number of transactions */
  transactionCount: number
}

// ============================================================================
// Computation
// ============================================================================

function computeTripStats(
  transactions: Transaction[],
  tripCurrency: string,
  homeCurrency: string
): TripStats | null {
  const normalizedTrip = normalizeCode(tripCurrency)
  const normalizedHome = normalizeCode(homeCurrency)

  // Filter transactions in the trip currency
  const tripTxns = transactions.filter((tx) => {
    if (!isForeignTransaction(tx, normalizedHome)) return false
    return normalizeCode(tx.currency) === normalizedTrip
  })

  if (tripTxns.length === 0) return null

  let totalForeign = 0
  let totalHome = 0
  const uniqueDays = new Set<string>()

  for (const tx of tripTxns) {
    const conversion = resolveTransactionAmount(tx, normalizedHome)
    totalForeign += conversion.localAmount
    totalHome += conversion.homeAmount
    uniqueDays.add(tx.date)
  }

  const daysSpent = uniqueDays.size || 1
  const effectiveRate = totalForeign > 0 ? totalHome / totalForeign : 0

  return {
    totalForeign,
    totalHome,
    effectiveRate,
    daysSpent,
    dailyAverageForeign: totalForeign / daysSpent,
    dailyAverageHome: totalHome / daysSpent,
    transactionCount: tripTxns.length,
  }
}

// ============================================================================
// Component
// ============================================================================

export function TripSpendingSummary({
  transactions,
  tripCurrency,
  label,
}: TripSpendingSummaryProps) {
  const homeCurrency = useMemo(() => getHomeCurrency(), [])

  const stats = useMemo(
    () => computeTripStats(transactions, tripCurrency, homeCurrency),
    [transactions, tripCurrency, homeCurrency]
  )

  if (!stats) return null

  const currencySymbol = getCurrencySymbol(tripCurrency)
  const homeSymbol = getCurrencySymbol(homeCurrency)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.snappy}
      style={{
        background: "var(--accent-100)",
        border: "1px solid var(--accent-200)",
        borderRadius: radius.control,
        padding: "20px 16px",
        fontFamily: FONT_FAMILY,
      }}
      aria-label={`Trip spending summary for ${tripCurrency}`}
    >
      {/* Header */}
      <div style={{ marginBottom: spacing.md }}>
        <p style={{
          fontSize: typography.caption.fontSize,
          fontWeight: fontWeights.semibold,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}>
          {label || "Trip Summary"}
        </p>
        <p style={{
          fontSize: typography.body.fontSize,
          fontWeight: fontWeights.medium,
          color: "var(--sub)",
        }}>
          {stats.transactionCount} transactions over {stats.daysSpent} {stats.daysSpent === 1 ? "day" : "days"}
        </p>
      </div>

      {/* Stats grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: spacing.sm,
      }}>
        {/* Total foreign */}
        <StatCell
          label={`Total (${tripCurrency})`}
          value={formatCurrency(stats.totalForeign, tripCurrency)}
          accent
        />

        {/* Total home */}
        <StatCell
          label={`Total (${homeCurrency})`}
          value={formatCurrency(stats.totalHome, homeCurrency)}
        />

        {/* Effective rate */}
        <StatCell
          label="Effective rate"
          value={`1 ${currencySymbol} ≈ ${homeSymbol}${stats.effectiveRate.toFixed(4)}`}
        />

        {/* Daily average */}
        <StatCell
          label="Daily average"
          value={formatCurrency(stats.dailyAverageForeign, tripCurrency)}
          subtitle={`≈ ${formatCurrency(stats.dailyAverageHome, homeCurrency)}`}
        />
      </div>
    </motion.div>
  )
}

// ============================================================================
// StatCell helper
// ============================================================================

function StatCell({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string
  value: string
  subtitle?: string
  accent?: boolean
}) {
  return (
    <div style={{
      background: "var(--fill-03)",
      borderRadius: radius.control,
      padding: "10px 12px",
    }}>
      <p style={{
        fontSize: typography.caption.fontSize,
        fontWeight: fontWeights.medium,
        color: "var(--muted)",
        marginBottom: 4,
      }}>
        {label}
      </p>
      <p style={{
        fontSize: typography.body.fontSize,
        fontWeight: fontWeights.semibold,
        fontVariantNumeric: "tabular-nums",
        color: accent ? "var(--accent)" : "var(--text)",
        lineHeight: 1.3,
      }}>
        {value}
      </p>
      {subtitle && (
        <p style={{
          fontSize: typography.caption.fontSize,
          fontWeight: fontWeights.regular,
          fontVariantNumeric: "tabular-nums",
          color: "var(--muted)",
          marginTop: 2,
        }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
