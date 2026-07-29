"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { useTheme } from "@/contexts/ThemeContext"
import { BUDGET_CATEGORIES } from "@/types"
import type { Budget, Goal } from "@/types"
import type { IncomeSmoothing } from "@/types/folio"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeadingStrong,
  linkButton,
  listRow,
  borderRadius,
  segmentedControl,
  segmentedButtonBase,
  segmentedButtonActive,
  segmentedButtonInactive,
  dangerZone,
} from "@/styles/shared"
import { MinBalanceBufferSetting } from "./MinBalanceBufferSetting"
import { DailyReminderSetting } from "./DailyReminderSetting"
import { getInsightsEnabled, setInsightsEnabled } from "@/lib/insightPreferences"

// ============================================================================
// Types
// ============================================================================

export interface SettingsScreenProps {
  budgets: Budget[]
  goals: Goal[]
  userEmail?: string
  incomeSmoothing?: IncomeSmoothing | null
  onSetIncomeSmoothing?: (s: IncomeSmoothing) => void
  onOpenBudgetSettings: () => void
  onOpenGoals: () => void
  onOpenTools?: () => void
  onOpenProfile: () => void
  onSignOut: () => void
  onResetOnboarding?: () => void
  onExportData?: () => void
  onDeleteAccount?: () => void
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
// Income smoothing options
// ============================================================================

type IncomeOption = {
  key: 'current_month' | 'trailing_average'
  label: string
  desc: string
  value: IncomeSmoothing
}

const INCOME_OPTIONS: IncomeOption[] = [
  {
    key: 'current_month',
    label: 'Just this month',
    desc: 'Uses your income recorded this month',
    value: { strategy: 'current_month' },
  },
  {
    key: 'trailing_average',
    label: 'Average the last 3 months',
    desc: 'Steadier for gig income or irregular pay',
    value: { strategy: 'trailing_average', windowMonths: 3 },
  },
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
  incomeSmoothing,
  onSetIncomeSmoothing,
  onOpenBudgetSettings,
  onOpenGoals,
  onOpenTools,
  onOpenProfile,
  onSignOut,
  onResetOnboarding,
  onExportData,
  onDeleteAccount,
}: SettingsScreenProps) {
  const { theme, setTheme } = useTheme()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [insightsEnabled, setInsightsEnabledState] = useState(() => getInsightsEnabled())

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
            No limits yet — Folio works fine without them, or add some anytime.
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

      {/* ── Income Calculation ────────────────────────────────────────────── */}
      {onSetIncomeSmoothing && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeadingStrong, marginBottom: 6 }}>
            Income
          </p>
          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.5 }}>
            How should your daily budget be calculated when income varies?
          </p>

          {/* Segmented control — same pattern as Appearance */}
          <div
            style={segmentedControl}
          >
            {INCOME_OPTIONS.map(opt => {
              const isActive = (incomeSmoothing?.strategy ?? 'current_month') === opt.key
              return (
                <motion.button
                  key={opt.key}
                  onClick={() => onSetIncomeSmoothing(opt.value)}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={{
                    ...segmentedButtonBase,
                    ...(isActive ? segmentedButtonActive : segmentedButtonInactive),
                    padding: "10px 8px",
                    fontSize: 12,
                    lineHeight: 1.3,
                  }}
                  aria-pressed={isActive}
                  aria-label={opt.label}
                  title={opt.desc}
                >
                  {opt.label}
                </motion.button>
              )
            })}
          </div>
        </GlassCard>
      )}

      {/* ── Tools & More ──────────────────────────────────────────── */}
      {onOpenTools && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeadingStrong }}>
            More & Tools
          </p>

          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14 }}>
            Debt tracking, recurring bills, IOUs, calculators, and more advanced features.
          </p>

          <motion.button
            onClick={onOpenTools}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={linkButton}
            aria-label="Open more tools and advanced features"
          >
            Open more →
          </motion.button>
        </GlassCard>
      )}

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
            No goals yet — set one when you&apos;re ready to save toward something.
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

      {/* ── Appearance ─────────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>
          Appearance
        </p>

        {/* Segmented theme toggle */}
        <div
          style={segmentedControl}
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
                  ...segmentedButtonBase,
                  ...(isActive ? segmentedButtonActive : segmentedButtonInactive),
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

      {/* ── Preferences ────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>
          Preferences
        </p>

        {/* Currency Display (informational for now) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 14, color: "var(--text)" }}>Currency</span>
          <span style={{ fontSize: 14, color: "var(--sub)" }}>USD ($)</span>
        </div>

        {/* Show daily insights toggle */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ flex: 1, marginRight: 12 }}>
            <span style={{ fontSize: 14, color: "var(--text)", display: "block" }}>
              Show daily insight
            </span>
            <span style={{ fontSize: 12, color: "var(--sub)", lineHeight: 1.4, marginTop: 2, display: "block" }}>
              A brief, rotating tip or celebration on your home screen
            </span>
          </div>
          <motion.button
            type="button"
            role="switch"
            aria-checked={insightsEnabled}
            aria-label="Show daily insight on home screen"
            onClick={() => {
              const next = !insightsEnabled
              setInsightsEnabledState(next)
              setInsightsEnabled(next)
            }}
            whileTap={{ scale: 0.92 }}
            transition={springs.snappy}
            style={{
              flexShrink: 0,
              width: 44,
              height: 26,
              borderRadius: 13,
              border: "none",
              cursor: "pointer",
              background: insightsEnabled
                ? "rgba(167, 139, 250, 0.6)"
                : "rgba(255, 255, 255, 0.1)",
              position: "relative",
              transition: "background 0.2s ease",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: insightsEnabled ? 21 : 3,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: insightsEnabled ? "#fff" : "rgba(255,255,255,0.4)",
                transition: "left 0.2s ease, background 0.2s ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </motion.button>
        </div>

        {/* Reset Tutorial/Onboarding */}
        {onResetOnboarding && (
          <motion.button
            onClick={onResetOnboarding}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={{
              ...linkButton,
              marginTop: 14,
            }}
            aria-label="Reset onboarding tutorial"
          >
            Reset tutorial →
          </motion.button>
        )}
      </GlassCard>

      {/* ── Daily Reminder ─────────────────────────────────────────────── */}
      <DailyReminderSetting />

      {/* ── Low-Balance Buffer ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <MinBalanceBufferSetting />
      </div>

      {/* ── Data & Account Management ──────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>
          Data & Account
        </p>

        {/* Export Data */}
        {onExportData && (
          <motion.button
            onClick={onExportData}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={{
              ...linkButton,
              marginBottom: 12,
            }}
            aria-label="Export your financial data"
          >
            Export my data →
          </motion.button>
        )}

        {/* Delete Account - Destructive Action */}
        {onDeleteAccount && !showDeleteConfirm && (
          <motion.button
            onClick={() => setShowDeleteConfirm(true)}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={{
              ...linkButton,
              color: "var(--error)",
            }}
            aria-label="Delete account"
          >
            Delete account →
          </motion.button>
        )}

        {/* Delete Confirmation UI */}
        {showDeleteConfirm && (
          <div
            style={{
              ...dangerZone,
              marginTop: 12,
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--error)",
                marginBottom: 8,
              }}
            >
              ⚠️ Delete Account
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--text)",
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              This will permanently delete all your data including transactions, budgets, and goals. This cannot be undone.
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--sub)",
                marginBottom: 12,
              }}
            >
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              style={{
                width: "100%",
                padding: "10px 12px",
                marginBottom: 12,
                fontSize: 14,
                fontFamily: FONT_FAMILY,
                color: "var(--text)",
                background: "rgba(0, 0, 0, 0.2)",
                border: "1px solid var(--border)",
                borderRadius: borderRadius.sm,
                outline: "none",
              }}
              aria-label="Type DELETE to confirm account deletion"
            />
            <div style={{ display: "flex", gap: 8 }}>
              <motion.button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText("")
                }}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  color: "var(--text)",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid var(--border)",
                  borderRadius: borderRadius.sm,
                  cursor: "pointer",
                }}
                aria-label="Cancel account deletion"
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={() => {
                  if (deleteConfirmText === "DELETE" && onDeleteAccount) {
                    onDeleteAccount()
                  }
                }}
                whileTap={{ scale: deleteConfirmText === "DELETE" ? 0.97 : 1 }}
                transition={springs.snappy}
                disabled={deleteConfirmText !== "DELETE"}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: FONT_FAMILY,
                  color: deleteConfirmText === "DELETE" ? "#fff" : "var(--muted)",
                  background: deleteConfirmText === "DELETE" 
                    ? "var(--error)" 
                    : "rgba(255, 255, 255, 0.03)",
                  border: "none",
                  borderRadius: borderRadius.sm,
                  cursor: deleteConfirmText === "DELETE" ? "pointer" : "not-allowed",
                  opacity: deleteConfirmText === "DELETE" ? 1 : 0.5,
                }}
                aria-label="Confirm account deletion"
              >
                Delete Forever
              </motion.button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* ── Account ────────────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>
          Account
        </p>

        <motion.button
          onClick={onOpenProfile}
          whileTap={{ scale: 0.97 }}
          transition={springs.snappy}
          style={linkButton}
          aria-label="Open account settings"
        >
          Manage account →
        </motion.button>
      </GlassCard>

      {/* ── Branded footer ────────────────────────────────────────────────── */}
      <div
        style={{
          textAlign: "center",
          paddingTop: 24,
          paddingBottom: 8,
          opacity: 0.4,
        }}
      >
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 14,
            fontWeight: 300,
            letterSpacing: "0.12em",
            color: "var(--sub)",
            margin: 0,
          }}
        >
          folio
        </p>
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 10,
            color: "var(--muted)",
            marginTop: 4,
            letterSpacing: "0.04em",
          }}
        >
          v0.1.0
        </p>
      </div>
    </div>
  )
}
