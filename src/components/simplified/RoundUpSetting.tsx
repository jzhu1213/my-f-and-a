"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import {
  isRoundUpEnabled,
  setRoundUpEnabled,
  computeMonthlyRoundUpTotal,
  getRoundUpTargetGoal,
  setRoundUpTargetGoal,
} from "@/lib/roundUpSavings"
import { FONT_FAMILY } from "@/styles/typography"
import { sectionHeader, shadows } from "@/styles/shared"
import type { Transaction, Goal } from "@/types"

// ============================================================================
// Types
// ============================================================================

export interface RoundUpSettingProps {
  /** Current month's transactions — used to show round-up savings total */
  transactions?: Transaction[]
  /** User's goals — for the goal picker dropdown */
  goals?: Goal[]
}

// ============================================================================
// RoundUpSetting Component
// ============================================================================

/**
 * RoundUpSetting — a toggle card that lets users opt into round-up savings.
 *
 * When enabled, each logged expense is rounded up to the nearest dollar and
 * the difference goes toward savings. Purely additive and reversible —
 * disabling stops future round-ups without touching existing transactions.
 */
export function RoundUpSetting({ transactions = [], goals = [] }: RoundUpSettingProps) {
  const [enabled, setEnabled] = useState(false)
  const [targetGoalId, setTargetGoalId] = useState<string | null>(null)

  // Hydrate from localStorage on mount
  useEffect(() => {
    setEnabled(isRoundUpEnabled())
    setTargetGoalId(getRoundUpTargetGoal())
  }, [])

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    setRoundUpEnabled(next)
  }

  function handleGoalChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newGoalId = e.target.value || null
    setTargetGoalId(newGoalId)
    setRoundUpTargetGoal(newGoalId)
  }

  // Compute current month's round-up total
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const monthlyTotal = computeMonthlyRoundUpTotal(transactions, currentMonth)

  return (
    <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
      <p style={{ ...sectionHeader }}>Round-Up Savings</p>

      {/* Description */}
      <p
        style={{
          fontSize: 13,
          color: "var(--sub)",
          lineHeight: 1.5,
          marginBottom: 16,
        }}
      >
        Round expenses to the nearest dollar. The difference goes to your savings.
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
          aria-label="Toggle round-up savings"
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
              boxShadow: shadows.sm,
            }}
          />
        </motion.button>
      </div>

      {/* Goal picker — shown when enabled */}
      {enabled && goals.length > 0 && (
        <div style={{ marginBottom: monthlyTotal > 0 ? 14 : 0 }}>
          <label
            htmlFor="round-up-target-goal"
            style={{
              fontSize: 12,
              color: "var(--sub)",
              display: "block",
              marginBottom: 6,
              fontFamily: FONT_FAMILY,
            }}
          >
            Contribute to
          </label>
          <select
            id="round-up-target-goal"
            value={targetGoalId ?? ""}
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
              No goal (savings only)
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

      {/* Monthly savings total — only when enabled and there's data */}
      {enabled && monthlyTotal > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(6, 214, 160, 0.08)",
            border: "1px solid rgba(6, 214, 160, 0.2)",
          }}
        >
          <span style={{ fontSize: 16 }} aria-hidden="true">
            🪙
          </span>
          <span
            style={{
              fontSize: 13,
              color: "var(--success)",
              fontWeight: 500,
              fontFamily: FONT_FAMILY,
            }}
          >
            This month: ~${monthlyTotal.toFixed(2)} saved
          </span>
        </div>
      )}
    </GlassCard>
  )
}
