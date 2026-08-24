"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  segmentedControl,
  segmentedButtonBase,
  segmentedButtonActive,
  segmentedButtonInactive,
  fills,
  colorRamp,
} from "@/styles/shared"
import { radius } from "@/styles/surfaces"
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
  const { prefersReducedMotion } = useReducedMotion()
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
          marginBottom: HORIZONTAL_PADDING,
          gap: spacing.sm,
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
              fontSize: typography.subhead.fontSize,
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
          <h1
            style={{
              fontSize: typography.headline.fontSize,
              fontWeight: fontWeights.bold,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Payment Methods
          </h1>
          <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", lineHeight: 1.4 }}>
            Manage how you pay for things
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openAddForm}
            aria-label="Add payment method"
            style={{
              background: fills[6],
              border: `1px solid ${fills[10]}`,
              borderRadius: radius.full,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: typography.subhead.fontSize,
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
        <Card style={{ padding: spacing.md, marginBottom: HORIZONTAL_PADDING }}>
          <p
            style={{
              fontSize: typography['body-sm'].fontSize,
              fontWeight: fontWeights.semibold,
              color: "var(--muted)",
              letterSpacing: "0.02em",
              marginBottom: 14,
            }}
          >
            {editingId ? "Edit source" : "Add new source"}
          </p>

          {/* Emoji picker */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginBottom: spacing.xs }}>
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
                    borderRadius: radius.control,
                    border:
                      form.emoji === emoji
                        ? "1.5px solid var(--success)"
                        : `1px solid ${fills[8]}`,
                    background:
                      form.emoji === emoji
                        ? "var(--success-100)"
                        : "transparent",
                    fontSize: typography.subhead.fontSize,
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
              style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", display: "block", marginBottom: 6 }}
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
                borderRadius: radius.control,
                border: `1px solid ${fills[10]}`,
                background: fills[4],
                color: "var(--text)",
                fontSize: typography.body.fontSize,
                fontFamily: FONT_FAMILY,
                outline: "none",
              }}
            />
          </div>

          {/* Kind selector */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginBottom: 6 }}>
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
          <div style={{ marginBottom: spacing.md }}>
            <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginBottom: 6 }}>
              Settlement
            </p>
            <div
              style={{
                display: "flex",
                gap: spacing.xs,
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
                  borderRadius: radius.control,
                  border: form.reducesBalanceNow
                    ? "1.5px solid var(--success)"
                    : `1px solid ${fills[8]}`,
                  background: form.reducesBalanceNow
                    ? "var(--success-100)"
                    : "transparent",
                  color: form.reducesBalanceNow ? "var(--success)" : "var(--muted)",
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.medium,
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
                  borderRadius: radius.control,
                  border: !form.reducesBalanceNow
                    ? "1.5px solid var(--warning)"
                    : `1px solid ${fills[8]}`,
                  background: !form.reducesBalanceNow
                    ? "var(--warning-100)"
                    : "transparent",
                  color: !form.reducesBalanceNow
                    ? "var(--warning)"
                    : "var(--muted)",
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.medium,
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
          <div style={{ display: "flex", gap: spacing.sm }}>
            <button
              onClick={handleCancel}
              aria-label="Cancel"
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: radius.control,
                border: `1px solid ${fills[10]}`,
                background: "transparent",
                color: "var(--sub)",
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.medium,
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
                borderRadius: radius.control,
                border: "none",
                background: form.label.trim()
                  ? "var(--success)"
                  : fills[6],
                color: form.label.trim() ? "var(--color-canvas)" : "var(--muted)",
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.semibold,
                fontFamily: FONT_FAMILY,
                cursor: form.label.trim() ? "pointer" : "not-allowed",
                opacity: form.label.trim() ? 1 : 0.5,
              }}
            >
              {editingId ? "Save" : "Add"}
            </button>
          </div>
        </Card>
      )}

      {/* ── Source Cards ──────────────────────────────────────────────── */}
      {fundingSources.length === 0 && !showForm ? (
        <EmptyState
          illustration="generic"
          title="No payment methods yet"
          subtitle="Add your cards, cash, and wallets to track where your money goes."
          actionLabel="+ Add a source"
          onAction={openAddForm}
          actionColor="success"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {fundingSources.map((source) => (
            <motion.div
              key={source.id}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              transition={springs.snappy}
            >
              <Card style={{ padding: "14px 16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  {/* Emoji */}
                  <span
                    style={{ fontSize: typography.headline.fontSize, lineHeight: 1, flexShrink: 0 }}
                    aria-hidden="true"
                  >
                    {source.emoji}
                  </span>

                  {/* Label + badges */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: typography.body.fontSize,
                        fontWeight: fontWeights.semibold,
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
                          fontSize: typography.caption.fontSize,
                          fontWeight: fontWeights.medium,
                          padding: "2px 8px",
                          borderRadius: radius.full,
                          background: fills[6],
                          border: `1px solid ${fills[8]}`,
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
                          fontSize: typography.caption.fontSize,
                          fontWeight: fontWeights.medium,
                          padding: "2px 8px",
                          borderRadius: radius.full,
                          background: source.reducesBalanceNow
                            ? "var(--success-100)"
                            : "var(--warning-100)",
                          color: source.reducesBalanceNow
                            ? "var(--success)"
                            : "var(--warning)",
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
                        borderRadius: radius.control,
                        border: "none",
                        background: "transparent",
                        color: "var(--sub)",
                        fontSize: typography.body.fontSize,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span aria-hidden="true">✏️</span>
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
                        borderRadius: radius.control,
                        border: "none",
                        background:
                          confirmDeleteId === source.id
                            ? "var(--error-200)"
                            : "transparent",
                        color:
                          confirmDeleteId === source.id
                            ? "var(--error)"
                            : "var(--sub)",
                        fontSize: typography.body.fontSize,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span aria-hidden="true">🗑️</span>
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
