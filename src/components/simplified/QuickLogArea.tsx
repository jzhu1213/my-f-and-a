"use client"

import { useState, useMemo, useRef } from "react"
import { motion, AnimatePresence, PanInfo } from "framer-motion"
import type { Transaction, Budget, TransactionCategory } from "@/types"
import { BUDGET_CATEGORIES } from "@/types"
import type { QuickTransaction, SmartSuggestion } from "@/types/folio"
import { generateSmartSuggestions } from "@/lib/suggestionUtils"
import { useToast } from "@/contexts/ToastContext"

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum allowed transaction amount (Requirement 10.5) */
const MAX_AMOUNT = 99_999

/** Maximum note length in characters (Requirement 10.7) */
const MAX_NOTE_LENGTH = 60

/** Minimum swipe distance (px) to reveal custom amount input (Requirement 3.5) */
const SWIPE_THRESHOLD = 60

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
}

/**
 * Large tappable category button — minimum 48×80px for accessibility.
 * Requirement 3.1, 15.2
 */
function CategoryButton({ category, emoji, label, isSelected, onSelect }: CategoryButtonProps) {
  return (
    <motion.button
      type="button"
      className={`cat-pill flex-1 min-w-0${isSelected ? " selected" : ""}`}
      style={{
        minHeight: 80,
        minWidth: 48,
        outline: isSelected ? `2px solid var(--sub)` : "none",
        outlineOffset: 2,
      }}
      onClick={onSelect}
      whileTap={{ scale: 0.93 }}
      aria-pressed={isSelected}
      aria-label={`${label} category${isSelected ? ", selected" : ""}`}
    >
      <span style={{ fontSize: 24 }} aria-hidden="true">{emoji}</span>
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
    </motion.button>
  )
}

interface SuggestionChipProps {
  suggestion: SmartSuggestion
  onTap: () => void
}

/**
 * Chip showing a suggested amount with optional label.
 * Tapping immediately logs the expense.
 * Requirements 3.3, 3.4
 */
function SuggestionChip({ suggestion, onTap }: SuggestionChipProps) {
  const amountStr =
    suggestion.amount % 1 === 0
      ? `$${suggestion.amount}`
      : `$${suggestion.amount.toFixed(2)}`

  return (
    <motion.button
      type="button"
      className="amount-chip active flex-shrink-0"
      style={{
        minHeight: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        padding: "10px 16px",
        borderRadius: "var(--radius-sm)",
      }}
      onClick={onTap}
      whileTap={{ scale: 0.95 }}
      aria-label={
        suggestion.label
          ? `Log ${amountStr} for ${suggestion.label}`
          : `Log ${amountStr}`
      }
    >
      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
        {amountStr}
      </span>
      {suggestion.label && (
        <span
          style={{
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

interface CustomAmountPanelProps {
  category: TransactionCategory
  onSubmit: (transaction: QuickTransaction) => void
  onCancel: () => void
}

/**
 * Swipe-revealed custom amount entry panel.
 * Validates amount and sanitizes note before submitting.
 * Requirements 3.5, 10.5, 10.7, 14.1
 */
function CustomAmountPanel({ category, onSubmit, onCancel }: CustomAmountPanelProps) {
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
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.2 }}
      aria-label={`Custom amount for ${categoryInfo?.label ?? category}`}
    >
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 20 }} aria-hidden="true">
          {categoryInfo?.emoji ?? "💼"}
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
}: QuickLogAreaProps) {
  const { showToast } = useToast()
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // ── 6.2: Sort categories by usage frequency (Requirement 3.2) ──────────────
  const sortedCategories = useMemo(() => {
    // Count transactions per expense category (look at the last 50 for performance)
    const usageCount = new Map<TransactionCategory, number>()
    const sample = recentTransactions.slice(0, 50)
    for (const tx of sample) {
      if (tx.type === "expense") {
        usageCount.set(tx.category, (usageCount.get(tx.category) ?? 0) + 1)
      }
    }
    // Only show expense categories (BUDGET_CATEGORIES excludes income)
    return [...BUDGET_CATEGORIES].sort(
      (a, b) => (usageCount.get(b.category) ?? 0) - (usageCount.get(a.category) ?? 0)
    )
  }, [recentTransactions])

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
    // Clear category and return to default state (Requirement 3.7)
    setSelectedCategory(null)
    setShowCustomInput(false)
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
      </div>

      {/* ── Category grid (Requirement 3.1) ── */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${sortedCategories.length}, 1fr)` }}
        role="group"
        aria-label="Expense categories"
      >
        {sortedCategories.map((cat) => (
          <CategoryButton
            key={cat.category}
            category={cat.category}
            emoji={cat.emoji}
            label={cat.label}
            isSelected={selectedCategory === cat.category}
            onSelect={() => handleCategorySelect(cat.category)}
          />
        ))}
      </div>

      {/* ── Suggestions & custom input area (Requirements 3.3, 3.4, 3.5, 3.6) ── */}
      <AnimatePresence mode="wait">
        {selectedCategory && !showCustomInput && suggestions.length > 0 && (
          <motion.div
            key={`suggestions-${selectedCategory}`}
            ref={suggestionsRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleSuggestionsPan}
            style={{ overflow: "hidden", touchAction: "none" }}
            aria-label={`Suggestions for ${categoryLabel(selectedCategory)}`}
          >
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: "none" }}
              role="list"
              aria-label="Suggested amounts"
            >
              {suggestions.slice(0, 4).map((s) => (
                <div key={s.id} role="listitem">
                  <SuggestionChip
                    suggestion={s}
                    onTap={() => handleSuggestionTap(s)}
                  />
                </div>
              ))}
            </div>

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
            transition={{ duration: 0.18 }}
            style={{ textAlign: "center", padding: "8px 0" }}
          >
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              No suggestions yet — enter a custom amount.
            </p>
          </motion.div>
        )}

        {/* ── Custom amount panel (Requirement 3.5) ── */}
        {selectedCategory && showCustomInput && (
          <motion.div
            key={`custom-${selectedCategory}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
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
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
