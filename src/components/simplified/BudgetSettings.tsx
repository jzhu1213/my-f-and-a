"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { isCategoryRolloverEnabled, setCategoryRolloverEnabled } from "@/lib/budgetUtils"
import { computeBudgetSummary, computeDailyEquivalent } from "@/lib/budgetSummary"
import { BUDGET_CATEGORIES } from "@/types"
import type { Budget, TransactionCategory } from "@/types"
import { FONT_FAMILY } from "@/styles/typography"
import { borderRadius } from "@/styles/shared"

// ============================================================================
// Types
// ============================================================================

export interface BudgetSettingsProps {
  /** Current budget limits */
  budgets: Budget[]
  /** Called when user changes a limit */
  onUpdateBudget: (category: TransactionCategory, limit: number) => void
  /** Optional back navigation */
  onBack?: () => void
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
export function BudgetSettings({ budgets, onUpdateBudget, onBack }: BudgetSettingsProps) {
  const [expandedCategory, setExpandedCategory] = useState<TransactionCategory | null>(null)
  const [localLimits, setLocalLimits] = useState<Record<string, number>>({})
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [rolloverEnabled, setRolloverEnabled] = useState(false)
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Hydrate rollover toggle from localStorage
  useEffect(() => {
    setRolloverEnabled(isCategoryRolloverEnabled())
  }, [])

  // ── Compute total budget and daily allowance ──────────────────────────────
  const { totalMonthly, dailyBudget } = useMemo(() => {
    return computeBudgetSummary(budgets, localLimits)
  }, [budgets, localLimits])

  // ── Get the effective limit for a category ────────────────────────────────
  const getLimit = useCallback(
    (category: TransactionCategory): number => {
      if (localLimits[category] !== undefined) return localLimits[category]
      const budget = budgets.find(b => b.category === category)
      return budget?.monthlyLimit ?? 0
    },
    [budgets, localLimits]
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
            fontSize: 14,
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </motion.button>
      )}

      {/* ── Summary Header (Task 12.3) ─────────────────────────────────────── */}
      <GlassCard elevation="medium" style={{ padding: "20px 24px", marginBottom: 20 }}>
        <p
          style={{
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 8,
            fontFamily: FONT_FAMILY,
            letterSpacing: "0.02em",
          }}
        >
          Total Monthly Budget
        </p>
        <p
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "var(--text)",
            fontFamily: FONT_FAMILY,
            lineHeight: 1.1,
          }}
        >
          ${totalMonthly.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          <span style={{ fontSize: 16, fontWeight: 400, color: "var(--sub)", marginLeft: 4 }}>
            /mo
          </span>
        </p>
        <p
          style={{
            fontSize: 14,
            color: "var(--sub)",
            marginTop: 6,
            fontFamily: FONT_FAMILY,
          }}
        >
          ≈ ${dailyBudget.toFixed(0)}/day
        </p>
      </GlassCard>

      {/* ── Category Limits List (Task 12.1 & 12.2) ────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "8px 0", marginBottom: 20 }}>
        <div style={{ padding: "12px 20px 8px" }}>
          <p
            style={{
              fontSize: 13,
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
          const isExpanded = expandedCategory === cat.category
          const weeklyEquiv = limit / 4.33
          const dailyEquiv = computeDailyEquivalent(limit)

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
                  background: isExpanded ? "rgba(255,255,255,0.03)" : "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  fontFamily: FONT_FAMILY,
                  textAlign: "left",
                }}
                aria-expanded={isExpanded}
                aria-label={`${cat.label} budget limit: $${limit} per month`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{cat.emoji}</span>
                  <span style={{ fontSize: 15, color: "var(--text)", fontWeight: 500 }}>
                    {cat.label}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 15,
                      color: limit > 0 ? "var(--text)" : "var(--muted)",
                      fontWeight: 500,
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
                        background: "rgba(255,255,255,0.02)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {/* Stepper controls for precise adjustment */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 16,
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
                            background: limit > SLIDER_MIN ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                            border: "1px solid var(--border)",
                            borderRadius: borderRadius.sm,
                            cursor: limit > SLIDER_MIN ? "pointer" : "not-allowed",
                            color: limit > SLIDER_MIN ? "var(--text)" : "var(--muted)",
                            fontSize: 18,
                            fontWeight: 600,
                          }}
                          aria-label="Decrease by $50"
                        >
                          −
                        </motion.button>
                        
                        <div style={{ flex: 1, textAlign: "center" }}>
                          <div
                            style={{
                              fontSize: 24,
                              fontWeight: 700,
                              color: "var(--text)",
                              fontFamily: FONT_FAMILY,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            ${limit}
                            <span style={{ fontSize: 14, fontWeight: 400, color: "var(--sub)", marginLeft: 4 }}>
                              /mo
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
                            background: limit < SLIDER_MAX ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                            border: "1px solid var(--border)",
                            borderRadius: borderRadius.sm,
                            cursor: limit < SLIDER_MAX ? "pointer" : "not-allowed",
                            color: limit < SLIDER_MAX ? "var(--text)" : "var(--muted)",
                            fontSize: 18,
                            fontWeight: 600,
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
                          background: `linear-gradient(to right, var(--success) 0%, var(--success) ${(limit / SLIDER_MAX) * 100}%, var(--border) ${(limit / SLIDER_MAX) * 100}%, var(--border) 100%)`,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      />

                      {/* Slider labels */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: 8,
                          fontSize: 11,
                          color: "var(--muted)",
                          fontFamily: FONT_FAMILY,
                        }}
                      >
                        <span>$0</span>
                        <span>$2,000</span>
                      </div>

                      {/* Weekly and daily equivalents */}
                      <div
                        style={{
                          display: "flex",
                          gap: 16,
                          marginTop: 14,
                          fontSize: 13,
                          color: "var(--sub)",
                          fontFamily: FONT_FAMILY,
                        }}
                      >
                        <span>≈ ${weeklyEquiv.toFixed(0)}/week</span>
                        <span>≈ ${dailyEquiv.toFixed(0)}/day</span>
                      </div>

                      {/* Remove limit button */}
                      <motion.button
                        onClick={() => handleRemoveLimit(cat.category)}
                        whileTap={{ scale: 0.96 }}
                        transition={springs.bouncy}
                        style={{
                          marginTop: 14,
                          padding: "8px 14px",
                          fontSize: 12,
                          fontFamily: FONT_FAMILY,
                          color: "var(--error)",
                          background: "rgba(248, 113, 113, 0.08)",
                          border: "1px solid rgba(248, 113, 113, 0.2)",
                          borderRadius: borderRadius.sm,
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                        aria-label={`Remove ${cat.label} limit`}
                      >
                        Remove limit
                      </motion.button>
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
            fontSize: 14,
            fontFamily: FONT_FAMILY,
            fontWeight: 500,
            color: "var(--sub)",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            borderRadius: borderRadius.md,
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
              fontSize: 14,
              color: "var(--text)",
              fontFamily: FONT_FAMILY,
              marginBottom: 12,
            }}
          >
            Reset all category limits to default values?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <motion.button
              onClick={() => setShowResetConfirm(false)}
              whileTap={{ scale: 0.96 }}
              transition={springs.bouncy}
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: 13,
                fontFamily: FONT_FAMILY,
                fontWeight: 500,
                color: "var(--sub)",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                borderRadius: borderRadius.sm,
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
                fontSize: 13,
                fontFamily: FONT_FAMILY,
                fontWeight: 500,
                color: "var(--text)",
                background: "var(--accent)",
                border: "1px solid var(--accent)",
                borderRadius: borderRadius.sm,
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
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
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
              borderRadius: 14,
              border: "none",
              cursor: "pointer",
              background: rolloverEnabled
                ? "var(--success)"
                : "rgba(255, 255, 255, 0.12)",
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
                borderRadius: borderRadius.md,
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </motion.button>
        </div>

        <p
          style={{
            fontSize: 12,
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
              fontSize: 12,
              color: "var(--muted)",
              lineHeight: 1.5,
              fontFamily: FONT_FAMILY,
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: borderRadius.sm,
              background: "rgba(255,255,255,0.03)",
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
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .budget-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--text);
          cursor: pointer;
          border: 2px solid var(--success);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
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
