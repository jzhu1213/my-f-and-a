"use client"

import { useState, useCallback, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  borderRadius,
} from "@/styles/shared"

// ============================================================================
// Types
// ============================================================================

/**
 * Constraint for items managed by the list screen. Each item must have a
 * string `id` so the scaffold can track editing state and keys.
 */
export interface ManagedItem {
  id: string
}

/**
 * Context passed to render-prop callbacks so the consumer can wire up
 * interactions without managing CRUD state directly.
 */
export interface ItemRenderContext<T extends ManagedItem> {
  /** The item to render. */
  item: T
  /** Whether this item is currently being edited inline. */
  isEditing: boolean
  /** Open the inline edit form for this item. */
  startEdit: () => void
  /** Request deletion of this item (triggers 2-step confirmation). */
  requestDelete: () => void
  /** Whether this item is in the "confirm delete?" state. */
  isConfirmingDelete: boolean
  /** Confirm the pending deletion (second tap). */
  confirmDelete: () => void
  /** Cancel the pending deletion. */
  cancelDelete: () => void
}

/**
 * Props for the ManagedListScreen scaffold.
 *
 * Generic over `T` — any type with an `id: string` field.
 */
export interface ManagedListScreenProps<T extends ManagedItem> {
  // ── Data ─────────────────────────────────────────────────────────────────
  /** The list of items to display. */
  items: T[]

  // ── Labels ───────────────────────────────────────────────────────────────
  /** Screen title displayed in the header (e.g. "Recurring Bills"). */
  title: string
  /** Label for the add button (e.g. "+ Add bill"). */
  addLabel: string
  /** Empty state emoji displayed when items list is empty. */
  emptyEmoji?: string
  /** Empty state title text. */
  emptyTitle?: string
  /** Empty state subtitle / description. */
  emptySubtitle?: string

  // ── Callbacks ────────────────────────────────────────────────────────────
  /** Navigate back / close the screen. */
  onBack: () => void
  /** Delete an item by id. */
  onDelete: (id: string) => Promise<void> | void

  // ── Render props ─────────────────────────────────────────────────────────
  /**
   * Render a single list row. Receives the item + context with edit/delete
   * actions. The consumer is responsible for its own inline display layout.
   */
  renderItem: (context: ItemRenderContext<T>) => ReactNode
  /**
   * Render the add/edit form. Receives:
   * - `item`: the item being edited (null when adding a new item)
   * - `onDone`: call after a successful save to close the form
   * - `onCancel`: close the form without saving
   */
  renderForm: (props: {
    item: T | null
    onDone: () => void
    onCancel: () => void
  }) => ReactNode
  /**
   * Optional summary section rendered between the header and the list.
   * Receives the full items array for computing aggregates.
   */
  renderSummary?: (items: T[]) => ReactNode

  // ── Layout options ───────────────────────────────────────────────────────
  /**
   * Whether to wrap the list in a single GlassCard container (inline style)
   * or render each item as a separate card.
   * @default "single-card"
   */
  listLayout?: "single-card" | "separate-cards"
}

// ============================================================================
// ManagedListScreen Component
// ============================================================================

/**
 * ManagedListScreen — a reusable scaffold for CRUD list screens.
 *
 * Provides:
 * - Standard page layout (max-width, padding, header with back button)
 * - CRUD state management (editingId, showAddForm, confirmDeleteId)
 * - 2-step delete confirmation pattern
 * - Animated list (framer-motion AnimatePresence + layout)
 * - Empty state with warm messaging
 * - Dashed add button
 * - Summary slot (optional)
 * - Render-prop based for full flexibility on item/form rendering
 *
 * Validates: Requirements 141.1
 */
export function ManagedListScreen<T extends ManagedItem>({
  items,
  title,
  addLabel,
  emptyEmoji: _emptyEmoji = "📋",
  emptyTitle = "Nothing here yet",
  emptySubtitle = "Add your first item to get started.",
  onBack,
  onDelete,
  renderItem,
  renderForm,
  renderSummary,
  listLayout = "single-card",
}: ManagedListScreenProps<T>) {
  const { prefersReducedMotion } = useReducedMotion()
  // ── State ──────────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openAddForm = useCallback(() => {
    setEditingId(null)
    setConfirmDeleteId(null)
    setShowAddForm(true)
  }, [])

  const startEdit = useCallback((id: string) => {
    setShowAddForm(false)
    setConfirmDeleteId(null)
    setEditingId(id)
  }, [])

  const closeForm = useCallback(() => {
    setEditingId(null)
    setShowAddForm(false)
  }, [])

  const requestDelete = useCallback((id: string) => {
    setConfirmDeleteId(id)
  }, [])

  const cancelDelete = useCallback(() => {
    setConfirmDeleteId(null)
  }, [])

  const confirmDeletion = useCallback(
    async (id: string) => {
      await onDelete(id)
      setConfirmDeleteId(null)
      if (editingId === id) {
        setEditingId(null)
      }
    },
    [onDelete, editingId]
  )

  // ── Build item context ─────────────────────────────────────────────────────
  function buildContext(item: T): ItemRenderContext<T> {
    return {
      item,
      isEditing: editingId === item.id,
      startEdit: () => startEdit(item.id),
      requestDelete: () => requestDelete(item.id),
      isConfirmingDelete: confirmDeleteId === item.id,
      confirmDelete: () => confirmDeletion(item.id),
      cancelDelete,
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const isFormVisible = showAddForm || editingId !== null
  const showAddButton = !showAddForm && editingId === null

  const listContent = (
    <>
      <AnimatePresence mode="popLayout">
        {items.map(item => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={springs.gentle}
          >
            {editingId === item.id
              ? renderForm({
                  item,
                  onDone: closeForm,
                  onCancel: closeForm,
                })
              : renderItem(buildContext(item))}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ── Inline Add Form ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={springs.gentle}
            style={{ overflow: "hidden", marginTop: 12 }}
          >
            {renderForm({
              item: null,
              onDone: closeForm,
              onCancel: closeForm,
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Button ─────────────────────────────────────────────────── */}
      {showAddButton && (
        <motion.button
          onClick={openAddForm}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
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
          aria-label={addLabel}
        >
          {addLabel}
        </motion.button>
      )}
    </>
  )

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
          onClick={onBack}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
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
          {title}
        </h2>
      </div>

      {/* ── Summary (optional) ─────────────────────────────────────────────── */}
      {renderSummary && renderSummary(items)}

      {/* ── List or Empty State ────────────────────────────────────────────── */}
      {items.length === 0 && !isFormVisible ? (
        <div style={{ padding: "4px 0" }}>
          <EmptyState
            illustration="generic"
            title={emptyTitle}
            subtitle={emptySubtitle}
            actionLabel={addLabel}
            onAction={openAddForm}
            actionColor="success"
          />
        </div>
      ) : listLayout === "single-card" ? (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          {listContent}
        </GlassCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {listContent}
        </div>
      )}
    </div>
  )
}
