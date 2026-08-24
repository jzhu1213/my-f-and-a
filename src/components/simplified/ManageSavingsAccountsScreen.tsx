"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { ManagedListScreen, type ItemRenderContext } from "@/components/ui/ManagedListScreen"
import { SAVINGS_ACCOUNT_TYPES } from "@/types/folio"
import type { SavingsAccount, SavingsAccountType } from "@/types/folio"
import {
  computeTotalSavingsBalance,
  computeMonthlyContributions,
  getAccountTypeMetadata,
} from "@/lib/savingsAccountUtils"
import {
  getContributionHistory,
  type SavingsContributionEntry,
} from "@/lib/savingsContributionHistory"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  sectionHeader,
  listRow,
  borderRadius,
  HORIZONTAL_PADDING,
} from "@/styles/shared"
import { radius } from '@/styles/surfaces'

// ============================================================================
// Types
// ============================================================================

/** Shape of the data passed to create/update savings account mutations. */
export interface SavingsAccountFormValues {
  type: SavingsAccountType
  name: string
  balance: number
  monthlyContribution: number
  expectedAnnualReturn: number
}

export interface ManageSavingsAccountsScreenProps {
  /** All of the user's savings/investment accounts. */
  savingsAccounts: SavingsAccount[]
  /** Create a new savings account. Resolves to the created account (or null on failure). */
  onCreateAccount: (data: SavingsAccountFormValues) => Promise<SavingsAccount | null>
  /** Update an existing savings account by id. */
  onUpdateAccount: (
    id: string,
    data: Partial<SavingsAccountFormValues>
  ) => Promise<SavingsAccount | null>
  /** Delete a savings account by id. */
  onDeleteAccount: (id: string) => Promise<boolean>
  /** Close the overlay / navigate back. */
  onBack: () => void
}

// ============================================================================
// Helpers
// ============================================================================

function formatDollars(amount: number): string {
  return "$" + amount.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

/** Format a signed dollar amount for a contribution row, e.g. "+$50" / "-$20". */
function formatSignedDollars(amount: number): string {
  const sign = amount >= 0 ? "+" : "−"
  return `${sign}$${Math.abs(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
}

/** Format a contribution timestamp as a friendly date + time. */
function formatEntryTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  if (isToday) return `Today · ${time}`
  if (isYesterday) return `Yesterday · ${time}`
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${time}`
}

// ============================================================================
// Styles
// ============================================================================

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: typography.body.fontSize,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "var(--color-sunken)",
  border: "1px solid var(--border)",
  borderRadius: radius.control,
  outline: "none",
}

const labelStyle: React.CSSProperties = {
  fontSize: typography['body-sm'].fontSize,
  fontWeight: fontWeights.medium,
  color: "var(--sub)",
  marginBottom: 4,
  fontFamily: FONT_FAMILY,
}

// ============================================================================
// ManageSavingsAccountsScreen Component
// ============================================================================

/**
 * ManageSavingsAccountsScreen — full CRUD manage screen for savings/investment
 * accounts (add / edit / delete). Distinct from the read-oriented
 * SavingsProjectionsScreen: this screen is built on the shared
 * `ManagedListScreen` scaffold (task 141.1) and surfaces the useHomeData savings
 * mutations (createSavingsAccount / updateSavingsAccount / deleteSavingsAccount).
 *
 * Validates: Requirements 158.1, 141.1
 */
export function ManageSavingsAccountsScreen({
  savingsAccounts,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onBack,
}: ManageSavingsAccountsScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()
  // ── Computed summary values ──────────────────────────────────────────────
  const totalBalance = computeTotalSavingsBalance(savingsAccounts)
  const monthlyContributions = computeMonthlyContributions(savingsAccounts)

  // ── Per-account contribution history expansion (task 158.2) ───────────────
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)

  // ── Per-account "Update Balance" action (task 163.1) ──────────────────────
  // Which account currently has its inline balance-update form open.
  const [balanceUpdateId, setBalanceUpdateId] = useState<string | null>(null)
  // Bumped after a balance update so the history panel re-mounts and reflects
  // the freshly-logged change (the panel reads localStorage once on mount).
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  /**
   * Apply a manual balance update. Reuses the existing savings update mutation,
   * which records the net change into the per-account contribution history
   * (task 158.2) so it flows into the same growth-over-time display.
   */
  async function handleUpdateBalance(account: SavingsAccount, newBalance: number) {
    if (newBalance === account.balance) {
      setBalanceUpdateId(null)
      return
    }
    await onUpdateAccount(account.id, { balance: newBalance })
    // Reveal the updated history so the change is immediately visible.
    setBalanceUpdateId(null)
    setHistoryRefreshKey(k => k + 1)
    setExpandedHistoryId(account.id)
  }

  // ── Render Callbacks ───────────────────────────────────────────────────────
  function renderSummary(items: SavingsAccount[]) {
    if (items.length === 0) return null
    return (
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: HORIZONTAL_PADDING }}>
        <p style={sectionHeader}>Total Savings &amp; Investments</p>
        <p
          style={{
            fontSize: typography.headline.fontSize,
            fontWeight: fontWeights.bold,
            color: "var(--text)",
            margin: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatDollars(totalBalance)}
        </p>
        <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", marginTop: 4 }}>
          {monthlyContributions > 0
            ? `${formatDollars(monthlyContributions)}/mo contributions across ${items.length} account${items.length !== 1 ? "s" : ""}`
            : `${items.length} account${items.length !== 1 ? "s" : ""} tracked`}
        </p>
      </GlassCard>
    )
  }

  function renderItem(context: ItemRenderContext<SavingsAccount>) {
    const { item: account, requestDelete, isConfirmingDelete, confirmDelete, cancelDelete } = context
    const meta = getAccountTypeMetadata(account.type)
    const isHistoryOpen = expandedHistoryId === account.id
    const isBalanceUpdateOpen = balanceUpdateId === account.id
    return (
      <div>
      <div
        style={{
          ...listRow,
          cursor: "pointer",
          padding: "10px 0",
          borderBottom: isHistoryOpen || isBalanceUpdateOpen ? "none" : "1px solid var(--border)",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: spacing.sm, flex: 1 }}
          onClick={context.startEdit}
          role="button"
          tabIndex={0}
          aria-label={`Edit ${account.name}`}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") context.startEdit()
          }}
        >
          <span style={{ fontSize: typography.subhead.fontSize }} aria-hidden="true">{meta.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: typography.body.fontSize, color: "var(--text)", margin: 0, fontWeight: fontWeights.medium }}>
              {account.name}
            </p>
            <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", margin: 0 }}>
              {meta.label}
              {account.monthlyContribution > 0
                ? ` · ${formatDollars(account.monthlyContribution)}/mo`
                : ""}
            </p>
          </div>
          <span
            style={{
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.semibold,
              color: "var(--text)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatDollars(account.balance)}
          </span>
        </div>
        {/* Update Balance — opens an inline balance-update form (task 163.1) */}
        <motion.button
          onClick={() =>
            setBalanceUpdateId(prev => {
              const next = prev === account.id ? null : account.id
              if (next) setExpandedHistoryId(null) // keep one panel open at a time
              return next
            })
          }
          whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
          transition={springs.snappy}
          style={{
            background: "none",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: typography.body.fontSize,
            color: isBalanceUpdateOpen ? "var(--text)" : "var(--sub)",
            marginLeft: 4,
          }}
          aria-label={`Update balance for ${account.name}`}
          aria-expanded={isBalanceUpdateOpen}
        >
          💰
        </motion.button>
        {/* History toggle — expands the per-account contribution history */}
        <motion.button
          onClick={() =>
            setExpandedHistoryId(prev => {
              const next = prev === account.id ? null : account.id
              if (next) setBalanceUpdateId(null) // keep one panel open at a time
              return next
            })
          }
          whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
          transition={springs.snappy}
          style={{
            background: "none",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: typography.body.fontSize,
            color: isHistoryOpen ? "var(--text)" : "var(--sub)",
            marginLeft: 4,
          }}
          aria-label={`${isHistoryOpen ? "Hide" : "Show"} contribution history for ${account.name}`}
          aria-expanded={isHistoryOpen}
        >
          🕘
        </motion.button>
        {isConfirmingDelete ? (
          <div style={{ display: "flex", gap: 4, marginLeft: spacing.xs }}>
            <motion.button
              onClick={confirmDelete}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
              transition={springs.snappy}
              style={{
                background: "var(--error-200)",
                border: "none",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.semibold,
                color: "var(--error)",
                borderRadius: radius.min,
                fontFamily: FONT_FAMILY,
              }}
              aria-label={`Confirm delete ${account.name}`}
            >
              Delete
            </motion.button>
            <motion.button
              onClick={cancelDelete}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
              transition={springs.snappy}
              style={{
                background: "none",
                border: "none",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: typography['body-sm'].fontSize,
                color: "var(--sub)",
              }}
              aria-label="Cancel delete"
            >
              ✕
            </motion.button>
          </div>
        ) : (
          <motion.button
            onClick={requestDelete}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
            transition={springs.snappy}
            style={{
              background: "none",
              border: "none",
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: typography.body.fontSize,
              color: "var(--error)",
              marginLeft: spacing.xs,
            }}
            aria-label={`Delete ${account.name}`}
          >
            ✕
          </motion.button>
        )}
      </div>
        <AnimatePresence initial={false}>
          {isBalanceUpdateOpen && (
            <UpdateBalancePanel
              key={`balance-${account.id}`}
              account={account}
              onSubmit={newBalance => handleUpdateBalance(account, newBalance)}
              onCancel={() => setBalanceUpdateId(null)}
            />
          )}
          {isHistoryOpen && (
            <ContributionHistoryPanel
              key={`history-${account.id}-${historyRefreshKey}`}
              accountId={account.id}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  function renderForm({
    item,
    onDone,
    onCancel,
  }: {
    item: SavingsAccount | null
    onDone: () => void
    onCancel: () => void
  }) {
    return (
      <SavingsAccountFormWrapper
        item={item}
        onCreateAccount={onCreateAccount}
        onUpdateAccount={onUpdateAccount}
        onDone={onDone}
        onCancel={onCancel}
      />
    )
  }

  return (
    <ManagedListScreen<SavingsAccount>
      items={savingsAccounts}
      title="Savings & Investments"
      addLabel="+ Add account"
      emptyEmoji="🌱"
      emptyTitle="No accounts yet"
      emptySubtitle="Add a savings or investment account to track it here. Every dollar counts."
      onBack={onBack}
      onDelete={async (id) => {
        await onDeleteAccount(id)
      }}
      renderItem={renderItem}
      renderForm={renderForm}
      renderSummary={renderSummary}
      listLayout="single-card"
    />
  )
}

// ============================================================================
// ContributionHistoryPanel — per-account contribution history (task 158.2)
// ============================================================================

interface ContributionHistoryPanelProps {
  accountId: string
}

/**
 * Expandable panel showing an account's contribution history (balance changes
 * over time), rendered with the same visual language as the transaction list:
 * each entry shows a date/timestamp and the signed amount changed.
 *
 * History is read from local storage on open. Shows a warm empty state when no
 * contributions have been recorded yet.
 */
function ContributionHistoryPanel({ accountId }: ContributionHistoryPanelProps) {
  const { prefersReducedMotion } = useReducedMotion()
  // Read once when the panel mounts (i.e. when the user expands it).
  const [entries] = useState<SavingsContributionEntry[]>(() =>
    getContributionHistory(accountId)
  )

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={springs.gentle}
      style={{ overflow: "hidden" }}
    >
      <div
        style={{
          padding: "10px 0 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <p
          style={{
            fontSize: typography.caption.fontSize,
            fontWeight: fontWeights.semibold,
            color: "var(--muted)",
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            margin: "0 0 8px",
          }}
        >
          Contribution history
        </p>

        {entries.length === 0 ? (
          <p
            style={{
              fontSize: typography['body-sm'].fontSize,
              color: "var(--sub)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            No contributions recorded yet. Balance changes will show up here as you
            contribute or update this account.
          </p>
        ) : (
          <div role="list" aria-label="Contribution history">
            {entries.map(entry => {
              const isPositive = entry.amount >= 0
              return (
                <div
                  key={entry.id}
                  role="listitem"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: spacing.sm,
                    padding: "8px 0",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: typography['body-sm'].fontSize,
                        color: "var(--text)",
                        margin: 0,
                        fontWeight: fontWeights.medium,
                      }}
                    >
                      {formatEntryTimestamp(entry.timestamp)}
                    </p>
                    <p style={{ fontSize: typography.caption.fontSize, color: "var(--muted)", margin: 0 }}>
                      Balance: {formatDollars(entry.resultingBalance)}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: typography.body.fontSize,
                      fontWeight: fontWeights.semibold,
                      color: isPositive ? "var(--success)" : "var(--error)",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatSignedDollars(entry.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ============================================================================
// UpdateBalancePanel — inline "Update Balance" action (task 163.1)
// ============================================================================

interface UpdateBalancePanelProps {
  account: SavingsAccount
  /** Called with the new total balance the user entered. */
  onSubmit: (newBalance: number) => void | Promise<void>
  onCancel: () => void
}

/**
 * Inline form to manually update an account's current balance. Since Folio
 * doesn't connect to banks, this is how balances move over time. The net change
 * is logged to the per-account contribution history (task 158.2) via the
 * savings update mutation, so it flows straight into the growth-over-time view.
 *
 * Shows a live preview of the change (up / down) with warm, non-judgmental copy
 * so a dip (e.g. a market wobble or a withdrawal) never reads as a failure.
 */
function UpdateBalancePanel({ account, onSubmit, onCancel }: UpdateBalancePanelProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [value, setValue] = useState<string>(String(account.balance))
  const [saving, setSaving] = useState(false)

  const parsed = parseFloat(value)
  const hasValidNumber = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0
  const delta = hasValidNumber ? parsed - account.balance : 0
  const isUnchanged = hasValidNumber && delta === 0
  const canSave = hasValidNumber && !isUnchanged && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSubmit(parsed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={springs.gentle}
      style={{ overflow: "hidden" }}
    >
      <div style={{ padding: "12px 0 14px", borderBottom: "1px solid var(--border)" }}>
        <p
          style={{
            fontSize: typography.caption.fontSize,
            fontWeight: fontWeights.semibold,
            color: "var(--muted)",
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            margin: "0 0 8px",
          }}
        >
          Update balance
        </p>

        <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", margin: "0 0 8px", lineHeight: 1.5 }}>
          Current balance: {formatDollars(account.balance)}. Enter the latest
          total — we&apos;ll log the change so you can watch it grow over time.
        </p>

        <label style={labelStyle} htmlFor={`balance-input-${account.id}`}>
          New balance ($)
        </label>
        <input
          id={`balance-input-${account.id}`}
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={String(account.balance)}
          min={0}
          step={100}
          autoFocus
          onKeyDown={e => {
            if (e.key === "Enter" && canSave) handleSave()
          }}
          style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
          aria-label={`New balance for ${account.name}`}
        />

        {/* Live change preview */}
        {hasValidNumber && !isUnchanged && (
          <p
            style={{
              fontSize: typography['body-sm'].fontSize,
              fontWeight: fontWeights.medium,
              margin: "8px 0 0",
              color: delta >= 0 ? "var(--success)" : "var(--muted)",
              fontVariantNumeric: "tabular-nums",
            }}
            aria-live="polite"
          >
            {delta >= 0
              ? `↑ ${formatSignedDollars(delta)} since last update — nice growth`
              : `${formatSignedDollars(delta)} since last update — that's okay, balances move`}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: spacing.xs, marginTop: 12 }}>
          <motion.button
            onClick={onCancel}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            transition={springs.snappy}
            style={{
              flex: 1,
              padding: "10px 16px",
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.medium,
              fontFamily: FONT_FAMILY,
              color: "var(--text)",
              background: "var(--fill-06)",
              border: "1px solid var(--border)",
              borderRadius: borderRadius.full,
              cursor: "pointer",
            }}
            aria-label="Cancel balance update"
          >
            Cancel
          </motion.button>
          <motion.button
            onClick={handleSave}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            transition={springs.snappy}
            disabled={!canSave}
            style={{
              flex: 1,
              padding: "10px 16px",
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.semibold,
              fontFamily: FONT_FAMILY,
              color: "var(--text)",
              background: canSave ? "var(--success)" : "var(--fill-06)",
              border: "none",
              borderRadius: borderRadius.full,
              cursor: canSave ? "pointer" : "not-allowed",
              opacity: canSave ? 1 : 0.5,
            }}
            aria-label={`Save new balance for ${account.name}`}
          >
            {saving ? "Saving…" : "Save balance"}
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================================
// SavingsAccountFormWrapper — self-contained add/edit form
// ============================================================================

interface SavingsAccountFormData {
  type: SavingsAccountType
  name: string
  balance: string
  monthlyContribution: string
  expectedReturn: string
}

interface SavingsAccountFormWrapperProps {
  item: SavingsAccount | null
  onCreateAccount: (data: SavingsAccountFormValues) => Promise<SavingsAccount | null>
  onUpdateAccount: (id: string, data: Partial<SavingsAccountFormValues>) => Promise<SavingsAccount | null>
  onDone: () => void
  onCancel: () => void
}

function SavingsAccountFormWrapper({
  item,
  onCreateAccount,
  onUpdateAccount,
  onDone,
  onCancel,
}: SavingsAccountFormWrapperProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [form, setForm] = useState<SavingsAccountFormData>(
    item
      ? {
          type: item.type,
          name: item.name,
          balance: String(item.balance),
          monthlyContribution: String(item.monthlyContribution),
          expectedReturn: String(item.expectedAnnualReturn),
        }
      : {
          type: "hysa",
          name: "",
          balance: "",
          monthlyContribution: "",
          // Pre-fill expected return from the default account type metadata
          expectedReturn: String(
            SAVINGS_ACCOUNT_TYPES.find(t => t.type === "hysa")?.defaultReturn ?? 0
          ),
        }
  )
  const [saving, setSaving] = useState(false)

  // Auto-fill expected return when type changes (only when the field is empty,
  // mirroring AddAccountForm in SavingsProjectionsScreen).
  function handleTypeChange(newType: SavingsAccountType) {
    setForm(prev => {
      const meta = SAVINGS_ACCOUNT_TYPES.find(t => t.type === newType)
      const shouldAutofill = meta && !prev.expectedReturn.trim()
      return {
        ...prev,
        type: newType,
        expectedReturn: shouldAutofill ? String(meta!.defaultReturn) : prev.expectedReturn,
      }
    })
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const values: SavingsAccountFormValues = {
        type: form.type,
        name: form.name.trim(),
        balance: parseFloat(form.balance) || 0,
        monthlyContribution: parseFloat(form.monthlyContribution) || 0,
        expectedAnnualReturn: parseFloat(form.expectedReturn) || 0,
      }
      if (item) {
        await onUpdateAccount(item.id, values)
      } else {
        await onCreateAccount(values)
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.name.trim().length > 0 && !saving

  return (
    <div
      style={{
        padding: 14,
        borderRadius: radius.control,
        background: "var(--fill-03)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Account Type */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>Account Type</p>
        <select
          value={form.type}
          onChange={e => handleTypeChange(e.target.value as SavingsAccountType)}
          style={{ ...inputStyle, appearance: "auto" }}
          aria-label="Account type"
        >
          {SAVINGS_ACCOUNT_TYPES.map(t => (
            <option key={t.type} value={t.type}>
              {t.emoji} {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Name */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>Account Name</p>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g. My Roth IRA"
          style={inputStyle}
          autoFocus
          aria-label="Account name"
        />
      </div>

      {/* Balance */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>Current Balance ($)</p>
        <input
          type="number"
          value={form.balance}
          onChange={e => setForm(prev => ({ ...prev, balance: e.target.value }))}
          placeholder="0"
          min={0}
          step={100}
          style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
          aria-label="Current balance"
        />
      </div>

      {/* Monthly Contribution */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>Monthly Contribution ($)</p>
        <input
          type="number"
          value={form.monthlyContribution}
          onChange={e => setForm(prev => ({ ...prev, monthlyContribution: e.target.value }))}
          placeholder="0"
          min={0}
          step={25}
          style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
          aria-label="Monthly contribution"
        />
      </div>

      {/* Expected Annual Return */}
      <div style={{ marginBottom: 14 }}>
        <p style={labelStyle}>Expected Annual Return (%)</p>
        <input
          type="number"
          value={form.expectedReturn}
          onChange={e => setForm(prev => ({ ...prev, expectedReturn: e.target.value }))}
          placeholder="7"
          min={0}
          max={30}
          step={0.5}
          style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
          aria-label="Expected annual return percentage"
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: spacing.xs }}>
        <motion.button
          onClick={onCancel}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
          transition={springs.snappy}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: typography.body.fontSize,
            fontWeight: fontWeights.medium,
            fontFamily: FONT_FAMILY,
            color: "var(--text)",
            background: "var(--fill-06)",
            border: "1px solid var(--border)",
            borderRadius: borderRadius.full,
            cursor: "pointer",
          }}
          aria-label="Cancel"
        >
          Cancel
        </motion.button>
        <motion.button
          onClick={handleSave}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
          transition={springs.snappy}
          disabled={!canSave}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: typography.body.fontSize,
            fontWeight: fontWeights.semibold,
            fontFamily: FONT_FAMILY,
            color: "var(--text)",
            background: canSave ? "var(--success)" : "var(--fill-06)",
            border: "none",
            borderRadius: borderRadius.full,
            cursor: canSave ? "pointer" : "not-allowed",
            opacity: canSave ? 1 : 0.5,
          }}
          aria-label={item ? "Save changes" : "Add account"}
        >
          {saving ? "Saving…" : item ? "Save" : "Add"}
        </motion.button>
      </div>
    </div>
  )
}
