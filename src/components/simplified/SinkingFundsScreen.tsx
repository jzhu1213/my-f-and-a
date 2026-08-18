"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { BUDGET_CATEGORIES } from "@/types"
import type { TransactionCategory } from "@/types"
import type { SinkingFund } from "@/lib/sinkingFunds"
import {
  SINKING_FUND_PRESETS,
  computeMonthlyReserve,
  computeDisbursementMonthlyShare,
  getFundProgress,
  isFunded,
  getRemainingAmount,
  summarizeSinkingFunds,
  getTotalMonthlyReserve,
  validateSinkingFund,
} from "@/lib/sinkingFunds"
import type { Disbursement } from "@/lib/disbursements"
import {
  isDisbursementActive,
  getRemainingMonths,
} from "@/lib/disbursements"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
  listRow,
  borderRadius,
} from "@/styles/shared"

// ============================================================================
// Types
// ============================================================================

export interface SinkingFundsScreenProps {
  funds: SinkingFund[]
  onAddFund: (fund: Omit<SinkingFund, "id" | "userId" | "createdAt">) => Promise<void>
  onUpdateFund: (id: string, updates: Partial<SinkingFund>) => Promise<void>
  onDeleteFund: (id: string) => Promise<void>
  onClose: () => void
  onSetDisbursement?: (monthlyAmount: number) => void
  /** Persisted disbursements list */
  disbursements?: Disbursement[]
  /** Add a new disbursement */
  onAddDisbursement?: (data: Omit<Disbursement, 'id'>) => void
  /** Remove a disbursement by ID */
  onRemoveDisbursement?: (id: string) => void
}

// ============================================================================
// Form state
// ============================================================================

interface FundFormData {
  label: string
  category: TransactionCategory
  targetAmount: number
  savedAmount: number
  dueDate: string
  monthlyReserve: number
  autoReserve: boolean
}

const DEFAULT_FORM: FundFormData = {
  label: "",
  category: "other",
  targetAmount: 0,
  savedAmount: 0,
  dueDate: "",
  monthlyReserve: 0,
  autoReserve: true,
}

// ============================================================================
// Constants
// ============================================================================

const FUND_CATEGORIES = BUDGET_CATEGORIES

function emojiForCategory(category: TransactionCategory): string {
  return BUDGET_CATEGORIES.find(c => c.category === category)?.emoji ?? "💰"
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
  background: "var(--color-sunken)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  outline: "none",
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--sub)",
  marginBottom: 4,
  fontFamily: FONT_FAMILY,
}

// ============================================================================
// SinkingFundsScreen Component
// ============================================================================

/**
 * SinkingFundsScreen — add/edit/list sinking funds for periodic large costs.
 * Reached from Settings. Uses GlassCard + Inter + warm palette.
 *
 * A sinking fund spreads a future one-time cost (textbooks, travel, gifts,
 * car registration, annual subscriptions) across remaining months so it
 * doesn't blow up the daily budget when the bill arrives.
 *
 * Validates: Requirements 12.3, 13.7, new
 */
export function SinkingFundsScreen({
  funds,
  onAddFund,
  onUpdateFund,
  onDeleteFund,
  onClose,
  onSetDisbursement,
  disbursements = [],
  onAddDisbursement,
  onRemoveDisbursement,
}: SinkingFundsScreenProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<FundFormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<string[]>([])

  const now = new Date()
  const summary = summarizeSinkingFunds(funds)
  const dynamicTotalReserve = getTotalMonthlyReserve(funds, now)

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openAddForm(preset?: typeof SINKING_FUND_PRESETS[number]) {
    setEditingId(null)
    setFormErrors([])
    if (preset) {
      setForm({
        ...DEFAULT_FORM,
        label: preset.label,
        category: preset.category,
        targetAmount: preset.suggestedTarget,
        autoReserve: true,
      })
    } else {
      setForm(DEFAULT_FORM)
    }
    setShowAddForm(true)
  }

  function openEditForm(fund: SinkingFund) {
    setShowAddForm(false)
    setFormErrors([])
    setEditingId(fund.id)
    setForm({
      label: fund.label,
      category: fund.category,
      targetAmount: fund.targetAmount,
      savedAmount: fund.savedAmount,
      dueDate: fund.dueDate,
      monthlyReserve: fund.monthlyReserve,
      autoReserve: false,
    })
  }

  function cancelForm() {
    setEditingId(null)
    setShowAddForm(false)
    setForm(DEFAULT_FORM)
    setFormErrors([])
  }

  /** Derive the effective monthly reserve based on autoReserve toggle */
  function effectiveReserve(f: FundFormData): number {
    if (f.autoReserve) {
      return computeMonthlyReserve(f.targetAmount, f.savedAmount, f.dueDate, now)
    }
    return f.monthlyReserve
  }

  async function handleSave() {
    const reserve = effectiveReserve(form)
    const draft = {
      label: form.label.trim(),
      category: form.category,
      targetAmount: form.targetAmount,
      savedAmount: form.savedAmount,
      dueDate: form.dueDate,
      monthlyReserve: reserve,
    }

    const validation = validateSinkingFund(draft)
    if (!validation.valid) {
      setFormErrors(validation.errors)
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await onUpdateFund(editingId, draft)
      } else {
        await onAddFund(draft)
      }
      cancelForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await onDeleteFund(id)
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
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
          aria-label="Go back to settings"
        >
          ←
        </motion.button>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          Sinking Funds
        </h2>
      </div>

      {/* ── Explainer ──────────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "14px 18px", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "var(--sub)", margin: 0, lineHeight: 1.5 }}>
          Save a little each month toward big upcoming costs — textbooks, travel, gifts —
          so they don&apos;t blow up your daily budget when they arrive. 💡
        </p>
      </GlassCard>

      {/* ── Summary Card ───────────────────────────────────────────────────── */}
      {funds.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={sectionHeader}>Total Monthly Reserve</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0, fontVariantNumeric: "tabular-nums" }}>
            ${dynamicTotalReserve.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--sub)", marginLeft: 3 }}>
              /mo set aside
            </span>
          </p>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {summary.count} fund{summary.count !== 1 ? "s" : ""}
            {summary.fundedCount > 0 && ` · ${summary.fundedCount} fully funded 🎉`}
          </p>
        </GlassCard>
      )}

      {/* ── Funds List ─────────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={sectionHeader}>Your Funds</p>

        {funds.length === 0 && !showAddForm && (
          <EmptyState
            illustration="budget"
            title="No funds yet"
            subtitle="Pick a preset below or add your own — saving a little now avoids a big hit later."
            actionLabel="+ Add fund"
            onAction={() => openAddForm()}
          />
        )}

        <AnimatePresence mode="popLayout">
          {funds.map(fund => (
            <motion.div
              key={fund.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={springs.gentle}
            >
              {editingId === fund.id ? (
                <FundForm
                  form={form}
                  setForm={setForm}
                  errors={formErrors}
                  onSave={handleSave}
                  onCancel={cancelForm}
                  saving={saving}
                  isEdit
                  now={now}
                />
              ) : (
                <FundRow
                  fund={fund}
                  now={now}
                  onEdit={() => openEditForm(fund)}
                  onDelete={() => handleDelete(fund.id)}
                />
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
              <FundForm
                form={form}
                setForm={setForm}
                errors={formErrors}
                onSave={handleSave}
                onCancel={cancelForm}
                saving={saving}
                now={now}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Add Button ───────────────────────────────────────────────────── */}
        {!showAddForm && !editingId && (
          <motion.button
            onClick={() => openAddForm()}
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
            aria-label="Add a new sinking fund"
          >
            + Add fund
          </motion.button>
        )}
      </GlassCard>

      {/* ── Presets ─────────────────────────────────────────────────────────── */}
      {!showAddForm && !editingId && (
        <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
          <p style={sectionHeader}>Quick Start</p>
          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14 }}>
            Common funds for students — tap to pre-fill.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SINKING_FUND_PRESETS.map(preset => (
              <motion.button
                key={preset.label}
                onClick={() => openAddForm(preset)}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  fontFamily: FONT_FAMILY,
                  textAlign: "left",
                }}
                aria-label={`Add ${preset.label} sinking fund`}
              >
                <span style={{ fontSize: 14, color: "var(--text)" }}>
                  {preset.emoji} {preset.label}
                </span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  ~${preset.suggestedTarget}
                </span>
              </motion.button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* ── Financial Aid / Disbursement ───────────────────────────────────── */}
      {(onSetDisbursement || onAddDisbursement) && (
        <DisbursementSection
          onSetDisbursement={onSetDisbursement ?? (() => {})}
          disbursements={disbursements}
          onAddDisbursement={onAddDisbursement}
          onRemoveDisbursement={onRemoveDisbursement}
        />
      )}
    </div>
  )
}

// ============================================================================
// DisbursementSection — collapsible lump-sum income boost
// ============================================================================

interface DisbursementSectionProps {
  onSetDisbursement: (monthlyAmount: number) => void
  disbursements?: Disbursement[]
  onAddDisbursement?: (data: Omit<Disbursement, 'id'>) => void
  onRemoveDisbursement?: (id: string) => void
}

function DisbursementSection({ onSetDisbursement, disbursements = [], onAddDisbursement, onRemoveDisbursement }: DisbursementSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [lumpSum, setLumpSum] = useState(0)
  const [months, setMonths] = useState(4)
  const [label, setLabel] = useState('')
  const [disbursementType, setDisbursementType] = useState<'financial_aid' | 'scholarship' | 'refund' | 'other'>('financial_aid')

  const now = new Date()
  const monthlyShare = computeDisbursementMonthlyShare(lumpSum, months)
  const activeDisbursements = disbursements.filter(d => isDisbursementActive(d, now))

  function handleSave() {
    if (onAddDisbursement && lumpSum > 0) {
      onAddDisbursement({
        label: label.trim() || 'Financial Aid',
        amount: lumpSum,
        coverMonths: months,
        startDate: new Date().toISOString().slice(0, 10),
        type: disbursementType,
        emoji: disbursementType === 'scholarship' ? '🏅' : disbursementType === 'refund' ? '🧾' : '🎓',
      })
      // Reset form
      setLumpSum(0)
      setLabel('')
      setMonths(4)
      setDisbursementType('financial_aid')
    } else {
      // Fallback to legacy behavior
      onSetDisbursement(monthlyShare)
    }
    setExpanded(false)
  }

  return (
    <GlassCard elevation="low" style={{ padding: "18px 20px", marginTop: 20 }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setExpanded(prev => !prev)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label="Toggle Financial Aid section"
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setExpanded(prev => !prev) }}
      >
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: 0 }}>
            🎓 Financial Aid / Lump-Sum Income
          </p>
          <p style={{ fontSize: 12, color: "var(--sub)", margin: "4px 0 0" }}>
            Spread a lump-sum across months to boost your daily budget
          </p>
        </div>
        <span style={{ fontSize: 16, color: "var(--sub)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
          ▾
        </span>
      </div>

      {/* ── Active Disbursements List ───────────────────────────────── */}
      {activeDisbursements.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {activeDisbursements.map(d => {
            const remaining = getRemainingMonths(d, now)
            const monthly = computeDisbursementMonthlyShare(d.amount, d.coverMonths)
            return (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 18 }}>{d.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", margin: 0 }}>
                    {d.label}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--muted)", margin: "2px 0 0" }}>
                    +${monthly.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo · {remaining}mo left
                  </p>
                </div>
                {onRemoveDisbursement && (
                  <motion.button
                    onClick={() => onRemoveDisbursement(d.id)}
                    whileTap={{ scale: 0.9 }}
                    transition={springs.snappy}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "4px 8px",
                      cursor: "pointer",
                      fontSize: 14,
                      color: "var(--error)",
                    }}
                    aria-label={`Remove ${d.label}`}
                  >
                    ✕
                  </motion.button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={springs.gentle}
            style={{ overflow: "hidden", marginTop: 16 }}
          >
            {/* Label input */}
            <div style={{ marginBottom: 12 }}>
              <p style={labelStyle}>Label (optional)</p>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Fall 2024 Aid Refund"
                style={inputStyle}
                aria-label="Aid label"
              />
            </div>

            {/* Lump-sum input */}
            <div style={{ marginBottom: 12 }}>
              <p style={labelStyle}>Lump-sum amount ($)</p>
              <input
                type="number"
                value={lumpSum || ""}
                onChange={e => setLumpSum(Number(e.target.value) || 0)}
                placeholder="e.g. 5000"
                min={0}
                step={1}
                style={inputStyle}
                aria-label="Lump-sum amount"
              />
            </div>

            {/* Type selector */}
            <div style={{ marginBottom: 12 }}>
              <p style={labelStyle}>Type</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {([
                  { value: 'financial_aid', label: '🎓 Aid', key: 'financial_aid' },
                  { value: 'scholarship', label: '🏅 Scholarship', key: 'scholarship' },
                  { value: 'refund', label: '🧾 Refund', key: 'refund' },
                  { value: 'other', label: '💼 Other', key: 'other' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDisbursementType(opt.value)}
                    aria-pressed={disbursementType === opt.value}
                    style={{
                      padding: "6px 12px",
                      borderRadius: borderRadius.full,
                      border: disbursementType === opt.value
                        ? "1.5px solid var(--accent)"
                        : "1px solid var(--border)",
                      background: disbursementType === opt.value
                        ? "rgba(129, 140, 248, 0.1)"
                        : "var(--fill-04)",
                      color: disbursementType === opt.value ? "var(--accent)" : "var(--sub)",
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: FONT_FAMILY,
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Term selector */}
            <div style={{ marginBottom: 14 }}>
              <p style={labelStyle}>Spread across how many months?</p>
              <select
                value={months}
                onChange={e => setMonths(Number(e.target.value))}
                style={{
                  ...inputStyle,
                  appearance: "none",
                  WebkitAppearance: "none",
                  paddingRight: 32,
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                }}
                aria-label="Number of months to spread this income over"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>
                    {n} month{n !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Computed monthly display */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                marginBottom: 14,
              }}
            >
              <p style={{ fontSize: 13, color: "var(--sub)", margin: 0 }}>Monthly boost</p>
              <p style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
                +${monthlyShare.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
              </p>
            </div>

            {/* Save button */}
            <motion.button
              onClick={handleSave}
              whileTap={{ scale: 0.97 }}
              transition={springs.snappy}
              disabled={lumpSum <= 0}
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: FONT_FAMILY,
                color: "var(--text)",
                background: lumpSum <= 0 ? "rgba(255,255,255,0.06)" : "var(--success)",
                border: "none",
                borderRadius: borderRadius.full,
                cursor: lumpSum <= 0 ? "not-allowed" : "pointer",
                opacity: lumpSum <= 0 ? 0.5 : 1,
              }}
              aria-label="Add aid to daily budget"
            >
              {onAddDisbursement ? 'Add aid income' : 'Apply to daily budget'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  )
}

// ============================================================================
// FundRow — display row for a saved fund
// ============================================================================

interface FundRowProps {
  fund: SinkingFund
  now: Date
  onEdit: () => void
  onDelete: () => void
}

function FundRow({ fund, now, onEdit, onDelete }: FundRowProps) {
  const progress = getFundProgress(fund)
  const funded = isFunded(fund)
  const remaining = getRemainingAmount(fund)
  const reserve = computeMonthlyReserve(fund.targetAmount, fund.savedAmount, fund.dueDate, now)

  return (
    <div
      style={{
        ...listRow,
        padding: "12px 0",
        borderBottom: "1px solid var(--border)",
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>{emojiForCategory(fund.category)}</span>
        <div
          style={{ flex: 1, cursor: "pointer" }}
          onClick={onEdit}
          role="button"
          tabIndex={0}
          aria-label={`Edit ${fund.label}`}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onEdit() }}
        >
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", margin: 0 }}>
            {fund.label}
            {funded && <span style={{ marginLeft: 6, fontSize: 12 }}>🎉</span>}
          </p>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
            {funded
              ? "Fully funded"
              : `$${remaining.toLocaleString("en-US")} left · $${reserve}/mo`}
            {fund.dueDate && !funded && ` · due ${fund.dueDate}`}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0, fontVariantNumeric: "tabular-nums" }}>
            ${fund.savedAmount.toLocaleString("en-US")}
          </p>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
            / ${fund.targetAmount.toLocaleString("en-US")}
          </p>
        </div>
        <motion.button
          onClick={onDelete}
          whileTap={{ scale: 0.9 }}
          transition={springs.snappy}
          style={{
            background: "none",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: 16,
            color: "var(--error)",
            marginLeft: 4,
          }}
          aria-label={`Delete ${fund.label}`}
        >
          ✕
        </motion.button>
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginTop: 8,
          height: 4,
          borderRadius: borderRadius.full,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
        aria-label={`${Math.round(progress * 100)}% funded`}
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.round(progress * 100)}%`,
            borderRadius: borderRadius.full,
            background: funded ? "var(--success)" : "var(--accent)",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  )
}

// ============================================================================
// FundForm sub-component
// ============================================================================

interface FundFormProps {
  form: FundFormData
  setForm: React.Dispatch<React.SetStateAction<FundFormData>>
  errors: string[]
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isEdit?: boolean
  now: Date
}

function FundForm({ form, setForm, errors, onSave, onCancel, saving, isEdit, now }: FundFormProps) {
  const autoReserve = computeMonthlyReserve(form.targetAmount, form.savedAmount, form.dueDate, now)
  const effectiveReserve = form.autoReserve ? autoReserve : form.monthlyReserve
  const canSave = form.label.trim() && form.targetAmount > 0

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
        <p style={labelStyle}>What are you saving for?</p>
        <input
          type="text"
          value={form.label}
          onChange={e => setForm(prev => ({ ...prev, label: e.target.value }))}
          placeholder="e.g. Fall textbooks, Flight home"
          style={inputStyle}
          autoFocus
          aria-label="Fund label"
        />
      </div>

      {/* Target Amount */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>Target amount ($)</p>
        <input
          type="number"
          value={form.targetAmount || ""}
          onChange={e => setForm(prev => ({ ...prev, targetAmount: Number(e.target.value) || 0 }))}
          placeholder="0"
          min={0}
          step={1}
          style={inputStyle}
          aria-label="Target amount"
        />
      </div>

      {/* Already saved */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>Already saved ($)</p>
        <input
          type="number"
          value={form.savedAmount || ""}
          onChange={e => setForm(prev => ({ ...prev, savedAmount: Number(e.target.value) || 0 }))}
          placeholder="0"
          min={0}
          step={1}
          style={inputStyle}
          aria-label="Already saved amount"
        />
      </div>

      {/* Due date */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>When do you need it? (optional)</p>
        <input
          type="date"
          value={form.dueDate}
          onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
          style={inputStyle}
          aria-label="Due date"
        />
      </div>

      {/* Monthly reserve */}
      <div style={{ marginBottom: 14 }}>
        <p style={labelStyle}>Monthly reserve</p>
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            marginBottom: 8,
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>
            ${effectiveReserve.toLocaleString("en-US")}/mo
            {form.autoReserve && (
              <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>
                auto-computed
              </span>
            )}
          </p>
        </div>
        {!form.autoReserve && (
          <input
            type="number"
            value={form.monthlyReserve || ""}
            onChange={e => setForm(prev => ({ ...prev, monthlyReserve: Number(e.target.value) || 0 }))}
            placeholder="0"
            min={0}
            step={1}
            style={{ ...inputStyle, marginBottom: 6 }}
            aria-label="Monthly reserve amount"
          />
        )}
        <button
          onClick={() => setForm(prev => ({ ...prev, autoReserve: !prev.autoReserve, monthlyReserve: autoReserve }))}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 12,
            color: "var(--sub)",
            cursor: "pointer",
            fontFamily: FONT_FAMILY,
            textDecoration: "underline",
          }}
          aria-label={form.autoReserve ? "Set custom monthly reserve" : "Use auto-computed reserve"}
        >
          {form.autoReserve ? "Set custom amount" : "Use auto-computed"}
        </button>
      </div>

      {/* Category */}
      <div style={{ marginBottom: 14 }}>
        <p style={labelStyle}>Category</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FUND_CATEGORIES.map(cat => {
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
                  background: isActive ? "rgba(6, 214, 160, 0.1)" : "var(--fill-04)",
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

      {/* Validation errors */}
      {errors.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {errors.map((err, i) => (
            <p key={i} style={{ fontSize: 12, color: "var(--error)", margin: "2px 0", fontFamily: FONT_FAMILY }}>
              {err}
            </p>
          ))}
        </div>
      )}

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
          disabled={saving || !canSave}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: FONT_FAMILY,
            color: "var(--text)",
            background: saving || !canSave ? "rgba(255,255,255,0.06)" : "var(--success)",
            border: "none",
            borderRadius: borderRadius.full,
            cursor: saving || !canSave ? "not-allowed" : "pointer",
            opacity: saving || !canSave ? 0.5 : 1,
          }}
          aria-label={isEdit ? "Save changes" : "Add fund"}
        >
          {saving ? "Saving…" : isEdit ? "Save" : "Add fund"}
        </motion.button>
      </div>
    </div>
  )
}
