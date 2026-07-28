"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { triggerHaptic } from '@/lib/haptics'
import { useToast } from '@/contexts/ToastContext'
import type { Transaction, TransactionCategory } from '@/types'
import { getCategoryEmoji } from '@/lib/vocabulary'
import { FONT_FAMILY } from '@/styles/typography'

interface EditTransactionSheetProps {
  isOpen: boolean
  onClose: () => void
  /** The transaction being edited */
  transaction: Transaction | null
  /** Called with the updated fields — performs optimistic update */
  onSave: (
    id: string,
    data: { amount: number; category: TransactionCategory; note?: string }
  ) => Promise<Transaction | null>
  /** Called when user taps "Refund this" */
  onRefund?: (transaction: Transaction) => void
}

const CATEGORY_GRID: { category: TransactionCategory; emoji: string; label: string }[] = [
  { category: 'food', emoji: getCategoryEmoji('food'), label: 'Food' },
  { category: 'transport', emoji: getCategoryEmoji('transport'), label: 'Transport' },
  { category: 'fun', emoji: getCategoryEmoji('fun'), label: 'Fun' },
  { category: 'school', emoji: getCategoryEmoji('school'), label: 'School' },
  { category: 'rent', emoji: getCategoryEmoji('rent'), label: 'Rent' },
  { category: 'other', emoji: getCategoryEmoji('other'), label: 'Other' },
]

const MAX_AMOUNT = 99999

/**
 * EditTransactionSheet — bottom sheet for editing an existing transaction.
 *
 * Allows editing amount, category, and note. Shows an undo toast after saving
 * for reversibility. Includes a "Refund this" link for quick refund flow.
 *
 * **Validates: Requirements 10.1, 10.5**
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

    const result = await onSave(transaction.id, {
      amount: parsed,
      category,
      note: note.trim() || undefined,
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
          })
          showToast('Change reverted')
        },
      })
      onClose()
    } else {
      showToast('Failed to save — try again', 'error')
    }
  }, [transaction, amount, category, note, isSaving, onSave, onClose, showToast])

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
      (note.trim() || undefined) !== (transaction.note || undefined)
    )
  })()

  return (
    <BottomSheet isOpen={isOpen && !!transaction} onClose={onClose} ariaLabel="Edit transaction" preventClose={isSaving}>
      {transaction && (
        <div style={{ padding: '0 24px 32px' }}>
              {/* ── Header ────────────────────────────────────── */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <p style={{
                  fontSize: 15,
                  fontFamily: FONT_FAMILY,
                  fontWeight: 600,
                  color: 'var(--text)',
                }}>
                  Edit transaction
                </p>
                <p style={{
                  fontSize: 12,
                  fontFamily: FONT_FAMILY,
                  color: 'var(--muted)',
                  marginTop: 4,
                }}>
                  {transaction.date}
                </p>
              </div>

              {/* ── Amount Input ──────────────────────────────── */}
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'center',
                  gap: 4,
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
                      color: 'var(--text)',
                      textAlign: 'center',
                      width: '100%',
                      maxWidth: 240,
                      caretColor: 'var(--text)',
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
                    gap: 10,
                    marginBottom: 24,
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
                          gap: 8,
                          cursor: 'pointer',
                          ...(selected
                            ? {
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
                        <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden="true">
                          {cat.emoji}
                        </span>
                        <span style={{
                          fontFamily: FONT_FAMILY,
                          fontSize: 12,
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
                <div style={{ marginBottom: 28 }}>
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
                        borderBottom: '1px solid var(--line)',
                        outline: 'none',
                        fontSize: 15,
                        fontFamily: FONT_FAMILY,
                        color: 'var(--text)',
                        padding: '12px 0',
                        caretColor: 'var(--text)',
                      }}
                    />
                    {note.length >= 50 && (
                      <span style={{
                        position: 'absolute',
                        right: 0,
                        bottom: 14,
                        fontSize: 11,
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
                    ? 'linear-gradient(135deg, #a78bfa, #7c3aed)'
                    : 'var(--dim)',
                  color: canSubmit && hasChanges ? '#fff' : 'var(--muted)',
                  fontFamily: FONT_FAMILY,
                  fontSize: 16,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: canSubmit && hasChanges ? 'pointer' : 'not-allowed',
                  opacity: canSubmit && hasChanges ? 1 : 0.5,
                }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>

              {/* ── Refund Link (only for expenses) ───────────── */}
              {transaction.type === 'expense' && onRefund && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={handleRefund}
                    aria-label="Refund this transaction"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 500,
                      color: 'var(--success)',
                      padding: '8px 16px',
                      opacity: 0.9,
                    }}
                  >
                    ↩ Refund this
                  </button>
                </div>
              )}
            </div>
      )}
    </BottomSheet>
  )
}
