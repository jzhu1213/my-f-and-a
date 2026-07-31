"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence, PanInfo, Variants, Reorder } from "framer-motion"
import type { Transaction, Budget, TransactionCategory } from "@/types"
import { BUDGET_CATEGORIES } from "@/types"
import type { QuickTransaction, SmartSuggestion, CustomCategory } from "@/types/folio"
import { generateSmartSuggestions } from "@/lib/suggestionUtils"
import { useToast } from "@/contexts/ToastContext"
import { springs, timings, STAGGER_STEP, useReducedMotion } from "@/lib/animations"
import { getCategoryEmoji } from "@/lib/vocabulary"
import { FONT_FAMILY } from '@/styles/typography'
import { borderRadius } from '@/styles/shared'
import {
  loadCategoryGridPrefs,
  saveCategoryGridPrefs,
  mergePrefsWithDefaults,
  categoriesToPrefs,
} from "@/lib/categoryGridPreferences"

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum allowed transaction amount (Requirement 10.5) */
const MAX_AMOUNT = 99_999

/** Maximum note length in characters (Requirement 10.7) */
const MAX_NOTE_LENGTH = 60

/** Minimum swipe distance (px) to reveal custom amount input (Requirement 3.5) */
const SWIPE_THRESHOLD = 60

/** Spring for category icon bounce micro-interaction (task 3.5, task 9.4). */
const ICON_BOUNCE_SPRING = springs.snappy

/** How long (ms) a chip must be held before the pulse-ring haptic fires. */
const LONG_PRESS_MS = 350

/** How long (ms) the success ripple plays before the selection resets. */
const RIPPLE_MS = 550

// ── Validation & Sanitization ────────────────────────────────────────────────

/**
 * Validates that an amount is positive and within allowed range.
 * Requirement 10.5
 */
function validateAmount(amount: number): string | null {
  if (!isFinite(amount) || isNaN(amount)) return "Enter a valid amount"
  if (amount <= 0) return "Amount must be greater than $0"
  if (amount > MAX_AMOUNT) return `Amount cannot exceed $${MAX_AMOUNT.toLocaleString()}`
  return null
}

/**
 * Sanitizes a note: strips HTML tags and trims to max 60 characters.
 * Requirement 10.7
 */
function sanitizeNote(raw: string): string {
  // Strip HTML tags using a simple regex (no DOM manipulation needed for plain text input)
  const stripped = raw.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim()
  return stripped.slice(0, MAX_NOTE_LENGTH)
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface CategoryButtonProps {
  category: TransactionCategory
  emoji: string
  label: string
  isSelected: boolean
  onSelect: () => void
  reducedMotion: boolean
  tabIndex?: number
}

/**
 * Large tappable category button — minimum 48×80px for accessibility.
 *
 * Restyled as a rounded glass pill (task 9.4). On selection a shared-layout
 * highlight slides in behind the content as an expanding backdrop with a
 * subtle inner glow, and the whole card lifts slightly with a scale. On tap
 * the icon plays a spring bounce (stiffness 400 / damping 17).
 *
 * Requirement 3.1, 8.4, 13.5, 15.2
 */
function CategoryButton({
  category,
  emoji,
  label,
  isSelected,
  onSelect,
  reducedMotion,
  tabIndex,
}: CategoryButtonProps) {
  // Variant maps drive the tap gesture. Framer propagates the active gesture
  // variant ("tap") to any child that defines the same key, so the icon
  // bounces no matter where inside the card the press lands.
  const cardTapVariants: Variants = reducedMotion
    ? { tap: {} }
    : { tap: { scale: 0.94 } }

  const iconBounceVariants: Variants = reducedMotion
    ? { tap: {} }
    : { tap: { scale: 1.3 } }

  // Selection lift — the highlighted card floats upward slightly with scale.
  const selectionAnimate = reducedMotion
    ? {}
    : { y: isSelected ? -4 : 0, scale: isSelected ? 1.03 : 1 }

  return (
    <motion.button
      type="button"
      className={`cat-pill cat-pill--glass flex-1 min-w-0${isSelected ? " selected" : ""}`}
      style={{ minHeight: 80, minWidth: 48 }}
      onClick={onSelect}
      variants={cardTapVariants}
      initial={false}
      animate={selectionAnimate}
      whileTap="tap"
      transition={springs.snappy}
      aria-pressed={isSelected}
      aria-label={`${label} category${isSelected ? ", selected" : ""}`}
      tabIndex={tabIndex}
    >
      {/* Expanding backdrop — shared layout element animates between cards */}
      {isSelected && (
        reducedMotion ? (
          <span className="cat-pill-highlight" aria-hidden="true" />
        ) : (
          <motion.span
            layoutId="cat-pill-highlight"
            className="cat-pill-highlight"
            transition={springs.snappy}
            aria-hidden="true"
          />
        )
      )}

      <span
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <motion.span
          style={{ fontSize: 24, display: "inline-block" }}
          variants={iconBounceVariants}
          transition={ICON_BOUNCE_SPRING}
          aria-hidden="true"
        >
          {emoji}
        </motion.span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: isSelected ? "var(--text)" : "var(--sub)",
            letterSpacing: "0.03em",
          }}
        >
          {label}
        </span>
      </span>
    </motion.button>
  )
}

interface SuggestionChipProps {
  suggestion: SmartSuggestion
  onTap: () => void
  /** True while the success ripple should emanate from this chip. */
  rippleActive: boolean
  reducedMotion: boolean
}

/**
 * Chip showing a suggested amount with optional label.
 *
 * Restyled as a floating glass pill with a soft shadow (task 9.4). Tapping
 * immediately logs the expense and triggers a success ripple; pressing and
 * holding fires a haptic buzz and shows a breathing pulse ring.
 *
 * Requirements 3.3, 3.4, 8.4, 13.5
 */
function SuggestionChip({ suggestion, onTap, rippleActive, reducedMotion }: SuggestionChipProps) {
  const [isHolding, setIsHolding] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const amountStr =
    suggestion.amount % 1 === 0
      ? `$${suggestion.amount}`
      : `$${suggestion.amount.toFixed(2)}`

  function clearHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    if (isHolding) setIsHolding(false)
  }

  function handlePointerDown() {
    holdTimer.current = setTimeout(() => {
      setIsHolding(true)
      // Press-and-hold haptic pattern (no-op where unsupported).
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([10, 30, 10])
      }
    }, LONG_PRESS_MS)
  }

  // Clean up any pending timer on unmount.
  useEffect(() => clearHold, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.button
      type="button"
      className="amount-chip active chip--glass flex-shrink-0"
      style={{
        position: "relative",
        minHeight: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        padding: "10px 16px",
        borderRadius: borderRadius.full,
      }}
      onClick={onTap}
      onPointerDown={handlePointerDown}
      onPointerUp={clearHold}
      onPointerLeave={clearHold}
      onPointerCancel={clearHold}
      whileTap={reducedMotion ? undefined : { scale: 0.95 }}
      aria-label={
        suggestion.label
          ? `Log ${amountStr} for ${suggestion.label}`
          : `Log ${amountStr}`
      }
    >
      {/* Press-and-hold pulse ring */}
      {isHolding && !reducedMotion && (
        <span className="chip-pulse-ring" aria-hidden="true" />
      )}
      {/* Success ripple emanating from the tapped chip */}
      {rippleActive && !reducedMotion && (
        <span className="chip-ripple" aria-hidden="true" />
      )}

      <span style={{ position: "relative", zIndex: 3, fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
        {amountStr}
      </span>
      {suggestion.label && (
        <span
          style={{
            position: "relative",
            zIndex: 3,
            fontSize: 11,
            color: "var(--muted)",
            maxWidth: 80,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {suggestion.label}
        </span>
      )}
    </motion.button>
  )
}

// ── Edit Category Inline (Task 133.1) ────────────────────────────────────────

interface EditCategoryInlineProps {
  emoji: string
  label: string
  onSave: (emoji: string, label: string) => void
  onCancel: () => void
  reducedMotion: boolean
}

/**
 * Small inline form to rename a category's label and emoji.
 * Appears when tapping a category in customize/edit mode.
 */
function EditCategoryInline({ emoji, label, onSave, onCancel, reducedMotion }: EditCategoryInlineProps) {
  const [editEmoji, setEditEmoji] = useState(emoji)
  const [editLabel, setEditLabel] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedLabel = editLabel.trim()
    if (trimmedLabel.length === 0) return
    onSave(editEmoji.trim() || emoji, trimmedLabel)
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      transition={springs.snappy}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "10px 12px",
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: borderRadius.md,
      }}
      aria-label={`Edit ${label} category`}
    >
      <input
        type="text"
        value={editEmoji}
        onChange={(e) => setEditEmoji(e.target.value)}
        style={{
          width: 36,
          height: 36,
          fontSize: 20,
          textAlign: "center",
          background: "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: borderRadius.sm,
          color: "var(--text)",
          padding: 0,
        }}
        aria-label="Category emoji"
        maxLength={4}
      />
      <input
        ref={inputRef}
        type="text"
        value={editLabel}
        onChange={(e) => setEditLabel(e.target.value.slice(0, 20))}
        style={{
          flex: 1,
          height: 36,
          fontSize: 13,
          fontWeight: 500,
          background: "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: borderRadius.sm,
          color: "var(--text)",
          padding: "0 10px",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Category label"
        maxLength={20}
      />
      <button
        type="submit"
        style={{
          height: 36,
          padding: "0 12px",
          fontSize: 12,
          fontWeight: 500,
          background: "rgba(167, 139, 250, 0.2)",
          border: "1px solid rgba(167, 139, 250, 0.4)",
          borderRadius: borderRadius.sm,
          color: "var(--text)",
          cursor: "pointer",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Save category changes"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          height: 36,
          padding: "0 10px",
          fontSize: 12,
          fontWeight: 500,
          background: "none",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: borderRadius.sm,
          color: "var(--muted)",
          cursor: "pointer",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Cancel editing"
      >
        ✕
      </button>
    </motion.form>
  )
}

interface CustomAmountPanelProps {
  category: TransactionCategory
  onSubmit: (transaction: QuickTransaction) => void
  onCancel: () => void
  reducedMotion: boolean
}

/**
 * Swipe-revealed custom amount entry panel.
 * Validates amount and sanitizes note before submitting.
 * Requirements 3.5, 10.5, 10.7, 14.1
 */
function CustomAmountPanel({ category, onSubmit, onCancel, reducedMotion }: CustomAmountPanelProps) {
  const [rawAmount, setRawAmount] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRawAmount(e.target.value)
    setError(null)
  }

  function handleNoteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const sanitized = sanitizeNote(e.target.value)
    setNote(sanitized)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(rawAmount)
    const validationError = validateAmount(amount)
    if (validationError) {
      setError(validationError)
      inputRef.current?.focus()
      return
    }
    // Keep category selection intact on validation failure (Requirement 14.5)
    const sanitizedNote = note ? sanitizeNote(note) : undefined
    onSubmit({ category, amount, note: sanitizedNote })
  }

  const categoryInfo = BUDGET_CATEGORIES.find((c) => c.category === category)

  return (
    <motion.form
      layout={!reducedMotion}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      transition={springs.gentle}
      aria-label={`Custom amount for ${categoryInfo?.label ?? category}`}
    >
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 20 }} aria-hidden="true">
          {getCategoryEmoji(category)}
        </span>
        <span style={{ fontSize: 14, color: "var(--sub)", fontWeight: 500 }}>
          {categoryInfo?.label ?? category}
        </span>
      </div>

      {/* Amount field */}
      <div className="flex flex-col gap-1">
        <div
          className="flex items-center gap-2"
          style={{
            background: "var(--raised)",
            borderRadius: "var(--radius-sm)",
            padding: "0 12px",
            border: error ? "1px solid var(--error)" : "1px solid var(--border)",
          }}
        >
          <span style={{ color: "var(--sub)", fontSize: 18, fontWeight: 500 }}>$</span>
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max={MAX_AMOUNT}
            value={rawAmount}
            onChange={handleAmountChange}
            placeholder="0.00"
            className="t-input"
            style={{ border: "none", padding: "14px 0", fontSize: 18, fontWeight: 500 }}
            aria-label="Amount"
            aria-describedby={error ? "amount-error" : undefined}
            autoFocus
          />
        </div>
        {error && (
          <p
            id="amount-error"
            role="alert"
            style={{ fontSize: 12, color: "var(--error)", marginTop: 2 }}
          >
            {error}
          </p>
        )}
      </div>

      {/* Note field */}
      <input
        type="text"
        value={note}
        onChange={handleNoteChange}
        placeholder="Note (optional)"
        className="t-input"
        maxLength={MAX_NOTE_LENGTH}
        aria-label="Note (optional)"
        style={{ fontSize: 14 }}
      />
      {note.length >= MAX_NOTE_LENGTH - 5 && (
        <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "right" }}>
          {note.length}/{MAX_NOTE_LENGTH}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-ghost"
          style={{ flex: 1, height: 48, fontSize: 13 }}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          style={{ flex: 2, height: 48, fontSize: 13 }}
        >
          Log expense
        </button>
      </div>
    </motion.form>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface QuickLogAreaProps {
  /** User's transaction history for smart suggestions and frequency sorting */
  recentTransactions: Transaction[]
  /** Budget data (reserved for future category-aware suggestions) */
  budgets: Budget[]
  /** Callback when an expense is logged */
  onLogExpense: (transaction: QuickTransaction) => void
  /** Callback when income is logged */
  onLogIncome: (amount: number, note?: string) => void
  /** User-defined custom categories to show in the category grid (task 69) */
  customCategories?: CustomCategory[]
}

/**
 * QuickLogArea — enables one-tap and swipe-to-custom expense logging.
 *
 * Features:
 * - Category icons sorted by usage frequency (most-used first)
 * - Smart suggestions displayed on category tap (up to 4 chips)
 * - "Repeat last" chips for frequent transactions
 * - One-tap logging from suggestion chip
 * - Swipe-down gesture to reveal custom amount entry
 * - Amount validation and note sanitization
 * - Success toast feedback after logging
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 10.5, 10.7
 */
export function QuickLogArea({
  recentTransactions,
  budgets,
  onLogExpense,
  onLogIncome,
  customCategories = [],
}: QuickLogAreaProps) {
  const { showToast } = useToast()
  const { prefersReducedMotion } = useReducedMotion()
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)
  /** Id of the chip currently playing the success ripple (task 9.4). */
  const [rippleChipId, setRippleChipId] = useState<string | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Customize mode state (Task 133.1) ──────────────────────────────────────
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [customizedCategories, setCustomizedCategories] = useState<
    { category: TransactionCategory; emoji: string; label: string }[]
  >([])

  // Load saved preferences on mount
  useEffect(() => {
    const prefs = loadCategoryGridPrefs()
    if (prefs) {
      setCustomizedCategories(mergePrefsWithDefaults(prefs))
    }
  }, [])

  // Clean up the ripple reset timer on unmount.
  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  // Scale + fade entrance stagger for suggestion chips (task 9.4).
  const chipContainerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: prefersReducedMotion ? 0 : STAGGER_STEP } },
  }
  const chipItemVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, scale: 0.8, y: 8 },
        visible: { opacity: 1, scale: 1, y: 0, transition: springs.snappy },
      }

  // ── 6.2: Sort categories by usage frequency (Requirement 3.2) ──────────────
  const sortedCategories = useMemo(() => {
    // If user has customized preferences, use those (Task 133.1)
    if (customizedCategories.length > 0) {
      // Append custom categories after the user's saved built-in order
      const custom = [...customCategories]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((c) => ({
          category: 'other' as TransactionCategory,
          emoji: c.emoji,
          label: c.label,
          customId: c.id,
        }))
      return [...customizedCategories, ...custom]
    }

    // Fallback: frequency-based sorting for new users
    // Count transactions per expense category (look at the last 50 for performance)
    const usageCount = new Map<TransactionCategory, number>()
    const sample = recentTransactions.slice(0, 50)
    for (const tx of sample) {
      if (tx.type === "expense") {
        usageCount.set(tx.category, (usageCount.get(tx.category) ?? 0) + 1)
      }
    }
    // Only show expense categories (BUDGET_CATEGORIES excludes income)
    const builtIn = [...BUDGET_CATEGORIES].sort(
      (a, b) => (usageCount.get(b.category) ?? 0) - (usageCount.get(a.category) ?? 0)
    )

    // Append custom categories at the end, sorted by creation date (task 69)
    const custom = [...customCategories]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((c) => ({
        category: 'other' as TransactionCategory,
        emoji: c.emoji,
        label: c.label,
        customId: c.id,
      }))

    return [...builtIn, ...custom]
  }, [recentTransactions, customCategories, customizedCategories])

  // ── 6.3: Smart suggestions for selected category (Requirements 3.3, 3.6) ───
  const suggestions = useMemo<SmartSuggestion[]>(() => {
    if (!selectedCategory) return []
    return generateSmartSuggestions(selectedCategory, recentTransactions)
  }, [selectedCategory, recentTransactions])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCategorySelect(category: TransactionCategory) {
    if (selectedCategory === category) {
      // Deselect — collapse suggestions
      setSelectedCategory(null)
      setShowCustomInput(false)
    } else {
      setSelectedCategory(category)
      setShowCustomInput(false)
    }
  }

  /** ── 6.4: One-tap expense logging (Requirements 3.4, 3.7) ── */
  function handleSuggestionTap(suggestion: SmartSuggestion) {
    if (!selectedCategory) return
    const transaction: QuickTransaction = {
      category: selectedCategory,
      amount: suggestion.amount,
      note: suggestion.label,
    }
    onLogExpense(transaction)
    const amountStr =
      suggestion.amount % 1 === 0
        ? `$${suggestion.amount}`
        : `$${suggestion.amount.toFixed(2)}`
    showToast(`Logged ${amountStr} for ${categoryLabel(selectedCategory)} ✓`, "success")

    // Reset to the default state (Requirement 3.7). When motion is enabled we
    // briefly keep the tapped chip mounted so the success ripple can play.
    if (prefersReducedMotion) {
      setSelectedCategory(null)
      setShowCustomInput(false)
      return
    }
    setRippleChipId(suggestion.id)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => {
      setSelectedCategory(null)
      setShowCustomInput(false)
      setRippleChipId(null)
    }, RIPPLE_MS)
  }

  /** ── 6.5: Custom amount submitted from panel ── */
  function handleCustomSubmit(transaction: QuickTransaction) {
    onLogExpense(transaction)
    const amountStr =
      transaction.amount % 1 === 0
        ? `$${transaction.amount}`
        : `$${transaction.amount.toFixed(2)}`
    showToast(`Logged ${amountStr} for ${categoryLabel(transaction.category)} ✓`, "success")
    // Clear category and return to default state (Requirement 3.7)
    setSelectedCategory(null)
    setShowCustomInput(false)
  }

  /**
   * ── 6.5: Swipe gesture to reveal custom amount (Requirement 3.5) ──
   * Detect a downward swipe on the suggestions row.
   */
  function handleSuggestionsPan(_: unknown, info: PanInfo) {
    if (info.offset.y > SWIPE_THRESHOLD && !showCustomInput) {
      setShowCustomInput(true)
    }
  }

  function categoryLabel(category: TransactionCategory): string {
    return BUDGET_CATEGORIES.find((c) => c.category === category)?.label ?? category
  }

  // ── Customize mode handlers (Task 133.1) ───────────────────────────────────

  /** Enter customize mode — copy current order into editable state */
  const handleStartCustomize = useCallback(() => {
    setIsCustomizing(true)
    setSelectedCategory(null)
    setShowCustomInput(false)
    setEditingCategoryId(null)
    // Use only built-in categories for reorder (custom categories handled separately)
    const builtInCats = sortedCategories.filter(c => !('customId' in c))
    setCustomizedCategories(builtInCats)
  }, [sortedCategories])

  /** Save customized order + labels and exit edit mode */
  const handleDoneCustomize = useCallback(() => {
    const prefs = categoriesToPrefs(customizedCategories)
    saveCategoryGridPrefs(prefs)
    setIsCustomizing(false)
    setEditingCategoryId(null)
    showToast("Categories updated ✓", "success")
  }, [customizedCategories, showToast])

  /** Update a category's label/emoji inline */
  const handleSaveCategoryEdit = useCallback((categoryId: string, newEmoji: string, newLabel: string) => {
    setCustomizedCategories(prev =>
      prev.map(c =>
        c.category === categoryId
          ? { ...c, emoji: newEmoji, label: newLabel }
          : c
      )
    )
    setEditingCategoryId(null)
  }, [])

  /** Handle reorder from framer-motion Reorder.Group */
  const handleReorder = useCallback((newOrder: { category: TransactionCategory; emoji: string; label: string }[]) => {
    setCustomizedCategories(newOrder)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Quick log expense"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--sub)",
            letterSpacing: "0.02em",
          }}
        >
          Log expense
        </span>
        <div className="flex items-center gap-3">
          {isCustomizing ? (
            <motion.button
              type="button"
              onClick={handleDoneCustomize}
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text)",
                background: "rgba(167, 139, 250, 0.2)",
                border: "1px solid rgba(167, 139, 250, 0.4)",
                borderRadius: borderRadius.full,
                padding: "5px 12px",
                cursor: "pointer",
                fontFamily: FONT_FAMILY,
              }}
              whileTap={{ scale: 0.95 }}
              aria-label="Done customizing categories"
            >
              Done
            </motion.button>
          ) : (
            <>
              {!selectedCategory && (
                <motion.button
                  type="button"
                  onClick={handleStartCustomize}
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 0",
                    fontFamily: FONT_FAMILY,
                  }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Customize category order and labels"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Customize
                </motion.button>
              )}
              {selectedCategory && !showCustomInput && (
                <motion.button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 0",
                  }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Enter custom amount"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Custom ↓
                </motion.button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Category grid (Requirement 3.1) ── */}
      {isCustomizing ? (
        /* ── Customize mode: drag-to-reorder (Task 133.1) ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Reorder.Group
            axis="x"
            values={customizedCategories}
            onReorder={handleReorder}
            style={{
              display: "flex",
              gap: 8,
              listStyle: "none",
              padding: 0,
              margin: 0,
              overflowX: "auto",
              paddingBottom: 4,
            }}
            aria-label="Drag to reorder expense categories"
          >
            {customizedCategories.map((cat) => (
              <Reorder.Item
                key={cat.category}
                value={cat}
                style={{ cursor: "grab", touchAction: "none" }}
                whileDrag={prefersReducedMotion ? undefined : { scale: 1.05, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
                dragListener={editingCategoryId !== cat.category}
              >
                <motion.button
                  type="button"
                  className="cat-pill cat-pill--glass"
                  style={{
                    minHeight: 80,
                    minWidth: 48,
                    position: "relative",
                    border: editingCategoryId === cat.category
                      ? "1.5px solid rgba(167, 139, 250, 0.6)"
                      : undefined,
                  }}
                  onClick={() =>
                    setEditingCategoryId(
                      editingCategoryId === cat.category ? null : cat.category
                    )
                  }
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                  aria-label={`Edit ${cat.label} category. Drag to reorder.`}
                >
                  {/* Drag handle indicator */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 6,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 16,
                      height: 3,
                      borderRadius: 2,
                      background: "rgba(255, 255, 255, 0.2)",
                    }}
                  />
                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      paddingTop: 6,
                    }}
                  >
                    <span style={{ fontSize: 24 }} aria-hidden="true">
                      {cat.emoji}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--sub)",
                        letterSpacing: "0.03em",
                        maxWidth: 60,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cat.label}
                    </span>
                  </span>
                </motion.button>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          {/* Inline edit form for tapped category */}
          <AnimatePresence mode="wait">
            {editingCategoryId && (
              <EditCategoryInline
                key={editingCategoryId}
                emoji={customizedCategories.find(c => c.category === editingCategoryId)?.emoji ?? "📦"}
                label={customizedCategories.find(c => c.category === editingCategoryId)?.label ?? ""}
                onSave={(emoji, label) => handleSaveCategoryEdit(editingCategoryId, emoji, label)}
                onCancel={() => setEditingCategoryId(null)}
                reducedMotion={prefersReducedMotion}
              />
            )}
          </AnimatePresence>

          <p
            style={{
              fontSize: 11,
              color: "var(--muted)",
              textAlign: "center",
              marginTop: 2,
              fontFamily: FONT_FAMILY,
            }}
            aria-live="polite"
          >
            Drag to reorder · Tap to rename
          </p>
        </div>
      ) : (
        /* ── Normal mode: category grid ── */
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${sortedCategories.length}, 1fr)` }}
          role="group"
          aria-label="Expense categories"
          onKeyDown={(e) => {
            const items = sortedCategories
            const currentIndex = selectedCategory
              ? items.findIndex(c => c.category === selectedCategory)
              : -1
            let nextIndex = -1
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault()
              nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault()
              nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
            }
            if (nextIndex >= 0) {
              handleCategorySelect(items[nextIndex].category)
              // Focus the next button
              const container = e.currentTarget
              const buttons = container.querySelectorAll<HTMLButtonElement>('[role="group"] > button, button[aria-pressed]')
              buttons[nextIndex]?.focus()
            }
          }}
        >
          {sortedCategories.map((cat, index) => (
            <CategoryButton
              key={'customId' in cat && cat.customId ? `custom-${cat.customId}` : cat.category}
              category={cat.category}
              emoji={cat.emoji}
              label={cat.label}
              isSelected={selectedCategory === cat.category}
              onSelect={() => handleCategorySelect(cat.category)}
              reducedMotion={prefersReducedMotion}
              tabIndex={
                selectedCategory === cat.category ? 0
                  : selectedCategory === null && index === 0 ? 0
                  : -1
              }
            />
          ))}
        </div>
      )}

      {/* ── First-time user prompt (Requirement 14.4) ── */}
      {recentTransactions.length === 0 && !selectedCategory && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={timings.normal}
          style={{
            fontSize: 13,
            color: "var(--muted)",
            textAlign: "center",
            padding: "4px 0",
            fontFamily: FONT_FAMILY,
          }}
        >
          Tap a category to see common amounts and log your first expense
        </motion.p>
      )}

      {/* ── Suggestions & custom input area (Requirements 3.3, 3.4, 3.5, 3.6) ── */}
      <AnimatePresence mode="wait">
        {selectedCategory && !showCustomInput && suggestions.length > 0 && (
          <motion.div
            key={`suggestions-${selectedCategory}`}
            ref={suggestionsRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={timings.normal}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleSuggestionsPan}
            style={{ overflow: "hidden", touchAction: "none" }}
            aria-label={`Suggestions for ${categoryLabel(selectedCategory)}`}
          >
            {/* Label: "Common amounts" for presets, hidden for history-based (Requirement 14.4) */}
            {suggestions.every((s) => s.source === "preset") && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  fontWeight: 500,
                  marginBottom: 6,
                  fontFamily: FONT_FAMILY,
                }}
              >
                Common amounts
              </p>
            )}
            <motion.div
              className="flex gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: "none", paddingTop: 4 }}
              role="list"
              aria-label="Suggested amounts"
              variants={chipContainerVariants}
              initial="hidden"
              animate="visible"
            >
              {suggestions.slice(0, 4).map((s) => (
                <motion.div key={s.id} role="listitem" variants={chipItemVariants}>
                  <SuggestionChip
                    suggestion={s}
                    onTap={() => handleSuggestionTap(s)}
                    rippleActive={rippleChipId === s.id}
                    reducedMotion={prefersReducedMotion}
                  />
                </motion.div>
              ))}
            </motion.div>

            {/* Swipe hint */}
            <p
              style={{
                fontSize: 11,
                color: "var(--muted)",
                textAlign: "center",
                marginTop: 6,
                userSelect: "none",
              }}
              aria-hidden="true"
            >
              Swipe down or tap &ldquo;Custom&rdquo; for a different amount
            </p>
          </motion.div>
        )}

        {/* Empty state: category selected but no suggestions yet */}
        {selectedCategory && !showCustomInput && suggestions.length === 0 && (
          <motion.div
            key={`empty-${selectedCategory}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={timings.fast}
            style={{ textAlign: "center", padding: "8px 0" }}
          >
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              No suggestions yet — enter a custom amount.
            </p>
          </motion.div>
        )}

        {/* ── Custom amount panel (Requirement 3.5) — fluid slide-up ── */}
        {selectedCategory && showCustomInput && (
          <motion.div
            key={`custom-${selectedCategory}`}
            layout={!prefersReducedMotion}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={prefersReducedMotion ? timings.fast : springs.gentle}
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              padding: 16,
              overflow: "hidden",
            }}
          >
            <CustomAmountPanel
              category={selectedCategory}
              onSubmit={handleCustomSubmit}
              onCancel={() => setShowCustomInput(false)}
              reducedMotion={prefersReducedMotion}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
