"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { Sheet } from '@/components/ui/primitives/Sheet'
import { triggerHaptic } from '@/lib/haptics'
import { useToast } from '@/contexts/ToastContext'
import type { Transaction, TransactionCategory } from '@/types'
import { getCategoryEmoji } from '@/lib/vocabulary'
import { FONT_FAMILY, spacing, pxToRem } from '@/styles/typography'
import { shadows, fills, colorRamp } from '@/styles/shared'
import { gradients } from '@/styles/colors'
import { DatePickerChips, getRelativeDateLabel } from '@/components/ui/DatePickerChips'

interface EditTransactionSheetProps {
  isOpen: boolean
  onClose: () => void
  /** The transaction being edited */
  transaction: Transaction | null
  /** Called with the updated fields — performs optimistic update */
  onSave: (
    id: string,
    data: { amount: number; category: TransactionCategory; note?: string; date?: string }
  ) => Promise<Transaction | null>
  /** Called when user taps "Refund this" */
  onRefund?: (transaction: Transaction) => void
}

const CATEGORY_GRID: { category: TransactionCategory; emoji: string; label: string }[] = [
  { category: 'food', emoji: getCategoryEmoji('food'), label: 'Food' },
  { category: 'drinks', emoji: getCategoryEmoji('drinks'), label: 'Drinks' },
  { category: 'transport', emoji: getCategoryEmoji('transport'), label: 'Transportation' },
  { category: 'fun', emoji: getCategoryEmoji('fun'), label: 'Fun' },
  { category: 'school', emoji: getCategoryEmoji('school'), label: 'School' },
  { category: 'rent', emoji: getCategoryEmoji('rent'), label: 'Rent' },
  { category: 'other', emoji: getCategoryEmoji('other'), label: 'Other' },
]

const MAX_AMOUNT = 99999

/**
 * EditTransactionSheet — bottom sheet for editing an existing transaction.
 *
 * Allows editing amount, category, note, and date. Shows an undo toast after
 * saving for reversibility. Includes a "Refund this" link for quick refund flow.
 *
 * **Validates: Requirements 10.1, 10.5, Task 92.1**
 */
export function EditTransactionSheet({
  isOpen,
  onClose,
  transaction,
  onSave,
  onRefund,
}: EditTransactionSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const { showToast } = useToast()
  const amountRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<TransactionCategory>('other')
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')
  const [showNoteField, setShowNoteField] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Pre-populate with existing transaction values when opening
  useEffect(() => {
    if (isOpen && transaction) {
      setAmount(
        transaction.amount % 1 === 0
          ? String(transaction.amount)
          : transaction.amount.toFixed(2)
      )
      setCategory(transaction.category)
      setNote(transaction.note ?? '')
      setDate(transaction.date)
      setShowNoteField(!!transaction.note)
      setIsSaving(false)
    }
  }, [isOpen, transaction])

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    const parts = raw.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    const numeric = parseFloat(raw)
    if (numeric > MAX_AMOUNT) return
    setAmount(raw)
  }, [])

  const handleNoteChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value
      .replace(/<[^>]*>/g, '')
      .replace(/&[a-z]+;/gi, ' ')
      .slice(0, 60)
    setNote(sanitized)
    if (sanitized && !showNoteField) {
      setShowNoteField(true)
    }
  }, [showNoteField])

  const handleSave = useCallback(async () => {
    if (!transaction || isSaving) return
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0 || parsed > MAX_AMOUNT) return

    setIsSaving(true)

    // Capture old values for undo
    const oldAmount = transaction.amount
    const oldCategory = transaction.category
    const oldNote = transaction.note
    const oldDate = transaction.date

    const result = await onSave(transaction.id, {
      amount: parsed,
      category,
      note: note.trim() || undefined,
      date: date !== transaction.date ? date : undefined,
    })

    setIsSaving(false)

    if (result) {
      showToast('Transaction updated ✓', 'success', {
        label: 'Undo',
        onClick: () => {
          // Revert to original values
          onSave(transaction.id, {
            amount: oldAmount,
            category: oldCategory,
            note: oldNote,
            date: oldDate,
          })
          showToast('Change reverted')
        },
      })
      onClose()
    } else {
      showToast('Failed to save — try again', 'error')
    }
  }, [transaction, amount, category, note, date, isSaving, onSave, onClose, showToast])

  const handleRefund = useCallback(() => {
    if (!transaction || !onRefund) return
    onClose()
    // Small delay for sheet close animation before opening refund sheet
    setTimeout(() => onRefund(transaction), 200)
  }, [transaction, onRefund, onClose])

  const canSubmit = (() => {
    const parsed = parseFloat(amount)
    return !!parsed && parsed > 0 && parsed <= MAX_AMOUNT && !isSaving
  })()

  // Check if anything changed
  const hasChanges = (() => {
    if (!transaction) return false
    const parsed = parseFloat(amount)
    if (!parsed) return false
    return (
      parsed !== transaction.amount ||
      category !== transaction.category ||
      date !== transaction.date ||
      (note.trim() || undefined) !== (transaction.note || undefined)
    )
  })()

  return (
    <Sheet open={isOpen && !!transaction} onClose={onClose} size="half" aria-label="Edit transaction">
      {transaction && (
        <div style={{ padding: `0 ${spacing.lg}px ${spacing.xl}px` }}>
              {/* ── Header ────────────────────────────────────── */}
              <div style={{ textAlign: 'center', marginBottom: spacing.md }}>
                <p style={{
                  fontSize: pxToRem(18),
                  fontFamily: FONT_FAMILY,
                  fontWeight: 700,
                  color: 'var(--text)',
                }}>
                  Edit transaction
                </p>
                <p style={{
                  fontSize: pxToRem(12),
                  fontFamily: FONT_FAMILY,
                  color: 'var(--muted)',
                  marginTop: spacing.xxs,
                }}>
                  {getRelativeDateLabel(date)}
                </p>
              </div>

              {/* ── Date Picker ───────────────────────────────── */}
              <div style={{ marginBottom: spacing.lg, textAlign: 'center' }}>
                <DatePickerChips
                  selectedDate={date}
                  onDateChange={setDate}
                  allowFutureDates={false}
                />
              </div>

              {/* ── Amount Input ──────────────────────────────── */}
              <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'center',
                  gap: spacing.xxs,
                }}>
                  <span style={{
                    fontSize: 28,
                    fontFamily: FONT_FAMILY,
                    fontWeight: 300,
                    color: transaction.type === 'income' ? 'var(--success)' : 'var(--muted)',
                  }}>
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
                      if (e.key === 'Enter' && canSubmit && hasChanges) {
                        e.preventDefault()
                        handleSave()
                      }
                    }}
                    aria-label="Transaction amount"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 48,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--text)',
                      textAlign: 'center',
                      width: '100%',
                      maxWidth: 240,
                      caretColor: 'var(--accent)',
                      lineHeight: 1.1,
                    }}
                  />
                </div>
              </div>

              {/* ── Category Grid ────────────────────────────── */}
              {transaction.type === 'expense' && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: spacing.sm,
                    marginBottom: spacing.lg,
                  }}
                  role="group"
                  aria-label="Transaction category"
                >
                  {CATEGORY_GRID.map((cat) => {
                    const selected = category === cat.category
                    return (
                      <motion.button
                        key={cat.category}
                        type="button"
                        onClick={() => { setCategory(cat.category); triggerHaptic('light') }}
                        aria-label={`Category: ${cat.label}`}
                        aria-pressed={selected}
                        whileTap={prefersReducedMotion ? {} : { scale: 0.94 }}
                        transition={springs.snappy}
                        style={{
                          minHeight: 72,
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: spacing.xs,
                          cursor: 'pointer',
                          ...(selected
                            ? {
                                background: colorRamp.accent[100],
                                border: `1.5px solid ${colorRamp.accent[400]}`,
                                boxShadow: shadows.glowAccent,
                              }
                            : {
                                background: fills[3],
                                border: `1px solid ${fills[6]}`,
                              }),
                        }}
                      >
                        <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden="true">
                          {cat.emoji}
                        </span>
                        <span style={{
                          fontFamily: FONT_FAMILY,
                          fontSize: pxToRem(12),
                          fontWeight: 500,
                          color: selected ? 'var(--text)' : 'var(--sub)',
                        }}>
                          {cat.label}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              )}

              {/* ── Note Input ────────────────────────────────── */}
              {!showNoteField && !note ? (
                <div style={{ marginBottom: spacing.xl, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowNoteField(true)}
                    aria-label="Add a note"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 'var(--radius-md)',
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      minHeight: 44,
                      fontSize: pxToRem(13),
                      fontFamily: FONT_FAMILY,
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
                <div style={{ marginBottom: spacing.xl }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="What's this for?"
                      value={note}
                      onChange={handleNoteChange}
                      maxLength={60}
                      aria-label="Transaction note"
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1.5px solid var(--line)',
                        outline: 'none',
                        fontSize: pxToRem(15),
                        fontFamily: FONT_FAMILY,
                        color: 'var(--text)',
                        padding: `${spacing.sm}px 0`,
                        caretColor: 'var(--accent)',
                        transition: 'border-color 0.2s ease',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
                      onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'var(--line)' }}
                    />
                    {note.length >= 50 && (
                      <span style={{
                        position: 'absolute',
                        right: 0,
                        bottom: 14,
                        fontSize: pxToRem(11),
                        fontFamily: FONT_FAMILY,
                        fontWeight: 400,
                        color: 'var(--muted)',
                      }}>
                        {note.length}/60
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ── Save Button ───────────────────────────────── */}
              <button
                onClick={handleSave}
                disabled={!canSubmit || !hasChanges}
                aria-label="Save changes"
                style={{
                  width: '100%',
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: canSubmit && hasChanges
                    ? gradients.action
                    : 'var(--dim)',
                  color: canSubmit && hasChanges ? 'var(--color-canvas)' : 'var(--muted)',
                  fontFamily: FONT_FAMILY,
                  fontSize: pxToRem(16),
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: canSubmit && hasChanges ? 'pointer' : 'not-allowed',
                  opacity: canSubmit && hasChanges ? 1 : 0.5,
                  boxShadow: canSubmit && hasChanges ? shadows.glowAccentStrong : 'none',
                  transition: 'opacity 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>

              {/* ── Refund Link (only for expenses) ───────────── */}
              {transaction.type === 'expense' && onRefund && (
                <div style={{ textAlign: 'center', marginTop: spacing.md }}>
                  <button
                    type="button"
                    onClick={handleRefund}
                    aria-label="Refund this transaction"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: pxToRem(13),
                      fontFamily: FONT_FAMILY,
                      fontWeight: 500,
                      color: 'var(--success)',
                      padding: `${spacing.xs}px ${spacing.md}px`,
                      minHeight: 44,
                      opacity: 0.9,
                    }}
                  >
                    ↩ Refund this
                  </button>
                </div>
              )}
            </div>
      )}
    </Sheet>
  )
}
