"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
} from "@/styles/shared"
import { radius } from '@/styles/surfaces'
import { SavingsProjection } from "@/components/simplified/SavingsProjection"
import { CombinedGrowthOutlook } from "@/components/simplified/CombinedGrowthOutlook"
import {
  computeTotalSavingsBalance,
  computeMonthlyContributions,
  getAccountTypeMetadata,
} from "@/lib/savingsAccountUtils"
import { isLearningEnabled } from "@/lib/educationPreferences"
import { SAVINGS_ACCOUNT_TYPES } from "@/types/folio"
import type { SavingsAccount, SavingsAccountType } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface SavingsProjectionsScreenProps {
  savingsAccounts: SavingsAccount[]
  totalBalance: number
  onCreateAccount: (data: {
    type: SavingsAccountType
    name: string
    balance: number
    monthlyContribution: number
    expectedAnnualReturn: number
  }) => Promise<SavingsAccount | null>
  onUpdateAccount: (
    id: string,
    data: {
      type?: SavingsAccountType
      name?: string
      balance?: number
      monthlyContribution?: number
      expectedAnnualReturn?: number
    }
  ) => Promise<SavingsAccount | null>
  onDeleteAccount: (id: string) => Promise<boolean>
  onBack: () => void
}

// ============================================================================
// Helpers
// ============================================================================

function formatDollars(amount: number): string {
  return "$" + amount.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

// ============================================================================
// SavingsProjectionsScreen Component
// ============================================================================

export function SavingsProjectionsScreen({
  savingsAccounts,
  totalBalance,
  onCreateAccount,
  onDeleteAccount,
  onBack,
}: SavingsProjectionsScreenProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [activeWhatIf, setActiveWhatIf] = useState<string | null>(null)

  // Compute month-over-month change indicator (monthly contributions as proxy)
  const monthlyChange = useMemo(
    () => computeMonthlyContributions(savingsAccounts),
    [savingsAccounts]
  )

  const computedTotal = useMemo(
    () => computeTotalSavingsBalance(savingsAccounts),
    [savingsAccounts]
  )

  const displayBalance = totalBalance || computedTotal

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `0 ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM - 20}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ── Back button ────────────────────────────────────────────── */}
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "var(--sub)",
          fontSize: typography.body.fontSize,
          cursor: "pointer",
          marginBottom: HORIZONTAL_PADDING,
          padding: "8px 0",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Go back"
      >
        ← Back
      </button>

      {/* ── Total Balance Header (156.2) ───────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        style={{ textAlign: "center", marginBottom: 28 }}
      >
        <p
          style={{
            fontSize: typography['body-sm'].fontSize,
            fontWeight: fontWeights.semibold,
            color: "var(--sub)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: spacing.xs,
          }}
        >
          Total Savings &amp; Investments
        </p>

        <h2
          style={{
            fontSize: typography.title.fontSize,
            fontWeight: fontWeights.bold,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.2,
            marginBottom: spacing.xs,
          }}
        >
          {formatDollars(displayBalance)}
        </h2>

        {/* Month-over-month change indicator */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: typography.body.fontSize,
            fontWeight: fontWeights.medium,
            color: monthlyChange > 0 ? "var(--success)" : "var(--muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {monthlyChange > 0 && (
            <span aria-hidden="true" style={{ fontSize: typography.body.fontSize }}>↑</span>
          )}
          <span>
            {monthlyChange > 0
              ? `+${formatDollars(monthlyChange)}/mo`
              : "No monthly contributions"}
          </span>
        </div>
      </motion.div>

      {/* ── Empty State ────────────────────────────────────────────── */}
      {savingsAccounts.length === 0 && !showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
        >
          <EmptyState
            illustration="goals"
            title="Start tracking your savings"
            subtitle="Add your savings and investment accounts to see how they could grow over time. Every dollar counts."
            actionLabel="+ Add your first account"
            onAction={() => setShowAddForm(true)}
            actionColor="success"
          />
        </motion.div>
      )}

      {/* ── Combined Growth Outlook (153.1) ────────────────────────── */}
      {savingsAccounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
        >
          <CombinedGrowthOutlook accounts={savingsAccounts} />
        </motion.div>
      )}

      {/* ── What If Scenarios ──────────────────────────────────────── */}
      {savingsAccounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.05 }}
          style={{ marginBottom: spacing.md, marginTop: 16 }}
        >
          <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
            <p
              style={{
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.semibold,
                color: "var(--sub)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 4,
              }}
            >
              What If…
            </p>
            <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", marginBottom: spacing.sm }}>
              Tap a scenario to see the difference
            </p>
            <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap", marginBottom: activeWhatIf ? 12 : 0 }}>
              <button
                onClick={() => setActiveWhatIf(activeWhatIf === "extra50" ? null : "extra50")}
                style={{
                  padding: "8px 14px",
                  borderRadius: radius.full,
                  border: activeWhatIf === "extra50" ? "1.5px solid var(--success)" : "1px solid var(--fill-08)",
                  background: activeWhatIf === "extra50" ? "var(--success-100)" : "var(--fill-04)",
                  color: activeWhatIf === "extra50" ? "var(--success)" : "var(--sub)",
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.medium,
                  fontFamily: FONT_FAMILY,
                  cursor: "pointer",
                }}
              >
                +$50/mo more
              </button>
              <button
                onClick={() => setActiveWhatIf(activeWhatIf === "extra1000" ? null : "extra1000")}
                style={{
                  padding: "8px 14px",
                  borderRadius: radius.full,
                  border: activeWhatIf === "extra1000" ? "1.5px solid var(--success)" : "1px solid var(--fill-08)",
                  background: activeWhatIf === "extra1000" ? "var(--success-100)" : "var(--fill-04)",
                  color: activeWhatIf === "extra1000" ? "var(--success)" : "var(--sub)",
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.medium,
                  fontFamily: FONT_FAMILY,
                  cursor: "pointer",
                }}
              >
                +$1,000 start
              </button>
            </div>

            {activeWhatIf && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={springs.gentle}
              >
                {(() => {
                  // Compute 10-year projection for current vs what-if
                  const projectionYears = 10
                  const months = projectionYears * 12

                  // Current scenario
                  const currentTotal = savingsAccounts.reduce((sum, acct) => {
                    const monthlyRate = (acct.expectedAnnualReturn || 0) / 100 / 12
                    let bal = acct.balance
                    for (let m = 0; m < months; m++) {
                      bal = bal * (1 + monthlyRate) + acct.monthlyContribution
                    }
                    return sum + bal
                  }, 0)

                  // What-if scenario
                  const extraMonthly = activeWhatIf === "extra50" ? 50 : 0
                  const extraInitial = activeWhatIf === "extra1000" ? 1000 : 0

                  const whatIfTotal = savingsAccounts.reduce((sum, acct) => {
                    const monthlyRate = (acct.expectedAnnualReturn || 0) / 100 / 12
                    let bal = acct.balance + (extraInitial / savingsAccounts.length)
                    const contribution = acct.monthlyContribution + (extraMonthly / savingsAccounts.length)
                    for (let m = 0; m < months; m++) {
                      bal = bal * (1 + monthlyRate) + contribution
                    }
                    return sum + bal
                  }, 0)

                  const difference = Math.round(whatIfTotal - currentTotal)

                  return (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: radius.control,
                        background: "var(--success-50)",
                        border: "1px solid var(--success-200)",
                      }}
                    >
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ fontSize: typography.subhead.fontSize, fontWeight: fontWeights.bold, color: "var(--success)", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                          +{formatDollars(difference)}
                        </p>
                        <p style={{ fontSize: typography.caption.fontSize, color: "var(--muted)", margin: 0 }}>
                          more in {projectionYears} years
                        </p>
                      </div>
                      {isLearningEnabled() && (
                      <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", lineHeight: 1.5, margin: 0 }}>
                        {activeWhatIf === "extra50"
                          ? "An extra $50/mo seems small, but compound growth turns it into real wealth over time. Your future self will thank you."
                          : "Starting with $1,000 more gives compound growth a bigger base to work from \u2014 it snowballs from there."}
                      </p>
                      )}
                    </div>
                  )
                })()}
              </motion.div>
            )}
          </GlassCard>
        </motion.div>
      )}

      {/* ── Account List with SavingsProjection cards (156.1) ──────── */}
      {savingsAccounts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {savingsAccounts.map((account, idx) => {
            const meta = getAccountTypeMetadata(account.type)
            return (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springs.gentle, delay: 0.04 * idx }}
              >
                {/* Account type header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                    padding: "0 2px",
                  }}
                >
                  <span
                    style={{
                      fontSize: typography['body-sm'].fontSize,
                      fontWeight: fontWeights.medium,
                      color: "var(--muted)",
                      fontFamily: FONT_FAMILY,
                    }}
                  >
                    {meta.emoji} {meta.label}
                  </span>

                  {/* Delete button */}
                  {deleteConfirmId === account.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={async () => {
                          await onDeleteAccount(account.id)
                          setDeleteConfirmId(null)
                        }}
                        style={{
                          background: "var(--error-200)",
                          border: "none",
                          borderRadius: radius.min,
                          color: "var(--error)",
                          fontSize: typography.caption.fontSize,
                          fontWeight: fontWeights.semibold,
                          padding: "4px 10px",
                          cursor: "pointer",
                          fontFamily: FONT_FAMILY,
                        }}
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--muted)",
                          fontSize: typography.caption.fontSize,
                          cursor: "pointer",
                          padding: "4px 8px",
                          fontFamily: FONT_FAMILY,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(account.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--muted)",
                        fontSize: typography.caption.fontSize,
                        cursor: "pointer",
                        padding: "4px 8px",
                        fontFamily: FONT_FAMILY,
                      }}
                      aria-label={`Delete ${account.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Existing SavingsProjection component */}
                <SavingsProjection account={account} />
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── Add Account Form (156.1) ──────────────────────────────── */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
          style={{ marginTop: savingsAccounts.length > 0 ? 16 : 0 }}
        >
          <AddAccountForm
            onSubmit={async (data) => {
              await onCreateAccount(data)
              setShowAddForm(false)
            }}
            onCancel={() => setShowAddForm(false)}
          />
        </motion.div>
      )}

      {/* ── Add Account Button ─────────────────────────────────────── */}
      {!showAddForm && savingsAccounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{ marginTop: spacing.md, textAlign: "center" }}
        >
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--fill-08)",
              borderRadius: radius.control,
              color: "var(--text)",
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.semibold,
              padding: "12px 24px",
              cursor: "pointer",
              fontFamily: FONT_FAMILY,
              width: "100%",
            }}
          >
            + Add Account
          </button>
        </motion.div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <p
        style={{
          fontSize: typography['body-sm'].fontSize,
          color: "var(--muted)",
          textAlign: "center",
          marginTop: spacing.lg,
          lineHeight: 1.5,
        }}
      >
        Projections are estimates based on consistent contributions and expected
        returns. Actual results may vary.
      </p>
    </div>
  )
}

// ============================================================================
// AddAccountForm (internal)
// ============================================================================

interface AddAccountFormProps {
  onSubmit: (data: {
    type: SavingsAccountType
    name: string
    balance: number
    monthlyContribution: number
    expectedAnnualReturn: number
  }) => Promise<void>
  onCancel: () => void
}

function AddAccountForm({ onSubmit, onCancel }: AddAccountFormProps) {
  const [type, setType] = useState<SavingsAccountType>("hysa")
  const [name, setName] = useState("")
  const [balance, setBalance] = useState("")
  const [monthlyContribution, setMonthlyContribution] = useState("")
  const [expectedReturn, setExpectedReturn] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Auto-fill expected return when type changes
  const handleTypeChange = (newType: SavingsAccountType) => {
    setType(newType)
    const meta = SAVINGS_ACCOUNT_TYPES.find((t) => t.type === newType)
    if (meta && !expectedReturn) {
      setExpectedReturn(String(meta.defaultReturn))
    }
  }

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return
    setSubmitting(true)
    try {
      await onSubmit({
        type,
        name: name.trim(),
        balance: parseFloat(balance) || 0,
        monthlyContribution: parseFloat(monthlyContribution) || 0,
        expectedAnnualReturn: parseFloat(expectedReturn) || 0,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--fill-04)",
    border: "1px solid var(--fill-08)",
    borderRadius: radius.control,
    padding: "10px 12px",
    color: "var(--text)",
    fontSize: typography.body.fontSize,
    fontFamily: FONT_FAMILY,
    outline: "none",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: typography['body-sm'].fontSize,
    fontWeight: fontWeights.medium,
    color: "var(--sub)",
    marginBottom: 6,
    display: "block",
    fontFamily: FONT_FAMILY,
  }

  return (
    <GlassCard elevation="low" style={{ padding: "18px" }}>
      <p
        style={{
          fontSize: typography.body.fontSize,
          fontWeight: fontWeights.semibold,
          color: "var(--text)",
          marginBottom: spacing.md,
          fontFamily: FONT_FAMILY,
        }}
      >
        Add Account
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        {/* Account Type */}
        <div>
          <label style={labelStyle}>Account Type</label>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as SavingsAccountType)}
            style={{ ...inputStyle, appearance: "auto" }}
          >
            {SAVINGS_ACCOUNT_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.emoji} {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div>
          <label style={labelStyle}>Account Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Roth IRA"
            style={inputStyle}
          />
        </div>

        {/* Balance */}
        <div>
          <label style={labelStyle}>Current Balance ($)</label>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0"
            min="0"
            step="100"
            style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
          />
        </div>

        {/* Monthly Contribution */}
        <div>
          <label style={labelStyle}>Monthly Contribution ($)</label>
          <input
            type="number"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(e.target.value)}
            placeholder="0"
            min="0"
            step="25"
            style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
          />
        </div>

        {/* Expected Annual Return */}
        <div>
          <label style={labelStyle}>Expected Annual Return (%)</label>
          <input
            type="number"
            value={expectedReturn}
            onChange={(e) => setExpectedReturn(e.target.value)}
            placeholder="7"
            min="0"
            max="30"
            step="0.5"
            style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: spacing.sm, marginTop: 4 }}>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            style={{
              flex: 1,
              background: name.trim() ? "var(--success)" : "var(--fill-06)",
              border: "none",
              borderRadius: radius.control,
              color: name.trim() ? "var(--text)" : "var(--muted)",
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.semibold,
              padding: "12px 16px",
              cursor: name.trim() ? "pointer" : "default",
              fontFamily: FONT_FAMILY,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Adding…" : "Add Account"}
          </button>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "1px solid var(--fill-08)",
              borderRadius: radius.control,
              color: "var(--sub)",
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.medium,
              padding: "12px 16px",
              cursor: "pointer",
              fontFamily: FONT_FAMILY,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </GlassCard>
  )
}
