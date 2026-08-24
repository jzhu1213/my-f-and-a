"use client"

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { triggerHaptic } from '@/lib/haptics'
import { useToast } from '@/contexts/ToastContext'
import type { TransactionCategory } from '@/types'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { radius } from '@/styles/surfaces'
import { getCategoryEmoji } from '@/lib/vocabulary'

interface BulkRepeatSheetProps {
  isOpen: boolean
  onClose: () => void
  /** Initial transaction template to repeat */
  transaction: {
    amount: number
    category: TransactionCategory
    note?: string
  }
  /** Callback when bulk transactions are confirmed */
  onSubmit: (transactions: Array<{
    amount: number
    category: TransactionCategory
    note?: string
    date: string
  }>) => void
}

/**
 * Get a range of past dates for bulk entry.
 * Returns date strings in YYYY-MM-DD format, from most recent to oldest.
 */
function getDateRange(days: number): string[] {
  const dates: string[] = []
  const today = new Date()
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    dates.push(date.toISOString().slice(0, 10))
  }
  
  return dates
}

/**
 * Format a date string into a readable label
 */
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)
  
  if (dateStr === todayStr) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'
  
  // Format as "Mon, Jun 12"
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  })
}

/**
 * BulkRepeatSheet enables users to quickly log the same expense across multiple past dates.
 * Use case: "I bought coffee every day last week" — log once, repeat across dates.
 * 
 * Validates: Task 93.1 (Bulk/repeat entry for past periods)
 */
export function BulkRepeatSheet({ 
  isOpen, 
  onClose, 
  transaction,
  onSubmit 
}: BulkRepeatSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const { showToast } = useToast()
  
  // Selected date range (checkboxes)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  
  // Quick-pick presets: "Past 3 days", "Past 7 days", etc.
  const [dateRangePreset, setDateRangePreset] = useState<number | null>(null)
  
  // Generate date options for past 14 days
  const dateOptions = useMemo(() => getDateRange(14), [])
  
  // Apply preset range
  const applyPreset = useCallback((days: number) => {
    const rangeStr = getDateRange(days)
    setSelectedDates(new Set(rangeStr))
    setDateRangePreset(days)
    triggerHaptic('light')
  }, [])
  
  // Toggle individual date
  const toggleDate = useCallback((dateStr: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) {
        next.delete(dateStr)
      } else {
        next.add(dateStr)
      }
      return next
    })
    setDateRangePreset(null) // Clear preset when manually toggling
    triggerHaptic('light')
  }, [])
  
  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedDates(new Set())
    setDateRangePreset(null)
    triggerHaptic('light')
  }, [])
  
  // Submit bulk transactions
  const handleSubmit = useCallback(() => {
    if (selectedDates.size === 0) {
      showToast('Select at least one date', 'error')
      return
    }
    
    const transactions = Array.from(selectedDates).map(date => ({
      amount: transaction.amount,
      category: transaction.category,
      note: transaction.note,
      date,
    }))
    
    onSubmit(transactions)
    
    const amountStr = transaction.amount % 1 === 0 
      ? `$${transaction.amount}` 
      : `$${transaction.amount.toFixed(2)}`
    
    showToast(
      `Logged ${amountStr} × ${selectedDates.size} days ✓`,
      'success'
    )
    
    onClose()
  }, [selectedDates, transaction, onSubmit, onClose, showToast])
  
  const canSubmit = selectedDates.size > 0
  
  const categoryEmoji = getCategoryEmoji(transaction.category)
  const amountStr = transaction.amount % 1 === 0 
    ? `$${transaction.amount}` 
    : `$${transaction.amount.toFixed(2)}`
  
  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      minHeight="60vh"
      ariaLabel="Repeat transaction across dates"
    >
      <div style={{ 
        padding: '0 24px 32px', 
        display: 'flex', 
        flexDirection: 'column',
        gap: spacing.lg
      }}>
        {/* Header: Transaction summary */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing.xs,
            padding: '12px 20px',
            background: 'var(--accent-100)',
            border: '1px solid var(--accent-200)',
            borderRadius: radius.control,
          }}>
            <span style={{ fontSize: typography.headline.fontSize }} aria-hidden="true">{categoryEmoji}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: typography.subhead.fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: fontWeights.semibold,
                color: 'var(--text)',
              }}>
                {amountStr}
              </div>
              {transaction.note && (
                <div style={{
                  fontSize: typography['body-sm'].fontSize,
                  fontFamily: FONT_FAMILY,
                  color: 'var(--muted)',
                }}>
                  {transaction.note}
                </div>
              )}
            </div>
          </div>
          
          <p style={{
            fontSize: typography.body.fontSize,
            fontFamily: FONT_FAMILY,
            color: 'var(--sub)',
            marginTop: spacing.sm,
          }}>
            Select the dates you want to log this expense
          </p>
        </div>
        
        {/* Quick presets */}
        <div>
          <label style={{
            display: 'block',
            fontSize: typography['body-sm'].fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: fontWeights.medium,
            color: 'var(--sub)',
            marginBottom: 10,
          }}>
            Quick picks
          </label>
          
          <div style={{
            display: 'flex',
            gap: spacing.xs,
            flexWrap: 'wrap',
          }}>
            {[3, 5, 7].map(days => (
              <button
                key={days}
                type="button"
                onClick={() => applyPreset(days)}
                aria-label={`Select past ${days} days`}
                aria-pressed={dateRangePreset === days}
                style={{
                  padding: '8px 16px',
                  background: dateRangePreset === days 
                    ? 'var(--accent-200)' 
                    : 'var(--fill-04)',
                  border: dateRangePreset === days
                    ? '1px solid var(--accent-400)'
                    : '1px solid var(--fill-10)',
                  borderRadius: radius.full,
                  cursor: 'pointer',
                  fontSize: typography['body-sm'].fontSize,
                  fontFamily: FONT_FAMILY,
                  fontWeight: fontWeights.medium,
                  color: dateRangePreset === days ? 'var(--text)' : 'var(--sub)',
                }}
              >
                Past {days} days
              </button>
            ))}
            
            <button
              type="button"
              onClick={clearAll}
              aria-label="Clear all selections"
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px dashed var(--fill-15)',
                borderRadius: radius.full,
                cursor: 'pointer',
                fontSize: typography['body-sm'].fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: fontWeights.medium,
                color: 'var(--muted)',
              }}
            >
              Clear all
            </button>
          </div>
        </div>
        
        {/* Date checkboxes */}
        <div>
          <label style={{
            display: 'block',
            fontSize: typography['body-sm'].fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: fontWeights.medium,
            color: 'var(--sub)',
            marginBottom: 10,
          }}>
            Or pick specific dates
          </label>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: spacing.xs,
            maxHeight: 300,
            overflowY: 'auto',
            padding: 2,
          }}>
            {dateOptions.map(dateStr => {
              const isSelected = selectedDates.has(dateStr)
              const isToday = dateStr === new Date().toISOString().slice(0, 10)
              
              return (
                <motion.button
                  key={dateStr}
                  type="button"
                  onClick={() => toggleDate(dateStr)}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.96 }}
                  aria-label={`${formatDateLabel(dateStr)}, ${isSelected ? 'selected' : 'not selected'}`}
                  aria-pressed={isSelected}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: '10px 12px',
                    background: isSelected 
                      ? 'var(--accent-200)' 
                      : 'var(--fill-04)',
                    border: isSelected
                      ? '1.5px solid var(--accent-400)'
                      : '1px solid var(--fill-10)',
                    borderRadius: radius.control,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: radius.min,
                    border: isSelected 
                      ? '2px solid var(--accent-500)' 
                      : '2px solid var(--fill-15)',
                    background: isSelected ? 'var(--accent-500)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path 
                          d="M1 4L3.5 6.5L9 1" 
                          stroke="white" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: typography['body-sm'].fontSize,
                      fontFamily: FONT_FAMILY,
                      fontWeight: fontWeights.medium,
                      color: 'var(--text)',
                    }}>
                      {formatDateLabel(dateStr)}
                    </div>
                    {isToday && (
                      <div style={{
                        fontSize: typography.caption.fontSize,
                        fontFamily: FONT_FAMILY,
                        color: 'var(--muted)',
                      }}>
                        Current
                      </div>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
        
        {/* Selected count indicator */}
        <AnimatePresence>
          {selectedDates.size > 0 && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={springs.snappy}
              style={{
                textAlign: 'center',
                padding: 12,
                background: 'var(--success-100)',
                border: '1px solid var(--success-200)',
                borderRadius: radius.control,
              }}
            >
              <span style={{
                fontSize: typography.body.fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: fontWeights.medium,
                color: 'var(--text)',
              }}>
                {selectedDates.size} {selectedDates.size === 1 ? 'day' : 'days'} selected
              </span>
              <span style={{
                fontSize: typography['body-sm'].fontSize,
                fontFamily: FONT_FAMILY,
                color: 'var(--muted)',
                marginLeft: spacing.xs,
              }}>
                · Total: ${(transaction.amount * selectedDates.size).toFixed(2)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label={`Log ${selectedDates.size} transactions`}
          style={{
            padding: '14px 24px',
            background: canSubmit 
              ? 'var(--accent-500)' 
              : 'var(--fill-08)',
            border: 'none',
            borderRadius: radius.control,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontSize: typography.body.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: fontWeights.semibold,
            color: canSubmit ? 'var(--text)' : 'var(--muted)',
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          {selectedDates.size === 0 
            ? 'Select dates to continue' 
            : `Log ${selectedDates.size} ${selectedDates.size === 1 ? 'transaction' : 'transactions'}`
          }
        </button>
      </div>
    </BottomSheet>
  )
}
