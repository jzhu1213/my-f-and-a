"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, timings } from '@/lib/animations'
import { Sheet } from '@/components/ui/primitives/Sheet'
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
import type { SavingsAccount } from '@/types/folio'
import { getAccountTypeMetadata } from '@/lib/savingsAccountUtils'
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { colorRamp, HORIZONTAL_PADDING } from '@/styles/shared'
import { radius } from '@/styles/surfaces'

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
  { key: 'invest', label: 'Invest', emoji: '📈', color: 'var(--accent)' },
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
  /** Savings/investment accounts available to fund from the Invest bucket */
  savingsAccounts?: SavingsAccount[]
  /** Called when the user contributes from the Invest bucket to a savings account */
  onContributeToSavings?: (accountId: string, amount: number) => void
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
  savingsAccounts,
  onContributeToSavings,
}: PaycheckSheetProps) {
  const { showToast } = useToast()

  // ── State ─────────────────────────────────────────────────────
  const [percentages, setPercentages] = useState<[number, number, number, number]>([80, 10, 5, 5])
  const [activePreset, setActivePreset] = useState<number | null>(0) // index into ALLOCATION_PRESETS or null for custom
  const [showGoalContributions, setShowGoalContributions] = useState(false)
  const [showSavingsContributions, setShowSavingsContributions] = useState(false)
  const [contributed, setContributed] = useState(0)
  const [savingsContributed, setSavingsContributed] = useState(0)
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
      setShowSavingsContributions(false)
      setContributed(0)
      setSavingsContributed(0)
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

  // Savings accounts available to fund from the Invest bucket
  const availableSavingsAccounts = savingsAccounts ?? []
  const hasSavingsStep = availableSavingsAccounts.length > 0 && allocation.invest > 0

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

    // Otherwise, if there are savings accounts to fund, offer that step
    if (hasSavingsStep) {
      setShowSavingsContributions(true)
      return
    }

    showToast('Income split ✓', 'success')
    onClose()
  }, [isValid, allocation, onAllocate, activeGoals, hasSavingsStep, showToast, onClose, showAutoContributeBanner, autoContributions, autoContributeTotal, onContribute])

  const handleContribute = useCallback((goalId: string, goalName: string, amt: number) => {
    onContribute(goalId, amt)
    setContributed(c => c + amt)
    showToast(`+$${amt} → ${goalName} ✓`, 'success')
  }, [onContribute, showToast])

  const handleDone = useCallback(() => {
    // After goal contributions, offer the optional savings-account funding step
    if (hasSavingsStep) {
      setShowGoalContributions(false)
      setShowSavingsContributions(true)
      return
    }
    showToast('Income split ✓', 'success')
    onClose()
  }, [hasSavingsStep, showToast, onClose])

  const handleContributeToSavings = useCallback((accountId: string, accountName: string, amt: number) => {
    onContributeToSavings?.(accountId, amt)
    setSavingsContributed(c => c + amt)
    showToast(`+$${amt} → ${accountName} ✓`, 'success')
  }, [onContributeToSavings, showToast])

  const handleFinishSavings = useCallback(() => {
    showToast('Income split ✓', 'success')
    onClose()
  }, [showToast, onClose])

  // ── Render ────────────────────────────────────────────────────
  return (
    <Sheet open={isOpen} onClose={onClose} size="full" aria-label="Split paycheck">
      <div style={{ padding: '0 24px 32px' }}>
              {/* ── Header ──────────────────────────────────────── */}
              <div style={{ textAlign: 'center', marginBottom: HORIZONTAL_PADDING }}>
                <p
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    fontFamily: FONT_FAMILY,
                    fontWeight: fontWeights.medium,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: spacing.xs,
                  }}
                >
                  Paycheck logged
                </p>
                <p
                  style={{
                    fontSize: 40,
                    fontFamily: FONT_FAMILY,
                    fontWeight: fontWeights.light,
                    color: 'var(--success)',
                    lineHeight: 1,
                  }}
                >
                  +${amount.toLocaleString()}
                </p>
                <p
                  style={{
                    fontSize: typography.body.fontSize,
                    fontFamily: FONT_FAMILY,
                    color: 'var(--muted)',
                    marginTop: 10,
                  }}
                >
                  {showSavingsContributions
                    ? 'Move some of your invest bucket into your accounts'
                    : showGoalContributions
                      ? 'Allocate some savings to your goals'
                      : 'Split it up — pick a preset or customize'}
                </p>
              </div>

              {/* ── Tax Set-Aside Suggestion (gig income) ─────────── */}
              {showTaxSuggestion && taxInfo && (
                <div
                  style={{
                    background: colorRamp.warning[100],
                    border: `1px solid ${colorRamp.warning[300]}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    marginBottom: spacing.md,
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm }}>
                    <span style={{ fontSize: typography.subhead.fontSize, lineHeight: 1.3 }} aria-hidden="true">💡</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: typography['body-sm'].fontSize,
                          fontFamily: FONT_FAMILY,
                          fontWeight: fontWeights.medium,
                          color: 'var(--warning)',
                          marginBottom: 4,
                        }}
                      >
                        Tax heads-up
                      </p>
                      <p
                        style={{
                          fontSize: typography['body-sm'].fontSize,
                          fontFamily: FONT_FAMILY,
                          color: 'var(--sub)',
                          lineHeight: 1.4,
                        }}
                      >
                        Since this is gig income, consider setting aside ~{Math.round(taxInfo.rate * 100)}% (${taxInfo.suggestedReserve.toLocaleString()}) for taxes in your Set Aside bucket.
                      </p>
                      <p
                        style={{
                          fontSize: typography.caption.fontSize,
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
                        fontSize: typography.body.fontSize,
                        cursor: 'pointer',
                        padding: 4,
                        minWidth: 44,
                        minHeight: 44,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
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
                    background: colorRamp.success[100],
                    border: `1px solid ${colorRamp.success[200]}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    marginBottom: spacing.md,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm }}>
                    <span style={{ fontSize: typography.subhead.fontSize, lineHeight: 1.3 }} aria-hidden="true">🎯</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: typography['body-sm'].fontSize,
                          fontFamily: FONT_FAMILY,
                          fontWeight: fontWeights.medium,
                          color: 'var(--success)',
                          marginBottom: 4,
                        }}
                      >
                        Auto-saving to goals
                      </p>
                      <p
                        style={{
                          fontSize: typography['body-sm'].fontSize,
                          fontFamily: FONT_FAMILY,
                          color: 'var(--sub)',
                          lineHeight: 1.4,
                        }}
                      >
                        ${autoContributeTotal} will go toward {autoContributions.length === 1
                          ? autoContributions[0].goalName
                          : `${autoContributions.length} goals`} when you confirm.
                      </p>
                      <div style={{ display: 'flex', gap: 6, marginTop: spacing.xs, flexWrap: 'wrap' }}>
                        {autoContributions.map(c => (
                          <span
                            key={c.goalId}
                            style={{
                              fontSize: typography.caption.fontSize,
                              fontFamily: FONT_FAMILY,
                              color: 'var(--muted)',
                              background: 'var(--fill-05)',
                              borderRadius: radius.min,
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
                        fontSize: typography['body-sm'].fontSize,
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
                {showSavingsContributions ? (
                  <motion.div
                    key="savings-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={timings.fast}
                  >
                    {/* ── Invest bucket remaining ─────────────────── */}
                    <GlassCard
                      elevation="low"
                      glow="healthy"
                      style={{ padding: '12px 16px', marginBottom: spacing.md }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ fontSize: typography['body-sm'].fontSize, fontFamily: FONT_FAMILY, color: 'var(--muted)' }}>
                          📈 Invest bucket remaining
                        </p>
                        <p style={{ fontSize: typography.subhead.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.semibold, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                          ${Math.max(0, allocation.invest - savingsContributed).toLocaleString()}
                        </p>
                      </div>
                    </GlassCard>

                    <p
                      style={{
                        fontSize: typography['body-sm'].fontSize,
                        fontFamily: FONT_FAMILY,
                        color: 'var(--muted)',
                        marginBottom: 10,
                      }}
                    >
                      Fund your future 🌱 — tap to move money into an account
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: HORIZONTAL_PADDING }}>
                      {availableSavingsAccounts.map(account => {
                        const meta = getAccountTypeMetadata(account.type)
                        const remaining = Math.max(0, allocation.invest - savingsContributed)
                        // Quick-tap amounts derived from the account's monthly contribution.
                        // Offer the full monthly contribution plus a couple sensible fractions,
                        // all capped at the remaining invest bucket. Fall back to small presets
                        // when no monthly contribution is configured.
                        const baseAmounts = account.monthlyContribution > 0
                          ? [
                              Math.round(account.monthlyContribution / 2),
                              Math.round(account.monthlyContribution),
                            ]
                          : [25, 50, 100]
                        const quickAmounts = Array.from(new Set(baseAmounts))
                          .filter(a => a > 0 && a <= remaining)

                        return (
                          <GlassCard key={account.id} elevation="low" style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 12 }}>
                              <span style={{ fontSize: typography.headline.fontSize }}>{meta.emoji}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                  style={{
                                    fontSize: typography.body.fontSize,
                                    fontFamily: FONT_FAMILY,
                                    fontWeight: fontWeights.medium,
                                    color: 'var(--text)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {account.name}
                                </p>
                                <p
                                  style={{
                                    fontSize: typography['body-sm'].fontSize,
                                    fontFamily: FONT_FAMILY,
                                    color: 'var(--muted)',
                                    marginTop: 2,
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {meta.label} · ${account.balance.toLocaleString()}
                                </p>
                              </div>
                            </div>

                            {/* Quick-contribution chips */}
                            <div style={{ display: 'flex', gap: spacing.xs }}>
                              {quickAmounts.length > 0 ? quickAmounts.map(q => (
                                <button
                                  key={q}
                                  onClick={() => handleContributeToSavings(account.id, account.name, q)}
                                  aria-label={`Contribute $${q} to ${account.name}`}
                                  style={{
                                    flex: 1,
                                    padding: '10px 0',
                                    fontSize: typography.body.fontSize,
                                    fontFamily: FONT_FAMILY,
                                    fontWeight: fontWeights.semibold,
                                    color: 'var(--text)',
                                    background: 'var(--fill-06)',
                                    border: '1px solid var(--line)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  +${q}
                                </button>
                              )) : (
                                <p
                                  style={{
                                    fontSize: typography['body-sm'].fontSize,
                                    fontFamily: FONT_FAMILY,
                                    color: 'var(--muted)',
                                    padding: '10px 0',
                                  }}
                                >
                                  Invest bucket fully split
                                </p>
                              )}
                            </div>
                          </GlassCard>
                        )
                      })}
                    </div>

                    {/* ── Finish button (always skippable) ─────────── */}
                    <button
                      onClick={handleFinishSavings}
                      aria-label="Done — finish splitting income"
                      style={{
                        width: '100%',
                        height: 52,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--gradient-action)',
                        color: 'var(--text)',
                        fontFamily: FONT_FAMILY,
                        fontSize: typography.body.fontSize,
                        fontWeight: fontWeights.semibold,
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {savingsContributed > 0 ? 'Done' : 'Skip for now'}
                    </button>
                  </motion.div>
                ) : !showGoalContributions ? (
                  <motion.div
                    key="allocation-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={timings.fast}
                  >
                    {/* ── Preset Buttons ───────────────────────────── */}
                    <div style={{ display: 'flex', gap: spacing.xs, marginBottom: HORIZONTAL_PADDING }}>
                      {ALLOCATION_PRESETS.map((preset, idx) => (
                        <button
                          key={preset.label}
                          onClick={() => handlePresetSelect(idx)}
                          aria-label={`${preset.label} preset: ${preset.split.join('/')}`}
                          style={{
                            flex: 1,
                            padding: '10px 6px',
                            fontSize: typography['body-sm'].fontSize,
                            fontFamily: FONT_FAMILY,
                            fontWeight: fontWeights.semibold,
                            color: activePreset === idx ? 'var(--color-canvas)' : 'var(--text)',
                            background: activePreset === idx
                              ? 'var(--gradient-action)'
                              : 'var(--fill-06)',
                            border: activePreset === idx
                              ? 'none'
                              : '1px solid var(--line)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ display: 'block', fontSize: typography.body.fontSize, marginBottom: 2 }}>
                            {preset.emoji}
                          </span>
                          {preset.label}
                          <span
                            style={{
                              display: 'block',
                              fontSize: typography.caption.fontSize,
                              fontWeight: fontWeights.regular,
                              color: activePreset === idx ? 'var(--text)' : 'var(--muted)',
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
                        aria-label="Custom split"
                        style={{
                          flex: 1,
                          padding: '10px 6px',
                          fontSize: typography['body-sm'].fontSize,
                          fontFamily: FONT_FAMILY,
                          fontWeight: fontWeights.semibold,
                          color: activePreset === null ? 'var(--color-canvas)' : 'var(--text)',
                          background: activePreset === null
                            ? 'var(--gradient-action)'
                            : 'var(--fill-06)',
                          border: activePreset === null
                            ? 'none'
                            : '1px solid var(--line)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ display: 'block', fontSize: typography.body.fontSize, marginBottom: 2 }} aria-hidden="true">✏️</span>
                        Custom
                      </button>
                    </div>

                    {/* ── Allocation Breakdown ─────────────────────── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: HORIZONTAL_PADDING }}>
                      {BUCKETS.map((bucket, idx) => (
                        <GlassCard key={bucket.key} elevation="low" style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                            <span style={{ fontSize: typography.subhead.fontSize }}>{bucket.emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <p
                                  style={{
                                    fontSize: typography.body.fontSize,
                                    fontFamily: FONT_FAMILY,
                                    fontWeight: fontWeights.medium,
                                    color: bucket.color,
                                  }}
                                >
                                  {bucket.label}
                                </p>
                                <p
                                  style={{
                                    fontSize: typography.body.fontSize,
                                    fontFamily: FONT_FAMILY,
                                    fontWeight: fontWeights.semibold,
                                    color: 'var(--text)',
                                  }}
                                >
                                  ${round2((percentages[idx] / 100) * amount).toLocaleString()}
                                </p>
                              </div>
                              {/* Slider row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
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
                                    accentColor: bucket.color === 'var(--text)' ? 'var(--sub)' : bucket.color,
                                    cursor: 'pointer',
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: typography['body-sm'].fontSize,
                                    fontFamily: FONT_FAMILY,
                                    fontWeight: fontWeights.medium,
                                    color: 'var(--muted)',
                                    minWidth: 32,
                                    textAlign: "end",
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
                          fontSize: typography['body-sm'].fontSize,
                          fontFamily: FONT_FAMILY,
                          color: totalPercent > 100 ? 'var(--error)' : 'var(--warning)',
                          textAlign: 'center',
                          marginBottom: spacing.sm,
                        }}
                      >
                        {totalPercent > 100
                          ? `Over by ${totalPercent - 100}% — adjust to total 100%`
                          : `${100 - totalPercent}% left to assign`}
                      </p>
                    )}

                    {/* ── Confirm Button ───────────────────────────── */}
                    <button
                      onClick={handleConfirm}
                      disabled={!isValid}
                      aria-label="Confirm split"
                      style={{
                        width: '100%',
                        height: 52,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isValid
                          ? 'var(--gradient-action)'
                          : 'var(--dim)',
                        color: isValid ? 'var(--color-canvas)' : 'var(--muted)',
                        fontFamily: FONT_FAMILY,
                        fontSize: typography.body.fontSize,
                        fontWeight: fontWeights.semibold,
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        cursor: isValid ? 'pointer' : 'not-allowed',
                        opacity: isValid ? 1 : 0.5,
                      }}
                    >
                      {activeGoals.length > 0 && allocation.save > 0
                        ? 'Confirm & Contribute to Goals'
                        : 'Confirm Split'}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="goals-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={timings.fast}
                  >
                    {/* ── Allocation Summary ───────────────────────── */}
                    <GlassCard
                      elevation="low"
                      glow="healthy"
                      style={{ padding: '12px 16px', marginBottom: spacing.md }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs }}>
                        {BUCKETS.map(bucket => (
                          <div key={bucket.key} style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: typography.caption.fontSize, fontFamily: FONT_FAMILY, color: 'var(--muted)' }}>
                              {bucket.emoji} {bucket.label}
                            </p>
                            <p style={{ fontSize: typography.body.fontSize, fontFamily: FONT_FAMILY, fontWeight: fontWeights.semibold, color: bucket.color }}>
                              ${allocation[bucket.key].toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </GlassCard>

                    {/* ── Goals List (contribute from Save bucket) ── */}
                    <p
                      style={{
                        fontSize: typography['body-sm'].fontSize,
                        fontFamily: FONT_FAMILY,
                        color: 'var(--muted)',
                        marginBottom: 10,
                      }}
                    >
                      Savings bucket: ${(allocation.save - contributed).toLocaleString()} remaining
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: HORIZONTAL_PADDING }}>
                      {activeGoals.map(goal => {
                        const pct = goal.targetAmount > 0
                          ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                          : 0
                        const maxContrib = Math.max(0, allocation.save - contributed)
                        const quickAmounts = [10, 25, 50].filter(a => a <= maxContrib)

                        return (
                          <GlassCard key={goal.id} elevation="low" style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 12 }}>
                              <span style={{ fontSize: typography.headline.fontSize }}>{goal.emoji}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                  style={{
                                    fontSize: typography.body.fontSize,
                                    fontFamily: FONT_FAMILY,
                                    fontWeight: fontWeights.medium,
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
                                    fontSize: typography['body-sm'].fontSize,
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
                            <div style={{ display: 'flex', gap: spacing.xs }}>
                              {quickAmounts.length > 0 ? quickAmounts.map(q => (
                                <button
                                  key={q}
                                  onClick={() => handleContribute(goal.id, goal.name, q)}
                                  aria-label={`Contribute $${q} to ${goal.name}`}
                                  style={{
                                    flex: 1,
                                    padding: '10px 0',
                                    fontSize: typography.body.fontSize,
                                    fontFamily: FONT_FAMILY,
                                    fontWeight: fontWeights.semibold,
                                    color: 'var(--text)',
                                    background: 'var(--fill-06)',
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
                                    fontSize: typography['body-sm'].fontSize,
                                    fontFamily: FONT_FAMILY,
                                    color: 'var(--muted)',
                                    padding: '10px 0',
                                  }}
                                >
                                  Save bucket fully split
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
                      aria-label="Done — finish splitting income"
                      style={{
                        width: '100%',
                        height: 52,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--gradient-action)',
                        color: 'var(--text)',
                        fontFamily: FONT_FAMILY,
                        fontSize: typography.body.fontSize,
                        fontWeight: fontWeights.semibold,
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {hasSavingsStep ? 'Next — fund your accounts' : 'Done'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
    </Sheet>
  )
}
