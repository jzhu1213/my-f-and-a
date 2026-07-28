"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import type { Debt, DebtType } from "@/types/folio"
import { DEBT_TYPES } from "@/types/folio"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeadingStrong,
  listRow,
  borderRadius,
} from "@/styles/shared"
import {
  getTotalDebtBalance,
  getTotalMinimumPayments,
  getPayoffMonths,
} from "@/lib/debtUtils"

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
  fontSize: 14,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "rgba(0, 0, 0, 0.2)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  outline: "none",
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--sub)",
  marginBottom: 4,
  fontFamily: FONT_FAMILY,
}

// ============================================================================
// DebtScreen Component
// ============================================================================

/**
 * DebtScreen — full-screen UI to add/edit/list debts (student loans,
 * credit cards, etc.). Reached from Settings. Uses GlassCard + Inter + warm palette.
 */
export function DebtScreen({
  debts,
  onAddDebt,
  onUpdateDebt,
  onDeleteDebt,
  onClose,
}: DebtScreenProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<DebtFormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

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
          gap: 12,
          marginBottom: 20,
        }}
      >
        <motion.button
          onClick={onClose}
          whileTap={{ scale: 0.92 }}
          transition={springs.snappy}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border)",
            borderRadius: borderRadius.full,
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 18,
            color: "var(--text)",
          }}
          aria-label="Go back"
        >
          ←
        </motion.button>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text)",
            margin: 0,
          }}
        >
          Debts
        </h2>
      </div>

      {/* ── Summary Card ───────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={sectionHeadingStrong}>Total Balance</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          ${totalBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
          ${totalMinimum.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          <span style={{ marginLeft: 3 }}>/mo minimum</span>
        </p>
      </GlassCard>

      {/* ── Debts List ─────────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={sectionHeadingStrong}>Your Debts</p>

        {debts.length === 0 && !showAddForm && (
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            No debts tracked yet. Add your first debt to see payoff estimates.
          </p>
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
                    style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}
                    onClick={() => openEditForm(debt)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${debt.name}`}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") openEditForm(debt)
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{emojiForType(debt.type)}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, color: "var(--text)", margin: 0, fontWeight: 500 }}>
                        {debt.name}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                        {debt.apr}% APR · ${debt.minimumPayment}/mo min ·{" "}
                        {formatPayoff(getPayoffMonths(debt.balance, debt.apr, debt.minimumPayment))}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      ${debt.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <motion.button
                    onClick={() => handleDelete(debt.id)}
                    whileTap={{ scale: 0.9 }}
                    transition={springs.snappy}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "4px 8px",
                      cursor: "pointer",
                      fontSize: 16,
                      color: "var(--error)",
                      marginLeft: 8,
                    }}
                    aria-label={`Delete ${debt.name}`}
                  >
                    ✕
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
              style={{ overflow: "hidden", marginTop: 12 }}
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
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "12px 0",
              background: "rgba(255,255,255,0.04)",
              border: "1.5px dashed var(--border)",
              borderRadius: borderRadius.md,
              color: "var(--sub)",
              fontSize: 14,
              fontWeight: 500,
              fontFamily: FONT_FAMILY,
              cursor: "pointer",
            }}
            aria-label="Add a new debt"
          >
            + Add debt
          </motion.button>
        )}
      </GlassCard>
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
  return (
    <div
      style={{
        padding: 14,
        borderRadius: borderRadius.md,
        background: "rgba(255,255,255,0.03)",
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
                whileTap={{ scale: 0.95 }}
                transition={springs.snappy}
                style={{
                  padding: "8px 14px",
                  borderRadius: borderRadius.full,
                  border: isActive ? "1.5px solid var(--success)" : "1px solid var(--border)",
                  background: isActive ? "rgba(6, 214, 160, 0.1)" : "rgba(0,0,0,0.15)",
                  color: isActive ? "var(--success)" : "var(--sub)",
                  fontSize: 13,
                  fontWeight: 500,
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
      <div style={{ display: "flex", gap: 8 }}>
        <motion.button
          onClick={onCancel}
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
            borderRadius: borderRadius.full,
            cursor: "pointer",
          }}
          aria-label="Cancel"
        >
          Cancel
        </motion.button>
        <motion.button
          onClick={onSave}
          whileTap={{ scale: 0.97 }}
          transition={springs.snappy}
          disabled={saving || !form.name.trim() || form.balance <= 0}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: FONT_FAMILY,
            color: "#fff",
            background: saving || !form.name.trim() || form.balance <= 0
              ? "rgba(255,255,255,0.06)"
              : "var(--success)",
            border: "none",
            borderRadius: borderRadius.full,
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
