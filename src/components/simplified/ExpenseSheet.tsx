"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { springs, timings, useReducedMotion } from '@/lib/animations'
import { generateSmartSuggestions } from '@/lib/suggestionUtils'
import { computeSplitAmount } from '@/lib/splitUtils'
import { autoCategorize } from '@/lib/autoCategorize'
import { triggerHaptic } from '@/lib/haptics'
import { predictHabit, getTopHabitChips } from '@/lib/habitEngine'
import { useToast } from '@/contexts/ToastContext'
import type { TransactionCategory, Transaction } from '@/types'
import type { SmartSuggestion, CustomCategory } from '@/types/folio'
import type { HabitChip } from '@/lib/habitEngine'
import type { CategoryDisplayItem } from '@/lib/customCategories'
import { mergeCategories } from '@/lib/customCategories'
import { getCategoryEmoji } from '@/lib/vocabulary'

interface ExpenseSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { amount: number; category: TransactionCategory; note?: string }) => void
  onUndo?: () => void
  defaultCategory?: TransactionCategory
  transactions?: Transaction[]
  customCategories?: CustomCategory[]
  /** Callback to create a new custom category inline (task 69) */
  onAddCustomCategory?: (label: string, emoji: string) => Promise<CustomCategory | null>
  /** When true, the split toggle starts enabled (task 65 — one-tap split flow) */
  splitPreEnabled?: boolean
}

const CATEGORY_GRID: { category: TransactionCategory; emoji: string; label: string }[] = [
  { category: 'food', emoji: getCategoryEmoji('food'), label: 'Food' },
  { category: 'transport', emoji: getCategoryEmoji('transport'), label: 'Transport' },
  { category: 'fun', emoji: getCategoryEmoji('fun'), label: 'Social' },
  { category: 'school', emoji: getCategoryEmoji('school'), label: 'School' },
  { category: 'rent', emoji: getCategoryEmoji('rent'), label: 'Rent' },
  { category: 'other', emoji: getCategoryEmoji('other'), label: 'Other' },
]

const MAX_AMOUNT = 99999

/** Spring config matching QuickLogArea's ICON_BOUNCE_SPRING (task 9.4). */
const ICON_BOUNCE_SPRING = { type: "spring" as const, stiffness: 400, damping: 17 }

/** Expense categories (excludes income-only categories). */
const EXPENSE_CATEGORIES = new Set<TransactionCategory>(['food', 'transport', 'fun', 'school', 'rent', 'other'])

/**
 * Finds the most recently used expense category from the transaction list.
 * Returns null if no qualifying transaction is found.
 */
function getMostRecentExpenseCategory(transactions: Transaction[] | undefined): TransactionCategory | null {
  if (!transactions || transactions.length === 0) return null
  const sorted = [...transactions]
    .filter((t) => t.type === 'expense' && EXPENSE_CATEGORIES.has(t.category))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return sorted.length > 0 ? sorted[0].category : null
}

export function ExpenseSheet({
  isOpen,
  onClose,
  onSubmit,
  onUndo,
  defaultCategory,
  transactions,
  customCategories = [],
  onAddCustomCategory,
  splitPreEnabled = false,
}: ExpenseSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const { showToast } = useToast()
  const amountRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<TransactionCategory | null>(null)
  const [note, setNote] = useState('')
  const [showNoteField, setShowNoteField] = useState(false)
  const [splitEnabled, setSplitEnabled] = useState(false)
  const [splitCount, setSplitCount] = useState(2)
  // Tracks whether category was manually selected (true) or auto-suggested (false)
  const [manualCategorySelection, setManualCategorySelection] = useState(false)
  // Tracks whether the current category was auto-suggested
  const [isAutoSuggested, setIsAutoSuggested] = useState(false)

  // ── Inline "Add custom category" form state (task 69) ───────────────────
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('✨')
  const [isAddingCategory, setIsAddingCategory] = useState(false)

  // Quick-pick emoji palette for the inline add form
  const EMOJI_PALETTE = ['🛒', '☕', '🍜', '🎓', '🏋️', '💇', '🎁', '🐾', '💊', '🧴', '✈️', '🎨', '🎶', '📱', '🪴']

  // Compute smart suggestions when category is selected
  const suggestions: SmartSuggestion[] = useMemo(() => {
    if (!category || !transactions || transactions.length === 0) return []
    return generateSmartSuggestions(category, transactions)
  }, [category, transactions])

  // Merged display list: built-in categories + user custom categories
  const displayCategories: CategoryDisplayItem[] = useMemo(() => {
    return mergeCategories(customCategories)
  }, [customCategories])

  // Compute effective default: explicit prop > most recently used > null
  const effectiveDefault = useMemo(() => {
    if (defaultCategory) return defaultCategory
    return getMostRecentExpenseCategory(transactions)
  }, [defaultCategory, transactions])

  // Habit prediction: pre-fill category + amount based on time-of-day patterns
  const habitPrediction = useMemo(() => {
    if (defaultCategory) return null // Don't override explicit category
    return predictHabit(transactions ?? [], new Date())
  }, [defaultCategory, transactions])

  // Top habit chips: frequency-weighted common transactions for one-tap logging
  const habitChips: HabitChip[] = useMemo(() => {
    return getTopHabitChips(transactions ?? [], 3)
  }, [transactions])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      // Pre-fill from habit prediction if no explicit default
      const prefillCategory = effectiveDefault ?? habitPrediction?.category ?? null
      const prefillAmount = (!defaultCategory && habitPrediction?.amount)
        ? String(habitPrediction.amount)
        : ''

      setAmount(prefillAmount)
      setCategory(prefillCategory)
      setNote('')
      setShowNoteField(false)
      setSplitEnabled(splitPreEnabled)
      setSplitCount(2)
      setManualCategorySelection(!!effectiveDefault)
      setIsAutoSuggested(!!(!defaultCategory && !effectiveDefault && habitPrediction))
      setShowAddCategoryForm(false)
      setNewCategoryLabel('')
      setNewCategoryEmoji('✨')
      setIsAddingCategory(false)
      // Auto-focus amount input (Task 73: removed setTimeout for instant focus)
      amountRef.current?.focus()
    }
  }, [isOpen, effectiveDefault, defaultCategory, habitPrediction, splitPreEnabled])

  // ── Inline add-category submit handler (task 69) ────────────────────────
  const handleAddCategorySubmit = useCallback(async () => {
    const trimmedLabel = newCategoryLabel.trim()
    if (!trimmedLabel || !onAddCustomCategory) return
    setIsAddingCategory(true)
    try {
      const created = await onAddCustomCategory(trimmedLabel, newCategoryEmoji)
      if (created) {
        // Select the newly created category and close the form
        setCategory('other')
        setManualCategorySelection(true)
        setIsAutoSuggested(false)
        setShowAddCategoryForm(false)
        setNewCategoryLabel('')
        setNewCategoryEmoji('✨')
      }
    } finally {
      setIsAddingCategory(false)
    }
  }, [newCategoryLabel, newCategoryEmoji, onAddCustomCategory])

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    const parts = raw.split('.')
    // Only allow one decimal point, max 2 decimal places
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    // Validate max amount
    const numeric = parseFloat(raw)
    if (numeric > MAX_AMOUNT) return
    setAmount(raw)
  }, [])

  const handleSubmit = useCallback(() => {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0 || !category) return

    // When split is enabled, submit the user's share instead of the full amount
    const submittedAmount = splitEnabled ? computeSplitAmount(parsed, splitCount) : parsed

    // Validate the computed share is within bounds
    if (submittedAmount <= 0 || submittedAmount > MAX_AMOUNT) return

    onSubmit({
      amount: submittedAmount,
      category,
      note: note.trim() || undefined,
    })
    // Show success toast with optional undo action
    const categoryLabel = displayCategories.find(c => c.categoryValue === category)?.label ?? category
    const amountStr = submittedAmount % 1 === 0 ? `$${submittedAmount}` : `$${submittedAmount.toFixed(2)}`
    const splitSuffix = splitEnabled ? ` (your share of $${parsed % 1 === 0 ? parsed : parsed.toFixed(2)})` : ''
    showToast(
      `Logged ${amountStr}${splitSuffix} for ${categoryLabel} ✓`,
      'success',
      onUndo ? { label: 'Undo', onClick: onUndo } : undefined
    )
    onClose()
  }, [amount, category, note, splitEnabled, splitCount, onSubmit, onClose, onUndo, showToast])

  const canSubmit = (() => {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0 || parsed > MAX_AMOUNT || !category) return false
    if (splitEnabled) {
      const share = computeSplitAmount(parsed, splitCount)
      return share > 0 && share <= MAX_AMOUNT && splitCount >= 2
    }
    return true
  })()

  // Compute recent notes for selected category (up to 4 unique)
  const recentNotes: string[] = useMemo(() => {
    if (!category || !transactions || transactions.length === 0) return []
    const seen = new Set<string>()
    const notes: string[] = []
    for (const tx of transactions) {
      if (tx.category !== category) continue
      const n = tx.note?.trim()
      if (!n || seen.has(n)) continue
      seen.add(n)
      notes.push(n)
      if (notes.length >= 4) break
    }
    return notes
  }, [category, transactions])

  const handleNoteChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip HTML tags and HTML entities, then limit to 60 chars
    const sanitized = e.target.value
      .replace(/<[^>]*>/g, '')
      .replace(/&[a-z]+;/gi, ' ')
      .slice(0, 60)
    setNote(sanitized)
    // Ensure note field stays visible once user starts typing
    if (sanitized && !showNoteField) {
      setShowNoteField(true)
    }

    // Auto-categorize: only apply if user hasn't manually picked a category
    if (!manualCategorySelection) {
      const result = autoCategorize(sanitized)
      if (result) {
        setCategory(result.category)
        setIsAutoSuggested(true)
      } else {
        // If no match, revert to effective default and clear suggestion indicator
        setCategory(effectiveDefault)
        setIsAutoSuggested(false)
      }
    }
  }, [showNoteField, manualCategorySelection, effectiveDefault])

  // ── Category button animation variants ──────────────────────────────────
  const cardTapVariants: Variants = prefersReducedMotion
    ? { tap: {} }
    : { tap: { scale: 0.94 } }

  const iconBounceVariants: Variants = prefersReducedMotion
    ? { tap: {} }
    : { tap: { scale: 1.3 } }

  // Sheet animation variants (Task 73: optimized for faster capture — 150ms vs 250ms)
  const sheetVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.15 } },
      }
    : {
        hidden: { y: '100%' },
        visible: { y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 30, duration: 0.15 } },
        exit: { y: '100%', transition: { duration: 0.15, ease: 'easeIn' as const } },
      }

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: timings.fast },
    exit: { opacity: 0, transition: timings.fast },
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="expense-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              background: 'rgba(0, 0, 0, 0.6)',
            }}
          />

          {/* Sheet */}
          <motion.div
            key="expense-sheet"
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              position: 'fixed',
              insetInline: 0,
              bottom: 0,
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface)',
              borderTop: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              maxHeight: '90vh',
              minHeight: '50vh',
              overflowY: 'auto',
              // Task 73: GPU acceleration for transform animations
              willChange: 'transform',
              transform: 'translate3d(0, 0, 0)',
            }}
          >
            {/* Handle */}
            <div className="sheet-handle" />

            <div style={{ padding: '0 24px 32px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              {habitChips.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: 20,
                    paddingTop: 4,
                  }}
                  aria-label="Quick log habits"
                >
                  {habitChips.map((chip, i) => (
                    <button
                      key={`habit-${chip.category}-${chip.amount}-${i}`}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light')
                        onSubmit({
                          amount: chip.amount,
                          category: chip.category,
                          note: chip.note,
                        })
                        const amountStr = chip.amount % 1 === 0 ? `$${chip.amount}` : `$${chip.amount.toFixed(2)}`
                        const categoryLabel = displayCategories.find(c => c.categoryValue === chip.category)?.label ?? chip.category
                        showToast(
                          `Logged ${amountStr} for ${categoryLabel} ✓`,
                          'success',
                          onUndo ? { label: 'Undo', onClick: onUndo } : undefined
                        )
                        onClose()
                      }}
                      aria-label={`Quick log: ${chip.label}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '10px 14px',
                        background: 'rgba(129, 140, 248, 0.06)',
                        border: '1px solid rgba(129, 140, 248, 0.2)',
                        borderRadius: 99,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ fontSize: 14 }} aria-hidden="true">⚡</span>
                      <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {chip.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* ── Habit pre-fill indicator ── */}
              {!defaultCategory && !effectiveDefault && habitPrediction && (
                <div
                  style={{
                    textAlign: 'center',
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      color: 'var(--muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    aria-live="polite"
                  >
                    <span aria-hidden="true">🕐</span> pre-filled from your habits
                  </span>
                </div>
              )}

              {/* ── Smart Suggestions (shown when category selected) ── */}
              <AnimatePresence>
                {category && suggestions.length > 0 && (
                  <motion.div
                    key={`suggestions-${category}`}
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={springs.snappy}
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                    aria-label="Suggested amounts"
                  >
                    {suggestions.slice(0, 4).map((s) => {
                      const amountStr = s.amount % 1 === 0 ? `$${s.amount}` : `$${s.amount.toFixed(2)}`
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            // One-tap log: immediately submit with suggested amount (Req 3.4)
                            onSubmit({
                              amount: s.amount,
                              category,
                              note: s.label || undefined,
                            })
                            const categoryLabel = displayCategories.find(c => c.categoryValue === category)?.label ?? category
                            showToast(
                              `Logged ${amountStr} for ${categoryLabel} ✓`,
                              'success',
                              onUndo ? { label: 'Undo', onClick: onUndo } : undefined
                            )
                            onClose()
                          }}
                          aria-label={s.label ? `Log ${amountStr} for ${s.label}` : `Log ${amountStr}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            padding: '8px 14px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 99,
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 500, fontFamily: 'Inter, sans-serif', color: 'var(--text)' }}>
                            {amountStr}
                          </span>
                          {s.label && (
                            <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Inter, sans-serif', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.label}
                            </span>
                          )}
                        </button>
                      )
                    })}
                    {/* Custom chip */}
                    <button
                      type="button"
                      onClick={() => { setAmount(''); amountRef.current?.focus() }}
                      aria-label="Enter custom amount"
                      style={{
                        padding: '8px 14px',
                        background: 'transparent',
                        border: '1px dashed rgba(255, 255, 255, 0.15)',
                        borderRadius: 99,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        color: 'var(--sub)',
                      }}
                    >
                      Custom
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Amount Input (calculator-style) ─────────────────── */}
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 28,
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 300,
                      color: 'var(--muted)',
                    }}
                  >
                    $
                  </span>
                  <input
                    ref={amountRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={handleAmountChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canSubmit) {
                        e.preventDefault()
                        handleSubmit()
                      }
                    }}
                    aria-label="Expense amount"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 48,
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                      color: 'var(--text)',
                      textAlign: 'center',
                      width: '100%',
                      maxWidth: 240,
                      caretColor: 'var(--text)',
                      lineHeight: 1.1,
                    }}
                  />
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--muted)',
                    marginTop: 8,
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  How much did you spend?
                </p>
              </div>

              {/* ── Category Grid (3×2) with glass-pill glow ────────── */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  marginBottom: 24,
                }}
                role="group"
                aria-label="Expense categories"
                onKeyDown={(e) => {
                  const currentIndex = category
                    ? displayCategories.findIndex(c => c.categoryValue === category)
                    : -1
                  let nextIndex = -1
                  if (e.key === "ArrowRight") {
                    e.preventDefault()
                    nextIndex = currentIndex < displayCategories.length - 1 ? currentIndex + 1 : 0
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault()
                    nextIndex = currentIndex > 0 ? currentIndex - 1 : displayCategories.length - 1
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault()
                    nextIndex = currentIndex + 3 < displayCategories.length ? currentIndex + 3 : currentIndex % 3
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault()
                    nextIndex = currentIndex - 3 >= 0 ? currentIndex - 3 : displayCategories.length - 3 + (currentIndex % 3)
                  }
                  if (nextIndex >= 0 && nextIndex < displayCategories.length) {
                    setCategory(displayCategories[nextIndex].categoryValue as TransactionCategory)
                    setManualCategorySelection(true)
                    setIsAutoSuggested(false)
                    triggerHaptic('light')
                    const container = e.currentTarget
                    const buttons = container.querySelectorAll<HTMLButtonElement>('button')
                    buttons[nextIndex]?.focus()
                  }
                }}
              >
                {displayCategories.map((cat, index) => {
                  const selected = category === cat.categoryValue
                  const isRovingActive = selected || (category === null && index === 0)

                  // Selection lift: slight upward shift + scale
                  const selectionAnimate = prefersReducedMotion
                    ? {}
                    : { y: selected ? -2 : 0, scale: selected ? 1.02 : 1 }

                  return (
                    <motion.button
                      key={cat.isCustom ? `custom-${cat.customId}` : cat.categoryValue}
                      type="button"
                      onClick={() => { setCategory(cat.categoryValue as TransactionCategory); setManualCategorySelection(true); setIsAutoSuggested(false); triggerHaptic('light') }}
                      aria-label={`Category: ${cat.label}`}
                      aria-pressed={selected}
                      tabIndex={isRovingActive ? 0 : -1}
                      className="cat-pill"
                      variants={cardTapVariants}
                      initial={false}
                      animate={selectionAnimate}
                      whileTap="tap"
                      transition={springs.snappy}
                      style={{
                        minHeight: 72,
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        // Glass-pill glow for selected, subtle surface for unselected
                        ...(selected
                          ? {
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)',
                              background: 'rgba(129, 140, 248, 0.08)',
                              border: '1.5px solid rgba(129, 140, 248, 0.4)',
                              boxShadow: '0 0 12px rgba(129, 140, 248, 0.15)',
                            }
                          : {
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                            }),
                      }}
                    >
                      {/* Emoji icon with bounce micro-interaction */}
                      <motion.span
                        style={{ fontSize: 24, lineHeight: 1, display: 'inline-block' }}
                        variants={iconBounceVariants}
                        transition={ICON_BOUNCE_SPRING}
                        aria-hidden="true"
                      >
                        {cat.emoji}
                      </motion.span>
                      <span
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: 12,
                          fontWeight: 500,
                          color: selected ? 'var(--text)' : 'var(--sub)',
                        }}
                      >
                        {cat.label}
                      </span>
                    </motion.button>
                  )
                })}

                {/* ── "+ Add" button — only shown when onAddCustomCategory is wired up (task 69) ── */}
                {onAddCustomCategory && !showAddCategoryForm && (
                  <motion.button
                    type="button"
                    onClick={() => { setShowAddCategoryForm(true); triggerHaptic('light') }}
                    aria-label="Add a custom category"
                    tabIndex={-1}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                    transition={springs.snappy}
                    style={{
                      minHeight: 72,
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      background: 'transparent',
                      border: '1px dashed rgba(255, 255, 255, 0.15)',
                    }}
                  >
                    <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden="true">+</span>
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--muted)',
                      }}
                    >
                      Add
                    </span>
                  </motion.button>
                )}
              </div>

              {/* ── Inline "Add custom category" form (task 69) ─────────────────── */}
              <AnimatePresence>
                {showAddCategoryForm && onAddCustomCategory && (
                  <motion.div
                    key="add-category-form"
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={springs.gentle}
                    style={{
                      overflow: 'hidden',
                      marginBottom: 16,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 14px 12px',
                    }}
                  >
                    {/* Emoji palette */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginBottom: 12,
                      }}
                      role="group"
                      aria-label="Choose an emoji for your category"
                    >
                      {EMOJI_PALETTE.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setNewCategoryEmoji(em)}
                          aria-label={`Use emoji ${em}`}
                          aria-pressed={newCategoryEmoji === em}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 'var(--radius-sm)',
                            border: newCategoryEmoji === em
                              ? '1.5px solid rgba(129, 140, 248, 0.6)'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            background: newCategoryEmoji === em
                              ? 'rgba(129, 140, 248, 0.1)'
                              : 'transparent',
                            fontSize: 18,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {em}
                        </button>
                      ))}
                    </div>

                    {/* Label input + action row */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 20,
                          flexShrink: 0,
                          width: 32,
                          textAlign: 'center',
                        }}
                        aria-hidden="true"
                      >
                        {newCategoryEmoji}
                      </span>
                      <input
                        type="text"
                        placeholder="Category name"
                        value={newCategoryLabel}
                        onChange={(e) => setNewCategoryLabel(e.target.value.slice(0, 30))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); void handleAddCategorySubmit() }
                          if (e.key === 'Escape') { setShowAddCategoryForm(false) }
                        }}
                        maxLength={30}
                        aria-label="New category name"
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                          outline: 'none',
                          fontSize: 14,
                          fontFamily: 'Inter, sans-serif',
                          color: 'var(--text)',
                          padding: '6px 0',
                        }}
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddCategorySubmit()}
                        disabled={!newCategoryLabel.trim() || isAddingCategory}
                        aria-label="Save new category"
                        style={{
                          flexShrink: 0,
                          padding: '6px 14px',
                          borderRadius: 99,
                          background: newCategoryLabel.trim()
                            ? 'rgba(129, 140, 248, 0.8)'
                            : 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          color: newCategoryLabel.trim() ? '#fff' : 'var(--muted)',
                          fontSize: 13,
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 600,
                          cursor: newCategoryLabel.trim() ? 'pointer' : 'not-allowed',
                          opacity: isAddingCategory ? 0.6 : 1,
                        }}
                      >
                        {isAddingCategory ? '…' : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddCategoryForm(false)}
                        aria-label="Cancel adding category"
                        style={{
                          flexShrink: 0,
                          padding: '6px 10px',
                          borderRadius: 99,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--muted)',
                          fontSize: 13,
                          fontFamily: 'Inter, sans-serif',
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Auto-category suggestion indicator ──────────────── */}
              {isAutoSuggested && category && (
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: -16,
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      color: 'var(--muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    aria-live="polite"
                  >
                    <span aria-hidden="true">✨</span> suggested from note
                  </span>
                </div>
              )}

              {/* ── Note Input (optional, hidden unless toggled) ───────────────────────────── */}
              {!showNoteField && !note ? (
                <div style={{ marginBottom: 28, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowNoteField(true)}
                    aria-label="Add a note"
                    style={{
                      background: 'transparent',
                      border: '1px dashed rgba(255, 255, 255, 0.15)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 16px',
                      fontSize: 13,
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      color: 'var(--sub)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>+</span> Add a note
                  </button>
                </div>
              ) : (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="What's this for?"
                      value={note}
                      onChange={handleNoteChange}
                      maxLength={60}
                      aria-label="Expense note"
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--line)',
                        outline: 'none',
                        fontSize: 15,
                        fontFamily: 'Inter, sans-serif',
                        color: 'var(--text)',
                        padding: '12px 0',
                        caretColor: 'var(--text)',
                      }}
                    />
                    {/* Character count indicator — shown when 50+ chars */}
                    {note.length >= 50 && (
                      <span
                        style={{
                          position: 'absolute',
                          right: 0,
                          bottom: 14,
                          fontSize: 11,
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 400,
                          color: 'var(--muted)',
                        }}
                      >
                        {note.length}/60
                      </span>
                    )}
                  </div>

                  {/* Note suggestion chips */}
                  {category && recentNotes.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      {recentNotes.map((recentNote) => (
                        <button
                          key={recentNote}
                          type="button"
                          onClick={() => {
                            setNote(recentNote)
                            setShowNoteField(true)
                          }}
                          aria-label={`Use note: ${recentNote}`}
                          style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: 99,
                            padding: '5px 12px',
                            fontSize: 12,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 400,
                            color: 'var(--sub)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {recentNote.length > 20
                            ? recentNote.slice(0, 20) + '…'
                            : recentNote}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Split Toggle (optional, between note and Log button) ────── */}
              <div style={{ marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={() => {
                    setSplitEnabled((prev) => !prev)
                    triggerHaptic('light')
                  }}
                  aria-pressed={splitEnabled}
                  aria-label="Split this expense"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '12px 14px',
                    background: splitEnabled
                      ? 'rgba(129, 140, 248, 0.06)'
                      : 'transparent',
                    border: splitEnabled
                      ? '1px solid rgba(129, 140, 248, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Toggle indicator */}
                  <span
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 10,
                      background: splitEnabled
                        ? 'rgba(129, 140, 248, 0.8)'
                        : 'rgba(255, 255, 255, 0.12)',
                      position: 'relative',
                      flexShrink: 0,
                      transition: 'background 0.15s ease',
                    }}
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: splitEnabled ? 18 : 2,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left 0.15s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    />
                  </span>
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 14,
                      fontWeight: 500,
                      color: splitEnabled ? 'var(--text)' : 'var(--sub)',
                    }}
                  >
                    Split this
                  </span>
                </button>

                {/* Split controls — shown when toggle is on */}
                <AnimatePresence>
                  {splitEnabled && (
                    <motion.div
                      key="split-controls"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={springs.snappy}
                      style={{ overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 4px 4px',
                          gap: 12,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 13,
                            color: 'var(--sub)',
                          }}
                        >
                          Split between
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setSplitCount((c) => Math.max(2, c - 1))}
                            disabled={splitCount <= 2}
                            aria-label="Decrease split count"
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: splitCount <= 2 ? 'var(--muted)' : 'var(--text)',
                              fontSize: 18,
                              fontFamily: 'Inter, sans-serif',
                              cursor: splitCount <= 2 ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: splitCount <= 2 ? 0.4 : 1,
                            }}
                          >
                            −
                          </button>
                          <span
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: 18,
                              fontWeight: 600,
                              color: 'var(--text)',
                              minWidth: 50,
                              textAlign: 'center',
                            }}
                            aria-live="polite"
                            aria-label={`${splitCount} people`}
                          >
                            {splitCount} 👥
                          </span>
                          <button
                            type="button"
                            onClick={() => setSplitCount((c) => Math.min(20, c + 1))}
                            disabled={splitCount >= 20}
                            aria-label="Increase split count"
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: splitCount >= 20 ? 'var(--muted)' : 'var(--text)',
                              fontSize: 18,
                              fontFamily: 'Inter, sans-serif',
                              cursor: splitCount >= 20 ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: splitCount >= 20 ? 0.4 : 1,
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Computed share display */}
                      {(() => {
                        const parsed = parseFloat(amount)
                        if (!parsed || parsed <= 0) return null
                        const share = computeSplitAmount(parsed, splitCount)
                        const shareStr = share % 1 === 0 ? `$${share}` : `$${share.toFixed(2)}`
                        return (
                          <div
                            style={{
                              textAlign: 'center',
                              padding: '10px 0 4px',
                            }}
                          >
                            <span
                              style={{
                                fontFamily: 'Inter, sans-serif',
                                fontSize: 14,
                                fontWeight: 500,
                                color: 'var(--text)',
                                background: 'rgba(129, 140, 248, 0.08)',
                                border: '1px solid rgba(129, 140, 248, 0.2)',
                                borderRadius: 99,
                                padding: '6px 14px',
                                display: 'inline-block',
                              }}
                              aria-live="polite"
                            >
                              Your share: {shareStr}
                            </span>
                          </div>
                        )
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Log Button (thumb zone — pinned at bottom of sheet) ── */}
              <motion.button
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-label="Log expense"
                whileTap={canSubmit && !prefersReducedMotion ? { scale: 0.97 } : undefined}
                transition={springs.bouncy}
                style={{
                  width: '100%',
                  height: 56,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 'auto',
                  background: canSubmit
                    ? 'linear-gradient(135deg, rgba(129, 140, 248, 1) 0%, rgba(99, 102, 241, 1) 100%)'
                    : 'var(--dim)',
                  color: canSubmit ? '#fff' : 'var(--muted)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 17,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  opacity: canSubmit ? 1 : 0.5,
                  boxShadow: canSubmit ? '0 4px 16px rgba(129, 140, 248, 0.3)' : 'none',
                }}
              >
                Log
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
