"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { useTheme } from "@/contexts/ThemeContext"
import { BUDGET_CATEGORIES } from "@/types"
import type { Budget, Goal } from "@/types"
import type { SavingsAccount } from "@/types/folio"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeadingStrong,
  linkButton,
  listRow,
} from "@/styles/shared"
import { SavingsProjection } from "./SavingsProjection"
import { MinBalanceBufferSetting } from "./MinBalanceBufferSetting"

// ============================================================================
// Types
// ============================================================================

export interface SettingsScreenProps {
  budgets: Budget[]
  goals: Goal[]
  savingsAccounts?: SavingsAccount[]
  totalSetAside?: number
  savingsRate?: number
  userEmail?: string
  onOpenBudgetSettings: () => void
  onOpenRecurringBills?: () => void
  onOpenSinkingFunds?: () => void
  onOpenSubscriptions?: () => void
  onOpenGoals: () => void
  onOpenLearn?: () => void
  onOpenReimbursements?: () => void
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
  savingsAccounts,
  totalSetAside,
  savingsRate,
  userEmail,
  onOpenBudgetSettings,
  onOpenRecurringBills,
  onOpenSinkingFunds,
  onOpenSubscriptions,
  onOpenGoals,
  onOpenLearn,
  onOpenReimbursements,
  onOpenProfile,
  onSignOut,
  onResetOnboarding,
  onExportData,
  onDeleteAccount,
}: SettingsScreenProps) {
  const { theme, setTheme } = useTheme()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

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

      {/* ── Set Aside This Month ─────────────────────────────────────────── */}
      {(totalSetAside ?? 0) > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }} aria-hidden="true">🏦</span>
            <div>
              <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 2 }}>
                Set aside this month
              </p>
              <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                ${Math.round(totalSetAside ?? 0).toLocaleString("en-US")}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ── Savings Rate ──────────────────────────────────────────────────── */}
      {(savingsRate ?? 0) > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }} aria-hidden="true">💪</span>
            <div>
              <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 2 }}>
                Savings rate
              </p>
              <p style={{ fontSize: 20, fontWeight: 700, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
                {savingsRate}%
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ── Recurring Bills ──────────────────────────────────────────────── */}
      {onOpenRecurringBills && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeadingStrong }}>
            Recurring Bills
          </p>

          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14 }}>
            Track your monthly fixed costs like rent, subscriptions, and utilities.
          </p>

          <motion.button
            onClick={onOpenRecurringBills}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={linkButton}
            aria-label="Manage recurring bills"
          >
            Manage bills →
          </motion.button>
        </GlassCard>
      )}

      {/* ── Subscriptions ─────────────────────────────────────────────── */}
      {onOpenSubscriptions && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeadingStrong }}>
            Subscriptions
          </p>

          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14 }}>
            Review detected recurring charges and make sure they&apos;re all worth keeping.
          </p>

          <motion.button
            onClick={onOpenSubscriptions}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={linkButton}
            aria-label="Review subscriptions"
          >
            Review subscriptions →
          </motion.button>
        </GlassCard>
      )}

      {/* ── Sinking Funds ────────────────────────────────────────────────── */}
      {onOpenSinkingFunds && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeadingStrong }}>
            Sinking Funds
          </p>

          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14 }}>
            Save gradually for predictable large expenses like insurance, tuition, or travel.
          </p>

          <motion.button
            onClick={onOpenSinkingFunds}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={linkButton}
            aria-label="Manage sinking funds"
          >
            Manage funds →
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

      {/* ── Savings Accounts ─────────────────────────────────────────── */}
      {savingsAccounts && savingsAccounts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
            <p style={{ ...sectionHeadingStrong }}>
              Savings & Investments
            </p>
            <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14 }}>
              Projected growth based on your current contributions.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {savingsAccounts.map(account => (
                <SavingsProjection key={account.id} account={account} />
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── IOUs & Reimbursements ────────────────────────────────────── */}
      {onOpenReimbursements && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeadingStrong }}>
            IOUs & Reimbursements
          </p>

          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14 }}>
            Track money friends owe you — or that you owe them.
          </p>

          <motion.button
            onClick={onOpenReimbursements}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={linkButton}
            aria-label="Manage IOUs and reimbursements"
          >
            Manage IOUs →
          </motion.button>
        </GlassCard>
      )}

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
              marginTop: 12,
              padding: 16,
              borderRadius: 12,
              background: "rgba(248, 113, 113, 0.1)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
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
                borderRadius: 8,
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
                  borderRadius: 8,
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
                  borderRadius: 8,
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
    </div>
  )
}
