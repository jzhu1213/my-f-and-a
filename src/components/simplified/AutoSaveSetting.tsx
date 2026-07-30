"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import {
  getAutoEarmarkConfig,
  setAutoEarmarkConfig,
  computeMonthlyEarmarkTotal,
} from "@/lib/autoEarmarkSavings"
import { FONT_FAMILY } from "@/styles/typography"
import { sectionHeadingStrong } from "@/styles/shared"
import type { Transaction, Goal, Budget } from "@/types"

// ============================================================================
// Types
// ============================================================================

export interface AutoSaveSettingProps {
  /** Current month's transactions — used to compute earmark total */
  transactions?: Transaction[]
  /** User's budget limits — needed for daily budget calculation */
  budgets?: Budget[]
  /** User's goals — for the goal picker dropdown */
  goals?: Goal[]
}

// ============================================================================
// AutoSaveSetting Component
// ============================================================================

/**
 * AutoSaveSetting — a toggle card that lets users opt into auto-earmarking
 * unspent daily allowance toward a savings goal.
 *
 * Purely informational/motivational — shows how much the user *would have*
 * saved if they maintained their spending habits. Does not create transactions.
 */
export function AutoSaveSetting({
  transactions = [],
  budgets = [],
  goals = [],
}: AutoSaveSettingProps) {
  const [enabled, setEnabled] = useState(false)
  const [goalId, setGoalId] = useState<string | null>(null)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const config = getAutoEarmarkConfig()
    setEnabled(config.enabled)
    setGoalId(config.goalId)
  }, [])

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    setAutoEarmarkConfig({ enabled: next, goalId })
  }

  function handleGoalChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newGoalId = e.target.value || null
    setGoalId(newGoalId)
    setAutoEarmarkConfig({ enabled, goalId: newGoalId })
  }

  // Compute current month's earmark total
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const monthlyTotal = computeMonthlyEarmarkTotal(transactions, budgets, currentMonth)

  // Find the selected goal name for display
  const selectedGoal = goals.find(g => g.id === goalId)

  return (
    <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
      <p style={{ ...sectionHeadingStrong }}>Auto-Save Earmark</p>

      {/* Description */}
      <p
        style={{
          fontSize: 13,
          color: "var(--sub)",
          lineHeight: 1.5,
          marginBottom: 16,
        }}
      >
        Track unspent daily allowance as virtual savings. See how much you could save just by keeping your current habits.
      </p>

      {/* Toggle row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: enabled ? 14 : 0,
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
          {enabled ? "Enabled" : "Disabled"}
        </span>

        {/* Toggle switch */}
        <motion.button
          onClick={handleToggle}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle auto-save earmark"
          style={{
            position: "relative",
            width: 48,
            height: 28,
            borderRadius: 14,
            border: "none",
            cursor: "pointer",
            background: enabled
              ? "var(--success)"
              : "rgba(255, 255, 255, 0.12)",
            transition: "background 0.2s",
            padding: 0,
          }}
        >
          <motion.span
            animate={{ x: enabled ? 22 : 2 }}
            transition={springs.snappy}
            style={{
              display: "block",
              position: "absolute",
              top: 2,
              left: 0,
              width: 24,
              height: 24,
              borderRadius: 12,
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </motion.button>
      </div>

      {/* Goal picker — shown when enabled */}
      {enabled && (
        <div style={{ marginBottom: monthlyTotal > 0 ? 14 : 0 }}>
          <label
            htmlFor="auto-earmark-goal"
            style={{
              fontSize: 12,
              color: "var(--sub)",
              display: "block",
              marginBottom: 6,
              fontFamily: FONT_FAMILY,
            }}
          >
            Earmark towards
          </label>
          <select
            id="auto-earmark-goal"
            value={goalId ?? ""}
            onChange={handleGoalChange}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              background: "rgba(255, 255, 255, 0.06)",
              color: "var(--text)",
              fontSize: 14,
              fontFamily: FONT_FAMILY,
              appearance: "none",
              WebkitAppearance: "none",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="" style={{ background: "var(--surface)" }}>
              General savings
            </option>
            {goals.map(goal => (
              <option
                key={goal.id}
                value={goal.id}
                style={{ background: "var(--surface)" }}
              >
                {goal.emoji} {goal.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Monthly earmark total — motivational metric */}
      {enabled && monthlyTotal > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(139, 92, 246, 0.08)",
            border: "1px solid rgba(139, 92, 246, 0.2)",
          }}
        >
          <span style={{ fontSize: 16 }} aria-hidden="true">
            ✨
          </span>
          <span
            style={{
              fontSize: 13,
              color: "rgb(167, 139, 250)",
              fontWeight: 500,
              fontFamily: FONT_FAMILY,
            }}
          >
            This month: ~${monthlyTotal.toFixed(2)} earmarked
            {selectedGoal ? ` → ${selectedGoal.emoji} ${selectedGoal.name}` : ""}
          </span>
        </div>
      )}
    </GlassCard>
  )
}
