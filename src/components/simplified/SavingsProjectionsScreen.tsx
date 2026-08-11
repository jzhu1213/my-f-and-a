"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
} from "@/styles/shared"
import { SavingsProjection } from "@/components/simplified/SavingsProjection"
import { CombinedGrowthOutlook } from "@/components/simplified/CombinedGrowthOutlook"
import {
  computeTotalSavingsBalance,
  computeMonthlyContributions,
  getAccountTypeMetadata,
} from "@/lib/savingsAccountUtils"
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
          fontSize: 14,
          cursor: "pointer",
          marginBottom: 20,
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
            fontSize: 12,
            fontWeight: 600,
            color: "var(--sub)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 8,
          }}
        >
          Total Savings &amp; Investments
        </p>

        <h2
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.2,
            marginBottom: 8,
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
            fontSize: 14,
            fontWeight: 500,
            color: monthlyChange > 0 ? "var(--success)" : "var(--muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {monthlyChange > 0 && (
            <span aria-hidden="true" style={{ fontSize: 16 }}>↑</span>
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
          <GlassCard elevation="low" style={{ padding: "24px 18px", textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 10 }} aria-hidden="true">
              🌱
            </p>
            <p
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 8,
              }}
            >
              Start tracking your savings
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--sub)",
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              Add your savings and investment accounts to see how they could grow
              over time. Every dollar counts.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                background: "var(--surface)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 14,
                fontWeight: 600,
                padding: "10px 20px",
                cursor: "pointer",
                fontFamily: FONT_FAMILY,
              }}
            >
              + Add Your First Account
            </button>
          </GlassCard>
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

      {/* ── Account List with SavingsProjection cards (156.1) ──────── */}
      {savingsAccounts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                      fontSize: 12,
                      fontWeight: 500,
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
                          background: "rgba(239, 68, 68, 0.15)",
                          border: "none",
                          borderRadius: 6,
                          color: "var(--error)",
                          fontSize: 11,
                          fontWeight: 600,
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
                          fontSize: 11,
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
                        fontSize: 11,
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
          style={{ marginTop: 16, textAlign: "center" }}
        >
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              background: "var(--surface)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              color: "var(--text)",
              fontSize: 14,
              fontWeight: 600,
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
          fontSize: 12,
          color: "var(--muted)",
          textAlign: "center",
          marginTop: 24,
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
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: "10px 12px",
    color: "var(--text)",
    fontSize: 14,
    fontFamily: FONT_FAMILY,
    outline: "none",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--sub)",
    marginBottom: 6,
    display: "block",
    fontFamily: FONT_FAMILY,
  }

  return (
    <GlassCard elevation="low" style={{ padding: "18px" }}>
      <p
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: 16,
          fontFamily: FONT_FAMILY,
        }}
      >
        Add Account
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            style={{
              flex: 1,
              background: name.trim() ? "var(--success)" : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: 8,
              color: name.trim() ? "var(--text)" : "var(--muted)",
              fontSize: 14,
              fontWeight: 600,
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
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              color: "var(--sub)",
              fontSize: 14,
              fontWeight: 500,
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
