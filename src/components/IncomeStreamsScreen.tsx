"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import type { IncomeStream, IncomeStreamType } from "@/types/folio"
import type { PayCadence } from "@/lib/paySchedule"
import { computeMonthlyIncomeFromStreams, getActiveStreams } from "@/lib/incomeStreams"
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

export interface IncomeStreamsScreenProps {
  streams: IncomeStream[]
  onAdd: (data: Omit<IncomeStream, "id">) => void
  onUpdate: (id: string, updates: Partial<IncomeStream>) => void
  onRemove: (id: string) => void
  onClose: () => void
}

// ============================================================================
// Constants
// ============================================================================

const STREAM_TYPES: { type: IncomeStreamType; label: string; emoji: string }[] = [
  { type: "job", label: "Job", emoji: "💼" },
  { type: "gig", label: "Gig / Freelance", emoji: "⚡" },
  { type: "aid", label: "Financial Aid", emoji: "🎓" },
  { type: "parental", label: "Family Support", emoji: "💜" },
  { type: "other", label: "Other", emoji: "💰" },
]

const CADENCE_OPTIONS: { cadence: PayCadence; label: string }[] = [
  { cadence: "weekly", label: "Weekly" },
  { cadence: "biweekly", label: "Every 2 weeks" },
  { cadence: "semimonthly", label: "Twice a month" },
  { cadence: "monthly", label: "Monthly" },
  { cadence: "irregular", label: "Irregular" },
]

function cadenceLabel(cadence: PayCadence): string {
  return CADENCE_OPTIONS.find(c => c.cadence === cadence)?.label ?? cadence
}

function streamTypeEmoji(type: IncomeStreamType): string {
  return STREAM_TYPES.find(t => t.type === type)?.emoji ?? "💰"
}

// ============================================================================
// Form state
// ============================================================================

interface StreamFormData {
  name: string
  type: IncomeStreamType
  amount: string
  cadence: PayCadence
  anchorDate: string
  emoji: string
  note: string
}

const DEFAULT_FORM: StreamFormData = {
  name: "",
  type: "job",
  amount: "",
  cadence: "biweekly",
  anchorDate: new Date().toISOString().slice(0, 10),
  emoji: "💼",
  note: "",
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
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--sub)",
  marginBottom: 4,
  fontFamily: FONT_FAMILY,
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  WebkitAppearance: "none",
  cursor: "pointer",
}

// ============================================================================
// IncomeStreamsScreen Component
// ============================================================================

/**
 * IncomeStreamsScreen — manage multiple named income streams.
 * Reached from Settings. Uses GlassCard + Inter + warm palette.
 *
 * Each stream has a name, type, amount, cadence, and anchor date.
 * The combined monthly income total is shown at the top.
 * Active streams feed the daily allowance as a single pool.
 *
 * Validates: Requirements new (Task 176.1)
 */
export function IncomeStreamsScreen({
  streams,
  onAdd,
  onUpdate,
  onRemove,
  onClose,
}: IncomeStreamsScreenProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<StreamFormData>(DEFAULT_FORM)

  const combinedMonthly = computeMonthlyIncomeFromStreams(streams, new Date())
  const activeCount = getActiveStreams(streams).length

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openAddForm() {
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setShowAddForm(true)
  }

  function openEditForm(stream: IncomeStream) {
    setShowAddForm(false)
    setEditingId(stream.id)
    setForm({
      name: stream.name,
      type: stream.type,
      amount: String(stream.amount),
      cadence: stream.cadence,
      anchorDate: stream.anchorDate,
      emoji: stream.emoji ?? streamTypeEmoji(stream.type),
      note: stream.note ?? "",
    })
  }

  function cancelForm() {
    setEditingId(null)
    setShowAddForm(false)
    setForm(DEFAULT_FORM)
  }

  function handleSave() {
    const amount = parseFloat(form.amount)
    if (!form.name.trim() || isNaN(amount) || amount <= 0) return

    if (editingId) {
      onUpdate(editingId, {
        name: form.name.trim(),
        type: form.type,
        amount,
        cadence: form.cadence,
        anchorDate: form.anchorDate,
        emoji: form.emoji || undefined,
        note: form.note.trim() || undefined,
      })
    } else {
      onAdd({
        name: form.name.trim(),
        type: form.type,
        amount,
        cadence: form.cadence,
        anchorDate: form.anchorDate,
        isActive: true,
        emoji: form.emoji || undefined,
        note: form.note.trim() || undefined,
      })
    }
    cancelForm()
  }

  function handleDelete(id: string) {
    onRemove(id)
    if (editingId === id) cancelForm()
  }

  function handleToggleActive(stream: IncomeStream) {
    onUpdate(stream.id, { isActive: !stream.isActive })
  }

  function handleTypeChange(type: IncomeStreamType) {
    const emoji = streamTypeEmoji(type)
    setForm(prev => ({ ...prev, type, emoji }))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const isFormOpen = showAddForm || editingId !== null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={springs.gentle}
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--sub)",
            fontSize: 14,
            fontFamily: FONT_FAMILY,
            cursor: "pointer",
            padding: "4px 0",
          }}
          aria-label="Go back"
        >
          ← Back
        </button>
      </div>

      <h2 style={{ ...sectionHeader, marginBottom: 4 }}>Income Sources</h2>
      <p style={{ fontSize: 13, color: "var(--sub)", fontFamily: FONT_FAMILY, marginBottom: 20, lineHeight: 1.4 }}>
        Your income sources — the app combines them into your daily number.
      </p>

      {/* Combined monthly total */}
      <GlassCard style={{ marginBottom: 16, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--sub)", fontFamily: FONT_FAMILY }}>
            Combined monthly income
          </span>
          <span style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", fontFamily: FONT_FAMILY, fontVariantNumeric: "tabular-nums" }}>
            ${Math.round(combinedMonthly).toLocaleString()}
          </span>
        </div>
        {activeCount > 0 && (
          <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 4, fontFamily: FONT_FAMILY }}>
            {activeCount} active source{activeCount !== 1 ? "s" : ""}
          </div>
        )}
      </GlassCard>

      {/* Stream list */}
      <AnimatePresence mode="popLayout">
        {streams.map(stream => (
          <motion.div
            key={stream.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={springs.gentle}
            style={{ marginBottom: 8 }}
          >
            <GlassCard style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Emoji + Name */}
                <span style={{ fontSize: 20 }}>{stream.emoji ?? streamTypeEmoji(stream.type)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: stream.isActive ? "var(--text)" : "var(--sub)",
                    fontFamily: FONT_FAMILY,
                    opacity: stream.isActive ? 1 : 0.6,
                  }}>
                    {stream.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--sub)", fontFamily: FONT_FAMILY }}>
                    ${stream.amount.toLocaleString()} · {cadenceLabel(stream.cadence)}
                  </div>
                </div>

                {/* Active toggle */}
                <button
                  onClick={() => handleToggleActive(stream)}
                  style={{
                    background: stream.isActive ? "var(--accent)" : "rgba(255,255,255,0.1)",
                    border: "none",
                    borderRadius: 12,
                    width: 40,
                    height: 24,
                    position: "relative",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  aria-label={`${stream.isActive ? "Deactivate" : "Activate"} ${stream.name}`}
                >
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    background: "#fff",
                    position: "absolute",
                    top: 3,
                    left: stream.isActive ? 19 : 3,
                    transition: "left 0.2s",
                  }} />
                </button>

                {/* Edit button */}
                <button
                  onClick={() => openEditForm(stream)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--sub)",
                    fontSize: 12,
                    fontFamily: FONT_FAMILY,
                    cursor: "pointer",
                    padding: "4px 8px",
                  }}
                  aria-label={`Edit ${stream.name}`}
                >
                  Edit
                </button>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add button */}
      {!isFormOpen && (
        <button
          onClick={openAddForm}
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: 14,
            fontFamily: FONT_FAMILY,
            color: "var(--accent)",
            background: "rgba(129, 140, 248, 0.08)",
            border: "1px dashed var(--accent)",
            borderRadius: 12,
            cursor: "pointer",
            marginTop: 8,
          }}
        >
          + Add income source
        </button>
      )}

      {/* Add/Edit Form */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={springs.gentle}
            style={{ overflow: "hidden", marginTop: 12 }}
          >
            <GlassCard style={{ padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", fontFamily: FONT_FAMILY, marginBottom: 12 }}>
                {editingId ? "Edit income source" : "New income source"}
              </h3>

              {/* Name */}
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  placeholder="e.g. Campus Job"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              {/* Type */}
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Type</label>
                <select
                  value={form.type}
                  onChange={e => handleTypeChange(e.target.value as IncomeStreamType)}
                  style={selectStyle}
                >
                  {STREAM_TYPES.map(t => (
                    <option key={t.type} value={t.type}>{t.emoji} {t.label}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Amount per pay period ($)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.amount}
                  onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  style={inputStyle}
                  min={0}
                  step="0.01"
                />
              </div>

              {/* Cadence */}
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>How often</label>
                <select
                  value={form.cadence}
                  onChange={e => setForm(prev => ({ ...prev, cadence: e.target.value as PayCadence }))}
                  style={selectStyle}
                >
                  {CADENCE_OPTIONS.map(c => (
                    <option key={c.cadence} value={c.cadence}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Anchor date */}
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>A known pay date</label>
                <input
                  type="date"
                  value={form.anchorDate}
                  onChange={e => setForm(prev => ({ ...prev, anchorDate: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              {/* Note (optional) */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Note (optional)</label>
                <input
                  type="text"
                  placeholder="Any extra details"
                  value={form.note}
                  onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={!form.name.trim() || !form.amount || parseFloat(form.amount) <= 0}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    fontSize: 14,
                    fontFamily: FONT_FAMILY,
                    fontWeight: 600,
                    color: "#fff",
                    background: "var(--accent)",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                    opacity: (!form.name.trim() || !form.amount || parseFloat(form.amount) <= 0) ? 0.5 : 1,
                  }}
                >
                  {editingId ? "Save" : "Add"}
                </button>
                {editingId && (
                  <button
                    onClick={() => handleDelete(editingId)}
                    style={{
                      padding: "10px 16px",
                      fontSize: 14,
                      fontFamily: FONT_FAMILY,
                      color: "var(--caution)",
                      background: "rgba(248, 113, 113, 0.08)",
                      border: "1px solid rgba(248, 113, 113, 0.3)",
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={cancelForm}
                  style={{
                    padding: "10px 16px",
                    fontSize: 14,
                    fontFamily: FONT_FAMILY,
                    color: "var(--sub)",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {streams.length === 0 && !isFormOpen && (
        <div style={{
          textAlign: "center",
          padding: "32px 16px",
          color: "var(--sub)",
          fontSize: 13,
          fontFamily: FONT_FAMILY,
          lineHeight: 1.5,
        }}>
          No income sources yet. Add one to help the app estimate your daily spending room.
        </div>
      )}
    </motion.div>
  )
}
