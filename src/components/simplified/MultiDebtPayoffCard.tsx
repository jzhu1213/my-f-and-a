"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import type { Debt } from "@/types/folio"
import { DEBT_TYPES } from "@/types/folio"
import { FONT_FAMILY, pxToRem } from "@/styles/typography"
import { sectionHeader, borderRadius } from "@/styles/shared"
import { compareStrategies, type StrategyComparison, type StrategyResult, type StrategyName } from "@/lib/debtUtils"

// ============================================================================
// Types
// ============================================================================

export interface MultiDebtPayoffCardProps {
  debts: Debt[]
}

// ============================================================================
// Helpers
// ============================================================================

function formatMonths(months: number): string {
  if (months === Infinity || months >= 1200) return "a very long time"
  if (months === 0) return "already paid off"
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (rem === 0) return `${years} year${years !== 1 ? "s" : ""}`
  return `${years}y ${rem}mo`
}

function formatCurrency(amount: number): string {
  if (amount === Infinity) return "\u2014"
  return "$" + amount.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function getPayoffDate(months: number): string {
  if (months === Infinity || months >= 1200) return "\u2014"
  const date = new Date()
  date.setMonth(date.getMonth() + months)
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function strategyLabel(name: StrategyName): string {
  return name === "snowball" ? "Snowball" : "Avalanche"
}

function strategyDescription(name: StrategyName): string {
  return name === "snowball"
    ? "Pay off smallest balances first for quick wins"
    : "Pay off highest interest rates first to save money"
}

function emojiForDebt(debt: Debt): string {
  return DEBT_TYPES.find(d => d.type === debt.type)?.emoji ?? "📄"
}

function getPayoffDateFromMonth(month: number): string {
  if (month === Infinity || month >= 1200) return "—"
  const date = new Date()
  date.setMonth(date.getMonth() + month)
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

// ============================================================================
// Styles
// ============================================================================

const strategyCardStyle: React.CSSProperties = {
  flex: 1,
  padding: "14px 16px",
  borderRadius: borderRadius.md,
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid var(--border)",
}

const strategyCardActiveStyle: React.CSSProperties = {
  ...strategyCardStyle,
  border: "1px solid rgba(6, 214, 160, 0.4)",
  background: "rgba(6, 214, 160, 0.05)",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "rgba(0, 0, 0, 0.2)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  outline: "none",
}


// ============================================================================
// MultiDebtPayoffCard Component
// ============================================================================

/**
 * Compares snowball vs avalanche payoff strategies across all tracked debts.
 * Shows payoff timeline + interest for each, with a warm recommendation.
 * Only renders when 2+ debts have positive balances.
 */
export function MultiDebtPayoffCard({ debts }: MultiDebtPayoffCardProps) {
  const [extraPayment, setExtraPayment] = useState(0)
  const [showTimeline, setShowTimeline] = useState(false)

  const activeDebts = useMemo(() => debts.filter(d => d.balance > 0), [debts])

  const comparison: StrategyComparison | null = useMemo(() => {
    if (activeDebts.length < 2) return null
    return compareStrategies(activeDebts, extraPayment)
  }, [activeDebts, extraPayment])

  // Only show when there are 2+ active debts
  if (!comparison || activeDebts.length < 2) return null

  const { snowball, avalanche, recommended, interestSaved } = comparison

  return (
    <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
      <p style={sectionHeader}>Payoff Strategy Comparison</p>
      <p style={{ fontSize: pxToRem(13), color: "var(--sub)", margin: "0 0 16px" }}>
        Both strategies work &mdash; here&apos;s how they compare for your {activeDebts.length} debts
      </p>

      {/* Extra payment input */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--sub)",
            marginBottom: 6,
            fontFamily: FONT_FAMILY,
          }}
        >
          Extra monthly payment (beyond minimums)
        </label>
        <input
          type="number"
          value={extraPayment || ""}
          onChange={e => setExtraPayment(Math.max(0, Number(e.target.value) || 0))}
          placeholder="$0"
          min={0}
          step={25}
          style={inputStyle}
          aria-label="Extra monthly payment amount"
        />
      </div>

      {/* Strategy comparison cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <StrategyCard
          name="snowball"
          result={snowball}
          isRecommended={recommended === "snowball"}
        />
        <StrategyCard
          name="avalanche"
          result={avalanche}
          isRecommended={recommended === "avalanche"}
        />
      </div>

      {/* Per-debt payoff timeline toggle */}
      <motion.button
        onClick={() => setShowTimeline(!showTimeline)}
        whileTap={{ scale: 0.98 }}
        transition={springs.snappy}
        style={{
          width: "100%",
          padding: "10px 14px",
          marginBottom: 16,
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid var(--border)",
          borderRadius: borderRadius.md,
          color: "var(--sub)",
          fontSize: pxToRem(13),
          fontWeight: 500,
          fontFamily: FONT_FAMILY,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
        aria-expanded={showTimeline}
        aria-label="Show per-debt payoff timeline"
      >
        <span>📋 Per-debt payoff order</span>
        <span
          style={{
            transform: showTimeline ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            fontSize: 12,
          }}
        >
          ▼
        </span>
      </motion.button>

      {/* Per-debt timeline details */}
      <AnimatePresence>
        {showTimeline && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={springs.gentle}
            style={{ overflow: "hidden", marginBottom: 16 }}
          >
            <PayoffTimeline
              debts={activeDebts}
              snowball={snowball}
              avalanche={avalanche}
              recommended={recommended}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recommendation */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        style={{
          padding: "12px 16px",
          borderRadius: borderRadius.md,
          background: "rgba(6, 214, 160, 0.08)",
          border: "1px solid rgba(6, 214, 160, 0.2)",
        }}
      >
        <p
          style={{
            fontSize: pxToRem(13),
            fontWeight: 600,
            color: "var(--success)",
            margin: 0,
            fontFamily: FONT_FAMILY,
          }}
        >
          {"\uD83D\uDCA1"} We&apos;d suggest: {strategyLabel(recommended)}
        </p>
        <p
          style={{
            fontSize: pxToRem(12),
            color: "var(--sub)",
            margin: "4px 0 0",
            fontFamily: FONT_FAMILY,
          }}
        >
          {recommended === "avalanche" && interestSaved > 0
            ? `You'd save ${formatCurrency(interestSaved)} in interest. ${strategyDescription(recommended)}.`
            : interestSaved > 0
              ? `Avalanche saves ${formatCurrency(interestSaved)} in interest, but snowball gives you quick wins to stay motivated.`
              : "Both strategies cost about the same \u2014 snowball gives you quicker wins along the way."}
        </p>
      </motion.div>
    </GlassCard>
  )
}

// ============================================================================
// StrategyCard sub-component
// ============================================================================

interface StrategyCardProps {
  name: StrategyName
  result: { totalMonths: number; totalInterestPaid: number }
  isRecommended: boolean
}

function StrategyCard({ name, result, isRecommended }: StrategyCardProps) {
  return (
    <div style={isRecommended ? strategyCardActiveStyle : strategyCardStyle}>
      <p
        style={{
          fontSize: pxToRem(11),
          fontWeight: 600,
          color: isRecommended ? "var(--success)" : "var(--muted)",
          margin: "0 0 8px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontFamily: FONT_FAMILY,
        }}
      >
        {isRecommended && "\u2713 "}
        {strategyLabel(name)}
      </p>
      <p
        style={{
          fontSize: pxToRem(12),
          color: "var(--sub)",
          margin: "0 0 2px",
          fontFamily: FONT_FAMILY,
        }}
      >
        {strategyDescription(name)}
      </p>
      <div style={{ marginTop: 10 }}>
        <p
          style={{
            fontSize: pxToRem(13),
            color: "var(--text)",
            fontWeight: 500,
            margin: "0 0 2px",
            fontFamily: FONT_FAMILY,
          }}
        >
          Debt-free: {getPayoffDate(result.totalMonths)}
        </p>
        <p
          style={{
            fontSize: pxToRem(12),
            color: "var(--muted)",
            margin: 0,
            fontFamily: FONT_FAMILY,
          }}
        >
          {formatMonths(result.totalMonths)} {"\u00B7"} {formatCurrency(result.totalInterestPaid)} interest
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// PayoffTimeline sub-component
// ============================================================================

interface PayoffTimelineProps {
  debts: Debt[]
  snowball: StrategyResult
  avalanche: StrategyResult
  recommended: StrategyName
}

/**
 * Shows a side-by-side comparison of per-debt payoff order for each strategy.
 * Makes the difference between snowball (smallest first) and avalanche
 * (highest rate first) visually clear.
 */
function PayoffTimeline({ debts, snowball, avalanche, recommended }: PayoffTimelineProps) {
  const debtMap = useMemo(() => {
    const map = new Map<string, Debt>()
    debts.forEach(d => map.set(d.id, d))
    return map
  }, [debts])

  // Sort payoff schedules by payoff order (month ascending)
  const snowballSchedule = [...snowball.payoffSchedule].sort((a, b) => a.paidOffMonth - b.paidOffMonth)
  const avalancheSchedule = [...avalanche.payoffSchedule].sort((a, b) => a.paidOffMonth - b.paidOffMonth)

  return (
    <div style={{ display: "flex", gap: 10 }}>
      {/* Snowball timeline */}
      <TimelineColumn
        name="snowball"
        schedule={snowballSchedule}
        debtMap={debtMap}
        isRecommended={recommended === "snowball"}
      />
      {/* Avalanche timeline */}
      <TimelineColumn
        name="avalanche"
        schedule={avalancheSchedule}
        debtMap={debtMap}
        isRecommended={recommended === "avalanche"}
      />
    </div>
  )
}

// ============================================================================
// TimelineColumn sub-component
// ============================================================================

interface TimelineColumnProps {
  name: StrategyName
  schedule: { debtId: string; paidOffMonth: number }[]
  debtMap: Map<string, Debt>
  isRecommended: boolean
}

function TimelineColumn({ name, schedule, debtMap, isRecommended }: TimelineColumnProps) {
  return (
    <div
      style={{
        flex: 1,
        padding: "12px 14px",
        borderRadius: borderRadius.md,
        background: isRecommended ? "rgba(6, 214, 160, 0.03)" : "rgba(255, 255, 255, 0.02)",
        border: isRecommended
          ? "1px solid rgba(6, 214, 160, 0.25)"
          : "1px solid var(--border)",
      }}
    >
      <p
        style={{
          fontSize: pxToRem(11),
          fontWeight: 600,
          color: isRecommended ? "var(--success)" : "var(--muted)",
          margin: "0 0 10px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontFamily: FONT_FAMILY,
        }}
      >
        {strategyLabel(name)} order
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {schedule.map((entry, index) => {
          const debt = debtMap.get(entry.debtId)
          if (!debt) return null

          return (
            <motion.div
              key={entry.debtId}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springs.gentle, delay: index * 0.05 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {/* Order number */}
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: isRecommended
                    ? "rgba(6, 214, 160, 0.15)"
                    : "rgba(255, 255, 255, 0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: pxToRem(10),
                  fontWeight: 600,
                  color: isRecommended ? "var(--success)" : "var(--muted)",
                  fontFamily: FONT_FAMILY,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>

              {/* Debt info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: pxToRem(12),
                    fontWeight: 500,
                    color: "var(--text)",
                    margin: 0,
                    fontFamily: FONT_FAMILY,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {emojiForDebt(debt)} {debt.name}
                </p>
                <p
                  style={{
                    fontSize: pxToRem(11),
                    color: "var(--muted)",
                    margin: 0,
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  {getPayoffDateFromMonth(entry.paidOffMonth)}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
