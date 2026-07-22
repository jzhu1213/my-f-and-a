"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, timings, useReducedMotion } from '@/lib/animations'
import { useToast } from '@/contexts/ToastContext'
import { GlassCard } from '@/components/ui/GlassCard'
import type { Goal } from '@/types'

interface PaycheckSheetProps {
  isOpen: boolean
  amount: number
  goals: Goal[]
  onContribute: (goalId: string, amount: number) => void
  onClose: () => void
}

const QUICK_CONTRIBUTIONS = [10, 25, 50]

export function PaycheckSheet({ isOpen, amount, goals, onContribute, onClose }: PaycheckSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const { showToast } = useToast()
  const [contributed, setContributed] = useState(0)

  // Reset contributed total when sheet opens
  useEffect(() => {
    if (isOpen) setContributed(0)
  }, [isOpen, amount])

  const handleContribute = (goalId: string, goalName: string, amt: number) => {
    onContribute(goalId, amt)
    setContributed(c => c + amt)
    showToast(`+$${amt} → ${goalName} ✓`, 'success')
  }

  const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount)
  const remaining = Math.max(0, amount - contributed)

  // Sheet animation variants (matching IncomeSheet pattern)
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
            key="paycheck-backdrop"
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
            key="paycheck-sheet"
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
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            {/* Handle */}
            <div className="sheet-handle" />

            <div style={{ padding: '0 24px 32px' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 8,
                  }}
                >
                  Paycheck logged
                </p>
                <p
                  style={{
                    fontSize: 40,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 300,
                    color: 'var(--success)',
                    lineHeight: 1,
                  }}
                >
                  +${amount.toLocaleString()}
                </p>
                <p
                  style={{
                    fontSize: 14,
                    fontFamily: 'Inter, sans-serif',
                    color: 'var(--muted)',
                    marginTop: 10,
                  }}
                >
                  Set some aside for savings, or tap Done to keep it all for spending.
                </p>
              </div>

              {/* Goals list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {activeGoals.length > 0 ? (
                  activeGoals.map(goal => {
                    const pct = goal.targetAmount > 0
                      ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                      : 0

                    return (
                      <GlassCard key={goal.id} elevation="low" style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 22 }}>{goal.emoji}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontSize: 15,
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 500,
                                color: 'var(--text)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {goal.name}
                            </p>
                            <p
                              style={{
                                fontSize: 12,
                                fontFamily: 'Inter, sans-serif',
                                color: 'var(--muted)',
                                marginTop: 2,
                              }}
                            >
                              ${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()} · {pct}%
                            </p>
                          </div>
                        </div>

                        {/* Quick-contribution chips */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          {QUICK_CONTRIBUTIONS.map(q => (
                            <button
                              key={q}
                              onClick={() => handleContribute(goal.id, goal.name, q)}
                              aria-label={`Contribute $${q} to ${goal.name}`}
                              style={{
                                flex: 1,
                                padding: '10px 0',
                                fontSize: 14,
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 600,
                                color: 'var(--text)',
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid var(--line)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                              }}
                            >
                              +${q}
                            </button>
                          ))}
                        </div>
                      </GlassCard>
                    )
                  })
                ) : (
                  <p
                    style={{
                      fontSize: 14,
                      fontFamily: 'Inter, sans-serif',
                      color: 'var(--muted)',
                      textAlign: 'center',
                      padding: '16px 0',
                    }}
                  >
                    No active savings goals. Create one to split paychecks automatically.
                  </p>
                )}
              </div>

              {/* Summary of contributions */}
              {contributed > 0 && (
                <GlassCard
                  elevation="low"
                  glow="healthy"
                  style={{ padding: '12px 16px', marginBottom: 20 }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 500,
                      color: 'var(--text)',
                    }}
                  >
                    ${contributed.toLocaleString()} saved · ${remaining.toLocaleString()} for spending
                  </p>
                </GlassCard>
              )}

              {/* Done button */}
              <button
                onClick={onClose}
                aria-label="Done — keep remaining for spending"
                style={{
                  width: '100%',
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                  color: '#fff',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 16,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
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
