"use client"

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, timings } from '@/lib/animations'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Icon } from '@/components/ui/Icon'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { formatMoney } from '@/lib/localeFormat'
import { chipButton, HORIZONTAL_PADDING } from '@/styles/shared'
import { radius } from '@/styles/surfaces'
import type { TransactionCategory } from '@/types'

// ============================================================================
// Types
// ============================================================================

export interface BackfillSheetProps {
  isOpen: boolean
  onClose: () => void
  /** Logs an expense on a specific backdated date */
  onLogExpense: (data: {
    amount: number
    category: TransactionCategory
    date: string
    note?: string
  }) => Promise<void>
  /** Logs the paycheck income on a specific date */
  onLogIncome: (data: {
    amount: number
    date: string
    note?: string
  }) => Promise<void>
}

type BackfillStep = 'paycheck' | 'expenses' | 'done'

// ============================================================================
// Constants
// ============================================================================

const EXPENSE_CATEGORIES: { category: TransactionCategory; emoji: string; label: string }[] = [
  { category: 'food', emoji: '🍔', label: 'Food' },
  { category: 'transport', emoji: '🚌', label: 'Transport' },
  { category: 'fun', emoji: '🎉', label: 'Social' },
  { category: 'school', emoji: '📚', label: 'School' },
  { category: 'rent', emoji: '🏠', label: 'Rent' },
  { category: 'other', emoji: '📦', label: 'Other' },
]

// ============================================================================
// Date Helpers
// ============================================================================

/** Returns YYYY-MM-DD of the most recent Friday (or today if today is Friday). */
function getLastFriday(today: Date): string {
  const day = today.getDay() // 0=Sun, 5=Fri
  const diff = day >= 5 ? day - 5 : day + 2
  const lastFri = new Date(today)
  lastFri.setDate(today.getDate() - diff)
  return lastFri.toISOString().slice(0, 10)
}

/** Returns YYYY-MM-DD of 2 weeks ago. */
function getTwoWeeksAgo(today: Date): string {
  const d = new Date(today)
  d.setDate(today.getDate() - 14)
  return d.toISOString().slice(0, 10)
}

/** Returns a human-readable relative label for a date string. */
function getRelativeDateLabel(dateStr: string): string {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (dateStr === todayStr) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'

  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Generate date chips for the last N days from a start date to today */
function getDateChips(paydayDate: string): { date: string; label: string }[] {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const start = new Date(paydayDate + 'T00:00:00')
  const chips: { date: string; label: string }[] = []

  // Add today and yesterday always at front
  chips.push({ date: todayStr, label: 'Today' })

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)
  if (yesterdayStr >= paydayDate) {
    chips.push({ date: yesterdayStr, label: 'Yesterday' })
  }

  // Add remaining days (skip today and yesterday)
  const cursor = new Date(today)
  cursor.setDate(today.getDate() - 2)
  while (cursor.toISOString().slice(0, 10) >= paydayDate && chips.length < 10) {
    const str = cursor.toISOString().slice(0, 10)
    const d = new Date(str + 'T00:00:00')
    chips.push({
      date: str,
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    })
    cursor.setDate(cursor.getDate() - 1)
  }

  return chips
}

// ============================================================================
// BackfillSheet Component
// ============================================================================

/**
 * BackfillSheet — a guided "Catch me up" flow for new and returning users.
 *
 * Step 1 (paycheck): "When were you last paid?" → log that paycheck on its real date
 * Step 2 (expenses): Quickly add expenses since payday with running tally
 * Step 3 (done): Summary and close
 *
 * Optimized for speed: date shortcuts, repeat-last chips, running "spent since payday" tally.
 */
export function BackfillSheet({
  isOpen,
  onClose,
  onLogExpense,
  onLogIncome,
}: BackfillSheetProps) {
  // ── Flow state ────────────────────────────────────────────────
  const [step, setStep] = useState<BackfillStep>('paycheck')

  // ── Paycheck step state ───────────────────────────────────────
  const [paydayDate, setPaydayDate] = useState(() => getLastFriday(new Date()))
  const [paycheckAmount, setPaycheckAmount] = useState('')
  const [showDateInput, setShowDateInput] = useState(false)

  // ── Expenses step state ───────────────────────────────────────
  const [expenseAmount, setExpenseAmount] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [totalSpent, setTotalSpent] = useState(0)
  const [expenseCount, setExpenseCount] = useState(0)
  const [lastExpense, setLastExpense] = useState<{
    amount: number
    category: TransactionCategory
    label: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Derived ───────────────────────────────────────────────────
  const dateChips = useMemo(() => getDateChips(paydayDate), [paydayDate])

  const today = new Date()
  const lastFridayStr = getLastFriday(today)
  const twoWeeksAgoStr = getTwoWeeksAgo(today)

  // ── Reset state on close ──────────────────────────────────────
  const handleClose = useCallback(() => {
    onClose()
    // Reset after animation completes
    setTimeout(() => {
      setStep('paycheck')
      setPaydayDate(getLastFriday(new Date()))
      setPaycheckAmount('')
      setShowDateInput(false)
      setExpenseAmount('')
      setSelectedCategory(null)
      setSelectedDate(new Date().toISOString().slice(0, 10))
      setTotalSpent(0)
      setExpenseCount(0)
      setLastExpense(null)
    }, 300)
  }, [onClose])

  // ── Paycheck handlers ─────────────────────────────────────────
  const handleLogPaycheck = useCallback(async () => {
    const amount = parseFloat(paycheckAmount)
    if (!amount || amount <= 0) return

    setIsSubmitting(true)
    try {
      await onLogIncome({
        amount,
        date: paydayDate,
        note: 'Paycheck (backfill)',
      })
      setStep('expenses')
    } finally {
      setIsSubmitting(false)
    }
  }, [paycheckAmount, paydayDate, onLogIncome])

  const handleSkipPaycheck = useCallback(() => {
    setStep('expenses')
  }, [])

  // ── Expense handlers ──────────────────────────────────────────
  const handleLogExpense = useCallback(async () => {
    const amount = parseFloat(expenseAmount)
    if (!amount || amount <= 0 || !selectedCategory) return

    setIsSubmitting(true)
    try {
      await onLogExpense({
        amount,
        category: selectedCategory,
        date: selectedDate,
      })
      setTotalSpent(prev => prev + amount)
      setExpenseCount(prev => prev + 1)
      const catItem = EXPENSE_CATEGORIES.find(c => c.category === selectedCategory)
      setLastExpense({
        amount,
        category: selectedCategory,
        label: `${catItem?.emoji ?? ''} ${formatMoney(amount)}`,
      })
      // Clear for next entry
      setExpenseAmount('')
      setSelectedCategory(null)
    } finally {
      setIsSubmitting(false)
    }
  }, [expenseAmount, selectedCategory, selectedDate, onLogExpense])

  const handleRepeatLast = useCallback(async () => {
    if (!lastExpense) return

    setIsSubmitting(true)
    try {
      await onLogExpense({
        amount: lastExpense.amount,
        category: lastExpense.category,
        date: selectedDate,
      })
      setTotalSpent(prev => prev + lastExpense.amount)
      setExpenseCount(prev => prev + 1)
    } finally {
      setIsSubmitting(false)
    }
  }, [lastExpense, selectedDate, onLogExpense])

  const handleFinish = useCallback(() => {
    setStep('done')
  }, [])

  // ── Render ────────────────────────────────────────────────────
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      maxHeight="95vh"
      ariaLabel="Catch up on past spending"
    >
      <div style={{ padding: '20px 24px 24px', fontFamily: FONT_FAMILY }}>
        <AnimatePresence mode="wait">
          {/* ── Step 1: Paycheck ─────────────────────────────────── */}
          {step === 'paycheck' && (
            <motion.div
              key="paycheck"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={timings.normal}
            >
              <h3 style={{
                fontSize: typography.subhead.fontSize,
                fontWeight: fontWeights.bold,
                color: 'var(--text)',
                marginBottom: 6,
              }}>
                When were you last paid?
              </h3>
              <p style={{
                fontSize: typography['body-sm'].fontSize,
                color: 'var(--sub)',
                marginBottom: HORIZONTAL_PADDING,
                lineHeight: 1.5,
              }}>
                We&apos;ll log your paycheck on that date so your budget starts right.
              </p>

              {/* Date shortcuts */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs, marginBottom: 16 }}>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  transition={springs.snappy}
                  onClick={() => { setPaydayDate(lastFridayStr); setShowDateInput(false) }}
                  style={{
                    ...chipButton,
                    background: paydayDate === lastFridayStr && !showDateInput
                      ? 'var(--accent-200)'
                      : 'var(--fill-06)',
                    border: paydayDate === lastFridayStr && !showDateInput
                      ? '1px solid var(--accent-400)'
                      : '1px solid var(--fill-10)',
                  }}
                >
                  Last Friday
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  transition={springs.snappy}
                  onClick={() => { setPaydayDate(twoWeeksAgoStr); setShowDateInput(false) }}
                  style={{
                    ...chipButton,
                    background: paydayDate === twoWeeksAgoStr && !showDateInput
                      ? 'var(--accent-200)'
                      : 'var(--fill-06)',
                    border: paydayDate === twoWeeksAgoStr && !showDateInput
                      ? '1px solid var(--accent-400)'
                      : '1px solid var(--fill-10)',
                  }}
                >
                  2 weeks ago
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  transition={springs.snappy}
                  onClick={() => setShowDateInput(true)}
                  style={{
                    ...chipButton,
                    background: showDateInput
                      ? 'var(--accent-200)'
                      : 'var(--fill-06)',
                    border: showDateInput
                      ? '1px solid var(--accent-400)'
                      : '1px solid var(--fill-10)',
                  }}
                >
                  Pick a date
                </motion.button>
              </div>

              {/* Custom date picker */}
              {showDateInput && (
                <input
                  type="date"
                  value={paydayDate}
                  onChange={(e) => setPaydayDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    marginBottom: spacing.md,
                    fontSize: typography.body.fontSize,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--text)',
                    background: 'var(--fill-04)',
                    border: '1px solid var(--border)',
                    borderRadius: radius.control,
                    outline: 'none',
                  }}
                  aria-label="Select payday date"
                />
              )}

              {/* Selected date display */}
              <p style={{ fontSize: typography['body-sm'].fontSize, color: 'var(--sub)', marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="breakdown:scheduled" size={14} /> Payday: {getRelativeDateLabel(paydayDate)}
              </p>

              {/* Amount input */}
              <label style={{ display: 'block', fontSize: typography['body-sm'].fontSize, color: 'var(--sub)', marginBottom: 6 }}>
                How much was the paycheck?
              </label>
              <div style={{ position: 'relative', marginBottom: HORIZONTAL_PADDING }}>
                <span style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: typography.subhead.fontSize,
                  color: 'var(--sub)',
                  fontWeight: fontWeights.medium,
                }}>
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={paycheckAmount}
                  onChange={(e) => setPaycheckAmount(e.target.value)}
                  placeholder="0"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '14px 14px 14px 32px',
                    fontSize: typography.headline.fontSize,
                    fontWeight: fontWeights.semibold,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--text)',
                    background: 'var(--fill-04)',
                    border: '1px solid var(--border)',
                    borderRadius: radius.control,
                    outline: 'none',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  aria-label="Paycheck amount"
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  onClick={handleLogPaycheck}
                  disabled={isSubmitting || !paycheckAmount || parseFloat(paycheckAmount) <= 0}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    fontSize: typography.body.fontSize,
                    fontWeight: fontWeights.semibold,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--text)',
                    background: paycheckAmount && parseFloat(paycheckAmount) > 0
                      ? 'var(--accent-500)'
                      : 'var(--accent-300)',
                    border: 'none',
                    borderRadius: radius.control,
                    cursor: paycheckAmount && parseFloat(paycheckAmount) > 0 ? 'pointer' : 'not-allowed',
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                  aria-label="Log paycheck and continue"
                >
                  Log paycheck & continue →
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  onClick={handleSkipPaycheck}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    fontSize: typography.body.fontSize,
                    fontWeight: fontWeights.medium,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--sub)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  aria-label="Skip paycheck logging and go straight to expenses"
                >
                  Skip — I&apos;ll start fresh
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Expenses ─────────────────────────────────── */}
          {step === 'expenses' && (
            <motion.div
              key="expenses"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={timings.normal}
            >
              {/* Running tally */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing.md,
              }}>
                <h3 style={{
                  fontSize: typography.body.fontSize,
                  fontWeight: fontWeights.bold,
                  color: 'var(--text)',
                  margin: 0,
                }}>
                  Add recent expenses
                </h3>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  background: 'var(--error-100)',
                  borderRadius: radius.full,
                  fontSize: typography['body-sm'].fontSize,
                  fontWeight: fontWeights.semibold,
                  color: 'var(--error)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  <span>−${totalSpent.toFixed(0)}</span>
                  <span style={{ fontSize: typography.caption.fontSize, fontWeight: fontWeights.regular, color: 'var(--sub)' }}>
                    ({expenseCount})
                  </span>
                </div>
              </div>

              <p style={{
                fontSize: typography['body-sm'].fontSize,
                color: 'var(--sub)',
                marginBottom: 14,
                lineHeight: 1.5,
              }}>
                Tap a category, enter the amount, and log. Repeat until you&apos;re caught up.
              </p>

              {/* Date chips */}
              <div style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                marginBottom: 14,
                paddingBottom: 4,
              }}>
                {dateChips.map(chip => (
                  <motion.button
                    key={chip.date}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    transition={springs.snappy}
                    onClick={() => setSelectedDate(chip.date)}
                    style={{
                      flexShrink: 0,
                      padding: '6px 12px',
                      fontSize: typography['body-sm'].fontSize,
                      fontWeight: fontWeights.medium,
                      fontFamily: FONT_FAMILY,
                      color: selectedDate === chip.date ? 'var(--text)' : 'var(--sub)',
                      background: selectedDate === chip.date
                        ? 'var(--accent-200)'
                        : 'var(--fill-04)',
                      border: selectedDate === chip.date
                        ? '1px solid var(--accent-400)'
                        : '1px solid var(--fill-08)',
                      borderRadius: radius.full,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    aria-label={`Select date ${chip.label}`}
                    aria-pressed={selectedDate === chip.date}
                  >
                    {chip.label}
                  </motion.button>
                ))}
              </div>

              {/* Category grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: spacing.xs,
                marginBottom: 14,
              }}>
                {EXPENSE_CATEGORIES.map(cat => (
                  <motion.button
                    key={cat.category}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    transition={springs.snappy}
                    onClick={() => setSelectedCategory(cat.category)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '12px 8px',
                      fontSize: typography['body-sm'].fontSize,
                      fontWeight: fontWeights.medium,
                      fontFamily: FONT_FAMILY,
                      color: selectedCategory === cat.category ? 'var(--text)' : 'var(--sub)',
                      background: selectedCategory === cat.category
                        ? 'var(--accent-200)'
                        : 'var(--fill-03)',
                      border: selectedCategory === cat.category
                        ? '1px solid var(--accent-300)'
                        : '1px solid var(--fill-08)',
                      borderRadius: radius.control,
                      cursor: 'pointer',
                    }}
                    aria-label={`Select category ${cat.label}`}
                    aria-pressed={selectedCategory === cat.category}
                  >
                    <span style={{ fontSize: typography.subhead.fontSize }} aria-hidden="true">{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </motion.button>
                ))}
              </div>

              {/* Amount input */}
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <span style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: typography.subhead.fontSize,
                  color: 'var(--sub)',
                  fontWeight: fontWeights.medium,
                }}>
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 32px',
                    fontSize: typography.subhead.fontSize,
                    fontWeight: fontWeights.semibold,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--text)',
                    background: 'var(--fill-04)',
                    border: '1px solid var(--border)',
                    borderRadius: radius.control,
                    outline: 'none',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  aria-label="Expense amount"
                />
              </div>

              {/* Action row: Log + Repeat Last */}
              <div style={{ display: 'flex', gap: spacing.xs, marginBottom: 14 }}>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  onClick={handleLogExpense}
                  disabled={isSubmitting || !selectedCategory || !expenseAmount || parseFloat(expenseAmount) <= 0}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    fontSize: typography.body.fontSize,
                    fontWeight: fontWeights.semibold,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--text)',
                    background: selectedCategory && expenseAmount && parseFloat(expenseAmount) > 0
                      ? 'var(--accent-500)'
                      : 'var(--accent-300)',
                    border: 'none',
                    borderRadius: radius.control,
                    cursor: selectedCategory && expenseAmount && parseFloat(expenseAmount) > 0
                      ? 'pointer'
                      : 'not-allowed',
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                  aria-label="Log this expense"
                >
                  Log
                </motion.button>

                {lastExpense && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={springs.snappy}
                    onClick={handleRepeatLast}
                    disabled={isSubmitting}
                    style={{
                      ...chipButton,
                      opacity: isSubmitting ? 0.6 : 1,
                    }}
                    aria-label={`Repeat last expense: ${lastExpense.label}`}
                  >
                    <Icon name="category:subscriptions" size={14} /> {lastExpense.label}
                  </motion.button>
                )}
              </div>

              {/* Done button */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                onClick={handleFinish}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  fontSize: typography.body.fontSize,
                  fontWeight: fontWeights.medium,
                  fontFamily: FONT_FAMILY,
                  color: 'var(--sub)',
                  background: 'none',
                  border: '1px solid var(--fill-10)',
                  borderRadius: radius.control,
                  cursor: 'pointer',
                }}
                aria-label="Finish adding expenses"
              >
                Done — that&apos;s everything ✓
              </motion.button>
            </motion.div>
          )}

          {/* ── Step 3: Done ──────────────────────────────────────── */}
          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={timings.normal}
              style={{ textAlign: 'center', padding: '20px 0' }}
            >
              <p style={{ fontSize: typography.title.fontSize, marginBottom: spacing.sm }} aria-hidden="true">✨</p>
              <h3 style={{
                fontSize: typography.subhead.fontSize,
                fontWeight: fontWeights.bold,
                color: 'var(--text)',
                marginBottom: spacing.xs,
              }}>
                All caught up!
              </h3>
              <p style={{
                fontSize: typography.body.fontSize,
                color: 'var(--sub)',
                marginBottom: 6,
                lineHeight: 1.5,
              }}>
                {expenseCount > 0
                  ? `You logged ${expenseCount} expense${expenseCount === 1 ? '' : 's'} totaling ${formatMoney(totalSpent)}.`
                  : 'You\'re starting fresh — your daily budget is ready.'}
              </p>
              <p style={{
                fontSize: typography['body-sm'].fontSize,
                color: 'var(--muted)',
                marginBottom: spacing.lg,
              }}>
                Your daily allowance will now reflect this history.
              </p>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                onClick={handleClose}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  fontSize: typography.body.fontSize,
                  fontWeight: fontWeights.semibold,
                  fontFamily: FONT_FAMILY,
                  color: 'var(--text)',
                  background: 'var(--accent-500)',
                  border: 'none',
                  borderRadius: radius.control,
                  cursor: 'pointer',
                }}
                aria-label="Close and return to home"
              >
                Back to Folio →
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BottomSheet>
  )
}
