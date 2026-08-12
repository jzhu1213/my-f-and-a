"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { Card } from "@/components/ui/Card"
import { Icon } from "@/components/ui/Icon"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
  borderRadius,
  linkButton,
} from "@/styles/shared"
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
    "🍕", "🏠", "🚲", "📚", "🎶", "💪", "🔄", "📦",
    "☕", "🎮", "🛒", "✈️", "💊", "🎬", "🐕", "🌿",
    "💈", "🎁", "🏋️", "🧹", "🔧", "📱", "👕", "🍳",
    "🚗", "🎓", "💡", "🏥", "🎵", "🛍️", "🏖️", "🧑‍💻",
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
        background: "rgba(14, 14, 26, 0.7)",
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
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12, fontFamily: FONT_FAMILY }}>
          Pick an emoji
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
          {commonEmojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => { onSelect(emoji); onClose() }}
              style={{
                background: emoji === currentEmoji ? "rgba(255,255,255,0.1)" : "transparent",
                border: emoji === currentEmoji ? "1px solid var(--border)" : "1px solid transparent",
                borderRadius: 8,
                padding: 6,
                fontSize: 20,
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
 * CategoryHubScreen — full-screen overlay for managing all categories
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
  const [newEmoji, setNewEmoji] = useState("📦")

  // Rebuild when custom categories change externally
  const itemIds = useMemo(() => items.map(i => i.id).join(","), [items])

  // ── Handlers ──────────────────────────────────────────────────────

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
      setNewEmoji("📦")
      setShowAddForm(false)
    }
  }

  async function handleDeleteCustom(id: string) {
    const success = await onRemoveCustomCategory(id)
    if (success) {
      const next = items.filter(i => i.id !== id)
      next.forEach((item, i) => { item.order = i })
      setItems(next)
      saveListToPrefs(next)
    }
  }

  // ── Render ────────────────────────────────────────────────────────

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
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <motion.button
          onClick={onClose}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          style={{
            background: "none",
            border: "none",
            fontSize: 20,
            color: "var(--text)",
            cursor: "pointer",
            padding: "4px 8px",
            marginRight: 12,
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
            flex: 1,
          }}
        >
          Manage Categories
        </h2>
        <motion.button
          onClick={() => setShowAddForm(true)}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: borderRadius.full,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text)",
            cursor: "pointer",
            fontFamily: FONT_FAMILY,
          }}
          aria-label="Add new category"
        >
          + Add
        </motion.button>
      </div>

      <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 20, lineHeight: 1.5 }}>
        Reorder, rename, change emojis, or archive categories. Archived categories still appear in your history.
      </p>

      {/* ── Add Form ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.snappy}
            style={{ overflow: "hidden", marginBottom: 16 }}
          >
            <Card style={{ padding: "16px 18px" }}>
              <p style={{ ...sectionHeader, marginBottom: 12 }}>New Category</p>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                <button
                  onClick={() => setEmojiPickerTarget("__new__")}
                  style={{
                    fontSize: 24,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
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
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 14,
                    color: "var(--text)",
                    fontFamily: FONT_FAMILY,
                    outline: "none",
                  }}
                  aria-label="New category name"
                  onKeyDown={e => { if (e.key === "Enter") handleAddCategory() }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <motion.button
                  onClick={handleAddCategory}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  disabled={!newLabel.trim()}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 8,
                    border: "none",
                    background: newLabel.trim() ? "var(--accent)" : "rgba(255,255,255,0.04)",
                    color: newLabel.trim() ? "var(--text)" : "var(--muted)",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: FONT_FAMILY,
                    cursor: newLabel.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Add Category
                </motion.button>
                <motion.button
                  onClick={() => { setShowAddForm(false); setNewLabel(""); setNewEmoji("📦") }}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--sub)",
                    fontSize: 13,
                    fontWeight: 500,
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

      {/* ── Active Categories ─────────────────────────────────── */}
      <p style={{ ...sectionHeader, marginBottom: 12 }}>
        Active ({activeItems.length})
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {activeItems.map((item, idx) => {
          const globalIdx = items.indexOf(item)
          return (
            <motion.div
              key={item.id}
              layout
              transition={springs.snappy}
            >
              <Card style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Emoji (clickable to change) */}
                  <button
                    onClick={() => setEmojiPickerTarget(item.id)}
                    style={{
                      fontSize: 20,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      borderRadius: 6,
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
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          padding: "6px 8px",
                          fontSize: 14,
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
                          fontSize: 14,
                          fontWeight: 500,
                          color: "var(--text)",
                          cursor: "pointer",
                          fontFamily: FONT_FAMILY,
                          textAlign: "left",
                        }}
                        aria-label={`Rename ${item.label}`}
                      >
                        {item.label}
                        {item.isCustom && (
                          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>custom</span>
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
                        fontSize: 14,
                        color: globalIdx === 0 ? "var(--muted)" : "var(--sub)",
                        cursor: globalIdx === 0 ? "default" : "pointer",
                        padding: "4px 6px",
                        opacity: globalIdx === 0 ? 0.3 : 1,
                      }}
                      aria-label={`Move ${item.label} up`}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveDown(globalIdx)}
                      disabled={globalIdx === items.length - 1}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: 14,
                        color: globalIdx === items.length - 1 ? "var(--muted)" : "var(--sub)",
                        cursor: globalIdx === items.length - 1 ? "default" : "pointer",
                        padding: "4px 6px",
                        opacity: globalIdx === items.length - 1 ? 0.3 : 1,
                      }}
                      aria-label={`Move ${item.label} down`}
                    >
                      ▼
                    </button>
                  </div>

                  {/* Archive button */}
                  <motion.button
                    onClick={() => handleToggleArchive(item.id)}
                    whileTap={{ scale: 0.9 }}
                    transition={springs.snappy}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: 14,
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
                      whileTap={{ scale: 0.9 }}
                      transition={springs.snappy}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: 14,
                        color: "rgba(248, 113, 113, 0.8)",
                        cursor: "pointer",
                        padding: "4px 6px",
                      }}
                      aria-label={`Delete ${item.label}`}
                      title="Delete"
                    >
                      ✕
                    </motion.button>
                  )}
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* ── Archived Categories ───────────────────────────────── */}
      {archivedItems.length > 0 && (
        <>
          <p style={{ ...sectionHeader, marginBottom: 12 }}>
            Archived ({archivedItems.length})
          </p>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.4 }}>
            These won&apos;t appear in the quick-log grid but your history stays intact.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {archivedItems.map(item => (
              <motion.div key={item.id} layout transition={springs.snappy}>
                <Card style={{ padding: "12px 14px", opacity: 0.7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }} aria-hidden="true">{item.emoji}</span>
                    <span style={{ flex: 1, fontSize: 14, color: "var(--sub)", fontFamily: FONT_FAMILY }}>
                      {item.label}
                      {item.isCustom && (
                        <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>custom</span>
                      )}
                    </span>
                    <motion.button
                      onClick={() => handleToggleArchive(item.id)}
                      whileTap={{ scale: 0.9 }}
                      transition={springs.snappy}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: 13,
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

      {/* ── Emoji Picker Overlay ──────────────────────────────── */}
      <AnimatePresence>
        {emojiPickerTarget && (
          <EmojiPicker
            currentEmoji={
              emojiPickerTarget === "__new__"
                ? newEmoji
                : (items.find(i => i.id === emojiPickerTarget)?.emoji ?? "📦")
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
