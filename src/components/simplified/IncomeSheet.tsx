"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useToast } from '@/contexts/ToastContext'
import { FONT_FAMILY } from '@/styles/typography'
import { borderRadius } from '@/styles/shared'
import type { FundingSource } from '@/lib/fundingSources'
import { predictFundingSource } from '@/lib/fundingSources'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { triggerHaptic } from '@/lib/haptics'
import type { Transaction } from '@/types'

// ── Date picker helpers ──────────────────────────────────────────────────────

/** Returns YYYY-MM-DD of the most recent Friday (or today if today is Friday) */
function getLastFriday(today: Date): string {
  const d = new Date(today)
  const day = d.getDay() // 0=Sun, 5=Fri
  const diff = day >= 5 ? day - 5 : day + 2
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

/** Returns a human-readable label for a date string */
function getDateLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  // Format as "Mon D" for other dates
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface IncomeSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { amount: number; note?: string; fundingSourceId?: string; date?: string }) => void
  /** Called after successful submit to show PaycheckSheet. Receives the logged amount and gig flag. */
  onShowPaycheck?: (amount: number, isGigIncome?: boolean) => void
  /** Called when user taps Undo on the success toast */
  onUndo?: () => void
  /** Available funding sources (payment methods) for the user */
  fundingSources?: FundingSource[]
  /** User's transaction history for smart source prediction */
  transactions?: Transaction[]
  /** Called when user wants to create a disbursement from this income (financial aid spread) */
  onCreateDisbursement?: (data: { amount: number; coverMonths: number; label: string }) => void
}

const MAX_AMOUNT = 99999

export function IncomeSheet({ isOpen, onClose, onSubmit, onShowPaycheck, onUndo, fundingSources = [], transactions = [], onCreateDisbursement }: IncomeSheetProps) {
  const { showToast } = useToast()
  const { prefersReducedMotion } = useReducedMotion()
  const amountRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [showNoteField, setShowNoteField] = useState(false)
  const [isGigIncome, setIsGigIncome] = useState(false)
  const [isFinancialAid, setIsFinancialAid] = useState(false)
  const [showSpreadPrompt, setShowSpreadPrompt] = useState(false)
  const [spreadMonths, setSpreadMonths] = useState(4)

  // ── Date picker state (task 87.2) ──────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showCustomDateInput, setShowCustomDateInput] = useState(false)

  // ── Funding source selection state (task 81.1) ─────────────────────────
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [showSourcePicker, setShowSourcePicker] = useState(false)

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setNote('')
      setShowNoteField(false)
      setIsGigIncome(false)
      setIsFinancialAid(false)
      setShowSpreadPrompt(false)
      setSpreadMonths(4)
      setSelectedDate(new Date().toISOString().slice(0, 10))
      setShowDatePicker(false)
      setShowCustomDateInput(false)
      
      // Smart source prediction for income (task 81.2)
      // Use 'income' category for prediction
      const predictedSourceId = predictFundingSource(transactions, 'income', fundingSources, new Date())
      // Fall back to first source if no prediction
      setSelectedSourceId(predictedSourceId ?? (fundingSources.length > 0 ? fundingSources[0].id : null))
      setShowSourcePicker(false)
      
      // Task 73: removed setTimeout for instant focus
      amountRef.current?.focus()
    }
  }, [isOpen, fundingSources, transactions])

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

    const data = {
      amount: parsed,
      note: note.trim() || undefined,
      fundingSourceId: selectedSourceId || undefined,
      date: selectedDate,
    }
    onSubmit(data)

    // If financial aid toggle is on, show spread prompt or create disbursement
    if (isFinancialAid && onCreateDisbursement) {
      onCreateDisbursement({
        amount: parsed,
        coverMonths: spreadMonths,
        label: note.trim() || 'Financial Aid',
      })
    }

    // Show success toast with undo action
    const formatted = parsed % 1 === 0 ? `$${parsed}` : `$${parsed.toFixed(2)}`
    const suffix = isFinancialAid ? ` (spread over ${spreadMonths}mo)` : ''
    showToast(
      `Logged +${formatted} income${suffix} ✓`,
      'success',
      onUndo ? { label: 'Undo', onClick: onUndo } : undefined
    )

    // Trigger PaycheckSheet if handler provided
    if (onShowPaycheck) {
      onShowPaycheck(parsed, isGigIncome || undefined)
    }

    onClose()
  }, [amount, note, isGigIncome, isFinancialAid, spreadMonths, selectedSourceId, selectedDate, onSubmit, onClose, onUndo, showToast, onShowPaycheck, onCreateDisbursement])

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

                {/* ── Source Chip (optional, task 81.1) ────────────────── */}
                {fundingSources.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSourcePicker(!showSourcePicker)
                        triggerHaptic('light')
                      }}
                      aria-label={
                        selectedSourceId
                          ? `Payment method: ${fundingSources.find(s => s.id === selectedSourceId)?.label ?? 'Unknown'}`
                          : 'Select payment method'
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: borderRadius.full,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontFamily: FONT_FAMILY,
                        fontWeight: 500,
                        color: 'var(--sub)',
                      }}
                    >
                      <span style={{ fontSize: 14 }} aria-hidden="true">
                        {selectedSourceId
                          ? fundingSources.find(s => s.id === selectedSourceId)?.emoji ?? '💳'
                          : '💳'}
                      </span>
                      <span>
                        {selectedSourceId
                          ? fundingSources.find(s => s.id === selectedSourceId)?.label ?? 'Payment method'
                          : 'Payment method'}
                      </span>
                    </button>

                    {/* Source picker overlay */}
                    <AnimatePresence>
                      {showSourcePicker && (
                        <motion.div
                          key="source-picker"
                          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                          transition={springs.snappy}
                          style={{
                            marginTop: 10,
                            padding: 12,
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 'var(--radius-md)',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                            gap: 8,
                          }}
                        >
                          {fundingSources.map((source) => (
                            <button
                              key={source.id}
                              type="button"
                              onClick={() => {
                                setSelectedSourceId(source.id)
                                setShowSourcePicker(false)
                                triggerHaptic('light')
                              }}
                              aria-label={`Use ${source.label}`}
                              aria-pressed={selectedSourceId === source.id}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 4,
                                padding: '10px 8px',
                                background: selectedSourceId === source.id
                                  ? 'rgba(74, 222, 128, 0.12)'
                                  : 'transparent',
                                border: selectedSourceId === source.id
                                  ? '1px solid rgba(74, 222, 128, 0.4)'
                                  : '1px solid transparent',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                fontSize: 11,
                                fontFamily: FONT_FAMILY,
                                fontWeight: 500,
                                color: selectedSourceId === source.id ? 'var(--text)' : 'var(--sub)',
                              }}
                            >
                              <span style={{ fontSize: 20 }} aria-hidden="true">
                                {source.emoji}
                              </span>
                              <span style={{ textAlign: 'center', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {source.label}
                              </span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
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

              {/* ── Financial Aid / Scholarship Toggle ────────────────────── */}
              {onCreateDisbursement && (
                <div style={{ marginBottom: 28, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFinancialAid(!isFinancialAid)
                      if (!isFinancialAid) setShowSpreadPrompt(true)
                      else setShowSpreadPrompt(false)
                    }}
                    aria-label={isFinancialAid ? 'Marked as financial aid' : 'Mark as financial aid or scholarship'}
                    aria-pressed={isFinancialAid}
                    style={{
                      background: isFinancialAid
                        ? 'rgba(129, 140, 248, 0.15)'
                        : 'transparent',
                      border: isFinancialAid
                        ? '1px solid rgba(129, 140, 248, 0.4)'
                        : '1px dashed rgba(255, 255, 255, 0.15)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 16px',
                      fontSize: 13,
                      fontFamily: FONT_FAMILY,
                      fontWeight: isFinancialAid ? 500 : 400,
                      color: isFinancialAid ? '#818cf8' : 'var(--sub)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{isFinancialAid ? '✓' : '🎓'}</span>
                    {isFinancialAid ? 'Financial aid / scholarship' : 'This is financial aid / scholarship'}
                  </button>

                  {/* Spread across semester prompt */}
                  <AnimatePresence>
                    {isFinancialAid && showSpreadPrompt && (
                      <motion.div
                        key="spread-prompt"
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                        transition={springs.snappy}
                        style={{
                          marginTop: 12,
                          padding: '12px 16px',
                          background: 'rgba(129, 140, 248, 0.08)',
                          border: '1px solid rgba(129, 140, 248, 0.2)',
                          borderRadius: 'var(--radius-md)',
                          textAlign: 'center',
                        }}
                      >
                        <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 10px', fontFamily: FONT_FAMILY }}>
                          Spread this across the semester?
                        </p>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {[3, 4, 5, 6].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setSpreadMonths(m)}
                              aria-label={`Spread over ${m} months`}
                              aria-pressed={spreadMonths === m}
                              style={{
                                padding: '6px 12px',
                                background: spreadMonths === m
                                  ? 'rgba(129, 140, 248, 0.2)'
                                  : 'rgba(255, 255, 255, 0.04)',
                                border: spreadMonths === m
                                  ? '1px solid rgba(129, 140, 248, 0.5)'
                                  : '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: borderRadius.full,
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: spreadMonths === m ? 600 : 400,
                                fontFamily: FONT_FAMILY,
                                color: spreadMonths === m ? '#818cf8' : 'var(--sub)',
                              }}
                            >
                              {m}mo
                            </button>
                          ))}
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0', fontFamily: FONT_FAMILY }}>
                          Adds ~${amount ? Math.round(parseFloat(amount) / spreadMonths).toLocaleString('en-US') : '0'}/mo to your daily budget
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ── Date Picker (optional, task 87.2) ────────────────────────── */}
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowDatePicker(!showDatePicker)
                    triggerHaptic('light')
                  }}
                  aria-label={`Date: ${getDateLabel(selectedDate)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: selectedDate !== new Date().toISOString().slice(0, 10)
                      ? 'rgba(129, 140, 248, 0.12)'
                      : 'rgba(255, 255, 255, 0.04)',
                    border: selectedDate !== new Date().toISOString().slice(0, 10)
                      ? '1px solid rgba(129, 140, 248, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: borderRadius.full,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: FONT_FAMILY,
                    fontWeight: 500,
                    color: selectedDate !== new Date().toISOString().slice(0, 10)
                      ? 'var(--text)'
                      : 'var(--sub)',
                  }}
                >
                  <span style={{ fontSize: 14 }} aria-hidden="true">📅</span>
                  <span>{getDateLabel(selectedDate)}</span>
                </button>

                <AnimatePresence>
                  {showDatePicker && (
                    <motion.div
                      key="date-picker"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      transition={springs.snappy}
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        justifyContent: 'center',
                      }}
                    >
                      {/* Today chip */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(new Date().toISOString().slice(0, 10))
                          setShowDatePicker(false)
                          setShowCustomDateInput(false)
                          triggerHaptic('light')
                        }}
                        style={{
                          padding: '8px 14px',
                          background: selectedDate === new Date().toISOString().slice(0, 10)
                            ? 'rgba(129, 140, 248, 0.12)'
                            : 'rgba(255, 255, 255, 0.04)',
                          border: selectedDate === new Date().toISOString().slice(0, 10)
                            ? '1px solid rgba(129, 140, 248, 0.4)'
                            : '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: borderRadius.full,
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 500,
                          fontFamily: FONT_FAMILY,
                          color: selectedDate === new Date().toISOString().slice(0, 10)
                            ? 'var(--text)'
                            : 'var(--sub)',
                        }}
                      >
                        Today
                      </button>

                      {/* Yesterday chip */}
                      {(() => {
                        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDate(yesterday)
                              setShowDatePicker(false)
                              setShowCustomDateInput(false)
                              triggerHaptic('light')
                            }}
                            style={{
                              padding: '8px 14px',
                              background: selectedDate === yesterday
                                ? 'rgba(129, 140, 248, 0.12)'
                                : 'rgba(255, 255, 255, 0.04)',
                              border: selectedDate === yesterday
                                ? '1px solid rgba(129, 140, 248, 0.4)'
                                : '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: borderRadius.full,
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: 500,
                              fontFamily: FONT_FAMILY,
                              color: selectedDate === yesterday
                                ? 'var(--text)'
                                : 'var(--sub)',
                            }}
                          >
                            Yesterday
                          </button>
                        )
                      })()}

                      {/* Last Friday chip */}
                      {(() => {
                        const lastFri = getLastFriday(new Date())
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDate(lastFri)
                              setShowDatePicker(false)
                              setShowCustomDateInput(false)
                              triggerHaptic('light')
                            }}
                            style={{
                              padding: '8px 14px',
                              background: selectedDate === lastFri
                                ? 'rgba(129, 140, 248, 0.12)'
                                : 'rgba(255, 255, 255, 0.04)',
                              border: selectedDate === lastFri
                                ? '1px solid rgba(129, 140, 248, 0.4)'
                                : '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: borderRadius.full,
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: 500,
                              fontFamily: FONT_FAMILY,
                              color: selectedDate === lastFri
                                ? 'var(--text)'
                                : 'var(--sub)',
                            }}
                          >
                            Last Fri
                          </button>
                        )
                      })()}

                      {/* Pick date chip */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomDateInput(!showCustomDateInput)
                          triggerHaptic('light')
                        }}
                        style={{
                          padding: '8px 14px',
                          background: showCustomDateInput
                            ? 'rgba(129, 140, 248, 0.12)'
                            : 'rgba(255, 255, 255, 0.04)',
                          border: showCustomDateInput
                            ? '1px solid rgba(129, 140, 248, 0.4)'
                            : '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: borderRadius.full,
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 500,
                          fontFamily: FONT_FAMILY,
                          color: showCustomDateInput
                            ? 'var(--text)'
                            : 'var(--sub)',
                        }}
                      >
                        Pick date
                      </button>

                      {/* Custom date input */}
                      {showCustomDateInput && (
                        <div style={{ width: '100%', marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => {
                              if (e.target.value) {
                                setSelectedDate(e.target.value)
                                setShowDatePicker(false)
                                setShowCustomDateInput(false)
                                triggerHaptic('light')
                              }
                            }}
                            style={{
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: borderRadius.sm,
                              padding: '8px 12px',
                              fontSize: 14,
                              fontFamily: FONT_FAMILY,
                              color: 'var(--text)',
                              colorScheme: 'dark',
                            }}
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
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
