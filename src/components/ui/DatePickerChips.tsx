"use client"

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { triggerHaptic } from '@/lib/haptics'
import { FONT_FAMILY } from '@/styles/typography'
import { borderRadius } from '@/styles/shared'

// ── Date helper utilities ────────────────────────────────────────────────────

/** Returns YYYY-MM-DD of the most recent Friday (or today if today is Friday). */
function getLastFriday(today: Date): string {
  const day = today.getDay() // 0=Sun, 5=Fri
  const diff = day >= 5 ? day - 5 : day + 2 // days back to last Friday
  const lastFri = new Date(today)
  lastFri.setDate(today.getDate() - diff)
  return lastFri.toISOString().slice(0, 10)
}

/** Returns YYYY-MM-DD of the next Monday (task 90.1 — future date chip). */
function getNextMonday(today: Date): string {
  const day = today.getDay() // 0=Sun, 1=Mon
  const diff = day === 0 ? 1 : 8 - day // days forward to next Monday
  const nextMon = new Date(today)
  nextMon.setDate(today.getDate() + diff)
  return nextMon.toISOString().slice(0, 10)
}

/** Returns a human-readable relative label for a date string. */
export function getRelativeDateLabel(dateStr: string): string {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (dateStr === todayStr) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'

  // Future date — show "Scheduled: Jun 12" (task 90.1)
  if (dateStr > todayStr) {
    const d = new Date(dateStr + 'T00:00:00')
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `Scheduled: ${label}`
  }

  // Format as short date: "Jun 12"
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Returns true if a date string is in the future relative to today. */
export function isFutureDate(dateStr: string): boolean {
  const todayStr = new Date().toISOString().slice(0, 10)
  return dateStr > todayStr
}

// ── Component Props ──────────────────────────────────────────────────────────

interface DatePickerChipsProps {
  /** Current selected date in YYYY-MM-DD format */
  selectedDate: string
  /** Called when date changes */
  onDateChange: (date: string) => void
  /** Whether to show the future date chip (Next Mon) — default false */
  allowFutureDates?: boolean
  /** Custom label override for the date button — defaults to getRelativeDateLabel */
  customLabel?: string
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * DatePickerChips — shared date selection component (task 91.1)
 * 
 * Provides a compact chip-based date picker with shortcuts:
 * - Today
 * - Yesterday
 * - Last Fri
 * - Pick date (opens native date input)
 * - Next Mon (optional, for future-dated transactions)
 * 
 * Used by ExpenseSheet, IncomeSheet, and PaycheckSheet for consistent UX.
 */
export function DatePickerChips({
  selectedDate,
  onDateChange,
  allowFutureDates = false,
  customLabel,
}: DatePickerChipsProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [showPicker, setShowPicker] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)

  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const lastFriStr = getLastFriday(new Date())
  const nextMonStr = getNextMonday(new Date())

  const isCustomDate =
    selectedDate !== todayStr &&
    selectedDate !== yesterdayStr &&
    selectedDate !== lastFriStr &&
    (!allowFutureDates || selectedDate !== nextMonStr)

  const displayLabel = customLabel ?? getRelativeDateLabel(selectedDate)

  const handleDateSelect = useCallback(
    (date: string) => {
      onDateChange(date)
      setShowPicker(false)
      setShowCustomInput(false)
      triggerHaptic('light')
    },
    [onDateChange]
  )

  const handleTogglePicker = useCallback(() => {
    setShowPicker(!showPicker)
    triggerHaptic('light')
  }, [showPicker])

  const handleToggleCustomInput = useCallback(() => {
    setShowCustomInput(!showCustomInput)
    triggerHaptic('light')
  }, [showCustomInput])

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Main date button */}
      <button
        type="button"
        onClick={handleTogglePicker}
        aria-label={`Date: ${displayLabel}`}
        aria-expanded={showPicker}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background:
            selectedDate !== todayStr
              ? 'rgba(129, 140, 248, 0.12)'
              : 'rgba(255, 255, 255, 0.04)',
          border:
            selectedDate !== todayStr
              ? '1px solid rgba(129, 140, 248, 0.4)'
              : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: borderRadius.full,
          cursor: 'pointer',
          fontSize: 13,
          fontFamily: FONT_FAMILY,
          fontWeight: 500,
          color:
            selectedDate !== todayStr ? 'var(--text)' : 'var(--sub)',
        }}
      >
        <span style={{ fontSize: 14 }} aria-hidden="true">
          📅
        </span>
        <span>{displayLabel}</span>
      </button>

      {/* Chip picker overlay */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            key="date-picker-chips"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }
            }
            animate={
              prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
            }
            exit={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }
            }
            transition={springs.snappy}
            style={{
              marginTop: 10,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'center',
            }}
            role="group"
            aria-label="Date shortcuts"
          >
            {/* Today chip */}
            <button
              type="button"
              onClick={() => handleDateSelect(todayStr)}
              aria-pressed={selectedDate === todayStr}
              style={{
                padding: '8px 14px',
                background:
                  selectedDate === todayStr
                    ? 'rgba(129, 140, 248, 0.12)'
                    : 'rgba(255, 255, 255, 0.04)',
                border:
                  selectedDate === todayStr
                    ? '1px solid rgba(129, 140, 248, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: borderRadius.full,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: FONT_FAMILY,
                color:
                  selectedDate === todayStr ? 'var(--text)' : 'var(--sub)',
              }}
            >
              Today
            </button>

            {/* Yesterday chip */}
            <button
              type="button"
              onClick={() => handleDateSelect(yesterdayStr)}
              aria-pressed={selectedDate === yesterdayStr}
              style={{
                padding: '8px 14px',
                background:
                  selectedDate === yesterdayStr
                    ? 'rgba(129, 140, 248, 0.12)'
                    : 'rgba(255, 255, 255, 0.04)',
                border:
                  selectedDate === yesterdayStr
                    ? '1px solid rgba(129, 140, 248, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: borderRadius.full,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: FONT_FAMILY,
                color:
                  selectedDate === yesterdayStr
                    ? 'var(--text)'
                    : 'var(--sub)',
              }}
            >
              Yesterday
            </button>

            {/* Last Friday chip */}
            <button
              type="button"
              onClick={() => handleDateSelect(lastFriStr)}
              aria-pressed={selectedDate === lastFriStr}
              style={{
                padding: '8px 14px',
                background:
                  selectedDate === lastFriStr
                    ? 'rgba(129, 140, 248, 0.12)'
                    : 'rgba(255, 255, 255, 0.04)',
                border:
                  selectedDate === lastFriStr
                    ? '1px solid rgba(129, 140, 248, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: borderRadius.full,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: FONT_FAMILY,
                color:
                  selectedDate === lastFriStr ? 'var(--text)' : 'var(--sub)',
              }}
            >
              Last Fri
            </button>

            {/* Next Monday chip (optional, for future dates) */}
            {allowFutureDates && (
              <button
                type="button"
                onClick={() => handleDateSelect(nextMonStr)}
                aria-pressed={selectedDate === nextMonStr}
                style={{
                  padding: '8px 14px',
                  background:
                    selectedDate === nextMonStr
                      ? 'rgba(129, 140, 248, 0.12)'
                      : 'rgba(255, 255, 255, 0.04)',
                  border:
                    selectedDate === nextMonStr
                      ? '1px solid rgba(129, 140, 248, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: borderRadius.full,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  color:
                    selectedDate === nextMonStr
                      ? 'var(--text)'
                      : 'var(--sub)',
                }}
              >
                Next Mon
              </button>
            )}

            {/* Pick date chip */}
            <button
              type="button"
              onClick={handleToggleCustomInput}
              aria-pressed={showCustomInput}
              style={{
                padding: '8px 14px',
                background: showCustomInput
                  ? 'rgba(129, 140, 248, 0.12)'
                  : 'rgba(255, 255, 255, 0.04)',
                border: showCustomInput
                  ? '1px solid rgba(129, 140, 248, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: borderRadius.full,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: FONT_FAMILY,
                color: showCustomInput ? 'var(--text)' : 'var(--sub)',
              }}
            >
              Pick date
            </button>

            {/* Custom date input (native date picker) */}
            {showCustomInput && (
              <div
                style={{
                  width: '100%',
                  marginTop: 8,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleDateSelect(e.target.value)
                    }
                  }}
                  // Allow past and future dates in the input
                  max={allowFutureDates ? undefined : todayStr}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: borderRadius.sm,
                    padding: '8px 12px',
                    fontSize: 14,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--text)',
                    colorScheme: 'dark',
                    cursor: 'pointer',
                  }}
                  aria-label="Pick a custom date"
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
