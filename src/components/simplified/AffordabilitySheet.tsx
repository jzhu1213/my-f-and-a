"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { simulatePurchase } from '@/lib/affordabilityUtils'
import type { AffordabilityResult } from '@/lib/affordabilityUtils'
import type { Budget, Transaction } from '@/types'
import type { IncomeSmoothing } from '@/types/folio'
import type { FixedExpense } from '@/lib/fixedExpenses'
import { GlassCard } from '@/components/ui/GlassCard'
import { FONT_FAMILY } from '@/styles/typography'
import { borderRadius } from '@/styles/shared'

// ============================================================================
// Props
// ============================================================================

export interface AffordabilitySheetProps {
  isOpen: boolean
  onClose: () => void
  budgets: Budget[]
  transactions: Transaction[]
  monthlyIncome?: number
  fixedExpenses?: FixedExpense[]
  setupDate?: Date
  incomeSmoothing?: IncomeSmoothing
  carryoverEnabled?: boolean
  /** Pre-computed days until next payday */
  daysUntilPayday?: number
}

// ============================================================================
// Component
// ============================================================================

/**
 * AffordabilitySheet — A lightweight bottom sheet for quickly checking
 * "Can I afford this?" without logging anything.
 *
 * Shows real-time impact on today's allowance as the user types an amount.
 * Warm, encouraging copy — never judgmental.
 *
 * Requirements: 1.1, 2.5, new
 */
export function AffordabilitySheet({
  isOpen,
  onClose,
  budgets,
  transactions,
  monthlyIncome,
  fixedExpenses,
  setupDate,
  incomeSmoothing,
  carryoverEnabled,
  daysUntilPayday,
}: AffordabilitySheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const [amount, setAmount] = useState('')

  // Reset and auto-focus when opening
  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  // Parse amount for simulation
  const parsedAmount = useMemo(() => {
    const n = parseFloat(amount)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [amount])

  // Compute affordability result in real-time
  const result: AffordabilityResult | null = useMemo(() => {
    if (parsedAmount <= 0) return null
    return simulatePurchase({
      budgets,
      transactions,
      purchaseAmount: parsedAmount,
      monthlyIncome,
      fixedExpenses,
      setupDate,
      incomeSmoothing,
      carryoverEnabled,
      daysUntilPayday,
    })
  }, [parsedAmount, budgets, transactions, monthlyIncome, fixedExpenses, setupDate, incomeSmoothing, carryoverEnabled, daysUntilPayday])

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    const parts = raw.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 2) return
    const numeric = parseFloat(raw)
    if (numeric > 99999) return
    setAmount(raw)
  }, [])

  // Status color for result display
  const statusColor = result
    ? result.canAfford ? 'var(--success)' : 'var(--warning)'
    : 'var(--sub)'

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="70vh" ariaLabel="Can I afford this?">
      <div style={{ padding: '0 24px 36px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--text)',
                    fontFamily: FONT_FAMILY,
                    marginBottom: 4,
                  }}
                >
                  Can I afford this?
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--muted)',
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  Quick check — nothing gets logged
                </p>
              </div>

              {/* Amount Input */}
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
                      fontFamily: FONT_FAMILY,
                      fontWeight: 300,
                      color: 'var(--muted)',
                    }}
                  >
                    $
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={handleAmountChange}
                    aria-label="Purchase amount to check"
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

              {/* Result Display */}
              <AnimatePresence mode="wait">
                {result && (
                  <motion.div
                    key={`result-${parsedAmount}`}
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    transition={springs.snappy}
                  >
                    <GlassCard
                      elevation="low"
                      glow={result.canAfford ? 'healthy' : 'caution'}
                      style={{
                        padding: '20px',
                        borderRadius: borderRadius.lg,
                        textAlign: 'center',
                      }}
                    >
                      {/* Verdict emoji */}
                      <p style={{ fontSize: 28, marginBottom: 8 }} aria-hidden="true">
                        {result.canAfford ? '✅' : '🤔'}
                      </p>

                      {/* Message */}
                      <p
                        style={{
                          fontSize: 15,
                          fontWeight: 500,
                          color: statusColor,
                          fontFamily: FONT_FAMILY,
                          marginBottom: 12,
                          lineHeight: 1.4,
                        }}
                        role="status"
                        aria-live="polite"
                      >
                        {result.message}
                      </p>

                      {/* Impact breakdown */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          gap: 20,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: FONT_FAMILY, marginBottom: 2 }}>
                            Left today
                          </p>
                          <p
                            style={{
                              fontSize: 18,
                              fontWeight: 600,
                              color: statusColor,
                              fontFamily: FONT_FAMILY,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            ${Math.max(0, Math.round(result.remainingAfter))}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: FONT_FAMILY, marginBottom: 2 }}>
                            Impact
                          </p>
                          <p
                            style={{
                              fontSize: 18,
                              fontWeight: 600,
                              color: 'var(--text)',
                              fontFamily: FONT_FAMILY,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            −${Math.round(result.impactOnDaily)}
                          </p>
                        </div>
                        {result.safeToSpendUntilPayday != null && (
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: FONT_FAMILY, marginBottom: 2 }}>
                              /day til payday
                            </p>
                            <p
                              style={{
                                fontSize: 18,
                                fontWeight: 600,
                                color: 'var(--text)',
                                fontFamily: FONT_FAMILY,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              ${Math.round(result.safeToSpendUntilPayday)}
                            </p>
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Placeholder when no amount entered */}
              {!result && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--muted)',
                      fontFamily: FONT_FAMILY,
                      opacity: 0.7,
                    }}
                  >
                    Type an amount to see how it fits your budget
                  </p>
                </div>
              )}

              {/* Close button */}
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileTap={{ scale: 0.96 }}
                  transition={springs.bouncy}
                  aria-label="Close affordability check"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: borderRadius.full,
                    padding: '12px 28px',
                    color: 'var(--sub)',
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: FONT_FAMILY,
                    cursor: 'pointer',
                  }}
                >
                  Done
                </motion.button>
              </div>
            </div>
    </BottomSheet>
  )
}
