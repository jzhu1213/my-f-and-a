"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useToast } from '@/contexts/ToastContext'
import { FONT_FAMILY } from '@/styles/typography'
import { borderRadius } from '@/styles/shared'

interface IncomeSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { amount: number; note?: string }) => void
  /** Called after successful submit to show PaycheckSheet. Receives the logged amount and gig flag. */
  onShowPaycheck?: (amount: number, isGigIncome?: boolean) => void
  /** Called when user taps Undo on the success toast */
  onUndo?: () => void
}

const MAX_AMOUNT = 99999

export function IncomeSheet({ isOpen, onClose, onSubmit, onShowPaycheck, onUndo }: IncomeSheetProps) {
  const { showToast } = useToast()
  const amountRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [showNoteField, setShowNoteField] = useState(false)
  const [isGigIncome, setIsGigIncome] = useState(false)

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setNote('')
      setShowNoteField(false)
      setIsGigIncome(false)
      // Task 73: removed setTimeout for instant focus
      amountRef.current?.focus()
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

    // Show success toast with undo action
    const formatted = parsed % 1 === 0 ? `$${parsed}` : `$${parsed.toFixed(2)}`
    showToast(
      `Logged +${formatted} income ✓`,
      'success',
      onUndo ? { label: 'Undo', onClick: onUndo } : undefined
    )

    // Trigger PaycheckSheet if handler provided
    if (onShowPaycheck) {
      onShowPaycheck(parsed, isGigIncome || undefined)
    }

    onClose()
  }, [amount, note, isGigIncome, onSubmit, onClose, onUndo, showToast, onShowPaycheck])

  const canSubmit = (() => {
    const parsed = parseFloat(amount)
    return !!parsed && parsed > 0 && parsed <= MAX_AMOUNT
  })()

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} minHeight="50vh" ariaLabel="Log income">
      <div style={{ padding: '0 24px 32px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              {/* ── Amount Input (calculator-style) ─────────────────── */}
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                {/* Quick income presets — common student amounts (task 65) */}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                  aria-label="Quick income amounts"
                >
                  {[20, 50, 100, 200].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(String(preset))}
                      aria-label={`Set amount to $${preset}`}
                      style={{
                        padding: '8px 14px',
                        background: amount === String(preset)
                          ? 'rgba(74, 222, 128, 0.12)'
                          : 'rgba(255, 255, 255, 0.04)',
                        border: amount === String(preset)
                          ? '1px solid rgba(74, 222, 128, 0.4)'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: borderRadius.full,
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 500,
                        fontFamily: FONT_FAMILY,
                        color: amount === String(preset) ? 'var(--success)' : 'var(--text)',
                      }}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>

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
                      fontFamily: FONT_FAMILY,
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
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--muted)',
                    marginTop: 8,
                    fontFamily: FONT_FAMILY,
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
                      aria-label="Income note"
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
                    {/* Character count indicator — shown when 50+ chars */}
                    {note.length >= 50 && (
                      <span
                        style={{
                          position: 'absolute',
                          right: 0,
                          bottom: 14,
                          fontSize: 11,
                          fontFamily: FONT_FAMILY,
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

              {/* ── Gig / Freelance Income Toggle ─────────────────────────── */}
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsGigIncome(!isGigIncome)}
                  aria-label={isGigIncome ? 'Marked as gig income' : 'Mark as gig or freelance income'}
                  aria-pressed={isGigIncome}
                  style={{
                    background: isGigIncome
                      ? 'rgba(251, 191, 36, 0.15)'
                      : 'transparent',
                    border: isGigIncome
                      ? '1px solid rgba(251, 191, 36, 0.4)'
                      : '1px dashed rgba(255, 255, 255, 0.15)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 16px',
                    fontSize: 13,
                    fontFamily: FONT_FAMILY,
                    fontWeight: isGigIncome ? 500 : 400,
                    color: isGigIncome ? '#fbbf24' : 'var(--sub)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{isGigIncome ? '✓' : '💼'}</span>
                  {isGigIncome ? 'Gig / freelance income' : 'This is gig / freelance income'}
                </button>
              </div>

              {/* ── Done Button (thumb zone — pinned at bottom of sheet) ── */}
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
                  marginTop: 'auto',
                  background: canSubmit
                    ? 'linear-gradient(135deg, #4ade80, #22c55e)'
                    : 'var(--dim)',
                  color: canSubmit ? '#fff' : 'var(--muted)',
                  fontFamily: FONT_FAMILY,
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
    </BottomSheet>
  )
}
