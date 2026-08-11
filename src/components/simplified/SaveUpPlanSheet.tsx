"use client"

import { useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { BottomSheet } from "@/components/ui/BottomSheet"
import { GlassCard } from "@/components/ui/GlassCard"
import {
  generateSaveUpScenarios,
  formatScenarioTimeline,
  DEFAULT_WEEKLY_RATES,
  type SaveUpScenario,
} from "@/lib/saveUpPlanUtils"
import { FONT_FAMILY } from '@/styles/typography'

// ============================================================================
// Types
// ============================================================================

export interface SaveUpPlanSheetProps {
  /** Whether the sheet is visible. */
  isOpen: boolean
  /** Close the sheet. */
  onClose: () => void
  /** Called when the user picks a scenario to create a goal from it. */
  onCreateGoal?: (data: {
    name: string
    targetAmount: number
    emoji: string
  }) => void
}

// ============================================================================
// SaveUpPlanSheet Component
// ============================================================================

/**
 * SaveUpPlanSheet — a friendly planning tool for big purchases. The user
 * enters a target amount (and optionally what they've already saved), and
 * sees multiple timeline scenarios at different weekly contribution rates.
 * They can select one to pre-fill a new savings goal.
 *
 * Uses GlassCard, framer-motion, and Inter font per the design system.
 *
 * Validates: Requirements 12.3, 12.4
 */
export function SaveUpPlanSheet({ isOpen, onClose, onCreateGoal }: SaveUpPlanSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()

  // ── Form state ──────────────────────────────────────────────────────────
  const [targetAmount, setTargetAmount] = useState("")
  const [currentAmount, setCurrentAmount] = useState("")
  const [goalName, setGoalName] = useState("")
  const [selectedScenario, setSelectedScenario] = useState<SaveUpScenario | null>(null)

  // ── Derived scenarios ───────────────────────────────────────────────────
  const target = parseFloat(targetAmount) || 0
  const saved = parseFloat(currentAmount) || 0

  const scenarios = useMemo(() => {
    if (target <= 0) return []
    return generateSaveUpScenarios(target, saved, DEFAULT_WEEKLY_RATES)
  }, [target, saved])

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSelectScenario = useCallback((scenario: SaveUpScenario) => {
    setSelectedScenario(scenario)
  }, [])

  const handleCreateGoal = useCallback(() => {
    if (!onCreateGoal || !selectedScenario || target <= 0) return

    const name = goalName.trim() || "Big purchase"
    onCreateGoal({
      name,
      targetAmount: target,
      emoji: "🎯",
    })

    // Reset and close
    setTargetAmount("")
    setCurrentAmount("")
    setGoalName("")
    setSelectedScenario(null)
    onClose()
  }, [onCreateGoal, selectedScenario, target, goalName, onClose])

  const handleClose = useCallback(() => {
    setSelectedScenario(null)
    onClose()
  }, [onClose])

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} maxHeight="85vh" ariaLabel="Plan a big purchase">
      <div style={{ padding: "0 20px 36px" }}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
            Plan a big purchase
          </h2>
          <motion.button
            onClick={handleClose}
            whileTap={{ scale: prefersReducedMotion ? 1 : 0.95 }}
            transition={springs.snappy}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: 22,
              lineHeight: 1,
              padding: 4,
            }}
            aria-label="Close"
          >
            ×
          </motion.button>
        </div>
        <p style={{ fontSize: 14, color: "var(--sub)", marginBottom: 24, lineHeight: 1.5 }}>
          See how long it takes to save at different rates. No pressure — just a plan.
        </p>

            {/* ── Target amount input ─────────────────────────────────── */}
            <label
              style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--sub)", marginBottom: 6 }}
            >
              What are you saving for?
            </label>
            <input
              type="text"
              placeholder="e.g., New laptop"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 15,
                fontFamily: FONT_FAMILY,
                color: "var(--text)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                marginBottom: 16,
                outline: "none",
              }}
              aria-label="Purchase name"
            />

            <label
              style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--sub)", marginBottom: 6 }}
            >
              How much does it cost?
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="$ 0"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                fontSize: 22,
                fontWeight: 600,
                fontFamily: FONT_FAMILY,
                color: "var(--text)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                marginBottom: 16,
                outline: "none",
              }}
              aria-label="Target purchase amount"
            />

            <label
              style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--sub)", marginBottom: 6 }}
            >
              Already saved? (optional)
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="$ 0"
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 15,
                fontFamily: FONT_FAMILY,
                color: "var(--text)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                marginBottom: 24,
                outline: "none",
              }}
              aria-label="Amount already saved"
            />

            {/* ── Scenarios ───────────────────────────────────────────── */}
            {scenarios.length > 0 && (
              <section aria-label="Timeline scenarios">
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 12 }}>
                  Your options
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <AnimatePresence>
                    {scenarios.map((scenario, i) => {
                      const isSelected = selectedScenario?.label === scenario.label
                      return (
                        <motion.div
                          key={scenario.label}
                          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...timings.normal, delay: prefersReducedMotion ? 0 : i * 0.04 }}
                        >
                          <GlassCard
                            elevation="low"
                            glow={isSelected ? "healthy" : "none"}
                            style={{
                              padding: "14px 16px",
                              cursor: "pointer",
                              border: isSelected
                                ? "1px solid rgba(6, 214, 160, 0.4)"
                                : "1px solid var(--border)",
                              borderRadius: 14,
                              transition: "border-color 0.15s ease",
                            }}
                          >
                            <motion.button
                              onClick={() => handleSelectScenario(scenario)}
                              whileTap={{ scale: prefersReducedMotion ? 1 : 0.98 }}
                              transition={springs.snappy}
                              style={{
                                width: "100%",
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                                background: "none",
                                border: "none",
                                textAlign: "left",
                                cursor: "pointer",
                                padding: 0,
                                fontFamily: FONT_FAMILY,
                              }}
                              aria-label={formatScenarioTimeline(scenario)}
                              aria-pressed={isSelected}
                            >
                              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                                {formatScenarioTimeline(scenario)}
                              </span>
                              <span style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.4 }}>
                                {scenario.message}
                              </span>
                            </motion.button>
                          </GlassCard>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* ── Encouragement when no target yet ────────────────────── */}
            {target <= 0 && (
              <GlassCard elevation="low" style={{ padding: "24px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 15, color: "var(--text)", marginBottom: 4, fontWeight: 500 }}>
                  🎯 Enter an amount above
                </p>
                <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5 }}>
                  We&apos;ll show you how quickly you can get there.
                </p>
              </GlassCard>
            )}

            {/* ── Create goal button ──────────────────────────────────── */}
            {selectedScenario && onCreateGoal && (
              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? timings.fast : springs.gentle}
                style={{ marginTop: 20 }}
              >
                <motion.button
                  onClick={handleCreateGoal}
                  whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
                  transition={springs.bouncy}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: FONT_FAMILY,
                    color: "var(--text)",
                    background: "var(--accent)",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                  aria-label="Save this as a goal"
                >
                  Save this as a goal →
                </motion.button>
                <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>
                  This creates a new savings goal you can track.
                </p>
              </motion.div>
            )}
      </div>
    </BottomSheet>
  )
}
