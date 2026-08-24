"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { isCategoryRolloverEnabled, setCategoryRolloverEnabled } from "@/lib/budgetUtils"
import { computeBudgetSummary, computeDailyEquivalent } from "@/lib/budgetSummary"
import { getIncomeProjection } from "@/lib/incomePatterns"
import { BUDGET_CATEGORIES } from "@/types"
import type { Budget, Transaction, TransactionCategory } from "@/types"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { segmentedControl, segmentedButtonBase, shadows, fills, colorRamp, HORIZONTAL_PADDING } from "@/styles/shared"
import { radius } from '@/styles/surfaces'

// ============================================================================
// Limit-type persistence helpers (localStorage, keyed per category)
// ============================================================================

const LIMIT_TYPE_STORAGE_KEY = "folio-limit-types"

function loadLimitTypes(): Record<string, "soft" | "hard"> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(LIMIT_TYPE_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, "soft" | "hard">
  } catch {
    return {}
  }
}

function saveLimitType(category: TransactionCategory, type: "soft" | "hard"): void {
  if (typeof window === "undefined") return
  try {
    const existing = loadLimitTypes()
    existing[category] = type
    localStorage.setItem(LIMIT_TYPE_STORAGE_KEY, JSON.stringify(existing))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

// ============================================================================
// Period persistence helpers (localStorage, keyed per category)
// ============================================================================

const BUDGET_PERIODS_STORAGE_KEY = "folio-budget-periods"

function loadBudgetPeriods(): Record<string, "monthly" | "weekly" | "payday_aligned" | "semester"> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(BUDGET_PERIODS_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, "monthly" | "weekly" | "payday_aligned" | "semester">
  } catch {
    return {}
  }
}

function saveBudgetPeriod(category: TransactionCategory, period: "monthly" | "weekly" | "payday_aligned" | "semester"): void {
  if (typeof window === "undefined") return
  try {
    const existing = loadBudgetPeriods()
    existing[category] = period
    localStorage.setItem(BUDGET_PERIODS_STORAGE_KEY, JSON.stringify(existing))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

// ============================================================================
// Per-transaction alert persistence helpers (localStorage, keyed per category)
// ============================================================================

const PER_TX_ALERTS_STORAGE_KEY = "folio-per-tx-alerts"

function loadPerTxAlerts(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(PER_TX_ALERTS_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, number>
  } catch {
    return {}
  }
}

function savePerTxAlert(category: TransactionCategory, threshold: number): void {
  if (typeof window === "undefined") return
  try {
    const existing = loadPerTxAlerts()
    if (threshold > 0) {
      existing[category] = threshold
    } else {
      delete existing[category]
    }
    localStorage.setItem(PER_TX_ALERTS_STORAGE_KEY, JSON.stringify(existing))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

// ============================================================================
// Types
// ============================================================================

export interface BudgetSettingsProps {
  /** Current budget limits */
  budgets: Budget[]
  /** Called when user changes a limit */
  onUpdateBudget: (category: TransactionCategory, limit: number) => void
  /**
   * Called when user changes the limit type for a category.
   * Optional — if not provided, limit-type changes are still persisted to
   * localStorage but the parent is not notified.
   */
  onUpdateLimitType?: (category: TransactionCategory, limitType: "soft" | "hard") => void
  /**
   * Called when user changes the period for a category.
   * Optional — if not provided, period changes are still persisted to
   * localStorage but the parent is not notified.
   */
  onUpdatePeriod?: (category: TransactionCategory, period: "monthly" | "weekly" | "payday_aligned" | "semester") => void
  /**
   * Called when user changes the per-transaction alert threshold for a category.
   * Optional — if not provided, alert changes are still persisted to
   * localStorage but the parent is not notified.
   */
  onUpdatePerTransactionAlert?: (category: TransactionCategory, threshold: number) => void
  /** Optional back navigation */
  onBack?: () => void
  /**
   * Optional pay schedule. When provided, a third period option ("Payday cycle")
   * is shown alongside Monthly and Weekly so the user can align a budget to their
   * pay cycle instead of calendar-month boundaries.
   */
  paySchedule?: { cadence: string } | null
  /** All transactions, used for income projection (optional) */
  transactions?: Transaction[]
  /** Called when user accepts the projected income as their budget basis */
  onAcceptProjectedIncome?: (projectedIncome: number) => void
}

// ============================================================================
// Constants
// ============================================================================

const SLIDER_MIN = 0
const SLIDER_MAX = 2000
const SLIDER_STEP = 10
const DEBOUNCE_MS = 300

const DEFAULT_LIMITS: Record<string, number> = {
  food: 400,
  rent: 800,
  transport: 150,
  school: 200,
  fun: 150,
  other: 100,
}

// ============================================================================
// BudgetSettings Component
// ============================================================================

/**
 * BudgetSettings — a cleaner settings-style screen for managing category
 * budget limits. Replaces the old LimitsView with inline expandable rows
 * and slider-based editing.
 *
 * Validates: Requirements 12.1, 12.2, 1.1
 */
export function BudgetSettings({ budgets, onUpdateBudget, onUpdateLimitType, onUpdatePeriod, onUpdatePerTransactionAlert, onBack, paySchedule, transactions, onAcceptProjectedIncome }: BudgetSettingsProps) {
  const [expandedCategory, setExpandedCategory] = useState<TransactionCategory | null>(null)
  const [localLimits, setLocalLimits] = useState<Record<string, number>>({})
  const [limitTypes, setLimitTypes] = useState<Record<string, "soft" | "hard">>({})
  const [budgetPeriods, setBudgetPeriods] = useState<Record<string, "monthly" | "weekly" | "payday_aligned" | "semester">>({})
  const [perTxAlerts, setPerTxAlerts] = useState<Record<string, number>>({})
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [rolloverEnabled, setRolloverEnabled] = useState(false)
  const [projectionDismissed, setProjectionDismissed] = useState(false)
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Hydrate rollover toggle from localStorage
  useEffect(() => {
    setRolloverEnabled(isCategoryRolloverEnabled())
  }, [])

  // Hydrate limit types from localStorage
  useEffect(() => {
    setLimitTypes(loadLimitTypes())
  }, [])

  // Hydrate budget periods from localStorage
  useEffect(() => {
    setBudgetPeriods(loadBudgetPeriods())
  }, [])

  // Hydrate per-tx alerts from localStorage
  useEffect(() => {
    setPerTxAlerts(loadPerTxAlerts())
  }, [])

  // ── Compute total budget and daily allowance ──────────────────────────────
  const { totalMonthly, dailyBudget } = useMemo(() => {
    return computeBudgetSummary(budgets, localLimits)
  }, [budgets, localLimits])

  // ── Compute income projection from transaction history ────────────────────
  const incomeProjection = useMemo(() => {
    if (!transactions || transactions.length === 0) return null
    return getIncomeProjection(transactions, new Date())
  }, [transactions])

  // ── Get the effective limit for a category ────────────────────────────────
  const getLimit = useCallback(
    (category: TransactionCategory): number => {
      if (localLimits[category] !== undefined) return localLimits[category]
      const budget = budgets.find(b => b.category === category)
      return budget?.monthlyLimit ?? 0
    },
    [budgets, localLimits]
  )

  // ── Get the limit type for a category ────────────────────────────────────
  const getLimitType = useCallback(
    (category: TransactionCategory): "soft" | "hard" => {
      // Prefer stored local state, then the budget object, then default 'soft'
      return limitTypes[category] ?? budgets.find(b => b.category === category)?.limitType ?? "soft"
    },
    [budgets, limitTypes]
  )

  // ── Handle limit-type toggle ──────────────────────────────────────────────
  const handleLimitTypeChange = useCallback(
    (category: TransactionCategory, type: "soft" | "hard") => {
      setLimitTypes(prev => ({ ...prev, [category]: type }))
      saveLimitType(category, type)
      onUpdateLimitType?.(category, type)
    },
    [onUpdateLimitType]
  )

  // ── Get the period for a category ─────────────────────────────────────────
  const getBudgetPeriod = useCallback(
    (category: TransactionCategory): "monthly" | "weekly" | "payday_aligned" | "semester" => {
      return budgetPeriods[category] ?? budgets.find(b => b.category === category)?.period ?? "monthly"
    },
    [budgets, budgetPeriods]
  )

  // ── Handle period toggle ──────────────────────────────────────────────────
  const handlePeriodChange = useCallback(
    (category: TransactionCategory, period: "monthly" | "weekly" | "payday_aligned" | "semester") => {
      setBudgetPeriods(prev => ({ ...prev, [category]: period }))
      saveBudgetPeriod(category, period)
      onUpdatePeriod?.(category, period)
    },
    [onUpdatePeriod]
  )

  // ── Get the per-tx alert for a category ───────────────────────────────────
  const getPerTxAlert = useCallback(
    (category: TransactionCategory): number => {
      if (perTxAlerts[category] !== undefined) return perTxAlerts[category]
      return budgets.find(b => b.category === category)?.perTransactionAlert ?? 0
    },
    [budgets, perTxAlerts]
  )

  // ── Handle per-tx alert change ────────────────────────────────────────────
  const handlePerTxAlertChange = useCallback(
    (category: TransactionCategory, threshold: number) => {
      const clamped = Math.max(0, threshold)
      setPerTxAlerts(prev => ({ ...prev, [category]: clamped }))
      savePerTxAlert(category, clamped)
      onUpdatePerTransactionAlert?.(category, clamped)
    },
    [onUpdatePerTransactionAlert]
  )

  // ── Handle slider change (local state update) ─────────────────────────────
  const handleSliderChange = useCallback(
    (category: TransactionCategory, value: number) => {
      setLocalLimits(prev => ({ ...prev, [category]: value }))
    },
    []
  )

  // ── Save on slider release (debounced) ────────────────────────────────────
  const handleSliderRelease = useCallback(
    (category: TransactionCategory) => {
      const value = localLimits[category]
      if (value === undefined) return

      // Clear existing debounce for this category
      if (debounceRef.current[category]) {
        clearTimeout(debounceRef.current[category])
      }

      debounceRef.current[category] = setTimeout(() => {
        onUpdateBudget(category, value)
        delete debounceRef.current[category]
      }, DEBOUNCE_MS)
    },
    [localLimits, onUpdateBudget]
  )

  // ── Stepper increment/decrement ───────────────────────────────────────────
  const handleStepChange = useCallback(
    (category: TransactionCategory, delta: number) => {
      const currentLimit = getLimit(category)
      const newLimit = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, currentLimit + delta))
      setLocalLimits(prev => ({ ...prev, [category]: newLimit }))
      
      // Immediately persist stepper changes
      if (debounceRef.current[category]) {
        clearTimeout(debounceRef.current[category])
      }
      debounceRef.current[category] = setTimeout(() => {
        onUpdateBudget(category, newLimit)
        delete debounceRef.current[category]
      }, DEBOUNCE_MS)
    },
    [getLimit, onUpdateBudget]
  )

  // ── Remove limit ──────────────────────────────────────────────────────────
  const handleRemoveLimit = useCallback(
    (category: TransactionCategory) => {
      if (window.confirm(`Remove ${BUDGET_CATEGORIES.find(c => c.category === category)?.label} limit? This will set it to $0.`)) {
        setLocalLimits(prev => ({ ...prev, [category]: 0 }))
        onUpdateBudget(category, 0)
      }
    },
    [onUpdateBudget]
  )

  // ── Reset all to defaults ─────────────────────────────────────────────────
  const handleResetDefaults = useCallback(() => {
    const newLimits: Record<string, number> = {}
    for (const cat of BUDGET_CATEGORIES) {
      const defaultVal = DEFAULT_LIMITS[cat.category] ?? 0
      newLimits[cat.category] = defaultVal
      onUpdateBudget(cat.category, defaultVal)
    }
    setLocalLimits(newLimits)
    setShowResetConfirm(false)
  }, [onUpdateBudget])

  // ── Toggle category rollover ──────────────────────────────────────────────
  const handleRolloverToggle = useCallback(() => {
    const next = !rolloverEnabled
    setRolloverEnabled(next)
    setCategoryRolloverEnabled(next)
  }, [rolloverEnabled])

  // ── Toggle row expansion & persist any pending changes ────────────────────
  const toggleCategory = useCallback(
    (category: TransactionCategory) => {
      // If collapsing a category with pending changes, persist immediately
      if (expandedCategory === category && localLimits[category] !== undefined) {
        const value = localLimits[category]
        if (debounceRef.current[category]) {
          clearTimeout(debounceRef.current[category])
          delete debounceRef.current[category]
        }
        onUpdateBudget(category, value)
      }
      
      setExpandedCategory(prev => (prev === category ? null : category))
    },
    [expandedCategory, localLimits, onUpdateBudget]
  )

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "0 20px",
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ── Back Button ────────────────────────────────────────────────────── */}
      {onBack && (
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.96 }}
          transition={springs.bouncy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "12px 0",
            background: "none",
            border: "none",
            color: "var(--muted)",
            cursor: "pointer",
            fontFamily: FONT_FAMILY,
            fontSize: typography.body.fontSize,
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </motion.button>
      )}

      {/* ── Summary Header (Task 12.3) ─────────────────────────────────────── */}
      <GlassCard elevation="medium" style={{ padding: "20px 24px", marginBottom: HORIZONTAL_PADDING }}>
        <p
          style={{
            fontSize: typography['body-sm'].fontSize,
            color: "var(--muted)",
            marginBottom: spacing.xs,
            fontFamily: FONT_FAMILY,
            letterSpacing: "0.02em",
          }}
        >
          Total Monthly Budget
        </p>
        <p
          style={{
            fontSize: typography.title.fontSize,
            fontWeight: fontWeights.bold,
            color: "var(--text)",
            fontFamily: FONT_FAMILY,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.1,
          }}
        >
          ${totalMonthly.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          <span style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.regular, color: "var(--sub)", marginLeft: 4 }}>
            /mo
          </span>
        </p>
        <p
          style={{
            fontSize: typography.body.fontSize,
            color: "var(--sub)",
            marginTop: 6,
            fontFamily: FONT_FAMILY,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ≈ ${dailyBudget.toFixed(0)}/day
        </p>
      </GlassCard>

      {/* ── Income Projection Card (Task 335.2) ────────────────────────────── */}
      {incomeProjection && incomeProjection.confidence >= 0.4 && !projectionDismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={springs.gentle}
        >
          <GlassCard elevation="low" style={{ padding: "14px 18px", marginBottom: HORIZONTAL_PADDING, position: "relative" }}>
            {/* Dismiss button */}
            <button
              onClick={() => setProjectionDismissed(true)}
              aria-label="Dismiss income projection"
              style={{
                position: "absolute",
                top: 10,
                right: 12,
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                padding: 4,
                lineHeight: 1,
                fontSize: typography.body.fontSize,
              }}
            >
              ✕
            </button>

            <p
              style={{
                fontSize: typography['body-sm'].fontSize,
                color: "var(--muted)",
                fontFamily: FONT_FAMILY,
                marginBottom: 6,
                paddingRight: 24,
              }}
            >
              {incomeProjection.confidence >= 0.7
                ? "Based on your last few months, you'll likely earn around"
                : "We're still learning your pattern, but you might earn around"}
            </p>
            <p
              style={{
                fontSize: typography.subhead.fontSize,
                fontWeight: fontWeights.semibold,
                color: "var(--text)",
                fontFamily: FONT_FAMILY,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.2,
              }}
            >
              ${Math.round(incomeProjection.projectedMonthlyIncome).toLocaleString("en-US")}
              <span style={{ fontSize: typography['body-sm'].fontSize, fontWeight: fontWeights.regular, color: "var(--sub)", marginLeft: 4 }}>
                /mo
              </span>
            </p>

            {/* Confidence band — shown for high confidence */}
            {incomeProjection.confidence >= 0.7 && (
              <p
                style={{
                  fontSize: typography['body-sm'].fontSize,
                  color: "var(--sub)",
                  fontFamily: FONT_FAMILY,
                  marginTop: 4,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                Usually between ${Math.round(incomeProjection.confidenceBand.low).toLocaleString("en-US")}–${Math.round(incomeProjection.confidenceBand.high).toLocaleString("en-US")}
              </p>
            )}

            {/* Accept button */}
            {onAcceptProjectedIncome && (
              <motion.button
                onClick={() => onAcceptProjectedIncome(incomeProjection.projectedMonthlyIncome)}
                whileTap={{ scale: 0.96 }}
                transition={springs.bouncy}
                style={{
                  marginTop: 10,
                  padding: "6px 14px",
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.medium,
                  fontFamily: FONT_FAMILY,
                  background: "var(--accent)",
                  color: "var(--text)",
                  border: "none",
                  borderRadius: radius.card,
                  cursor: "pointer",
                }}
              >
                Use this
              </motion.button>
            )}
          </GlassCard>
        </motion.div>
      )}

      {/* ── Category Limits List (Task 12.1 & 12.2) ────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "8px 0", marginBottom: HORIZONTAL_PADDING }}>
        <div style={{ padding: "12px 20px 8px" }}>
          <p
            style={{
              fontSize: typography['body-sm'].fontSize,
              color: "var(--muted)",
              fontFamily: FONT_FAMILY,
              letterSpacing: "0.02em",
            }}
          >
            Category Limits
          </p>
        </div>

        {BUDGET_CATEGORIES.map(cat => {
          const limit = getLimit(cat.category)
          const currentLimitType = getLimitType(cat.category)
          const isFirm = currentLimitType === "hard"
          const isExpanded = expandedCategory === cat.category
          const currentPeriod = getBudgetPeriod(cat.category)
          const isWeekly = currentPeriod === "weekly"
          const isPaydayAligned = currentPeriod === "payday_aligned"
          const isSemester = currentPeriod === "semester"
          // When weekly: the limit IS the weekly amount; monthly equiv = limit × 4.33
          // When monthly or payday_aligned: weekly equiv = limit / 4.33
          const weeklyEquiv = isWeekly ? limit : limit / 4.33
          const dailyEquiv = isWeekly
            ? computeDailyEquivalent(limit * 4.33)
            : computeDailyEquivalent(limit)
          const currentPerTxAlert = getPerTxAlert(cat.category)

          return (
            <div key={cat.category}>
              {/* Category Row */}
              <motion.button
                onClick={() => toggleCategory(cat.category)}
                whileTap={{ scale: 0.98 }}
                transition={springs.bouncy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "14px 20px",
                  background: isExpanded ? "var(--fill-03)" : "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  fontFamily: FONT_FAMILY,
                  textAlign: "left",
                }}
                aria-expanded={isExpanded}
                aria-label={limit > 0 ? `${cat.label} budget limit: $${limit} per month` : `${cat.label}: no limit set — tap to add one`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                  <span style={{ fontSize: typography.headline.fontSize, lineHeight: 1 }}>{cat.emoji}</span>
                  <span style={{ fontSize: typography.body.fontSize, color: "var(--text)", fontWeight: fontWeights.medium }}>
                    {cat.label}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
                  {isFirm && limit > 0 && (
                    <span
                      style={{
                        fontSize: typography.caption.fontSize,
                        fontWeight: fontWeights.semibold,
                        color: colorRamp.warning[500],
                        background: colorRamp.warning[100],
                        border: `1px solid ${colorRamp.warning[300]}`,
                        borderRadius: radius.full,
                        padding: "2px 7px",
                        letterSpacing: "0.04em",
                        fontFamily: FONT_FAMILY,
                        textTransform: "uppercase",
                      }}
                    >
                      Firm
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: typography.body.fontSize,
                      color: limit > 0 ? "var(--text)" : "var(--muted)",
                      fontWeight: fontWeights.medium,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {limit > 0 ? `$${limit}` : "Not set"}
                  </span>
                  <motion.svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth={2}
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={timings.fast}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </div>
              </motion.button>

              {/* Expanded Slider Panel (Task 12.2) */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={timings.normal}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      style={{
                        padding: "16px 20px 20px",
                        background: "var(--fill-02)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {/* Stepper controls for precise adjustment */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: spacing.sm,
                          marginBottom: spacing.md,
                        }}
                      >
                        <motion.button
                          onClick={() => handleStepChange(cat.category, -50)}
                          whileTap={{ scale: 0.96 }}
                          transition={springs.bouncy}
                          disabled={limit <= SLIDER_MIN}
                          style={{
                            width: 36,
                            height: 36,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: limit > SLIDER_MIN ? "var(--fill-06)" : "var(--fill-02)",
                            border: "1px solid var(--border)",
                            borderRadius: radius.control,
                            cursor: limit > SLIDER_MIN ? "pointer" : "not-allowed",
                            color: limit > SLIDER_MIN ? "var(--text)" : "var(--muted)",
                            fontSize: typography.subhead.fontSize,
                            fontWeight: fontWeights.semibold,
                          }}
                          aria-label="Decrease by $50"
                        >
                          −
                        </motion.button>
                        
                        <div style={{ flex: 1, textAlign: "center" }}>
                          <div
                            style={{
                              fontSize: typography.headline.fontSize,
                              fontWeight: fontWeights.bold,
                              color: "var(--text)",
                              fontFamily: FONT_FAMILY,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            ${limit}
                            <span style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.regular, color: "var(--sub)", marginLeft: 4 }}>
                              {isWeekly ? "/week" : "/mo"}
                            </span>
                          </div>
                        </div>

                        <motion.button
                          onClick={() => handleStepChange(cat.category, 50)}
                          whileTap={{ scale: 0.96 }}
                          transition={springs.bouncy}
                          disabled={limit >= SLIDER_MAX}
                          style={{
                            width: 36,
                            height: 36,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: limit < SLIDER_MAX ? "var(--fill-06)" : "var(--fill-02)",
                            border: "1px solid var(--border)",
                            borderRadius: radius.control,
                            cursor: limit < SLIDER_MAX ? "pointer" : "not-allowed",
                            color: limit < SLIDER_MAX ? "var(--text)" : "var(--muted)",
                            fontSize: typography.subhead.fontSize,
                            fontWeight: fontWeights.semibold,
                          }}
                          aria-label="Increase by $50"
                        >
                          +
                        </motion.button>
                      </div>

                      {/* Slider */}
                      <input
                        type="range"
                        min={SLIDER_MIN}
                        max={SLIDER_MAX}
                        step={SLIDER_STEP}
                        value={limit}
                        onChange={e => handleSliderChange(cat.category, Number(e.target.value))}
                        onMouseUp={() => handleSliderRelease(cat.category)}
                        onTouchEnd={() => handleSliderRelease(cat.category)}
                        aria-label={`Set ${cat.label} monthly limit`}
                        className="budget-slider"
                        style={{
                          width: "100%",
                          height: 6,
                          borderRadius: 3,
                          appearance: "none",
                          background: `linear-gradient(to right, ${isFirm ? colorRamp.warning[500] : "var(--success)"} 0%, ${isFirm ? colorRamp.warning[500] : "var(--success)"} ${(limit / SLIDER_MAX) * 100}%, var(--border) ${(limit / SLIDER_MAX) * 100}%, var(--border) 100%)`,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      />

                      {/* Slider labels */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: spacing.xs,
                          fontSize: typography.caption.fontSize,
                          color: "var(--muted)",
                          fontFamily: FONT_FAMILY,
                        }}
                      >
                        <span>$0</span>
                        <span>$2,000{isWeekly ? "/week" : "/month"}</span>
                      </div>

                      {/* Weekly and daily equivalents */}
                      <div
                        style={{
                          display: "flex",
                          gap: spacing.md,
                          marginTop: 14,
                          fontSize: typography['body-sm'].fontSize,
                          color: "var(--sub)",
                          fontFamily: FONT_FAMILY,
                        }}
                      >
                        {isWeekly ? (
                          <>
                            <span>= ${limit}/week</span>
                            <span>≈ ${dailyEquiv.toFixed(0)}/day</span>
                          </>
                        ) : isPaydayAligned ? (
                          <>
                            <span>≈ ${weeklyEquiv.toFixed(0)}/week equiv</span>
                            <span>≈ ${dailyEquiv.toFixed(0)}/day</span>
                          </>
                        ) : (
                          <>
                            <span>≈ ${weeklyEquiv.toFixed(0)}/week</span>
                            <span>≈ ${dailyEquiv.toFixed(0)}/day</span>
                          </>
                        )}
                      </div>

                      {/* Remove limit button */}
                      <motion.button
                        onClick={() => handleRemoveLimit(cat.category)}
                        whileTap={{ scale: 0.96 }}
                        transition={springs.bouncy}
                        style={{
                          marginTop: 14,
                          padding: "8px 14px",
                          fontSize: typography['body-sm'].fontSize,
                          fontFamily: FONT_FAMILY,
                          color: "var(--error)",
                          background: colorRamp.error[100],
                          border: `1px solid ${colorRamp.error[200]}`,
                          borderRadius: radius.control,
                          cursor: "pointer",
                          fontWeight: fontWeights.medium,
                        }}
                        aria-label={`Remove ${cat.label} limit`}
                      >
                        Remove limit
                      </motion.button>

                      {/* ── Soft / Firm toggle (Task 98.2) ─────────────────── */}
                      {limit > 0 && (
                        <div style={{ marginTop: 18 }}>
                          <p
                            style={{
                              fontSize: typography['body-sm'].fontSize,
                              color: "var(--muted)",
                              fontFamily: FONT_FAMILY,
                              marginBottom: spacing.xs,
                              letterSpacing: "0.03em",
                            }}
                          >
                            Limit type
                          </p>
                          <div
                            role="group"
                            aria-label={`Limit type for ${cat.label}`}
                            style={{ ...segmentedControl, maxWidth: 220 }}
                          >
                            <motion.button
                              onClick={() => handleLimitTypeChange(cat.category, "soft")}
                              whileTap={{ scale: 0.96 }}
                              transition={springs.bouncy}
                              role="radio"
                              aria-checked={!isFirm}
                              style={{
                                ...segmentedButtonBase,
                                background: !isFirm ? "var(--fill-08)" : "transparent",
                                color: !isFirm ? "var(--text)" : "var(--muted)",
                                boxShadow: !isFirm ? shadows.sm : "none",
                              }}
                            >
                              Soft
                            </motion.button>
                            <motion.button
                              onClick={() => handleLimitTypeChange(cat.category, "hard")}
                              whileTap={{ scale: 0.96 }}
                              transition={springs.bouncy}
                              role="radio"
                              aria-checked={isFirm}
                              style={{
                                ...segmentedButtonBase,
                                background: isFirm ? colorRamp.warning[200] : "transparent",
                                color: isFirm ? colorRamp.warning[500] : "var(--muted)",
                                boxShadow: isFirm ? shadows.sm : "none",
                              }}
                            >
                              Firm
                            </motion.button>
                          </div>
                          <p
                            style={{
                              fontSize: typography.caption.fontSize,
                              color: "var(--muted)",
                              fontFamily: FONT_FAMILY,
                              marginTop: 6,
                              lineHeight: 1.5,
                            }}
                          >
                            {isFirm
                              ? "Heads-up at 70% — you'll know before you're close."
                              : "Gentle nudge when you're near the limit."}
                          </p>
                        </div>
                      )}

                      {/* ── Period toggle: Monthly / Weekly (Task 102.1) ────── */}
                      {limit > 0 && (
                        <div style={{ marginTop: 18 }}>
                          <p
                            style={{
                              fontSize: typography['body-sm'].fontSize,
                              color: "var(--muted)",
                              fontFamily: FONT_FAMILY,
                              marginBottom: spacing.xs,
                              letterSpacing: "0.03em",
                            }}
                          >
                            Period
                          </p>
                          <div
                            role="group"
                            aria-label={`Budget period for ${cat.label}`}
                            style={{ ...segmentedControl, maxWidth: paySchedule ? 400 : 290 }}
                          >
                            <motion.button
                              onClick={() => handlePeriodChange(cat.category, "monthly")}
                              whileTap={{ scale: 0.96 }}
                              transition={springs.bouncy}
                              role="radio"
                              aria-checked={!isWeekly && !isPaydayAligned && !isSemester}
                              style={{
                                ...segmentedButtonBase,
                                background: !isWeekly && !isPaydayAligned && !isSemester ? "var(--fill-08)" : "transparent",
                                color: !isWeekly && !isPaydayAligned && !isSemester ? "var(--text)" : "var(--muted)",
                                boxShadow: !isWeekly && !isPaydayAligned && !isSemester ? shadows.sm : "none",
                              }}
                            >
                              Monthly
                            </motion.button>
                            <motion.button
                              onClick={() => handlePeriodChange(cat.category, "weekly")}
                              whileTap={{ scale: 0.96 }}
                              transition={springs.bouncy}
                              role="radio"
                              aria-checked={isWeekly}
                              style={{
                                ...segmentedButtonBase,
                                background: isWeekly ? "var(--accent-200)" : "transparent",
                                color: isWeekly ? "var(--accent)" : "var(--muted)",
                                boxShadow: isWeekly ? shadows.sm : "none",
                              }}
                            >
                              Weekly
                            </motion.button>
                            {!!paySchedule && (
                              <motion.button
                                onClick={() => handlePeriodChange(cat.category, "payday_aligned")}
                                whileTap={{ scale: 0.96 }}
                                transition={springs.bouncy}
                                role="radio"
                                aria-checked={isPaydayAligned}
                                style={{
                                  ...segmentedButtonBase,
                                  background: isPaydayAligned ? "var(--success-200)" : "transparent",
                                  color: isPaydayAligned ? "var(--success)" : "var(--muted)",
                                  boxShadow: isPaydayAligned ? shadows.sm : "none",
                                }}
                              >
                                Payday cycle
                              </motion.button>
                            )}
                            <motion.button
                              onClick={() => handlePeriodChange(cat.category, "semester")}
                              whileTap={{ scale: 0.96 }}
                              transition={springs.bouncy}
                              role="radio"
                              aria-checked={isSemester}
                              style={{
                                ...segmentedButtonBase,
                                background: isSemester ? colorRamp.warning[200] : "transparent",
                                color: isSemester ? "var(--warning)" : "var(--muted)",
                                boxShadow: isSemester ? shadows.sm : "none",
                              }}
                            >
                              Semester
                            </motion.button>
                          </div>
                          <p
                            style={{
                              fontSize: typography.caption.fontSize,
                              color: "var(--muted)",
                              fontFamily: FONT_FAMILY,
                              marginTop: 6,
                              lineHeight: 1.5,
                            }}
                          >
                            {isWeekly
                              ? `$${limit}/week — tracked on a 7-day rolling basis.`
                              : isPaydayAligned
                                ? `Resets with each paycheck — your daily budget adjusts to your pay cycle.`
                                : isSemester
                                  ? `Spreads across your whole term — make this last until the end.`
                                  : `$${limit}/month — divided into weekly chunks automatically.`}
                          </p>
                        </div>
                      )}

                      {/* ── Large purchase alert (Task 102.2) ───────────────── */}
                      {limit > 0 && (
                        <div style={{ marginTop: 18 }}>
                          <p
                            style={{
                              fontSize: typography['body-sm'].fontSize,
                              color: "var(--muted)",
                              fontFamily: FONT_FAMILY,
                              marginBottom: spacing.xs,
                              letterSpacing: "0.03em",
                            }}
                          >
                            Alert me when a single expense exceeds
                          </p>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: spacing.sm,
                            }}
                          >
                            <motion.button
                              onClick={() => handlePerTxAlertChange(cat.category, Math.max(0, currentPerTxAlert - 10))}
                              whileTap={{ scale: 0.96 }}
                              transition={springs.bouncy}
                              disabled={currentPerTxAlert <= 0}
                              aria-label="Decrease alert threshold by $10"
                              style={{
                                width: 32,
                                height: 32,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: currentPerTxAlert > 0 ? "var(--fill-06)" : "var(--fill-02)",
                                border: "1px solid var(--border)",
                                borderRadius: radius.control,
                                cursor: currentPerTxAlert > 0 ? "pointer" : "not-allowed",
                                color: currentPerTxAlert > 0 ? "var(--text)" : "var(--muted)",
                                fontSize: typography.body.fontSize,
                                fontWeight: fontWeights.semibold,
                                fontFamily: FONT_FAMILY,
                              }}
                            >
                              −
                            </motion.button>

                            <div
                              style={{
                                flex: 1,
                                textAlign: "center",
                                fontSize: typography.body.fontSize,
                                fontWeight: fontWeights.semibold,
                                color: currentPerTxAlert > 0 ? "var(--text)" : "var(--muted)",
                                fontFamily: FONT_FAMILY,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {currentPerTxAlert > 0 ? `$${currentPerTxAlert}` : "Off"}
                            </div>

                            <motion.button
                              onClick={() => handlePerTxAlertChange(cat.category, currentPerTxAlert + 10)}
                              whileTap={{ scale: 0.96 }}
                              transition={springs.bouncy}
                              aria-label="Increase alert threshold by $10"
                              style={{
                                width: 32,
                                height: 32,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "var(--fill-06)",
                                border: "1px solid var(--border)",
                                borderRadius: radius.control,
                                cursor: "pointer",
                                color: "var(--text)",
                                fontSize: typography.body.fontSize,
                                fontWeight: fontWeights.semibold,
                                fontFamily: FONT_FAMILY,
                              }}
                            >
                              +
                            </motion.button>
                          </div>
                          <p
                            style={{
                              fontSize: typography.caption.fontSize,
                              color: "var(--muted)",
                              fontFamily: FONT_FAMILY,
                              marginTop: 6,
                              lineHeight: 1.5,
                            }}
                          >
                            {currentPerTxAlert > 0
                              ? `You'll get a gentle nudge for ${cat.label} expenses over $${currentPerTxAlert}.`
                              : "Set a threshold and we'll give you a gentle heads-up for big purchases."}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </GlassCard>

      {/* ── Reset to Defaults Button (Task 12.1) ──────────────────────────── */}
      {!showResetConfirm ? (
        <motion.button
          onClick={() => setShowResetConfirm(true)}
          whileTap={{ scale: 0.96 }}
          transition={springs.bouncy}
          style={{
            display: "block",
            width: "100%",
            padding: "14px 20px",
            fontSize: typography.body.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: fontWeights.medium,
            color: "var(--sub)",
            background: "var(--fill-03)",
            border: "1px solid var(--border)",
            borderRadius: radius.control,
            cursor: "pointer",
            textAlign: "center",
            marginBottom: 40,
          }}
          aria-label="Reset all limits to defaults"
        >
          Reset to defaults
        </motion.button>
      ) : (
        <GlassCard elevation="medium" style={{ padding: "16px 20px", marginBottom: 40 }}>
          <p
            style={{
              fontSize: typography.body.fontSize,
              color: "var(--text)",
              fontFamily: FONT_FAMILY,
              marginBottom: spacing.sm,
            }}
          >
            Reset all category limits to default values?
          </p>
          <div style={{ display: "flex", gap: spacing.xs }}>
            <motion.button
              onClick={() => setShowResetConfirm(false)}
              whileTap={{ scale: 0.96 }}
              transition={springs.bouncy}
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: typography['body-sm'].fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: fontWeights.medium,
                color: "var(--sub)",
                background: "var(--fill-03)",
                border: "1px solid var(--border)",
                borderRadius: radius.control,
                cursor: "pointer",
              }}
            >
              Cancel
            </motion.button>
            <motion.button
              onClick={handleResetDefaults}
              whileTap={{ scale: 0.96 }}
              transition={springs.bouncy}
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: typography['body-sm'].fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: fontWeights.medium,
                color: "var(--text)",
                background: "var(--accent)",
                border: "1px solid var(--accent)",
                borderRadius: radius.control,
                cursor: "pointer",
              }}
            >
              Reset
            </motion.button>
          </div>
        </GlassCard>
      )}

      {/* ── Category Rollover Toggle ──────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 40 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.xs,
          }}
        >
          <span
            style={{
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.medium,
              color: "var(--text)",
              fontFamily: FONT_FAMILY,
            }}
          >
            Roll unused budget to next week
          </span>

          {/* Toggle switch */}
          <motion.button
            onClick={handleRolloverToggle}
            whileTap={{ scale: 0.95 }}
            transition={springs.bouncy}
            role="switch"
            aria-checked={rolloverEnabled}
            aria-label="Toggle category budget rollover"
            style={{
              position: "relative",
              width: 48,
              height: 28,
              borderRadius: radius.control,
              border: "none",
              cursor: "pointer",
              background: rolloverEnabled
                ? "var(--success)"
                : "var(--fill-12)",
              transition: "background 0.2s",
              padding: 0,
            }}
          >
            <motion.span
              animate={{ x: rolloverEnabled ? 22 : 2 }}
              transition={springs.bouncy}
              style={{
                display: "block",
                position: "absolute",
                top: 2,
                left: 0,
                width: 24,
                height: 24,
                borderRadius: radius.control,
                background: "var(--text)",
                boxShadow: shadows.sm,
              }}
            />
          </motion.button>
        </div>

        <p
          style={{
            fontSize: typography['body-sm'].fontSize,
            color: "var(--sub)",
            lineHeight: 1.5,
            fontFamily: FONT_FAMILY,
          }}
        >
          Unspent category budget carries over (up to 50%)
        </p>

        {rolloverEnabled && (
          <p
            style={{
              fontSize: typography['body-sm'].fontSize,
              color: "var(--muted)",
              lineHeight: 1.5,
              fontFamily: FONT_FAMILY,
              marginTop: spacing.xs,
              padding: "8px 12px",
              borderRadius: radius.control,
              background: "var(--fill-03)",
              border: "1px solid var(--border)",
            }}
          >
            Turn off anytime to reset — your base budget stays the same.
          </p>
        )}
      </GlassCard>

      {/* ── Slider Styles for Cross-Browser Compatibility ──────────────────── */}
      <style jsx>{`
        .budget-slider::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--text);
          cursor: pointer;
          border: 2px solid var(--success);
          box-shadow: var(--shadow-sm);
        }

        .budget-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--text);
          cursor: pointer;
          border: 2px solid var(--success);
          box-shadow: var(--shadow-sm);
        }

        .budget-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        .budget-slider::-moz-range-thumb:hover {
          transform: scale(1.1);
        }
      `}</style>
    </div>
  )
}
