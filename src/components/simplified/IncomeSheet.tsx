"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, timings, useReducedMotion } from '@/lib/animations'
import { useToast } from '@/contexts/ToastContext'

interface IncomeSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { amount: number; note?: string }) => void
  /** Called after successful submit to show PaycheckSheet. Receives the logged amount. */
  onShowPaycheck?: (amount: number) => void
}

const MAX_AMOUNT = 99999

export function IncomeSheet({ isOpen, onClose, onSubmit, onShowPaycheck }: IncomeSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const { showToast } = useToast()
  const amountRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [showNoteField, setShowNoteField] = useState(false)

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setNote('')
      setShowNoteField(false)
      setTimeout(() => amountRef.current?.focus(), 120)
    }
  }, [isOpen])

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
  }, [showNoteField])

  const handleSubmit = useCallback(() => {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0 || parsed > MAX_AMOUNT) return

    const data = { amount: parsed, note: note.trim() || undefined }
    onSubmit(data)

    // Show success toast
    const formatted = parsed % 1 === 0 ? `$${parsed}` : `$${parsed.toFixed(2)}`
    showToast(`Logged +${formatted} income ✓`, 'success')

    // Trigger PaycheckSheet if handler provided
    if (onShowPaycheck) {
      onShowPaycheck(parsed)
    }

    onClose()
  }, [amount, note, onSubmit, onClose, showToast, onShowPaycheck])

  const canSubmit = (() => {
    const parsed = parseFloat(amount)
    return !!parsed && parsed > 0 && parsed <= MAX_AMOUNT
  })()

  // Sheet animation variants
  const sheetVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: timings.fast },
        exit: { opacity: 0, transition: timings.fast },
      }
    : {
        hidden: { y: '100%' },
        visible: { y: 0, transition: springs.gentle },
        exit: { y: '100%', transition: timings.normal },
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
            key="income-backdrop"
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
            key="income-sheet"
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
                      color: 'var(--success)',
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
                    aria-label="Income amount"
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
                  How much did you earn?
                </p>
              </div>

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
                      aria-label="Income note"
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
                </div>
              )}

              {/* ── Done Button ──────────────────────────────────────── */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-label="Done — log income"
                style={{
                  width: '100%',
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: canSubmit
                    ? 'linear-gradient(135deg, #4ade80, #22c55e)'
                    : 'var(--dim)',
                  color: canSubmit ? '#fff' : 'var(--muted)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 16,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  opacity: canSubmit ? 1 : 0.5,
                }}
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
