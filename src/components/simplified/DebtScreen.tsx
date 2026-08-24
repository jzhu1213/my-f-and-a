"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import type { Debt, DebtType } from "@/types/folio"
import { DEBT_TYPES } from "@/types/folio"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
  listRow,
} from "@/styles/shared"
import { radius } from "@/styles/surfaces"
import {
  getTotalDebtBalance,
  getTotalMinimumPayments,
  getPayoffMonths,
  getTotalInterestPaid,
} from "@/lib/debtUtils"
import { isLearningEnabled } from "@/lib/educationPreferences"
import { MultiDebtPayoffCard } from "./MultiDebtPayoffCard"

// ============================================================================
// Types
// ============================================================================

export interface DebtScreenProps {
  debts: Debt[]
  onAddDebt: (debt: Omit<Debt, "id" | "userId" | "createdAt">) => Promise<void>
  onUpdateDebt: (id: string, debt: Partial<Debt>) => Promise<void>
  onDeleteDebt: (id: string) => Promise<void>
  onClose: () => void
}

// ============================================================================
// Helpers
// ============================================================================

function emojiForType(type: DebtType): string {
  return DEBT_TYPES.find(d => d.type === type)?.emoji ?? "📄"
}

function formatPayoff(months: number): string {
  if (months === Infinity) return "∞"
  if (months === 0) return "Paid off"
  if (months < 12) return `${months}mo`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years}y ${rem}mo` : `${years}y`
}

// ============================================================================
// Form state
// ============================================================================

interface DebtFormData {
  name: string
  type: DebtType
  balance: number
  apr: number
  minimumPayment: number
}

const DEFAULT_FORM: DebtFormData = {
  name: "",
  type: "student_loan",
  balance: 0,
  apr: 0,
  minimumPayment: 0,
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
// DebtScreen Component
// ============================================================================

/**
 * DebtScreen — full-screen UI to add/edit/list debts (student loans,
 * credit cards, etc.). Reached from Settings. Uses Card + Inter + warm palette.
 */
export function DebtScreen({
  debts,
  onAddDebt,
  onUpdateDebt,
  onDeleteDebt,
  onClose,
}: DebtScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<DebtFormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [activeWhatIf, setActiveWhatIf] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // ── Computed ───────────────────────────────────────────────────────────────
  const totalBalance = getTotalDebtBalance(debts)
  const totalMinimum = getTotalMinimumPayments(debts)

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openAddForm() {
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setShowAddForm(true)
  }

  function openEditForm(debt: Debt) {
    setShowAddForm(false)
    setEditingId(debt.id)
    setForm({
      name: debt.name,
      type: debt.type,
      balance: debt.balance,
      apr: debt.apr,
      minimumPayment: debt.minimumPayment,
    })
  }

  function cancelForm() {
    setEditingId(null)
    setShowAddForm(false)
    setForm(DEFAULT_FORM)
  }

  async function handleSave() {
    if (!form.name.trim() || form.balance <= 0) return
    setSaving(true)
    try {
      if (editingId) {
        await onUpdateDebt(editingId, {
          name: form.name.trim(),
          type: form.type,
          balance: form.balance,
          apr: form.apr,
          minimumPayment: form.minimumPayment,
        })
      } else {
        await onAddDebt({
          name: form.name.trim(),
          type: form.type,
          balance: form.balance,
          apr: form.apr,
          minimumPayment: form.minimumPayment,
        })
      }
      cancelForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      setTimeout(() => setConfirmDeleteId((prev) => prev === id ? null : prev), 4000)
      return
    }
    setConfirmDeleteId(null)
    await onDeleteDebt(id)
    if (editingId === id) cancelForm()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM - 20}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing.sm,
          marginBottom: HORIZONTAL_PADDING,
        }}
      >
        <motion.button
          onClick={onClose}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
          transition={springs.snappy}
          style={{
            background: "var(--fill-06)",
            border: "1px solid var(--border)",
            borderRadius: radius.full,
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: typography.subhead.fontSize,
            color: "var(--text)",
          }}
          aria-label="Go back"
        >
          ←
        </motion.button>
        <h1
          style={{
            fontSize: typography.headline.fontSize,
            fontWeight: fontWeights.bold,
            color: "var(--text)",
            margin: 0,
          }}
        >
          Debts
        </h1>
      </div>

      {/* ── Summary Card ───────────────────────────────────────────────────── */}
      <Card style={{ padding: "18px 20px", marginBottom: HORIZONTAL_PADDING }}>
        <p style={sectionHeader}>Total Balance</p>
        <p style={{ fontSize: typography.headline.fontSize, fontWeight: fontWeights.bold, color: "var(--text)", margin: 0, fontVariantNumeric: "tabular-nums" }}>
          ${totalBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </p>
        <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
          ${totalMinimum.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          <span style={{ marginInlineStart: 3 }}>/mo minimum</span>
        </p>
      </Card>

      {/* ── What If Scenarios ──────────────────────────────────────────────── */}
      {debts.length > 0 && totalBalance > 0 && totalMinimum > 0 && (
        <Card style={{ padding: "18px 20px", marginBottom: HORIZONTAL_PADDING }}>
          <p style={sectionHeader}>What If…</p>
          <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", marginBottom: spacing.sm }}>
            Tap a scenario to see the difference
          </p>
          <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap", marginBottom: activeWhatIf ? 12 : 0 }}>
            <motion.button
              onClick={() => setActiveWhatIf(activeWhatIf === "extra50" ? null : "extra50")}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
              transition={springs.snappy}
              style={{
                padding: "8px 14px",
                borderRadius: radius.full,
                border: activeWhatIf === "extra50" ? "1.5px solid var(--success)" : "1px solid var(--border)",
                background: activeWhatIf === "extra50" ? "var(--success-100)" : "var(--fill-04)",
                color: activeWhatIf === "extra50" ? "var(--success)" : "var(--sub)",
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.medium,
                fontFamily: FONT_FAMILY,
                cursor: "pointer",
              }}
            >
              +$50/mo
            </motion.button>
            <motion.button
              onClick={() => setActiveWhatIf(activeWhatIf === "double" ? null : "double")}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
              transition={springs.snappy}
              style={{
                padding: "8px 14px",
                borderRadius: radius.full,
                border: activeWhatIf === "double" ? "1.5px solid var(--success)" : "1px solid var(--border)",
                background: activeWhatIf === "double" ? "var(--success-100)" : "var(--fill-04)",
                color: activeWhatIf === "double" ? "var(--success)" : "var(--sub)",
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.medium,
                fontFamily: FONT_FAMILY,
                cursor: "pointer",
              }}
            >
              Double payments
            </motion.button>
          </div>

          <AnimatePresence>
            {activeWhatIf && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={springs.gentle}
                style={{ overflow: "hidden" }}
              >
                {(() => {
                  // Calculate current scenario
                  const currentMonths = debts.reduce((max, d) => {
                    const m = getPayoffMonths(d.balance, d.apr, d.minimumPayment)
                    return m > max ? m : max
                  }, 0)
                  const currentInterest = debts.reduce((sum, d) => {
                    const interest = getTotalInterestPaid(d.balance, d.apr, d.minimumPayment)
                    return interest === Infinity ? sum : sum + interest
                  }, 0)

                  // Calculate "what if" scenario
                  const extraPerDebt = activeWhatIf === "extra50" ? 50 / debts.length : 0
                  const multiplier = activeWhatIf === "double" ? 2 : 1

                  const whatIfMonths = debts.reduce((max, d) => {
                    const payment = d.minimumPayment * multiplier + extraPerDebt
                    const m = getPayoffMonths(d.balance, d.apr, payment)
                    return m > max ? m : max
                  }, 0)
                  const whatIfInterest = debts.reduce((sum, d) => {
                    const payment = d.minimumPayment * multiplier + extraPerDebt
                    const interest = getTotalInterestPaid(d.balance, d.apr, payment)
                    return interest === Infinity ? sum : sum + interest
                  }, 0)

                  const monthsSaved = currentMonths === Infinity ? null : currentMonths - whatIfMonths
                  const interestSaved = currentInterest - whatIfInterest

                  return (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: radius.control,
                        background: "var(--success-50)",
                        border: "1px solid var(--success-200)",
                      }}
                    >
                      <div style={{ display: "flex", gap: spacing.md, marginBottom: 10 }}>
                        {monthsSaved !== null && monthsSaved > 0 && (
                          <div>
                            <p style={{ fontSize: typography.subhead.fontSize, fontWeight: fontWeights.bold, color: "var(--success)", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                              {monthsSaved < 12 ? `${monthsSaved}mo` : `${Math.floor(monthsSaved / 12)}y ${monthsSaved % 12}mo`}
                            </p>
                            <p style={{ fontSize: typography.caption.fontSize, color: "var(--muted)", margin: 0 }}>sooner</p>
                          </div>
                        )}
                        {interestSaved > 0 && (
                          <div>
                            <p style={{ fontSize: typography.subhead.fontSize, fontWeight: fontWeights.bold, color: "var(--success)", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                              ${Math.round(interestSaved).toLocaleString()}
                            </p>
                            <p style={{ fontSize: typography.caption.fontSize, color: "var(--muted)", margin: 0 }}>less interest</p>
                          </div>
                        )}
                      </div>
                      {isLearningEnabled() && (
                      <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", lineHeight: 1.5, margin: 0 }}>
                        {activeWhatIf === "extra50"
                          ? "Even $50 more per month adds up fast. The extra goes straight to principal, shrinking the balance that accrues interest."
                          : "Doubling payments dramatically cuts your timeline. Each extra dollar fights interest instead of feeding it."}
                      </p>
                      )}
                    </div>
                  )
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}

      {/* ── Debts List ─────────────────────────────────────────────────────── */}
      <Card style={{ padding: "18px 20px", marginBottom: HORIZONTAL_PADDING }}>
        <p style={sectionHeader}>Your Debts</p>

        {debts.length === 0 && !showAddForm && (
          <EmptyState
            illustration="generic"
            title="Debt-free zone (for now)"
            subtitle="Tracking debts here helps you plan payoff timelines and see progress over time."
            actionLabel="+ Add your first debt"
            onAction={openAddForm}
          />
        )}

        <AnimatePresence mode="popLayout">
          {debts.map(debt => (
            <motion.div
              key={debt.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={springs.gentle}
            >
              {editingId === debt.id ? (
                <DebtForm
                  form={form}
                  setForm={setForm}
                  onSave={handleSave}
                  onCancel={cancelForm}
                  saving={saving}
                  isEdit
                />
              ) : (
                <div
                  style={{
                    ...listRow,
                    cursor: "pointer",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: spacing.sm, flex: 1 }}
                    onClick={() => openEditForm(debt)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${debt.name}`}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") openEditForm(debt)
                    }}
                  >
                    <span style={{ fontSize: typography.subhead.fontSize }}>{emojiForType(debt.type)}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: typography.body.fontSize, color: "var(--text)", margin: 0, fontWeight: fontWeights.medium }}>
                        {debt.name}
                      </p>
                      <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", margin: 0 }}>
                        {debt.apr}% APR · ${debt.minimumPayment}/mo min ·{" "}
                        {formatPayoff(getPayoffMonths(debt.balance, debt.apr, debt.minimumPayment))}
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
                      ${debt.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <motion.button
                    onClick={() => handleDelete(debt.id)}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                    transition={springs.snappy}
                    style={{
                      background: confirmDeleteId === debt.id ? "var(--error-200)" : "none",
                      border: "none",
                      padding: "4px 8px",
                      cursor: "pointer",
                      fontSize: confirmDeleteId === debt.id ? 12 : 16,
                      fontWeight: confirmDeleteId === debt.id ? 600 : undefined,
                      color: "var(--error)",
                      marginInlineStart: spacing.xs,
                      borderRadius: radius.min,
                    }}
                    aria-label={confirmDeleteId === debt.id ? `Confirm delete ${debt.name}` : `Delete ${debt.name}`}
                  >
                    {confirmDeleteId === debt.id ? "Confirm?" : "✕"}
                  </motion.button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* ── Inline Add Form ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={springs.gentle}
              style={{ overflow: "hidden", marginTop: spacing.sm }}
            >
              <DebtForm
                form={form}
                setForm={setForm}
                onSave={handleSave}
                onCancel={cancelForm}
                saving={saving}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Add Button ───────────────────────────────────────────────────── */}
        {!showAddForm && !editingId && (
          <motion.button
            onClick={openAddForm}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            transition={springs.snappy}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "12px 0",
              background: "var(--fill-04)",
              border: "1.5px dashed var(--border)",
              borderRadius: radius.control,
              color: "var(--sub)",
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.medium,
              fontFamily: FONT_FAMILY,
              cursor: "pointer",
            }}
            aria-label="Add a new debt"
          >
            + Add debt
          </motion.button>
        )}
      </Card>

      {/* ── Multi-Debt Payoff Comparison ───────────────────────────────────── */}
      <MultiDebtPayoffCard debts={debts} />
    </div>
  )
}

// ============================================================================
// DebtForm sub-component
// ============================================================================

interface DebtFormProps {
  form: DebtFormData
  setForm: React.Dispatch<React.SetStateAction<DebtFormData>>
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isEdit?: boolean
}

function DebtForm({ form, setForm, onSave, onCancel, saving, isEdit }: DebtFormProps) {
  const { prefersReducedMotion } = useReducedMotion()

  return (
    <div
      style={{
        padding: 14,
        borderRadius: radius.control,
        background: "var(--fill-03)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Name */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>Name</p>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g. Federal Student Loan, Chase Visa"
          style={inputStyle}
          autoFocus
          aria-label="Debt name"
        />
      </div>

      {/* Type */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>Type</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DEBT_TYPES.map(dt => {
            const isActive = form.type === dt.type
            return (
              <motion.button
                key={dt.type}
                onClick={() => setForm(prev => ({ ...prev, type: dt.type }))}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                transition={springs.snappy}
                style={{
                  padding: "8px 14px",
                  borderRadius: radius.full,
                  border: isActive ? "1.5px solid var(--success)" : "1px solid var(--border)",
                  background: isActive ? "var(--success-100)" : "var(--fill-04)",
                  color: isActive ? "var(--success)" : "var(--sub)",
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.medium,
                  fontFamily: FONT_FAMILY,
                  cursor: "pointer",
                }}
                aria-label={`Type: ${dt.label}`}
                aria-pressed={isActive}
              >
                {dt.emoji} {dt.label}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Balance */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>Balance ($)</p>
        <input
          type="number"
          value={form.balance || ""}
          onChange={e => setForm(prev => ({ ...prev, balance: Number(e.target.value) || 0 }))}
          placeholder="0"
          min={0}
          step={100}
          style={inputStyle}
          aria-label="Debt balance"
        />
      </div>

      {/* APR */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>APR (%)</p>
        <input
          type="number"
          value={form.apr || ""}
          onChange={e => setForm(prev => ({ ...prev, apr: Number(e.target.value) || 0 }))}
          placeholder="0"
          min={0}
          step={0.1}
          style={inputStyle}
          aria-label="Annual percentage rate"
        />
      </div>

      {/* Minimum Payment */}
      <div style={{ marginBottom: 14 }}>
        <p style={labelStyle}>Minimum Payment ($/mo)</p>
        <input
          type="number"
          value={form.minimumPayment || ""}
          onChange={e => setForm(prev => ({ ...prev, minimumPayment: Number(e.target.value) || 0 }))}
          placeholder="0"
          min={0}
          step={10}
          style={inputStyle}
          aria-label="Minimum monthly payment"
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
            borderRadius: radius.full,
            cursor: "pointer",
          }}
          aria-label="Cancel"
        >
          Cancel
        </motion.button>
        <motion.button
          onClick={onSave}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
          transition={springs.snappy}
          disabled={saving || !form.name.trim() || form.balance <= 0}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: typography.body.fontSize,
            fontWeight: fontWeights.semibold,
            fontFamily: FONT_FAMILY,
            color: "var(--text)",
            background: saving || !form.name.trim() || form.balance <= 0
              ? "var(--fill-06)"
              : "var(--success)",
            border: "none",
            borderRadius: radius.full,
            cursor: saving || !form.name.trim() || form.balance <= 0 ? "not-allowed" : "pointer",
            opacity: saving || !form.name.trim() || form.balance <= 0 ? 0.5 : 1,
          }}
          aria-label={isEdit ? "Save changes" : "Add debt"}
        >
          {saving ? "Saving…" : isEdit ? "Save" : "Add"}
        </motion.button>
      </div>
    </div>
  )
}
