"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import {
  getAutoEarmarkConfig,
  setAutoEarmarkConfig,
  computeMonthlyEarmarkTotal,
  computeSweepAmount,
  isSweepDue,
  recordSweep,
  getLastSweep,
} from "@/lib/autoEarmarkSavings"
import type { SweepFrequency } from "@/lib/autoEarmarkSavings"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { formatMoney } from '@/lib/localeFormat'
import { sectionHeader, shadows } from "@/styles/shared"
import { radius } from '@/styles/surfaces'
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
  /** Callback to contribute to a goal (from useHomeData) */
  contributeToGoal?: (goalId: string, amount: number) => Promise<unknown>
}

// ============================================================================
// AutoSaveSetting Component
// ============================================================================

/**
 * AutoSaveSetting — a toggle card that lets users opt into auto-earmarking
 * unspent daily allowance toward a savings goal.
 *
 * When sweep is enabled, it actively contributes leftover amounts to the
 * selected goal on each app open (respecting the configured frequency).
 */
export function AutoSaveSetting({
  transactions = [],
  budgets = [],
  goals = [],
  contributeToGoal,
}: AutoSaveSettingProps) {
  const [enabled, setEnabled] = useState(false)
  const [goalId, setGoalId] = useState<string | null>(null)
  const [sweepEnabled, setSweepEnabled] = useState(false)
  const [sweepFrequency, setSweepFrequency] = useState<SweepFrequency>("daily")
  const [lastSweptInfo, setLastSweptInfo] = useState<{ amount: number; date: string } | null>(null)
  const [sweepRunning, setSweepRunning] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const config = getAutoEarmarkConfig()
    setEnabled(config.enabled)
    setGoalId(config.goalId)
    setSweepEnabled(config.sweepEnabled)
    setSweepFrequency(config.sweepFrequency)

    const last = getLastSweep()
    if (last) {
      setLastSweptInfo({ amount: last.amount, date: last.date })
    }
  }, [])

  // Auto-sweep on mount: if sweep is due, compute and contribute
  useEffect(() => {
    const config = getAutoEarmarkConfig()
    if (!config.sweepEnabled || !config.goalId || !contributeToGoal) return
    if (!isSweepDue(config)) return

    const amount = computeSweepAmount(transactions, budgets, config)
    if (amount <= 0) return

    setSweepRunning(true)
    const todayStr = new Date().toISOString().slice(0, 10)

    contributeToGoal(config.goalId, amount)
      .then(() => {
        recordSweep({ date: todayStr, amount, goalId: config.goalId! })
        setLastSweptInfo({ amount, date: todayStr })
      })
      .catch(() => {
        // Sweep failed — will retry next app open
      })
      .finally(() => {
        setSweepRunning(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    const newConfig = { enabled: next, goalId, sweepEnabled: next ? sweepEnabled : false, sweepFrequency }
    setAutoEarmarkConfig(newConfig)
    if (!next) setSweepEnabled(false)
  }

  function handleGoalChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newGoalId = e.target.value || null
    setGoalId(newGoalId)
    setAutoEarmarkConfig({ enabled, goalId: newGoalId, sweepEnabled, sweepFrequency })
  }

  function handleSweepToggle() {
    const next = !sweepEnabled
    setSweepEnabled(next)
    setAutoEarmarkConfig({ enabled, goalId, sweepEnabled: next, sweepFrequency })
  }

  function handleFrequencyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const freq = e.target.value as SweepFrequency
    setSweepFrequency(freq)
    setAutoEarmarkConfig({ enabled, goalId, sweepEnabled, sweepFrequency: freq })
  }

  const handleManualSweep = useCallback(async () => {
    if (!goalId || !contributeToGoal || sweepRunning) return

    const config = getAutoEarmarkConfig()
    const amount = computeSweepAmount(transactions, budgets, config)
    if (amount <= 0) return

    setSweepRunning(true)
    const todayStr = new Date().toISOString().slice(0, 10)

    try {
      await contributeToGoal(goalId, amount)
      recordSweep({ date: todayStr, amount, goalId })
      setLastSweptInfo({ amount, date: todayStr })
    } catch {
      // best-effort
    } finally {
      setSweepRunning(false)
    }
  }, [goalId, contributeToGoal, sweepRunning, transactions, budgets])

  // Compute current month's earmark total
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const monthlyTotal = computeMonthlyEarmarkTotal(transactions, budgets, currentMonth)

  // Find the selected goal name for display
  const selectedGoal = goals.find(g => g.id === goalId)

  // Format last swept date for display
  const lastSweptLabel = lastSweptInfo
    ? `Last swept: ${formatMoney(lastSweptInfo.amount)} on ${formatShortDate(lastSweptInfo.date)}`
    : null

  // Suppress unused variable warning — available for future manual-sweep button
  void handleManualSweep

  return (
    <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
      <p style={{ ...sectionHeader }}>Auto-Save Earmark</p>

      {/* Description */}
      <p
        style={{
          fontSize: typography['body-sm'].fontSize,
          color: "var(--sub)",
          lineHeight: 1.5,
          marginBottom: spacing.md,
        }}
      >
        Track unspent daily allowance as virtual savings. When sweep is on, leftovers go straight to your goal — effortlessly.
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
            fontSize: typography.body.fontSize,
            fontWeight: fontWeights.medium,
            color: "var(--text)",
            fontFamily: FONT_FAMILY,
          }}
        >
          {enabled ? "Tracking enabled" : "Disabled"}
        </span>

        {/* Toggle switch */}
        <ToggleSwitch checked={enabled} onToggle={handleToggle} label="Toggle auto-save earmark" />
      </div>

      {/* Goal picker — shown when enabled */}
      {enabled && (
        <div style={{ marginBottom: 14 }}>
          <label
            htmlFor="auto-earmark-goal"
            style={{
              fontSize: typography['body-sm'].fontSize,
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
            style={selectStyle}
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

      {/* Sweep toggle — shown when earmarking is enabled and a goal is selected */}
      {enabled && goalId && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: sweepEnabled ? 14 : 0,
            paddingTop: 8,
            borderTop: "1px solid var(--fill-06)",
          }}
        >
          <div>
            <span
              style={{
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.medium,
                color: "var(--text)",
                fontFamily: FONT_FAMILY,
                display: "block",
              }}
            >
              Sweep to goal
            </span>
            <span
              style={{
                fontSize: typography['body-sm'].fontSize,
                color: "var(--sub)",
                fontFamily: FONT_FAMILY,
              }}
            >
              Actually contribute leftovers
            </span>
          </div>
          <ToggleSwitch checked={sweepEnabled} onToggle={handleSweepToggle} label="Toggle sweep to goal" />
        </div>
      )}

      {/* Sweep frequency — shown when sweep is enabled */}
      {enabled && goalId && sweepEnabled && (
        <div style={{ marginBottom: 14 }}>
          <label
            htmlFor="sweep-frequency"
            style={{
              fontSize: typography['body-sm'].fontSize,
              color: "var(--sub)",
              display: "block",
              marginBottom: 6,
              fontFamily: FONT_FAMILY,
            }}
          >
            Sweep frequency
          </label>
          <select
            id="sweep-frequency"
            value={sweepFrequency}
            onChange={handleFrequencyChange}
            style={selectStyle}
          >
            <option value="daily" style={{ background: "var(--surface)" }}>Daily</option>
            <option value="weekly" style={{ background: "var(--surface)" }}>Weekly</option>
            <option value="monthly" style={{ background: "var(--surface)" }}>Monthly</option>
          </select>
        </div>
      )}

      {/* Last swept indicator */}
      {enabled && sweepEnabled && lastSweptLabel && (
        <p
          style={{
            fontSize: typography['body-sm'].fontSize,
            color: "var(--sub)",
            fontFamily: FONT_FAMILY,
            marginBottom: 10,
            opacity: 0.8,
          }}
        >
          {sweepRunning ? "Sweeping..." : lastSweptLabel}
        </p>
      )}

      {/* Monthly earmark total — motivational metric */}
      {enabled && monthlyTotal > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.xs,
            padding: "10px 14px",
            borderRadius: radius.control,
            background: "var(--accent-100)",
            border: "1px solid var(--accent-200)",
          }}
        >
          <span style={{ fontSize: typography.body.fontSize }} aria-hidden="true">
            ✨
          </span>
          <span
            style={{
              fontSize: typography['body-sm'].fontSize,
              color: "rgb(167, 139, 250)",
              fontWeight: fontWeights.medium,
              fontFamily: FONT_FAMILY,
              fontVariantNumeric: "tabular-nums",
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

// ============================================================================
// Shared sub-components and styles
// ============================================================================

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: radius.control,
  border: "1px solid var(--fill-10)",
  background: "var(--fill-06)",
  color: "var(--text)",
  fontSize: typography.body.fontSize,
  fontFamily: FONT_FAMILY,
  appearance: "none",
  WebkitAppearance: "none",
  cursor: "pointer",
  outline: "none",
}

function ToggleSwitch({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.95 }}
      transition={springs.snappy}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      style={{
        position: "relative",
        width: 48,
        height: 28,
        borderRadius: radius.control,
        border: "none",
        cursor: "pointer",
        background: checked
          ? "var(--success)"
          : "var(--fill-12)",
        transition: "background 0.2s",
        padding: 0,
      }}
    >
      <motion.span
        animate={{ x: checked ? 22 : 2 }}
        transition={springs.snappy}
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
  )
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  } catch {
    return dateStr
  }
}
