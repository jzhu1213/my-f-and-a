"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs } from '@/lib/animations'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useToast } from '@/contexts/ToastContext'
import { GlassCard } from '@/components/ui/GlassCard'
import { computeTaxSetAside, DEFAULT_GIG_TAX_RATE } from '@/lib/taxSetAside'
import {
  loadAutoContributeRules,
  computeAutoContributions,
  computeAutoContributeTotal,
  type AutoContribution,
} from '@/lib/autoContributeUtils'
import type { Goal, IncomeAllocation, AllocationPreset } from '@/types'
import { FONT_FAMILY } from '@/styles/typography'

// ── Default presets ──────────────────────────────────────────────────────────

const ALLOCATION_PRESETS: AllocationPreset[] = [
  { label: 'Student', emoji: '🎓', split: [80, 10, 5, 5] },
  { label: 'Saver', emoji: '🐷', split: [70, 15, 10, 5] },
  { label: 'Balanced', emoji: '⚖️', split: [60, 20, 10, 10] },
]

// ── Bucket metadata ──────────────────────────────────────────────────────────

const BUCKETS: { key: keyof IncomeAllocation; label: string; emoji: string; color: string }[] = [
  { key: 'spend', label: 'Spend', emoji: '💸', color: 'var(--text)' },
  { key: 'save', label: 'Save', emoji: '🏦', color: 'var(--success)' },
  { key: 'invest', label: 'Invest', emoji: '📈', color: '#818cf8' },
  { key: 'setAside', label: 'Set Aside', emoji: '🎯', color: 'var(--warning)' },
]

// ── Props ────────────────────────────────────────────────────────────────────

interface PaycheckSheetProps {
  isOpen: boolean
  amount: number
  goals: Goal[]
  onContribute: (goalId: string, amount: number) => void
  /** Called with the final allocation; parent can roll back on persistence failure */
  onAllocate?: (allocation: IncomeAllocation) => void
  onClose: () => void
  /** When true, shows a tax set-aside suggestion for gig/freelance income */
  isGigIncome?: boolean
}

// ── Helper: round to 2 decimal places ────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Component ────────────────────────────────────────────────────────────────

export function PaycheckSheet({
  isOpen,
  amount,
  goals,
  onContribute,
  onAllocate,
  onClose,
  isGigIncome,
}: PaycheckSheetProps) {
  const { showToast } = useToast()

  // ── State ─────────────────────────────────────────────────────
  const [percentages, setPercentages] = useState<[number, number, number, number]>([80, 10, 5, 5])
  const [activePreset, setActivePreset] = useState<number | null>(0) // index into ALLOCATION_PRESETS or null for custom
  const [showGoalContributions, setShowGoalContributions] = useState(false)
  const [contributed, setContributed] = useState(0)
  const [taxSuggestionDismissed, setTaxSuggestionDismissed] = useState(false)

  // ── Auto-contribute state ─────────────────────────────────────
  const [autoContributions, setAutoContributions] = useState<AutoContribution[]>([])
  const [autoContributeSkipped, setAutoContributeSkipped] = useState(false)
  const [autoContributeApplied, setAutoContributeApplied] = useState(false)

  // ── Tax set-aside suggestion for gig income ───────────────────
  const taxInfo = useMemo(() => {
    if (!isGigIncome || amount <= 0) return null
    return computeTaxSetAside(amount, DEFAULT_GIG_TAX_RATE)
  }, [isGigIncome, amount])

  const showTaxSuggestion = !!taxInfo && !taxSuggestionDismissed

  // Reset when sheet opens
  useEffect(() => {
    if (isOpen) {
      setPercentages([80, 10, 5, 5])
      setActivePreset(0)
      setShowGoalContributions(false)
      setContributed(0)
      setTaxSuggestionDismissed(false)
      setAutoContributeSkipped(false)
      setAutoContributeApplied(false)

      // Compute auto-contributions from persisted rules
      const rules = loadAutoContributeRules()
      const activeRules = rules.filter(r => r.enabled)
      if (activeRules.length > 0 && goals.length > 0 && amount > 0) {
        const contributions = computeAutoContributions(activeRules, goals, amount)
        setAutoContributions(contributions)
      } else {
        setAutoContributions([])
      }
    }
  }, [isOpen, amount, goals])

  // ── Derived values ────────────────────────────────────────────
  const allocation: IncomeAllocation = useMemo(() => ({
    spend: round2((percentages[0] / 100) * amount),
    save: round2((percentages[1] / 100) * amount),
    invest: round2((percentages[2] / 100) * amount),
    setAside: round2((percentages[3] / 100) * amount),
  }), [percentages, amount])

  const totalPercent = percentages[0] + percentages[1] + percentages[2] + percentages[3]
  const isValid = totalPercent === 100

  const activeGoals = goals
    .filter(g => g.currentAmount < g.targetAmount)
    .sort((a, b) => {
      // Emergency fund goals surface first so they get funded before discretionary savings
      const aIsEF = a.type === 'emergency_fund' ? 0 : 1
      const bIsEF = b.type === 'emergency_fund' ? 0 : 1
      return aIsEF - bIsEF
    })

  // Auto-contribute: show the banner when there are pending contributions
  const showAutoContributeBanner =
    autoContributions.length > 0 && !autoContributeSkipped && !autoContributeApplied
  const autoContributeTotal = computeAutoContributeTotal(autoContributions)

  // ── Handlers ──────────────────────────────────────────────────

  const handlePresetSelect = useCallback((index: number) => {
    const preset = ALLOCATION_PRESETS[index]
    setPercentages([...preset.split])
    setActivePreset(index)
  }, [])

  const handlePercentageChange = useCallback((bucketIndex: number, value: number) => {
    setPercentages(prev => {
      const next: [number, number, number, number] = [...prev]
      next[bucketIndex] = Math.max(0, Math.min(100, value))
      return next
    })
    setActivePreset(null) // custom
  }, [])

  const handleConfirm = useCallback(() => {
    if (!isValid) return

    // Apply auto-contributions optimistically if banner is active
    if (showAutoContributeBanner && autoContributions.length > 0) {
      for (const contrib of autoContributions) {
        onContribute(contrib.goalId, contrib.amount)
      }
      setAutoContributeApplied(true)
      showToast(`Auto-saved $${autoContributeTotal} toward your goals ✓`, 'success')
    }

    // Notify parent with optimistic allocation data
    if (onAllocate) {
      onAllocate(allocation)
    }

    // If there are active goals, offer quick contributions from save bucket
    if (activeGoals.length > 0 && allocation.save > 0) {
      setShowGoalContributions(true)
      return
    }

    showToast('Income allocated ✓', 'success')
    onClose()
  }, [isValid, allocation, onAllocate, activeGoals, showToast, onClose, showAutoContributeBanner, autoContributions, autoContributeTotal, onContribute])

  const handleContribute = useCallback((goalId: string, goalName: string, amt: number) => {
    onContribute(goalId, amt)
    setContributed(c => c + amt)
    showToast(`+$${amt} → ${goalName} ✓`, 'success')
  }, [onContribute, showToast])

  const handleDone = useCallback(() => {
    showToast('Income allocated ✓', 'success')
    onClose()
  }, [showToast, onClose])

  // ── Render ────────────────────────────────────────────────────
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="85vh" ariaLabel="Allocate paycheck">
      <div style={{ padding: '0 24px 32px' }}>
              {/* ── Header ──────────────────────────────────────── */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontFamily: FONT_FAMILY,
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
                    fontFamily: FONT_FAMILY,
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
                    fontFamily: FONT_FAMILY,
                    color: 'var(--muted)',
                    marginTop: 10,
                  }}
                >
                  {showGoalContributions
                    ? 'Allocate some savings to your goals'
                    : 'Split it up — pick a preset or customize'}
                </p>
              </div>

              {/* ── Tax Set-Aside Suggestion (gig income) ─────────── */}
              {showTaxSuggestion && taxInfo && (
                <div
                  style={{
                    background: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.25)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    marginBottom: 16,
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 18, lineHeight: 1.3 }}>💡</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontFamily: FONT_FAMILY,
                          fontWeight: 500,
                          color: 'var(--warning)',
                          marginBottom: 4,
                        }}
                      >
                        Tax heads-up
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          fontFamily: FONT_FAMILY,
                          color: 'var(--sub)',
                          lineHeight: 1.4,
                        }}
                      >
                        Since this is gig income, consider setting aside ~{Math.round(taxInfo.rate * 100)}% (${taxInfo.suggestedReserve.toLocaleString()}) for taxes in your Set Aside bucket.
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          fontFamily: FONT_FAMILY,
                          color: 'var(--muted)',
                          marginTop: 4,
                          lineHeight: 1.3,
                        }}
                      >
                        {taxInfo.rationale}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTaxSuggestionDismissed(true)}
                      aria-label="Dismiss tax suggestion"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        fontSize: 16,
                        cursor: 'pointer',
                        padding: 4,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* ── Auto-Contribute Banner ─────────────────────── */}
              {showAutoContributeBanner && (
                <div
                  style={{
                    background: 'rgba(74, 222, 128, 0.08)',
                    border: '1px solid rgba(74, 222, 128, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 18, lineHeight: 1.3 }}>🎯</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontFamily: FONT_FAMILY,
                          fontWeight: 500,
                          color: 'var(--success)',
                          marginBottom: 4,
                        }}
                      >
                        Auto-saving to goals
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          fontFamily: FONT_FAMILY,
                          color: 'var(--sub)',
                          lineHeight: 1.4,
                        }}
                      >
                        ${autoContributeTotal} will go toward {autoContributions.length === 1
                          ? autoContributions[0].goalName
                          : `${autoContributions.length} goals`} when you confirm.
                      </p>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {autoContributions.map(c => (
                          <span
                            key={c.goalId}
                            style={{
                              fontSize: 11,
                              fontFamily: FONT_FAMILY,
                              color: 'var(--muted)',
                              background: 'rgba(255,255,255,0.05)',
                              borderRadius: 6,
                              padding: '3px 8px',
                            }}
                          >
                            {c.goalEmoji} {c.goalName}: +${c.amount}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoContributeSkipped(true)}
                      aria-label="Skip auto-contributions this time"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        fontSize: 12,
                        fontFamily: FONT_FAMILY,
                        cursor: 'pointer',
                        padding: '2px 6px',
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              <AnimatePresence mode="wait">
                {!showGoalContributions ? (
                  <motion.div
                    key="allocation-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* ── Preset Buttons ───────────────────────────── */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                      {ALLOCATION_PRESETS.map((preset, idx) => (
                        <button
                          key={preset.label}
                          onClick={() => handlePresetSelect(idx)}
                          aria-label={`${preset.label} preset: ${preset.split.join('/')}`}
                          style={{
                            flex: 1,
                            padding: '10px 6px',
                            fontSize: 12,
                            fontFamily: FONT_FAMILY,
                            fontWeight: 600,
                            color: activePreset === idx ? '#fff' : 'var(--text)',
                            background: activePreset === idx
                              ? 'linear-gradient(135deg, #4ade80, #22c55e)'
                              : 'rgba(255, 255, 255, 0.06)',
                            border: activePreset === idx
                              ? 'none'
                              : '1px solid var(--line)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ display: 'block', fontSize: 16, marginBottom: 2 }}>
                            {preset.emoji}
                          </span>
                          {preset.label}
                          <span
                            style={{
                              display: 'block',
                              fontSize: 10,
                              fontWeight: 400,
                              color: activePreset === idx ? 'rgba(255,255,255,0.8)' : 'var(--muted)',
                              marginTop: 2,
                            }}
                          >
                            {preset.split[0]}/{preset.split[1]}/{preset.split[2]}/{preset.split[3]}
                          </span>
                        </button>
                      ))}
                      {/* Custom button */}
                      <button
                        onClick={() => setActivePreset(null)}
                        aria-label="Custom allocation"
                        style={{
                          flex: 1,
                          padding: '10px 6px',
                          fontSize: 12,
                          fontFamily: FONT_FAMILY,
                          fontWeight: 600,
                          color: activePreset === null ? '#fff' : 'var(--text)',
                          background: activePreset === null
                            ? 'linear-gradient(135deg, #818cf8, #6366f1)'
                            : 'rgba(255, 255, 255, 0.06)',
                          border: activePreset === null
                            ? 'none'
                            : '1px solid var(--line)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ display: 'block', fontSize: 16, marginBottom: 2 }}>✏️</span>
                        Custom
                      </button>
                    </div>

                    {/* ── Allocation Breakdown ─────────────────────── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                      {BUCKETS.map((bucket, idx) => (
                        <GlassCard key={bucket.key} elevation="low" style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 20 }}>{bucket.emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <p
                                  style={{
                                    fontSize: 14,
                                    fontFamily: FONT_FAMILY,
                                    fontWeight: 500,
                                    color: bucket.color,
                                  }}
                                >
                                  {bucket.label}
                                </p>
                                <p
                                  style={{
                                    fontSize: 14,
                                    fontFamily: FONT_FAMILY,
                                    fontWeight: 600,
                                    color: 'var(--text)',
                                  }}
                                >
                                  ${round2((percentages[idx] / 100) * amount).toLocaleString()}
                                </p>
                              </div>
                              {/* Slider row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={percentages[idx]}
                                  onChange={(e) => handlePercentageChange(idx, parseInt(e.target.value, 10))}
                                  aria-label={`${bucket.label} percentage`}
                                  style={{
                                    flex: 1,
                                    height: 4,
                                    accentColor: bucket.color === 'var(--text)' ? '#e2e8f0' : bucket.color,
                                    cursor: 'pointer',
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontFamily: FONT_FAMILY,
                                    fontWeight: 500,
                                    color: 'var(--muted)',
                                    minWidth: 32,
                                    textAlign: 'right',
                                  }}
                                >
                                  {percentages[idx]}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </GlassCard>
                      ))}
                    </div>

                    {/* ── Validation hint ──────────────────────────── */}
                    {!isValid && (
                      <p
                        style={{
                          fontSize: 12,
                          fontFamily: FONT_FAMILY,
                          color: totalPercent > 100 ? 'var(--error)' : 'var(--warning)',
                          textAlign: 'center',
                          marginBottom: 12,
                        }}
                      >
                        {totalPercent > 100
                          ? `Over by ${totalPercent - 100}% — adjust to total 100%`
                          : `${100 - totalPercent}% unallocated — assign the rest`}
                      </p>
                    )}

                    {/* ── Confirm Button ───────────────────────────── */}
                    <button
                      onClick={handleConfirm}
                      disabled={!isValid}
                      aria-label="Confirm allocation"
                      style={{
                        width: '100%',
                        height: 52,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isValid
                          ? 'linear-gradient(135deg, #4ade80, #22c55e)'
                          : 'var(--dim)',
                        color: isValid ? '#fff' : 'var(--muted)',
                        fontFamily: FONT_FAMILY,
                        fontSize: 16,
                        fontWeight: 600,
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        cursor: isValid ? 'pointer' : 'not-allowed',
                        opacity: isValid ? 1 : 0.5,
                      }}
                    >
                      {activeGoals.length > 0 && allocation.save > 0
                        ? 'Confirm & Contribute to Goals'
                        : 'Confirm Allocation'}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="goals-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* ── Allocation Summary ───────────────────────── */}
                    <GlassCard
                      elevation="low"
                      glow="healthy"
                      style={{ padding: '12px 16px', marginBottom: 16 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        {BUCKETS.map(bucket => (
                          <div key={bucket.key} style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 11, fontFamily: FONT_FAMILY, color: 'var(--muted)' }}>
                              {bucket.emoji} {bucket.label}
                            </p>
                            <p style={{ fontSize: 14, fontFamily: FONT_FAMILY, fontWeight: 600, color: bucket.color }}>
                              ${allocation[bucket.key].toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </GlassCard>

                    {/* ── Goals List (contribute from Save bucket) ── */}
                    <p
                      style={{
                        fontSize: 13,
                        fontFamily: FONT_FAMILY,
                        color: 'var(--muted)',
                        marginBottom: 10,
                      }}
                    >
                      Savings bucket: ${(allocation.save - contributed).toLocaleString()} remaining
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                      {activeGoals.map(goal => {
                        const pct = goal.targetAmount > 0
                          ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                          : 0
                        const maxContrib = Math.max(0, allocation.save - contributed)
                        const quickAmounts = [10, 25, 50].filter(a => a <= maxContrib)

                        return (
                          <GlassCard key={goal.id} elevation="low" style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                              <span style={{ fontSize: 22 }}>{goal.emoji}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                  style={{
                                    fontSize: 15,
                                    fontFamily: FONT_FAMILY,
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
                                    fontFamily: FONT_FAMILY,
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
                              {quickAmounts.length > 0 ? quickAmounts.map(q => (
                                <button
                                  key={q}
                                  onClick={() => handleContribute(goal.id, goal.name, q)}
                                  aria-label={`Contribute $${q} to ${goal.name}`}
                                  style={{
                                    flex: 1,
                                    padding: '10px 0',
                                    fontSize: 14,
                                    fontFamily: FONT_FAMILY,
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
                              )) : (
                                <p
                                  style={{
                                    fontSize: 12,
                                    fontFamily: FONT_FAMILY,
                                    color: 'var(--muted)',
                                    padding: '10px 0',
                                  }}
                                >
                                  Save bucket fully allocated
                                </p>
                              )}
                            </div>
                          </GlassCard>
                        )
                      })}
                    </div>

                    {/* ── Done button ──────────────────────────────── */}
                    <button
                      onClick={handleDone}
                      aria-label="Done — finish allocation"
                      style={{
                        width: '100%',
                        height: 52,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                        color: '#fff',
                        fontFamily: FONT_FAMILY,
                        fontSize: 16,
                        fontWeight: 600,
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Done
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
    </BottomSheet>
  )
}
