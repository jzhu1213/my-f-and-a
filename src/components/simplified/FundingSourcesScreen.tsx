"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { Card } from "@/components/ui/Card"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  glassSurface,
  segmentedControl,
  segmentedButtonBase,
  segmentedButtonActive,
  segmentedButtonInactive,
} from "@/styles/shared"
import type { FundingSource, FundingSourceKind } from "@/lib/fundingSources"

// ============================================================================
// Types
// ============================================================================

export interface FundingSourcesScreenProps {
  fundingSources: FundingSource[]
  onAdd: (source: Omit<FundingSource, "id" | "userId" | "createdAt">) => void
  onEdit: (id: string, updates: Partial<FundingSource>) => void
  onRemove: (id: string) => void
  onBack?: () => void
}

interface FormState {
  emoji: string
  label: string
  kind: FundingSourceKind
  reducesBalanceNow: boolean
}

// ============================================================================
// Constants
// ============================================================================

const PAYMENT_EMOJIS = ["💳", "💵", "💎", "📱", "🍎", "🏦", "👛", "💰", "🪙", "🤝", "🎓"]

const KIND_OPTIONS: { value: FundingSourceKind; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "debit", label: "Debit" },
  { value: "credit", label: "Credit" },
  { value: "external_wallet", label: "Wallet" },
  { value: "borrowed", label: "Borrowed" },
]

const KIND_DISPLAY: Record<FundingSourceKind, string> = {
  cash: "Cash",
  debit: "Debit",
  credit: "Credit",
  external_wallet: "Wallet",
  borrowed: "Borrowed",
}

const DEFAULT_FORM: FormState = {
  emoji: "💳",
  label: "",
  kind: "debit",
  reducesBalanceNow: true,
}

// ============================================================================
// FundingSourcesScreen Component
// ============================================================================

/**
 * FundingSourcesScreen — Manage payment methods / funding sources.
 *
 * Allows users to add, edit, and remove funding sources. Each source is
 * displayed as a Card with emoji, label, kind badge, and settlement
 * indicator. Reachable from Settings → Tools area (progressive disclosure).
 *
 * Requirements: 8.1, 8.4
 */
export function FundingSourcesScreen({
  fundingSources,
  onAdd,
  onEdit,
  onRemove,
  onBack,
}: FundingSourcesScreenProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // ── Form handlers ──────────────────────────────────────────────────────

  function openAddForm() {
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setShowForm(true)
  }

  function openEditForm(source: FundingSource) {
    setEditingId(source.id)
    setForm({
      emoji: source.emoji,
      label: source.label,
      kind: source.kind,
      reducesBalanceNow: source.reducesBalanceNow,
    })
    setShowForm(true)
  }

  function handleSave() {
    if (!form.label.trim()) return

    if (editingId) {
      onEdit(editingId, {
        emoji: form.emoji,
        label: form.label.trim(),
        kind: form.kind,
        reducesBalanceNow: form.reducesBalanceNow,
      })
    } else {
      onAdd({
        emoji: form.emoji,
        label: form.label.trim(),
        kind: form.kind,
        reducesBalanceNow: form.reducesBalanceNow,
      })
    }

    setShowForm(false)
    setEditingId(null)
    setForm(DEFAULT_FORM)
  }

  function handleCancel() {
    setShowForm(false)
    setEditingId(null)
    setForm(DEFAULT_FORM)
  }

  function handleDelete(id: string) {
    if (confirmDeleteId === id) {
      onRemove(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM - 20}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 20,
          gap: 12,
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Go back"
            style={{
              background: "none",
              border: "none",
              padding: 4,
              fontSize: 18,
              color: "var(--sub)",
              cursor: "pointer",
              fontFamily: FONT_FAMILY,
              lineHeight: 1,
            }}
          >
            ←
          </button>
        )}
        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Payment Methods
          </h2>
          <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.4 }}>
            Manage how you pay for things
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openAddForm}
            aria-label="Add payment method"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 9999,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              color: "var(--text)",
              cursor: "pointer",
              fontFamily: FONT_FAMILY,
            }}
          >
            +
          </button>
        )}
      </div>

      {/* ── Add/Edit Form ────────────────────────────────────────────── */}
      {showForm && (
        <div style={{ ...glassSurface, padding: 16, marginBottom: 20 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted)",
              letterSpacing: "0.02em",
              marginBottom: 14,
            }}
          >
            {editingId ? "Edit source" : "Add new source"}
          </p>

          {/* Emoji picker */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 8 }}>
              Icon
            </p>
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
              role="radiogroup"
              aria-label="Choose an emoji icon"
            >
              {PAYMENT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setForm((f) => ({ ...f, emoji }))}
                  aria-label={`Select ${emoji} icon`}
                  aria-checked={form.emoji === emoji}
                  role="radio"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border:
                      form.emoji === emoji
                        ? "1.5px solid var(--success)"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                    background:
                      form.emoji === emoji
                        ? "rgba(6, 214, 160, 0.1)"
                        : "transparent",
                    fontSize: 18,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Label input */}
          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="funding-source-label"
              style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 6 }}
            >
              Label
            </label>
            <input
              id="funding-source-label"
              type="text"
              placeholder="e.g. Chase Debit"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(255, 255, 255, 0.04)",
                color: "var(--text)",
                fontSize: 14,
                fontFamily: FONT_FAMILY,
                outline: "none",
              }}
            />
          </div>

          {/* Kind selector */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 6 }}>
              Type
            </p>
            <div style={segmentedControl} role="radiogroup" aria-label="Source type">
              {KIND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setForm((f) => ({ ...f, kind: opt.value }))}
                  role="radio"
                  aria-checked={form.kind === opt.value}
                  aria-label={opt.label}
                  style={{
                    ...segmentedButtonBase,
                    ...(form.kind === opt.value
                      ? segmentedButtonActive
                      : segmentedButtonInactive),
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Settlement toggle */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 6 }}>
              Settlement
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
              }}
              role="radiogroup"
              aria-label="Settlement timing"
            >
              <button
                onClick={() => setForm((f) => ({ ...f, reducesBalanceNow: true }))}
                role="radio"
                aria-checked={form.reducesBalanceNow}
                aria-label="Immediate settlement"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: form.reducesBalanceNow
                    ? "1.5px solid var(--success)"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  background: form.reducesBalanceNow
                    ? "rgba(6, 214, 160, 0.08)"
                    : "transparent",
                  color: form.reducesBalanceNow ? "var(--success)" : "var(--muted)",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                ⚡ Immediate
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, reducesBalanceNow: false }))}
                role="radio"
                aria-checked={!form.reducesBalanceNow}
                aria-label="Deferred settlement"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: !form.reducesBalanceNow
                    ? "1.5px solid var(--warning, #f59e0b)"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  background: !form.reducesBalanceNow
                    ? "rgba(245, 158, 11, 0.08)"
                    : "transparent",
                  color: !form.reducesBalanceNow
                    ? "var(--warning, #f59e0b)"
                    : "var(--muted)",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                🕐 Deferred
              </button>
            </div>
          </div>

          {/* Save / Cancel */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleCancel}
              aria-label="Cancel"
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "transparent",
                color: "var(--sub)",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: FONT_FAMILY,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.label.trim()}
              aria-label={editingId ? "Save changes" : "Add source"}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                border: "none",
                background: form.label.trim()
                  ? "var(--success)"
                  : "rgba(255, 255, 255, 0.06)",
                color: form.label.trim() ? "#000" : "var(--muted)",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: FONT_FAMILY,
                cursor: form.label.trim() ? "pointer" : "not-allowed",
                opacity: form.label.trim() ? 1 : 0.5,
              }}
            >
              {editingId ? "Save" : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* ── Source Cards ──────────────────────────────────────────────── */}
      {fundingSources.length === 0 && !showForm ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "48px 20px",
          }}
        >
          <span style={{ fontSize: 36 }} aria-hidden="true">
            💳
          </span>
          <p
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "var(--text)",
              textAlign: "center",
              fontFamily: FONT_FAMILY,
            }}
          >
            No payment methods yet
          </p>
          <p
            style={{
              fontSize: 13,
              color: "var(--sub)",
              textAlign: "center",
              fontFamily: FONT_FAMILY,
              maxWidth: 260,
              lineHeight: 1.5,
            }}
          >
            Add your cards, cash, and wallets to track where your money goes.
          </p>
          <button
            onClick={openAddForm}
            aria-label="Add your first payment method"
            style={{
              marginTop: 8,
              padding: "10px 20px",
              borderRadius: 9999,
              border: "1.5px solid rgba(6, 214, 160, 0.4)",
              background: "transparent",
              color: "var(--success)",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: FONT_FAMILY,
              cursor: "pointer",
            }}
          >
            + Add a source
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {fundingSources.map((source) => (
            <motion.div
              key={source.id}
              whileTap={{ scale: 0.98 }}
              transition={springs.snappy}
            >
              <Card style={{ padding: "14px 16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {/* Emoji */}
                  <span
                    style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}
                    aria-hidden="true"
                  >
                    {source.emoji}
                  </span>

                  {/* Label + badges */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--text)",
                        marginBottom: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {source.label}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      {/* Kind badge */}
                      <span
                        aria-label={`Type: ${KIND_DISPLAY[source.kind]}`}
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background: "rgba(255, 255, 255, 0.06)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          color: "var(--sub)",
                          fontFamily: FONT_FAMILY,
                        }}
                      >
                        {KIND_DISPLAY[source.kind]}
                      </span>

                      {/* Settlement indicator */}
                      <span
                        aria-label={
                          source.reducesBalanceNow
                            ? "Immediate settlement"
                            : "Deferred settlement"
                        }
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background: source.reducesBalanceNow
                            ? "rgba(6, 214, 160, 0.1)"
                            : "rgba(245, 158, 11, 0.1)",
                          color: source.reducesBalanceNow
                            ? "var(--success)"
                            : "var(--warning, #f59e0b)",
                          fontFamily: FONT_FAMILY,
                        }}
                      >
                        {source.reducesBalanceNow ? "Immediate" : "Deferred"}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <button
                      onClick={() => openEditForm(source)}
                      aria-label={`Edit ${source.label}`}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: "none",
                        background: "transparent",
                        color: "var(--sub)",
                        fontSize: 14,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(source.id)}
                      aria-label={
                        confirmDeleteId === source.id
                          ? `Confirm delete ${source.label}`
                          : `Delete ${source.label}`
                      }
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: "none",
                        background:
                          confirmDeleteId === source.id
                            ? "rgba(239, 68, 68, 0.15)"
                            : "transparent",
                        color:
                          confirmDeleteId === source.id
                            ? "var(--error)"
                            : "var(--sub)",
                        fontSize: 14,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
