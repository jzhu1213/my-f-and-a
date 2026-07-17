"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { generateSmartSuggestions } from '@/lib/suggestionUtils'
import { triggerHaptic } from '@/lib/haptics'
import { useToast } from '@/contexts/ToastContext'
import type { TransactionCategory, Transaction } from '@/types'
import type { SmartSuggestion } from '@/types/folio'

interface ExpenseSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { amount: number; category: TransactionCategory; note?: string }) => void
  onUndo?: () => void
  defaultCategory?: TransactionCategory
  transactions?: Transaction[]
}

const CATEGORY_GRID: { category: TransactionCategory; emoji: string; label: string }[] = [
  { category: 'food', emoji: '🍕', label: 'Food' },
  { category: 'transport', emoji: '🚗', label: 'Transport' },
  { category: 'fun', emoji: '🎮', label: 'Fun' },
  { category: 'school', emoji: '📚', label: 'School' },
  { category: 'rent', emoji: '🏠', label: 'Rent' },
  { category: 'other', emoji: '💼', label: 'Other' },
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
}: ExpenseSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const { showToast } = useToast()
  const amountRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<TransactionCategory | null>(null)
  const [note, setNote] = useState('')

  // Compute smart suggestions when category is selected
  const suggestions: SmartSuggestion[] = useMemo(() => {
    if (!category || !transactions || transactions.length === 0) return []
    return generateSmartSuggestions(category, transactions)
  }, [category, transactions])

  // Compute effective default: explicit prop > most recently used > null
  const effectiveDefault = useMemo(() => {
    if (defaultCategory) return defaultCategory
    return getMostRecentExpenseCategory(transactions)
  }, [defaultCategory, transactions])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setCategory(effectiveDefault)
      setNote('')
      // Auto-focus amount input
      setTimeout(() => amountRef.current?.focus(), 120)
    }
  }, [isOpen, effectiveDefault])

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
    onSubmit({
      amount: parsed,
      category,
      note: note.trim() || undefined,
    })
    // Show success toast with optional undo action
    const categoryLabel = CATEGORY_GRID.find(c => c.category === category)?.label ?? category
    const amountStr = parsed % 1 === 0 ? `$${parsed}` : `$${parsed.toFixed(2)}`
    showToast(
      `Logged ${amountStr} for ${categoryLabel} ✓`,
      'success',
      onUndo ? { label: 'Undo', onClick: onUndo } : undefined
    )
    onClose()
  }, [amount, category, note, onSubmit, onClose, onUndo, showToast])

  const canSubmit = (() => {
    const parsed = parseFloat(amount)
    return !!parsed && parsed > 0 && parsed <= MAX_AMOUNT && !!category
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
  }, [])

  // ── Category button animation variants ──────────────────────────────────
  const cardTapVariants: Variants = prefersReducedMotion
    ? { tap: {} }
    : { tap: { scale: 0.94 } }

  const iconBounceVariants: Variants = prefersReducedMotion
    ? { tap: {} }
    : { tap: { scale: 1.3 } }

  // Sheet animation variants
  const sheetVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        hidden: { y: '100%' },
        visible: { y: 0, transition: springs.gentle },
        exit: { y: '100%', transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] as const } },
      }

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
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
              overflowY: 'auto',
            }}
          >
            {/* Handle */}
            <div className="sheet-handle" />

            <div style={{ padding: '0 24px 32px' }}>
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
                          onClick={() => setAmount(s.amount % 1 === 0 ? s.amount.toString() : s.amount.toFixed(2))}
                          aria-label={s.label ? `${amountStr} for ${s.label}` : amountStr}
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
              >
                {CATEGORY_GRID.map((cat) => {
                  const selected = category === cat.category

                  // Selection lift: slight upward shift + scale
                  const selectionAnimate = prefersReducedMotion
                    ? {}
                    : { y: selected ? -2 : 0, scale: selected ? 1.02 : 1 }

                  return (
                    <motion.button
                      key={cat.category}
                      type="button"
                      onClick={() => { setCategory(cat.category); triggerHaptic('light') }}
                      aria-label={`Category: ${cat.label}`}
                      aria-pressed={selected}
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
              </div>

              {/* ── Note Input (optional) ───────────────────────────── */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Add a note (optional)"
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
                        onClick={() => setNote(recentNote)}
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

              {/* ── Log Button ──────────────────────────────────────── */}
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
