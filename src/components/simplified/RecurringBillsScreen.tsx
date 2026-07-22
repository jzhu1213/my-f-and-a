"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { BUDGET_CATEGORIES } from "@/types"
import type { TransactionCategory } from "@/types"
import type { FixedExpense } from "@/lib/fixedExpenses"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeadingStrong,
  listRow,
} from "@/styles/shared"

// ============================================================================
// Types
// ============================================================================

export interface RecurringBillsScreenProps {
  bills: FixedExpense[]
  onAddBill: (bill: Omit<FixedExpense, "id" | "userId">) => Promise<void>
  onUpdateBill: (id: string, bill: Partial<FixedExpense>) => Promise<void>
  onDeleteBill: (id: string) => Promise<void>
  onClose: () => void
}

// ============================================================================
// Constants
// ============================================================================

/** Bill-relevant categories with emoji lookup */
const BILL_CATEGORIES = BUDGET_CATEGORIES.filter(c =>
  ["rent", "transport", "school", "other"].includes(c.category)
)

function emojiForCategory(category: TransactionCategory): string {
  return BUDGET_CATEGORIES.find(c => c.category === category)?.emoji ?? "💼"
}

// ============================================================================
// Form state
// ============================================================================

interface BillFormData {
  label: string
  amount: number
  dueDay: number
  category: TransactionCategory
}

const DEFAULT_FORM: BillFormData = {
  label: "",
  amount: 0,
  dueDay: 1,
  category: "rent",
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
// RecurringBillsScreen Component
// ============================================================================

/**
 * RecurringBillsScreen — full-screen UI to add/edit/list monthly recurring bills.
 * Reached from Settings. Uses GlassCard + Inter + warm palette.
 *
 * Validates: Requirements 12.3
 */
export function RecurringBillsScreen({
  bills,
  onAddBill,
  onUpdateBill,
  onDeleteBill,
  onClose,
}: RecurringBillsScreenProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<BillFormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  // ── Computed ───────────────────────────────────────────────────────────────
  const totalMonthly = bills
    .filter(b => b.isActive)
    .reduce((sum, b) => sum + b.amount, 0)

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openAddForm() {
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setShowAddForm(true)
  }

  function openEditForm(bill: FixedExpense) {
    setShowAddForm(false)
    setEditingId(bill.id)
    setForm({
      label: bill.label,
      amount: bill.amount,
      dueDay: bill.dueDay,
      category: bill.category,
    })
  }

  function cancelForm() {
    setEditingId(null)
    setShowAddForm(false)
    setForm(DEFAULT_FORM)
  }

  async function handleSave() {
    if (!form.label.trim() || form.amount <= 0) return
    setSaving(true)
    try {
      if (editingId) {
        await onUpdateBill(editingId, {
          label: form.label.trim(),
          amount: form.amount,
          dueDay: form.dueDay,
          category: form.category,
        })
      } else {
        await onAddBill({
          label: form.label.trim(),
          amount: form.amount,
          dueDay: form.dueDay,
          category: form.category,
          recurringId: crypto.randomUUID(),
          isActive: true,
        })
      }
      cancelForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await onDeleteBill(id)
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
            borderRadius: 99,
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 18,
            color: "var(--text)",
          }}
          aria-label="Go back to settings"
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
          Recurring Bills
        </h2>
      </div>

      {/* ── Summary Card ───────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={sectionHeadingStrong}>Monthly Fixed Costs</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          ${totalMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          <span style={{ fontSize: 13, fontWeight: 400, color: "var(--sub)", marginLeft: 3 }}>
            /mo
          </span>
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
          {bills.filter(b => b.isActive).length} active bill
          {bills.filter(b => b.isActive).length !== 1 ? "s" : ""}
        </p>
      </GlassCard>

      {/* ── Bills List ─────────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={sectionHeadingStrong}>Bills</p>

        {bills.length === 0 && !showAddForm && (
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            No bills yet. Add your first recurring bill below.
          </p>
        )}

        <AnimatePresence mode="popLayout">
          {bills.map(bill => (
            <motion.div
              key={bill.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={springs.gentle}
            >
              {editingId === bill.id ? (
                <BillForm
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
                    onClick={() => openEditForm(bill)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${bill.label}`}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") openEditForm(bill)
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{emojiForCategory(bill.category)}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, color: "var(--text)", margin: 0, fontWeight: 500 }}>
                        {bill.label}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                        Due day {bill.dueDay}
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
                      ${bill.amount}
                    </span>
                  </div>
                  <motion.button
                    onClick={() => handleDelete(bill.id)}
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
                    aria-label={`Delete ${bill.label}`}
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
              <BillForm
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
              borderRadius: 12,
              color: "var(--sub)",
              fontSize: 14,
              fontWeight: 500,
              fontFamily: FONT_FAMILY,
              cursor: "pointer",
            }}
            aria-label="Add a new recurring bill"
          >
            + Add bill
          </motion.button>
        )}
      </GlassCard>
    </div>
  )
}

// ============================================================================
// BillForm sub-component
// ============================================================================

interface BillFormProps {
  form: BillFormData
  setForm: React.Dispatch<React.SetStateAction<BillFormData>>
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isEdit?: boolean
}

function BillForm({ form, setForm, onSave, onCancel, saving, isEdit }: BillFormProps) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Label */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>Label</p>
        <input
          type="text"
          value={form.label}
          onChange={e => setForm(prev => ({ ...prev, label: e.target.value }))}
          placeholder="e.g. Rent, Spotify, Electric"
          style={inputStyle}
          autoFocus
          aria-label="Bill label"
        />
      </div>

      {/* Amount */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>Amount ($)</p>
        <input
          type="number"
          value={form.amount || ""}
          onChange={e => setForm(prev => ({ ...prev, amount: Number(e.target.value) || 0 }))}
          placeholder="0"
          min={0}
          step={1}
          style={inputStyle}
          aria-label="Bill amount"
        />
      </div>

      {/* Due Day */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>Due Day (1–31)</p>
        <input
          type="number"
          value={form.dueDay}
          onChange={e => {
            const val = Math.max(1, Math.min(31, Number(e.target.value) || 1))
            setForm(prev => ({ ...prev, dueDay: val }))
          }}
          min={1}
          max={31}
          style={inputStyle}
          aria-label="Bill due day of month"
        />
      </div>

      {/* Category */}
      <div style={{ marginBottom: 14 }}>
        <p style={labelStyle}>Category</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {BILL_CATEGORIES.map(cat => {
            const isActive = form.category === cat.category
            return (
              <motion.button
                key={cat.category}
                onClick={() => setForm(prev => ({ ...prev, category: cat.category }))}
                whileTap={{ scale: 0.95 }}
                transition={springs.snappy}
                style={{
                  padding: "8px 14px",
                  borderRadius: 99,
                  border: isActive ? "1.5px solid var(--success)" : "1px solid var(--border)",
                  background: isActive ? "rgba(6, 214, 160, 0.1)" : "rgba(0,0,0,0.15)",
                  color: isActive ? "var(--success)" : "var(--sub)",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  cursor: "pointer",
                }}
                aria-label={`Category: ${cat.label}`}
                aria-pressed={isActive}
              >
                {cat.emoji} {cat.label}
              </motion.button>
            )
          })}
        </div>
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
            borderRadius: 99,
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
          disabled={saving || !form.label.trim() || form.amount <= 0}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: FONT_FAMILY,
            color: "#fff",
            background: saving || !form.label.trim() || form.amount <= 0
              ? "rgba(255,255,255,0.06)"
              : "var(--success)",
            border: "none",
            borderRadius: 99,
            cursor: saving || !form.label.trim() || form.amount <= 0 ? "not-allowed" : "pointer",
            opacity: saving || !form.label.trim() || form.amount <= 0 ? 0.5 : 1,
          }}
          aria-label={isEdit ? "Save changes" : "Add bill"}
        >
          {saving ? "Saving…" : isEdit ? "Save" : "Add"}
        </motion.button>
      </div>
    </div>
  )
}
