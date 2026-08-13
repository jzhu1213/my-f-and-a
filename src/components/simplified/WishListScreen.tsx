"use client"

/**
 * WishListScreen — Track things you want and see when you can afford them.
 *
 * Features:
 * - List of wish items with name, amount, projection, and progress ring
 * - Add/edit/delete items
 * - Reorder by priority (need > want > dream)
 * - Warm empty state with encouraging CTA
 * - Completion celebration via celebrationEngine
 *
 * Requirements: 19.1
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useReducedMotion } from "@/lib/animations"
import { SectionHeader, ListRow, Card } from "@/components/ui"
import { Icon } from "@/components/ui/Icon"
import { contentColumn, spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, colorRamp, surfaceColors } from "@/styles/colors"
import { radius } from "@/styles/surfaces"
import { safeAreaBottom } from "@/styles/layout"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import {
  getWishItems,
  createWishItem,
  updateWishItem,
  deleteWishItem,
  markWishItemComplete,
  computeWishProjection,
  type WishItem,
  type WishPriority,
} from "@/lib/wishList"
import { createWishCompleteCelebration } from "@/lib/celebrationEngine"
import type { Transaction, Budget } from "@/types"
import type { CelebrationEvent } from "@/types/folio"

// ============================================================================
// Types
// ============================================================================

export interface WishListScreenProps {
  onBack: () => void
  transactions?: Transaction[]
  budgets?: Budget[]
  /** Called when a celebration event should be shown */
  onCelebration?: (event: CelebrationEvent) => void
}

interface WishFormData {
  name: string
  amount: string
  priority: WishPriority
}

// ============================================================================
// Constants
// ============================================================================

const PRIORITY_ORDER: Record<WishPriority, number> = { need: 0, want: 1, dream: 2 }
const PRIORITY_LABELS: Record<WishPriority, string> = { need: "Need", want: "Want", dream: "Dream" }
const PRIORITY_COLORS: Record<WishPriority, string> = {
  need: colorRamp.accent[400],
  want: colorRamp.success[400],
  dream: colorRamp.warning[400],
}

// ============================================================================
// Progress Ring (small inline SVG)
// ============================================================================

function ProgressRing({ progress, size = 28 }: { progress: number; size?: number }) {
  const strokeWidth = 3
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)))

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={colorRamp.accent[400]}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.3s ease" }}
      />
    </svg>
  )
}

// ============================================================================
// WishListScreen Component
// ============================================================================

export function WishListScreen({
  onBack,
  transactions = [],
  budgets = [],
  onCelebration,
}: WishListScreenProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { prefersReducedMotion } = useReducedMotion()

  const [items, setItems] = useState<WishItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<WishItem | null>(null)
  const [formData, setFormData] = useState<WishFormData>({ name: "", amount: "", priority: "want" })

  // ── Load items ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setIsLoading(true)
    getWishItems(user.id).then((data) => {
      if (!cancelled) {
        setItems(data.filter((i) => !i.isComplete))
        setIsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [user?.id])

  // ── Sorted items (need first, then want, then dream) ──────────────────────
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  }, [items])

  // ── Projections ────────────────────────────────────────────────────────────
  const projections = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeWishProjection>> = {}
    for (const item of sortedItems) {
      map[item.id] = computeWishProjection(item, transactions, budgets)
    }
    return map
  }, [sortedItems, transactions, budgets])

  // ── Form handlers ──────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setFormData({ name: "", amount: "", priority: "want" })
    setShowForm(false)
    setEditingItem(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!user?.id) return
    const name = formData.name.trim()
    const amount = parseFloat(formData.amount)
    if (!name || isNaN(amount) || amount <= 0) {
      showToast("Enter a name and amount", "error")
      return
    }

    if (editingItem) {
      const updated = await updateWishItem(user.id, editingItem.id, {
        name,
        amount,
        priority: formData.priority,
      })
      if (updated) {
        setItems((prev) => prev.map((i) => (i.id === editingItem.id ? updated : i)))
        showToast("Wish updated", "success")
      }
    } else {
      const newItem = await createWishItem(user.id, { name, amount, priority: formData.priority })
      if (newItem) {
        setItems((prev) => [newItem, ...prev])
        showToast("Wish added ✨", "success")
      }
    }
    resetForm()
  }, [user?.id, formData, editingItem, showToast, resetForm])

  const handleEdit = useCallback((item: WishItem) => {
    setEditingItem(item)
    setFormData({ name: item.name, amount: String(item.amount), priority: item.priority })
    setShowForm(true)
  }, [])

  const handleDelete = useCallback(async (item: WishItem) => {
    if (!user?.id) return
    await deleteWishItem(user.id, item.id)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    showToast("Wish removed", "info")
  }, [user?.id, showToast])

  const handleMarkComplete = useCallback(async (item: WishItem) => {
    if (!user?.id) return
    await markWishItemComplete(user.id, item.id)
    setItems((prev) => prev.filter((i) => i.id !== item.id))

    // Trigger celebration
    const event = createWishCompleteCelebration(item.id, item.name)
    if (event && onCelebration) {
      onCelebration(event)
    }
    showToast(`Enjoy your ${item.name}! 🎉`, "success")
  }, [user?.id, onCelebration, showToast])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        ...contentColumn,
        paddingTop: spacingScale["24"],
        paddingBottom: safeAreaBottom(100),
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: spacingScale["12"], marginBottom: spacingScale["8"] }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{
            background: "none",
            border: "none",
            color: textColors.text,
            cursor: "pointer",
            display: "inline-flex",
            padding: spacingScale["4"],
          }}
        >
          <Icon name="action:forward" size={20} style={{ transform: "rotate(180deg)" }} />
        </button>
        <SectionHeader>Wish List</SectionHeader>
      </div>
      <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["24"] }}>
        Track what you're saving toward.
      </p>

      {/* Add button */}
      <button
        type="button"
        onClick={() => { resetForm(); setShowForm(true) }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacingScale["8"],
          background: colorRamp.accent[500],
          color: "#fff",
          border: "none",
          borderRadius: radius.control,
          padding: `${spacingScale["8"]} ${spacingScale["16"]}`,
          cursor: "pointer",
          ...typography.body,
          marginBottom: spacingScale["24"],
        }}
      >
        <Icon name="action:add" size={16} />
        Add a wish
      </button>

      {/* Form (inline) */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            style={{
              background: surfaceColors.raised,
              borderRadius: radius.card,
              padding: spacingScale["16"],
              marginBottom: spacingScale["24"],
              display: "flex",
              flexDirection: "column",
              gap: spacingScale["12"],
            }}
          >
            <input
              type="text"
              placeholder="What are you saving for?"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              maxLength={60}
              style={{
                ...typography.body,
                background: surfaceColors.canvas,
                color: textColors.text,
                border: `1px solid var(--border-subtle)`,
                borderRadius: radius.control,
                padding: `${spacingScale["8"]} ${spacingScale["12"]}`,
                outline: "none",
                width: "100%",
              }}
              autoFocus
            />
            <input
              type="number"
              placeholder="Amount ($)"
              value={formData.amount}
              onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
              min={0}
              step={0.01}
              style={{
                ...typography.body,
                background: surfaceColors.canvas,
                color: textColors.text,
                border: `1px solid var(--border-subtle)`,
                borderRadius: radius.control,
                padding: `${spacingScale["8"]} ${spacingScale["12"]}`,
                outline: "none",
                width: "100%",
              }}
            />
            {/* Priority selector */}
            <div style={{ display: "flex", gap: spacingScale["8"] }}>
              {(["need", "want", "dream"] as WishPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFormData((f) => ({ ...f, priority: p }))}
                  style={{
                    ...typography.caption,
                    flex: 1,
                    padding: `${spacingScale["6"]} ${spacingScale["8"]}`,
                    borderRadius: radius.control,
                    border: `1px solid ${formData.priority === p ? PRIORITY_COLORS[p] : 'var(--border-subtle)'}`,
                    background: formData.priority === p ? `${PRIORITY_COLORS[p]}22` : "transparent",
                    color: formData.priority === p ? PRIORITY_COLORS[p] : textColors.sub,
                    cursor: "pointer",
                  }}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
            {/* Actions */}
            <div style={{ display: "flex", gap: spacingScale["8"], justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={resetForm}
                style={{
                  ...typography.body,
                  background: "none",
                  border: `1px solid var(--border-subtle)`,
                  borderRadius: radius.control,
                  padding: `${spacingScale["8"]} ${spacingScale["16"]}`,
                  color: textColors.sub,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  ...typography.body,
                  background: colorRamp.accent[500],
                  border: "none",
                  borderRadius: radius.control,
                  padding: `${spacingScale["8"]} ${spacingScale["16"]}`,
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {editingItem ? "Save" : "Add"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!isLoading && sortedItems.length === 0 && !showForm && (
        <div
          style={{
            textAlign: "center",
            padding: `${spacingScale["48"]} ${spacingScale["24"]}`,
          }}
        >
          <p style={{ ...typography.subhead, color: textColors.text, marginBottom: spacingScale["8"] }}>
            What are you saving toward?
          </p>
          <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["24"] }}>
            Add something you want — Folio will show when you can afford it at your current pace.
          </p>
          <button
            type="button"
            onClick={() => { resetForm(); setShowForm(true) }}
            style={{
              ...typography.body,
              background: colorRamp.accent[500],
              color: "#fff",
              border: "none",
              borderRadius: radius.control,
              padding: `${spacingScale["8"]} ${spacingScale["24"]}`,
              cursor: "pointer",
            }}
          >
            Add your first wish ✨
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <p style={{ ...typography["body-sm"], color: textColors.muted, textAlign: "center", padding: spacingScale["24"] }}>
          Loading…
        </p>
      )}

      {/* Wish list items */}
      {!isLoading && sortedItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
          {sortedItems.map((item) => {
            const projection = projections[item.id]
            const progress = item.amount > 0 ? item.savedSoFar / item.amount : 0

            return (
              <Card key={item.id} style={{ padding: spacingScale["12"] }}>
                <div style={{ display: "flex", alignItems: "center", gap: spacingScale["12"] }}>
                  <ProgressRing progress={progress} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: spacingScale["8"] }}>
                      <p style={{ ...typography.body, color: textColors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.name}
                      </p>
                      <span
                        style={{
                          ...typography.caption,
                          color: PRIORITY_COLORS[item.priority],
                          flexShrink: 0,
                        }}
                      >
                        {PRIORITY_LABELS[item.priority]}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: spacingScale["8"], marginTop: spacingScale["2"] }}>
                      <span style={{ ...typography["body-sm"], color: textColors.sub, fontVariantNumeric: "tabular-nums" }}>
                        ${item.amount.toLocaleString("en-US")}
                      </span>
                      {projection && projection.hasEnoughData && projection.daysToAfford > 0 && projection.daysToAfford !== Infinity && (
                        <span style={{ ...typography.caption, color: textColors.muted }}>
                          ~{projection.daysToAfford <= 90 ? `${projection.daysToAfford} days` : `${Math.round(projection.daysToAfford / 30)} mo`}
                        </span>
                      )}
                      {projection && !projection.hasEnoughData && (
                        <span style={{ ...typography.caption, color: textColors.muted }}>
                          Log more to project
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display: "flex", gap: spacingScale["4"], flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleMarkComplete(item)}
                      aria-label={`Mark ${item.name} complete`}
                      title="Mark complete"
                      style={{
                        background: "none",
                        border: "none",
                        color: colorRamp.success[400],
                        cursor: "pointer",
                        padding: spacingScale["4"],
                        display: "inline-flex",
                      }}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      aria-label={`Edit ${item.name}`}
                      style={{
                        background: "none",
                        border: "none",
                        color: textColors.muted,
                        cursor: "pointer",
                        padding: spacingScale["4"],
                        display: "inline-flex",
                      }}
                    >
                      <Icon name="action:edit" size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      aria-label={`Delete ${item.name}`}
                      style={{
                        background: "none",
                        border: "none",
                        color: textColors.muted,
                        cursor: "pointer",
                        padding: spacingScale["4"],
                        display: "inline-flex",
                      }}
                    >
                      <Icon name="action:delete" size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
