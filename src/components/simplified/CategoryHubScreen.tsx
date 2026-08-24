"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { Card } from "@/components/ui/Card"
import { Icon } from "@/components/ui/Icon"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
  borderRadius,
  linkButton,
} from "@/styles/shared"
import { radius } from '@/styles/surfaces'
import { BUDGET_CATEGORIES } from "@/types"
import type { CustomCategory } from "@/types/folio"
import type { CategoryGridPreference } from "@/lib/categoryGridPreferences"
import {
  loadCategoryGridPrefs,
  saveCategoryGridPrefs,
} from "@/lib/categoryGridPreferences"

// ============================================================================
// Types
// ============================================================================

export interface CategoryHubScreenProps {
  customCategories: CustomCategory[]
  onAddCustomCategory: (label: string, emoji: string, icon?: string) => Promise<CustomCategory | null>
  onRemoveCustomCategory: (id: string) => Promise<boolean>
  onRenameCustomCategory: (id: string, updates: { label?: string; emoji?: string; icon?: string }) => Promise<CustomCategory | null>
  onClose: () => void
}

/** Unified category item for the hub list */
interface HubCategoryItem {
  id: string
  emoji: string
  label: string
  isCustom: boolean
  archived: boolean
  order: number
}

// ============================================================================
// Helpers
// ============================================================================

function buildUnifiedList(
  prefs: CategoryGridPreference[] | null,
  customCategories: CustomCategory[]
): HubCategoryItem[] {
  const items: HubCategoryItem[] = []

  // Built-in categories
  BUDGET_CATEGORIES.forEach((cat, idx) => {
    const pref = prefs?.find(p => p.categoryId === cat.category)
    items.push({
      id: cat.category,
      emoji: pref?.customEmoji ?? cat.emoji,
      label: pref?.customLabel ?? cat.label,
      isCustom: false,
      archived: pref?.archived ?? false,
      order: pref?.order ?? idx,
    })
  })

  // Custom categories
  customCategories.forEach((cat, idx) => {
    const pref = prefs?.find(p => p.categoryId === cat.id)
    items.push({
      id: cat.id,
      emoji: pref?.customEmoji ?? cat.emoji,
      label: pref?.customLabel ?? cat.label,
      isCustom: true,
      archived: pref?.archived ?? false,
      order: pref?.order ?? (BUDGET_CATEGORIES.length + idx),
    })
  })

  // Sort by order
  items.sort((a, b) => a.order - b.order)
  return items
}

function saveListToPrefs(items: HubCategoryItem[]): void {
  const prefs: CategoryGridPreference[] = items.map((item, idx) => {
    const defaultCat = BUDGET_CATEGORIES.find(c => c.category === item.id)
    const pref: CategoryGridPreference = {
      categoryId: item.id,
      order: idx,
      archived: item.archived || undefined,
    }
    // Only save overrides for built-in categories
    if (defaultCat) {
      if (item.label !== defaultCat.label) pref.customLabel = item.label
      if (item.emoji !== defaultCat.emoji) pref.customEmoji = item.emoji
    } else {
      // For custom categories, always save label/emoji in prefs if overridden
      // (The canonical label is in Supabase; prefs store display overrides)
      // We only store if there's a difference from the custom category itself
      // but since we don't have the original here, we store them
      pref.customLabel = item.label
      pref.customEmoji = item.emoji
    }
    return pref
  })
  saveCategoryGridPrefs(prefs)
}

// ============================================================================
// Sub-components
// ============================================================================

function EmojiPicker({
  currentEmoji,
  onSelect,
  onClose,
}: {
  currentEmoji: string
  onSelect: (emoji: string) => void
  onClose: () => void
}) {
  const commonEmojis = [
    "ðŸ•", "ðŸ ", "ðŸš²", "ðŸ“š", "ðŸŽ¶", "ðŸ’ª", "ðŸ”„", "ðŸ“¦",
    "â˜•", "ðŸŽ®", "ðŸ›’", "âœˆï¸", "ðŸ’Š", "ðŸŽ¬", "ðŸ•", "ðŸŒ¿",
    "ðŸ’ˆ", "ðŸŽ", "ðŸ‹ï¸", "ðŸ§¹", "ðŸ”§", "ðŸ“±", "ðŸ‘•", "ðŸ³",
    "ðŸš—", "ðŸŽ“", "ðŸ’¡", "ðŸ¥", "ðŸŽµ", "ðŸ›ï¸", "ðŸ–ï¸", "ðŸ§‘â€ðŸ’»",
  ]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={springs.snappy}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-canvas)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: borderRadius.lg,
          padding: 20,
          maxWidth: 320,
          width: "90%",
        }}
      >
        <p style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: "var(--text)", marginBottom: spacing.sm, fontFamily: FONT_FAMILY }}>
          Pick an emoji
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: spacing.xs }}>
          {commonEmojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => { onSelect(emoji); onClose() }}
              style={{
                background: emoji === currentEmoji ? "var(--fill-10)" : "transparent",
                border: emoji === currentEmoji ? "1px solid var(--border)" : "1px solid transparent",
                borderRadius: radius.control,
                padding: 6,
                fontSize: typography.subhead.fontSize,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label={`Select ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * CategoryHubScreen â€” full-screen overlay for managing all categories
 * (built-in + custom) in a single unified list.
 *
 * Supports: add, rename, re-emoji, reorder, and archive categories.
 * Archived categories keep transaction history intact.
 *
 * Task 138.1
 */
export function CategoryHubScreen({
  customCategories,
  onAddCustomCategory,
  onRemoveCustomCategory,
  onRenameCustomCategory,
  onClose,
}: CategoryHubScreenProps) {
  // Load initial state from localStorage prefs
  const [items, setItems] = useState<HubCategoryItem[]>(() =>
    buildUnifiedList(loadCategoryGridPrefs(), customCategories)
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newEmoji, setNewEmoji] = useState("ðŸ“¦")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Rebuild when custom categories change externally
  const itemIds = useMemo(() => items.map(i => i.id).join(","), [items])

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function handleMoveUp(index: number) {
    if (index <= 0) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(index - 1, 0, moved)
    // Recalculate orders
    next.forEach((item, i) => { item.order = i })
    setItems(next)
    saveListToPrefs(next)
  }

  function handleMoveDown(index: number) {
    if (index >= items.length - 1) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(index + 1, 0, moved)
    next.forEach((item, i) => { item.order = i })
    setItems(next)
    saveListToPrefs(next)
  }

  function handleToggleArchive(id: string) {
    const next = items.map(item =>
      item.id === id ? { ...item, archived: !item.archived } : item
    )
    setItems(next)
    saveListToPrefs(next)
  }

  function handleStartEdit(item: HubCategoryItem) {
    setEditingId(item.id)
    setEditLabel(item.label)
  }

  async function handleSaveEdit(id: string) {
    const trimmed = editLabel.trim()
    if (!trimmed) {
      setEditingId(null)
      return
    }

    const item = items.find(i => i.id === id)
    if (!item) { setEditingId(null); return }

    // Update in list
    const next = items.map(i =>
      i.id === id ? { ...i, label: trimmed } : i
    )
    setItems(next)
    saveListToPrefs(next)

    // For custom categories, also persist to Supabase
    if (item.isCustom) {
      await onRenameCustomCategory(id, { label: trimmed })
    }

    setEditingId(null)
  }

  async function handleEmojiChange(id: string, emoji: string) {
    const item = items.find(i => i.id === id)
    if (!item) return

    const next = items.map(i =>
      i.id === id ? { ...i, emoji } : i
    )
    setItems(next)
    saveListToPrefs(next)

    // For custom categories, also persist to Supabase
    if (item.isCustom) {
      await onRenameCustomCategory(id, { emoji })
    }
  }

  async function handleAddCategory() {
    const trimmed = newLabel.trim()
    if (!trimmed) return

    const result = await onAddCustomCategory(trimmed, newEmoji)
    if (result) {
      const next: HubCategoryItem[] = [
        ...items,
        {
          id: result.id,
          emoji: newEmoji,
          label: trimmed,
          isCustom: true,
          archived: false,
          order: items.length,
        },
      ]
      setItems(next)
      saveListToPrefs(next)
      setNewLabel("")
      setNewEmoji("ðŸ“¦")
      setShowAddForm(false)
    }
  }

  async function handleDeleteCustom(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      setTimeout(() => setConfirmDeleteId((prev) => prev === id ? null : prev), 4000)
      return
    }
    setConfirmDeleteId(null)
    const success = await onRemoveCustomCategory(id)
    if (success) {
      const next = items.filter(i => i.id !== id)
      next.forEach((item, i) => { item.order = i })
      setItems(next)
      saveListToPrefs(next)
    }
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const activeItems = items.filter(i => !i.archived)
  const archivedItems = items.filter(i => i.archived)

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: HORIZONTAL_PADDING }}>
        <motion.button
          onClick={onClose}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          style={{
            background: "none",
            border: "none",
            fontSize: typography.subhead.fontSize,
            color: "var(--text)",
            cursor: "pointer",
            padding: "4px 8px",
            marginRight: spacing.sm,
          }}
          aria-label="Go back"
        >
          â†
        </motion.button>
        <h1
          style={{
            fontSize: typography.headline.fontSize,
            fontWeight: fontWeights.bold,
            color: "var(--text)",
            flex: 1,
          }}
        >
          Manage Categories
        </h1>
        <motion.button
          onClick={() => setShowAddForm(true)}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          style={{
            background: "var(--fill-06)",
            border: "1px solid var(--fill-10)",
            borderRadius: borderRadius.full,
            padding: "8px 14px",
            fontSize: typography['body-sm'].fontSize,
            fontWeight: fontWeights.medium,
            color: "var(--text)",
            cursor: "pointer",
            fontFamily: FONT_FAMILY,
          }}
          aria-label="Add new category"
        >
          + Add
        </motion.button>
      </div>

      <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", marginBottom: HORIZONTAL_PADDING, lineHeight: 1.5 }}>
        Reorder, rename, change emojis, or archive categories. Archived categories still appear in your history.
      </p>

      {/* â”€â”€ Add Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.snappy}
            style={{ overflow: "hidden", marginBottom: spacing.md }}
          >
            <Card style={{ padding: "16px 18px" }}>
              <p style={{ ...sectionHeader, marginBottom: spacing.sm }}>New Category</p>
              <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", marginBottom: 12 }}>
                <button
                  onClick={() => setEmojiPickerTarget("__new__")}
                  style={{
                    fontSize: typography.headline.fontSize,
                    background: "var(--fill-04)",
                    border: "1px solid var(--border)",
                    borderRadius: radius.control,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                  aria-label={`Current emoji: ${newEmoji}. Click to change.`}
                >
                  {newEmoji}
                </button>
                <input
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="Category name"
                  maxLength={30}
                  style={{
                    flex: 1,
                    background: "var(--fill-04)",
                    border: "1px solid var(--border)",
                    borderRadius: radius.control,
                    padding: "10px 12px",
                    fontSize: typography.body.fontSize,
                    color: "var(--text)",
                    fontFamily: FONT_FAMILY,
                    outline: "none",
                  }}
                  aria-label="New category name"
                  onKeyDown={e => { if (e.key === "Enter") handleAddCategory() }}
                />
              </div>
              <div style={{ display: "flex", gap: spacing.xs }}>
                <motion.button
                  onClick={handleAddCategory}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  disabled={!newLabel.trim()}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: radius.control,
                    border: "none",
                    background: newLabel.trim() ? "var(--accent)" : "var(--fill-04)",
                    color: newLabel.trim() ? "var(--text)" : "var(--muted)",
                    fontSize: typography['body-sm'].fontSize,
                    fontWeight: fontWeights.semibold,
                    fontFamily: FONT_FAMILY,
                    cursor: newLabel.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Add Category
                </motion.button>
                <motion.button
                  onClick={() => { setShowAddForm(false); setNewLabel(""); setNewEmoji("ðŸ“¦") }}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={{
                    padding: "10px 16px",
                    borderRadius: radius.control,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--sub)",
                    fontSize: typography['body-sm'].fontSize,
                    fontWeight: fontWeights.medium,
                    fontFamily: FONT_FAMILY,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </motion.button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Active Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <p style={{ ...sectionHeader, marginBottom: spacing.sm }}>
        Active ({activeItems.length})
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, marginBottom: 24 }}>
        {activeItems.map((item, idx) => {
          const globalIdx = items.indexOf(item)
          return (
            <motion.div
              key={item.id}
              layout
              transition={springs.snappy}
            >
              <Card style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                  {/* Emoji (clickable to change) */}
                  <button
                    onClick={() => setEmojiPickerTarget(item.id)}
                    style={{
                      fontSize: typography.subhead.fontSize,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      borderRadius: radius.min,
                    }}
                    aria-label={`Change emoji for ${item.label}`}
                  >
                    {item.emoji}
                  </button>

                  {/* Label (editable or display) */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editingId === item.id ? (
                      <input
                        type="text"
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        onBlur={() => handleSaveEdit(item.id)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleSaveEdit(item.id)
                          if (e.key === "Escape") setEditingId(null)
                        }}
                        autoFocus
                        maxLength={30}
                        style={{
                          width: "100%",
                          background: "var(--fill-04)",
                          border: "1px solid var(--border)",
                          borderRadius: radius.min,
                          padding: "6px 8px",
                          fontSize: typography.body.fontSize,
                          color: "var(--text)",
                          fontFamily: FONT_FAMILY,
                          outline: "none",
                        }}
                        aria-label={`Edit name for ${item.label}`}
                      />
                    ) : (
                      <button
                        onClick={() => handleStartEdit(item)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          fontSize: typography.body.fontSize,
                          fontWeight: fontWeights.medium,
                          color: "var(--text)",
                          cursor: "pointer",
                          fontFamily: FONT_FAMILY,
                          textAlign: "left",
                        }}
                        aria-label={`Rename ${item.label}`}
                      >
                        {item.label}
                        {item.isCustom && (
                          <span style={{ fontSize: typography.caption.fontSize, color: "var(--muted)", marginLeft: 6 }}>custom</span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Reorder buttons */}
                  <div style={{ display: "flex", gap: 2 }}>
                    <button
                      onClick={() => handleMoveUp(globalIdx)}
                      disabled={globalIdx === 0}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: typography.body.fontSize,
                        color: globalIdx === 0 ? "var(--muted)" : "var(--sub)",
                        cursor: globalIdx === 0 ? "default" : "pointer",
                        padding: "4px 6px",
                        opacity: globalIdx === 0 ? 0.3 : 1,
                      }}
                      aria-label={`Move ${item.label} up`}
                    >
                      â–²
                    </button>
                    <button
                      onClick={() => handleMoveDown(globalIdx)}
                      disabled={globalIdx === items.length - 1}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: typography.body.fontSize,
                        color: globalIdx === items.length - 1 ? "var(--muted)" : "var(--sub)",
                        cursor: globalIdx === items.length - 1 ? "default" : "pointer",
                        padding: "4px 6px",
                        opacity: globalIdx === items.length - 1 ? 0.3 : 1,
                      }}
                      aria-label={`Move ${item.label} down`}
                    >
                      â–¼
                    </button>
                  </div>

                  {/* Archive button */}
                  <motion.button
                    onClick={() => handleToggleArchive(item.id)}
                    whileTap={{ scale: 0.95 }}
                    transition={springs.snappy}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: typography.body.fontSize,
                      color: "var(--sub)",
                      cursor: "pointer",
                      padding: "4px 6px",
                    }}
                    aria-label={`Archive ${item.label}`}
                    title="Archive"
                  >
                    <Icon name="category:other" size={16} />
                  </motion.button>

                  {/* Delete (only custom) */}
                  {item.isCustom && (
                    <motion.button
                      onClick={() => handleDeleteCustom(item.id)}
                      whileTap={{ scale: 0.95 }}
                      transition={springs.snappy}
                      style={{
                        background: confirmDeleteId === item.id ? "var(--error-200)" : "none",
                        border: "none",
                        fontSize: confirmDeleteId === item.id ? 11 : 14,
                        fontWeight: confirmDeleteId === item.id ? 600 : undefined,
                        color: "var(--error-500)",
                        cursor: "pointer",
                        padding: "4px 6px",
                        borderRadius: radius.min,
                      }}
                      aria-label={confirmDeleteId === item.id ? `Confirm delete ${item.label}` : `Delete ${item.label}`}
                      title={confirmDeleteId === item.id ? "Confirm delete" : "Delete"}
                    >
                      {confirmDeleteId === item.id ? "Sure?" : "âœ•"}
                    </motion.button>
                  )}
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* â”€â”€ Archived Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {archivedItems.length > 0 && (
        <>
          <p style={{ ...sectionHeader, marginBottom: spacing.sm }}>
            Archived ({archivedItems.length})
          </p>
          <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", marginBottom: spacing.sm, lineHeight: 1.4 }}>
            These won&apos;t appear in the quick-log grid but your history stays intact.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, marginBottom: 24 }}>
            {archivedItems.map(item => (
              <motion.div key={item.id} layout transition={springs.snappy}>
                <Card style={{ padding: "12px 14px", opacity: 0.7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                    <span style={{ fontSize: typography.subhead.fontSize }} aria-hidden="true">{item.emoji}</span>
                    <span style={{ flex: 1, fontSize: typography.body.fontSize, color: "var(--sub)", fontFamily: FONT_FAMILY }}>
                      {item.label}
                      {item.isCustom && (
                        <span style={{ fontSize: typography.caption.fontSize, color: "var(--muted)", marginLeft: 6 }}>custom</span>
                      )}
                    </span>
                    <motion.button
                      onClick={() => handleToggleArchive(item.id)}
                      whileTap={{ scale: 0.95 }}
                      transition={springs.snappy}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: typography['body-sm'].fontSize,
                        color: "var(--sub)",
                        cursor: "pointer",
                        padding: "4px 8px",
                        fontFamily: FONT_FAMILY,
                      }}
                      aria-label={`Unarchive ${item.label}`}
                    >
                      Restore
                    </motion.button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* â”€â”€ Emoji Picker Overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatePresence>
        {emojiPickerTarget && (
          <EmojiPicker
            currentEmoji={
              emojiPickerTarget === "__new__"
                ? newEmoji
                : (items.find(i => i.id === emojiPickerTarget)?.emoji ?? "ðŸ“¦")
            }
            onSelect={(emoji) => {
              if (emojiPickerTarget === "__new__") {
                setNewEmoji(emoji)
              } else {
                handleEmojiChange(emojiPickerTarget, emoji)
              }
            }}
            onClose={() => setEmojiPickerTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
