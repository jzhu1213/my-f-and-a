"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { ManagedListScreen, type ItemRenderContext } from "@/components/ui/ManagedListScreen"
import { BUDGET_CATEGORIES } from "@/types"
import type { TransactionCategory } from "@/types"
import type { FixedExpense } from "@/lib/fixedExpenses"
import { getTotalFixedMonthly } from "@/lib/fixedExpenses"
import { FONT_FAMILY } from "@/styles/typography"
import {
  sectionHeadingStrong,
  listRow,
  borderRadius,
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
 * Reached from Settings. Uses ManagedListScreen scaffold + GlassCard + Inter + warm palette.
 *
 * Validates: Requirements 12.3, 141.1
 */
export function RecurringBillsScreen({
  bills,
  onAddBill,
  onUpdateBill,
  onDeleteBill,
  onClose,
}: RecurringBillsScreenProps) {
  // ── Computed ───────────────────────────────────────────────────────────────
  const totalMonthly = getTotalFixedMonthly(bills)

  // ── Render Callbacks ───────────────────────────────────────────────────────
  function renderSummary() {
    return (
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
    )
  }

  function renderItem(context: ItemRenderContext<FixedExpense>) {
    const { item: bill, requestDelete, isConfirmingDelete, confirmDelete, cancelDelete } = context
    return (
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
          onClick={context.startEdit}
          role="button"
          tabIndex={0}
          aria-label={`Edit ${bill.label}`}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") context.startEdit()
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
        {isConfirmingDelete ? (
          <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
            <motion.button
              onClick={confirmDelete}
              whileTap={{ scale: 0.9 }}
              transition={springs.snappy}
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "none",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--error)",
                borderRadius: 6,
              }}
              aria-label={`Confirm delete ${bill.label}`}
            >
              Delete
            </motion.button>
            <motion.button
              onClick={cancelDelete}
              whileTap={{ scale: 0.9 }}
              transition={springs.snappy}
              style={{
                background: "none",
                border: "none",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: 12,
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
        )}
      </div>
    )
  }

  function renderForm({
    item,
    onDone,
    onCancel,
  }: {
    item: FixedExpense | null
    onDone: () => void
    onCancel: () => void
  }) {
    return (
      <BillFormWrapper
        item={item}
        onAddBill={onAddBill}
        onUpdateBill={onUpdateBill}
        onDone={onDone}
        onCancel={onCancel}
      />
    )
  }

  return (
    <ManagedListScreen<FixedExpense>
      items={bills}
      title="Recurring Bills"
      addLabel="+ Add bill"
      emptyEmoji="📋"
      emptyTitle="No bills yet"
      emptySubtitle="Add your first recurring bill to track monthly fixed costs."
      onBack={onClose}
      onDelete={onDeleteBill}
      renderItem={renderItem}
      renderForm={renderForm}
      renderSummary={renderSummary}
      listLayout="single-card"
    />
  )
}

// ============================================================================
// BillFormWrapper — self-contained form with its own state
// ============================================================================

interface BillFormWrapperProps {
  item: FixedExpense | null
  onAddBill: (bill: Omit<FixedExpense, "id" | "userId">) => Promise<void>
  onUpdateBill: (id: string, bill: Partial<FixedExpense>) => Promise<void>
  onDone: () => void
  onCancel: () => void
}

function BillFormWrapper({ item, onAddBill, onUpdateBill, onDone, onCancel }: BillFormWrapperProps) {
  const [form, setForm] = useState<BillFormData>(
    item
      ? { label: item.label, amount: item.amount, dueDay: item.dueDay, category: item.category }
      : DEFAULT_FORM
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.label.trim() || form.amount <= 0) return
    setSaving(true)
    try {
      if (item) {
        await onUpdateBill(item.id, {
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
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <BillForm
      form={form}
      setForm={setForm}
      onSave={handleSave}
      onCancel={onCancel}
      saving={saving}
      isEdit={item !== null}
    />
  )
}

// ============================================================================
// BillForm sub-component (presentational)
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
                  borderRadius: borderRadius.full,
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
            borderRadius: borderRadius.full,
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
