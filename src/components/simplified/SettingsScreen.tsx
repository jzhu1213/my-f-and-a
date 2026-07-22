"use client"

import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { useTheme } from "@/contexts/ThemeContext"
import { BUDGET_CATEGORIES } from "@/types"
import type { Budget, Goal } from "@/types"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeadingStrong,
  linkButton,
  listRow,
} from "@/styles/shared"

// ============================================================================
// Types
// ============================================================================

export interface SettingsScreenProps {
  budgets: Budget[]
  goals: Goal[]
  userEmail?: string
  onOpenBudgetSettings: () => void
  onOpenGoals: () => void
  onOpenLearn?: () => void
  onSignOut: () => void
}

// ============================================================================
// Theme options
// ============================================================================

type ThemeOption = { key: "warm" | "dark" | "system"; label: string }

const THEME_OPTIONS: ThemeOption[] = [
  { key: "warm", label: "Warm" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
]

// ============================================================================
// Helpers
// ============================================================================

function getDaysInMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

// ============================================================================
// SettingsScreen Component
// ============================================================================

/**
 * SettingsScreen — consolidated settings surface accessible from the dock.
 * Shows Budget Limits, Goals, Appearance, Learn, and Account sections
 * using GlassCard surfaces.
 *
 * Validates: Requirements 12.1–12.6
 */
export function SettingsScreen({
  budgets,
  goals,
  userEmail,
  onOpenBudgetSettings,
  onOpenGoals,
  onOpenLearn,
  onSignOut,
}: SettingsScreenProps) {
  const { theme, setTheme } = useTheme()

  // ── Budget summary computations ────────────────────────────────────────────
  const totalMonthly = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
  const daysInMonth = getDaysInMonth()
  const dailyBudget = daysInMonth > 0 ? totalMonthly / daysInMonth : 0

  // Active budgets with a limit set
  const activeLimits = BUDGET_CATEGORIES
    .map(cat => {
      const budget = budgets.find(b => b.category === cat.category)
      return { ...cat, limit: budget?.monthlyLimit ?? 0 }
    })
    .filter(c => c.limit > 0)

  // ── Goal summary ───────────────────────────────────────────────────────────
  const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount)

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM - 20}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ── Title ──────────────────────────────────────────────────────────── */}
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: 20,
        }}
      >
        Settings
      </h2>

      {/* ── Budget Limits ──────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong }}>
          Budget Limits
        </p>

        {/* Summary line */}
        <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
              ${totalMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--sub)", marginLeft: 3 }}>/mo</span>
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <p style={{ fontSize: 14, color: "var(--sub)" }}>
              ≈ ${dailyBudget.toFixed(0)}/day
            </p>
          </div>
        </div>

        {/* Category list */}
        {activeLimits.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {activeLimits.map(cat => (
              <div
                key={cat.category}
                style={listRow}
              >
                <span>
                  {cat.emoji} {cat.label}
                </span>
                <span style={{ color: "var(--sub)", fontVariantNumeric: "tabular-nums" }}>
                  ${cat.limit}/mo
                </span>
              </div>
            ))}
          </div>
        )}

        {activeLimits.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            No limits set yet.
          </p>
        )}

        <motion.button
          onClick={onOpenBudgetSettings}
          whileTap={{ scale: 0.97 }}
          transition={springs.snappy}
          style={linkButton}
          aria-label="Manage budget limits"
        >
          Manage limits →
        </motion.button>
      </GlassCard>

      {/* ── Goals ──────────────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong }}>
          Goals
        </p>

        {activeGoals.length > 0 ? (
          <div style={{ marginBottom: 14 }}>
            {activeGoals.map(goal => {
              const progress = goal.targetAmount > 0
                ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                : 0
              return (
                <div
                  key={goal.id}
                  style={listRow}
                >
                  <span>
                    {goal.emoji} {goal.name}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: progress >= 100 ? "var(--success)" : "var(--sub)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {progress}%
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            No active goals yet.
          </p>
        )}

        <motion.button
          onClick={onOpenGoals}
          whileTap={{ scale: 0.97 }}
          transition={springs.snappy}
          style={linkButton}
          aria-label="Manage savings goals"
        >
          Manage goals →
        </motion.button>
      </GlassCard>

      {/* ── Learn ──────────────────────────────────────────────────────────── */}
      {onOpenLearn && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeadingStrong }}>
            Learn
          </p>

          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14 }}>
            Short lessons on budgeting, saving, and growing your money.
          </p>

          <motion.button
            onClick={onOpenLearn}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={linkButton}
            aria-label="Open financial lessons"
          >
            Browse lessons →
          </motion.button>
        </GlassCard>
      )}

      {/* ── Appearance ─────────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>
          Appearance
        </p>

        {/* Segmented theme toggle */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: 4,
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
          }}
        >
          {THEME_OPTIONS.map(opt => {
            const isActive = theme === opt.key
            return (
              <motion.button
                key={opt.key}
                onClick={() => setTheme(opt.key)}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 9,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  cursor: "pointer",
                  color: isActive ? "var(--text)" : "var(--muted)",
                  background: isActive
                    ? "rgba(255,255,255,0.08)"
                    : "transparent",
                  boxShadow: isActive
                    ? "0 1px 4px rgba(0,0,0,0.12)"
                    : "none",
                  transition: "background 0.2s, color 0.2s, box-shadow 0.2s",
                }}
                aria-pressed={isActive}
                aria-label={`Set theme to ${opt.label}`}
              >
                {opt.label}
              </motion.button>
            )
          })}
        </div>
      </GlassCard>

      {/* ── Account ────────────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 10 }}>
          Account
        </p>

        {userEmail && (
          <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 14 }}>
            {userEmail}
          </p>
        )}

        <motion.button
          onClick={onSignOut}
          whileTap={{ scale: 0.97 }}
          transition={springs.snappy}
          style={{
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            color: "var(--error)",
            background: "rgba(248, 113, 113, 0.08)",
            border: "1px solid rgba(248, 113, 113, 0.2)",
            borderRadius: 10,
            cursor: "pointer",
          }}
          aria-label="Sign out of your account"
        >
          Sign out
        </motion.button>
      </GlassCard>
    </div>
  )
}
