"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Sheet } from '@/components/ui/primitives/Sheet'
import { useToast } from '@/contexts/ToastContext'
import { FONT_FAMILY, spacing, pxToRem } from '@/styles/typography'
import { borderRadius, shadows, fills, colorRamp, roundButton } from '@/styles/shared'
import type { FundingSource } from '@/lib/fundingSources'
import { predictFundingSource } from '@/lib/fundingSources'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { triggerHaptic } from '@/lib/haptics'
import { listFriends } from '@/lib/social/friends'
import { searchPublicProfiles } from '@/lib/social/profiles'
import { createSplit } from '@/lib/social/splits'
import type { SplitMethod } from '@/lib/social/splits.types'
import { computeSplitAmount, computePerFriendOwed, computePerFriendOwedCustom, computePercentSplit, computeShareSplit } from '@/lib/splitUtils'
import type { Transaction } from '@/types'
import type { SavingsAccount } from '@/types/folio'
import { getAccountTypeMetadata } from '@/lib/savingsAccountUtils'
import { TagInput } from './TagInput'
import { getRecentTags } from '@/lib/tagUtils'

// ── Quick-contribute dedupe (task 157.2) ─────────────────────────────────────
// Persist which paychecks have already shown the savings-contribute chip so the
// same logged income event doesn't nag on re-open / re-log within a short window.

const CONTRIBUTE_PROMPT_SEEN_KEY = 'folio_income_contribute_seen'

/** Build a stable key for a paycheck event from its date + amount. */
function makePaycheckKey(date: string, amount: number): string {
  return `${date}_${amount}`
}

/** Whether the contribute chip has already been surfaced for this paycheck. */
function hasSeenContributePrompt(key: string): boolean {
  try {
    const raw = localStorage.getItem(CONTRIBUTE_PROMPT_SEEN_KEY)
    if (!raw) return false
    const seen = JSON.parse(raw)
    return Array.isArray(seen) && seen.includes(key)
  } catch {
    return false
  }
}

/** Record that the contribute chip has been surfaced for this paycheck. */
function markContributePromptSeen(key: string): void {
  try {
    const raw = localStorage.getItem(CONTRIBUTE_PROMPT_SEEN_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    const seen: string[] = Array.isArray(parsed) ? parsed : []
    if (!seen.includes(key)) seen.push(key)
    // Bound growth — keep only the most recent entries.
    localStorage.setItem(CONTRIBUTE_PROMPT_SEEN_KEY, JSON.stringify(seen.slice(-20)))
  } catch {
    /* ignore — dedupe is best-effort */
  }
}

// ── Date picker helpers ──────────────────────────────────────────────────────

/** Returns YYYY-MM-DD of the most recent Friday (or today if today is Friday) */
function getLastFriday(today: Date): string {
  const d = new Date(today)
  const day = d.getDay() // 0=Sun, 5=Fri
  const diff = day >= 5 ? day - 5 : day + 2
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

/** A split participant — either a linked friend (with userId) or a name-only entry */
interface IncomeSplitParticipant {
  id: string
  name: string
  userId: string | null
  avatarUrl?: string | null
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
  onSubmit: (data: { amount: number; note?: string; fundingSourceId?: string; date?: string; tags?: string[]; isGigIncome?: boolean }) => void
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
  /** Savings/investment accounts — used to offer a quick-contribute chip after logging (task 157.2) */
  savingsAccounts?: SavingsAccount[]
  /** Called when user taps the quick-contribute chip for a recurring saver (task 157.2) */
  onContributeToSavings?: (accountId: string, amount: number) => void
  /** Recent split partner names for quick-select chips (task 284.1) */
  recentSplitPartners?: string[]
  /** Called when user taps "View settle-up" to navigate to the ReimbursementLedger (task 284.1) */
  onOpenSettleUp?: () => void
}

const MAX_AMOUNT = 99999

export function IncomeSheet({ isOpen, onClose, onSubmit, onShowPaycheck, onUndo, fundingSources = [], transactions = [], onCreateDisbursement, savingsAccounts = [], onContributeToSavings, recentSplitPartners = [], onOpenSettleUp }: IncomeSheetProps) {
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
  const [tags, setTags] = useState<string[]>([])

  // ── Split state (task 284.1) ───────────────────────────────────────────
  const [splitEnabled, setSplitEnabled] = useState(false)
  const [splitMode, setSplitMode] = useState<SplitMethod>('even')
  const [splitCount, setSplitCount] = useState(2)
  const [splitWith, setSplitWith] = useState('')
  const [splitFriends, setSplitFriends] = useState<string[]>([])
  const [splitParticipants, setSplitParticipants] = useState<IncomeSplitParticipant[]>([])
  const [customShareInput, setCustomShareInput] = useState('')
  const [percentInputs, setPercentInputs] = useState<number[]>([])
  const [shareInputs, setShareInputs] = useState<number[]>([])
  const [showAdvancedSplit, setShowAdvancedSplit] = useState(false)
  const [friendsList, setFriendsList] = useState<{ userId: string; name: string; avatarUrl?: string | null }[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [showNameInput, setShowNameInput] = useState(false)
  const splitWithRef = useRef<HTMLInputElement>(null)

  // ── Date picker state (task 87.2) ──────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showCustomDateInput, setShowCustomDateInput] = useState(false)

  // ── Funding source selection state (task 81.1) ─────────────────────────
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [showSourcePicker, setShowSourcePicker] = useState(false)

  // ── Quick-contribute prompt state (task 157.2) ─────────────────────────
  // When set, the sheet shows a subtle "Contribute $X to <account>?" phase
  // after income is logged, before finally closing. null = form phase.
  const [contributePrompt, setContributePrompt] = useState<{ amount: number; isGigIncome: boolean } | null>(null)

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
      setTags([])
      setSplitEnabled(false)
      setSplitMode('even')
      setSplitCount(2)
      setSplitWith('')
      setSplitFriends([])
      setSplitParticipants([])
      setCustomShareInput('')
      setPercentInputs([])
      setShareInputs([])
      setShowAdvancedSplit(false)
      setShowNameInput(false)
      setSelectedDate(new Date().toISOString().slice(0, 10))
      setShowDatePicker(false)
      setShowCustomDateInput(false)
      setContributePrompt(null)
      
      // Smart source prediction for income (task 81.2)
      // Use 'income' category for prediction
      const predictedSourceId = predictFundingSource(transactions, 'income', fundingSources, new Date())
      // Fall back to first source if no prediction
      setSelectedSourceId(predictedSourceId ?? (fundingSources.length > 0 ? fundingSources[0].id : null))
      setShowSourcePicker(false)
      
      // NOTE: Do NOT auto-focus the amount input here. On iOS, focusing an input
      // triggers the virtual keyboard which resizes the viewport and pushes the
      // fixed-position sheet up awkwardly. The user can tap the input when ready.
    }
  }, [isOpen, fundingSources, transactions])

  // Load friends list when split is enabled (task 284.1)
  useEffect(() => {
    if (splitEnabled && friendsList.length === 0 && !friendsLoading) {
      setFriendsLoading(true)
      listFriends().then(async (friendships) => {
        const { data: session } = await (await import('@/lib/supabaseClient')).supabase.auth.getSession()
        const userId = session?.session?.user?.id
        if (!userId || friendships.length === 0) {
          setFriendsLoading(false)
          return
        }
        const friendUserIds = friendships.map((f) =>
          f.requesterId === userId ? f.addresseeId : f.requesterId
        )
        const profiles = await Promise.all(
          friendUserIds.map((id) => searchPublicProfiles(id).then((results) => results.find((p) => p.id === id)))
        )
        const resolved = friendUserIds.map((id, i) => ({
          userId: id,
          name: profiles[i]?.displayName || profiles[i]?.handle || `Friend`,
          avatarUrl: profiles[i]?.avatarUrl ?? null,
        }))
        setFriendsList(resolved)
        setFriendsLoading(false)
      }).catch(() => setFriendsLoading(false))
    }
  }, [splitEnabled, friendsList.length, friendsLoading])

  // Auto-sync splitCount with participants (task 284.1)
  useEffect(() => {
    if (splitFriends.length > 0) {
      setSplitCount(splitFriends.length + 1)
    }
  }, [splitFriends])

  // Sync percent/share inputs with participant count
  useEffect(() => {
    const count = splitParticipants.length
    if (count > 0) {
      setPercentInputs((prev) => {
        if (prev.length === count) return prev
        const even = Math.floor(100 / count)
        return Array(count).fill(even)
      })
      setShareInputs((prev) => {
        if (prev.length === count) return prev
        return Array(count).fill(1)
      })
    }
  }, [splitParticipants.length])

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
      tags: tags.length > 0 ? tags : undefined,
      isGigIncome: isGigIncome || undefined,
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

    // Quick-contribute chip for recurring savers (task 157.2).
    // If the user has savings accounts with a monthly contribution, surface a
    // subtle in-sheet prompt before closing — but only once per paycheck.
    const eligibleAccounts = savingsAccounts.filter(a => a.monthlyContribution > 0)
    if (eligibleAccounts.length > 0 && onContributeToSavings) {
      const paycheckKey = makePaycheckKey(selectedDate, parsed)
      if (!hasSeenContributePrompt(paycheckKey)) {
        markContributePromptSeen(paycheckKey)
        // Show the contribute phase; finalize (paycheck sheet + close) is
        // deferred until the user contributes or dismisses.
        setContributePrompt({ amount: parsed, isGigIncome: !!isGigIncome })
        return
      }
    }

    // Trigger PaycheckSheet if handler provided
    if (onShowPaycheck) {
      onShowPaycheck(parsed, isGigIncome || undefined)
    }

    onClose()
  }, [amount, note, isGigIncome, isFinancialAid, spreadMonths, selectedSourceId, selectedDate, tags, onSubmit, onClose, onUndo, showToast, onShowPaycheck, onCreateDisbursement, savingsAccounts, onContributeToSavings])

  /** Finish the flow after the contribute phase: open PaycheckSheet then close. */
  const finalizeSubmit = useCallback((parsed: number, gig: boolean) => {
    if (onShowPaycheck) {
      onShowPaycheck(parsed, gig || undefined)
    }
    onClose()
  }, [onShowPaycheck, onClose])

  /** User tapped a quick-contribute chip — contribute, celebrate, then finish. */
  const handleQuickContribute = useCallback((account: SavingsAccount) => {
    triggerHaptic('light')
    onContributeToSavings?.(account.id, account.monthlyContribution)
    const amt = account.monthlyContribution
    const formatted = amt % 1 === 0 ? `$${amt}` : `$${amt.toFixed(2)}`
    showToast(`Nice — ${formatted} on its way to ${account.name} 🌱`, 'success')
    const pending = contributePrompt
    setContributePrompt(null)
    if (pending) finalizeSubmit(pending.amount, pending.isGigIncome)
  }, [onContributeToSavings, showToast, contributePrompt, finalizeSubmit])

  /** User dismissed the contribute phase — just finish the flow. */
  const handleDismissContribute = useCallback(() => {
    triggerHaptic('light')
    const pending = contributePrompt
    setContributePrompt(null)
    if (pending) finalizeSubmit(pending.amount, pending.isGigIncome)
  }, [contributePrompt, finalizeSubmit])

  const canSubmit = (() => {
    const parsed = parseFloat(amount)
    return !!parsed && parsed > 0 && parsed <= MAX_AMOUNT
  })()

  return (
    <Sheet open={isOpen} onClose={onClose} size="full" aria-label="Log income">
      {contributePrompt ? (
        /* ── Quick-contribute phase (task 157.2) ─────────────────── */
        <div style={{ padding: '8px 24px 32px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={springs.snappy}
            style={{ textAlign: 'center' }}
          >
            <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden="true">🌱</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, fontFamily: FONT_FAMILY, color: 'var(--text)', margin: '0 0 6px' }}>
              Income logged ✓
            </h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', fontFamily: FONT_FAMILY, margin: '0 0 20px' }}>
              Want to move a little toward future you?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {savingsAccounts
                .filter(a => a.monthlyContribution > 0)
                .sort((a, b) => b.monthlyContribution - a.monthlyContribution)
                .slice(0, 3)
                .map((account) => {
                  const meta = getAccountTypeMetadata(account.type)
                  const amt = account.monthlyContribution
                  const formatted = amt % 1 === 0 ? `$${amt.toLocaleString('en-US')}` : `$${amt.toFixed(2)}`
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => handleQuickContribute(account)}
                      aria-label={`Contribute ${formatted} to ${account.name}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '14px 16px',
                        background: colorRamp.success[200],
                        border: `1px solid ${colorRamp.success[300]}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontFamily: FONT_FAMILY,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 22 }} aria-hidden="true">{meta.emoji}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                          Contribute {formatted} to {account.name}?
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          Your usual monthly contribution
                        </span>
                      </span>
                      <span style={{ fontSize: 18, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }} aria-hidden="true">→</span>
                    </button>
                  )
                })}
            </div>

            <button
              type="button"
              onClick={handleDismissContribute}
              aria-label="Not now"
              style={{
                marginTop: 16,
                background: 'transparent',
                border: 'none',
                color: 'var(--sub)',
                fontSize: 14,
                fontFamily: FONT_FAMILY,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '10px 16px',
              }}
            >
              Not now
            </button>
          </motion.div>
        </div>
      ) : (
      <div style={{ padding: '0 24px 32px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              {/* ── Amount Input (calculator-style) ─────────────────── */}
              <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
                {/* Quick income presets — common student amounts (task 65) */}
                <div
                  style={{
                    display: 'flex',
                    gap: spacing.xs,
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    marginBottom: spacing.md,
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
                        padding: '10px 16px',
                        minHeight: 44,
                        background: amount === String(preset)
                          ? colorRamp.success[200]
                          : fills[4],
                        border: amount === String(preset)
                          ? `1px solid ${colorRamp.success[400]}`
                          : `1px solid ${fills[10]}`,
                        borderRadius: borderRadius.full,
                        cursor: 'pointer',
                        fontSize: pxToRem(14),
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
                    gap: spacing.xxs,
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
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--text)',
                      textAlign: 'center',
                      width: '100%',
                      maxWidth: 240,
                      caretColor: 'var(--accent)',
                      lineHeight: 1.1,
                    }}
                  />
                </div>
                <p
                  style={{
                    fontSize: pxToRem(12),
                    color: 'var(--muted)',
                    marginTop: spacing.xs,
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
                                  ? colorRamp.success[200]
                                  : 'transparent',
                                border: selectedSourceId === source.id
                                  ? `1px solid ${colorRamp.success[400]}`
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
                <div style={{ marginBottom: spacing.xl, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowNoteField(true)}
                    aria-label="Add a note"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 'var(--radius-md)',
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      minHeight: 44,
                      fontSize: pxToRem(13),
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
                <div style={{ marginBottom: spacing.xl }}>
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
                        borderBottom: '1.5px solid var(--line)',
                        outline: 'none',
                        fontSize: pxToRem(15),
                        fontFamily: FONT_FAMILY,
                        color: 'var(--text)',
                        padding: `${spacing.sm}px 0`,
                        caretColor: 'var(--accent)',
                        transition: 'border-color 0.2s ease',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
                      onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'var(--line)' }}
                    />
                    {/* Character count indicator — shown when 50+ chars */}
                    {note.length >= 50 && (
                      <span
                        style={{
                          position: 'absolute',
                          right: 0,
                          bottom: 14,
                          fontSize: pxToRem(11),
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
              <div style={{ marginBottom: spacing.xl, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsGigIncome(!isGigIncome)}
                  aria-label={isGigIncome ? 'Marked as gig income' : 'Mark as gig or freelance income'}
                  aria-pressed={isGigIncome}
                  style={{
                    background: isGigIncome
                      ? colorRamp.warning[200]
                      : 'transparent',
                    border: isGigIncome
                      ? `1px solid ${colorRamp.warning[400]}`
                      : `1px dashed ${fills[15]}`,
                    borderRadius: 'var(--radius-md)',
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    minHeight: 44,
                    fontSize: pxToRem(13),
                    fontFamily: FONT_FAMILY,
                    fontWeight: isGigIncome ? 500 : 400,
                    color: isGigIncome ? 'var(--warning)' : 'var(--sub)',
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
                        ? colorRamp.accent[200]
                        : 'transparent',
                      border: isFinancialAid
                        ? `1px solid ${colorRamp.accent[400]}`
                        : `1px dashed ${fills[15]}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 16px',
                      fontSize: 13,
                      fontFamily: FONT_FAMILY,
                      fontWeight: isFinancialAid ? 500 : 400,
                      color: isFinancialAid ? 'var(--accent)' : 'var(--sub)',
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
                          background: colorRamp.accent[100],
                          border: `1px solid ${colorRamp.accent[200]}`,
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
                                  ? colorRamp.accent[200]
                                  : fills[4],
                                border: spreadMonths === m
                                  ? `1px solid ${colorRamp.accent[400]}`
                                  : `1px solid ${fills[10]}`,
                                borderRadius: borderRadius.full,
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: spreadMonths === m ? 600 : 400,
                                fontFamily: FONT_FAMILY,
                                color: spreadMonths === m ? 'var(--accent)' : 'var(--sub)',
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
                      ? colorRamp.accent[200]
                      : fills[4],
                    border: selectedDate !== new Date().toISOString().slice(0, 10)
                      ? `1px solid ${colorRamp.accent[400]}`
                      : `1px solid ${fills[10]}`,
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
                            ? colorRamp.accent[200]
                            : fills[4],
                          border: selectedDate === new Date().toISOString().slice(0, 10)
                            ? `1px solid ${colorRamp.accent[400]}`
                            : `1px solid ${fills[10]}`,
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
                                ? colorRamp.accent[200]
                                : fills[4],
                              border: selectedDate === yesterday
                                ? `1px solid ${colorRamp.accent[400]}`
                                : `1px solid ${fills[10]}`,
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
                                ? colorRamp.accent[200]
                                : fills[4],
                              border: selectedDate === lastFri
                                ? `1px solid ${colorRamp.accent[400]}`
                                : `1px solid ${fills[10]}`,
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
                            ? colorRamp.accent[200]
                            : fills[4],
                          border: showCustomDateInput
                            ? `1px solid ${colorRamp.accent[400]}`
                            : `1px solid ${fills[10]}`,
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

              {/* ── Tags (optional, task 130.1) ────────────────────────── */}
              <div style={{ marginBottom: 28 }}>
                <TagInput
                  tags={tags}
                  onChange={setTags}
                  suggestions={getRecentTags(transactions)}
                  collapsible
                />
              </div>

              {/* ── Split Toggle (task 284.1) ────────────────────────────── */}
              <div style={{ marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={() => {
                    setSplitEnabled((prev) => !prev)
                    triggerHaptic('light')
                  }}
                  aria-pressed={splitEnabled}
                  aria-label="Split this income"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '12px 14px',
                    background: splitEnabled
                      ? 'rgba(129, 140, 248, 0.06)'
                      : 'transparent',
                    border: splitEnabled
                      ? '1px solid rgba(129, 140, 248, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 10,
                      background: splitEnabled
                        ? 'rgba(129, 140, 248, 0.8)'
                        : 'rgba(255, 255, 255, 0.12)',
                      position: 'relative',
                      flexShrink: 0,
                      transition: 'background 0.15s ease',
                    }}
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: splitEnabled ? 18 : 2,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: 'var(--text)',
                        transition: 'left 0.15s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    />
                  </span>
                  <span
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: 14,
                      fontWeight: 500,
                      color: splitEnabled ? 'var(--text)' : 'var(--sub)',
                    }}
                  >
                    Split this
                  </span>
                </button>

                {/* Split controls — shown when toggle is on */}
                <AnimatePresence>
                  {splitEnabled && (
                    <motion.div
                      key="income-split-controls"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={springs.snappy}
                      style={{ overflow: 'hidden' }}
                    >
                      {/* Participant picker (task 284.1) */}
                      <div style={{ padding: '14px 4px 0' }}>
                        {/* Selected participant chips */}
                        {splitParticipants.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }} aria-label="Added split partners">
                            {splitParticipants.map((p) => (
                              <span
                                key={p.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: p.userId ? 'rgba(129, 140, 248, 0.12)' : 'rgba(129, 140, 248, 0.08)',
                                  border: p.userId ? '1px solid rgba(129, 140, 248, 0.3)' : '1px solid rgba(129, 140, 248, 0.2)',
                                  borderRadius: borderRadius.full,
                                  padding: '5px 10px',
                                  fontSize: 12,
                                  fontFamily: FONT_FAMILY,
                                  fontWeight: 500,
                                  color: 'var(--text)',
                                }}
                              >
                                {p.userId && <span style={{ fontSize: 10, opacity: 0.7 }}>👤</span>}
                                {p.name}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSplitParticipants((prev) => prev.filter((x) => x.id !== p.id))
                                    setSplitFriends((prev) => prev.filter((f) => f !== p.name))
                                    triggerHaptic('light')
                                  }}
                                  aria-label={`Remove ${p.name}`}
                                  style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, lineHeight: 1 }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Friends quick-select chips */}
                        {friendsList.length > 0 && !showNameInput && (
                          <div style={{ marginBottom: 10 }}>
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Friends</span>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-label="Select a friend to split with">
                              {friendsList
                                .filter((f) => !splitParticipants.some((p) => p.userId === f.userId))
                                .slice(0, 8)
                                .map((friend) => (
                                  <button
                                    key={friend.userId}
                                    type="button"
                                    onClick={() => {
                                      const newP: IncomeSplitParticipant = { id: friend.userId, name: friend.name, userId: friend.userId, avatarUrl: friend.avatarUrl }
                                      setSplitParticipants((prev) => [...prev, newP])
                                      setSplitFriends((prev) => [...prev, friend.name])
                                      triggerHaptic('light')
                                    }}
                                    aria-label={`Split with ${friend.name}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      background: 'rgba(129, 140, 248, 0.06)',
                                      border: '1px solid rgba(129, 140, 248, 0.2)',
                                      borderRadius: borderRadius.full,
                                      padding: '6px 12px',
                                      fontSize: 12,
                                      fontFamily: FONT_FAMILY,
                                      fontWeight: 500,
                                      color: 'var(--sub)',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <span style={{ fontSize: 10 }}>👤</span>
                                    {friend.name}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        {friendsLoading && (
                          <span style={{ fontFamily: FONT_FAMILY, fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Loading friends…</span>
                        )}

                        {/* "Just type a name" fallback */}
                        {!showNameInput && (
                          <button
                            type="button"
                            onClick={() => { setShowNameInput(true); triggerHaptic('light') }}
                            style={{ background: 'transparent', border: 'none', padding: '4px 0', cursor: 'pointer', fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 500, color: 'rgba(129, 140, 248, 0.8)', marginBottom: 4 }}
                            aria-label="Type a name instead"
                          >
                            + Just type a name
                          </button>
                        )}

                        {/* Name text input */}
                        {(showNameInput || (friendsList.length === 0 && !friendsLoading)) && (
                          <>
                            <input
                              ref={splitWithRef}
                              type="text"
                              placeholder={splitParticipants.length > 0 ? 'Add another person...' : 'Who are you splitting with?'}
                              value={splitWith}
                              onChange={(e) => setSplitWith(e.target.value.slice(0, 40))}
                              onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ',') && splitWith.trim()) {
                                  e.preventDefault()
                                  const name = splitWith.trim().replace(/,+$/, '')
                                  if (name && !splitFriends.includes(name)) {
                                    const newP: IncomeSplitParticipant = { id: `name-${Date.now()}-${name}`, name, userId: null }
                                    setSplitParticipants((prev) => [...prev, newP])
                                    setSplitFriends((prev) => [...prev, name])
                                  }
                                  setSplitWith('')
                                  triggerHaptic('light')
                                }
                              }}
                              maxLength={40}
                              aria-label="Friend's name to split with"
                              style={{ width: '100%', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: borderRadius.md, outline: 'none', fontSize: 14, fontFamily: FONT_FAMILY, color: 'var(--text)', padding: '10px 14px', caretColor: 'var(--text)' }}
                            />
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                              Press Enter or comma to add
                            </span>
                          </>
                        )}

                        {/* Recent split partners */}
                        {recentSplitPartners.filter((n) => !splitFriends.includes(n)).length > 0 && !splitWith.trim() && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }} aria-label="Recent split partners">
                            {recentSplitPartners.filter((n) => !splitFriends.includes(n)).slice(0, 5).map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  const newP: IncomeSplitParticipant = { id: `recent-${name}`, name, userId: null }
                                  setSplitParticipants((prev) => [...prev, newP])
                                  setSplitFriends((prev) => [...prev, name])
                                  triggerHaptic('light')
                                }}
                                aria-label={`Split with ${name}`}
                                style={{ background: 'rgba(129, 140, 248, 0.06)', border: '1px solid rgba(129, 140, 248, 0.2)', borderRadius: borderRadius.full, padding: '6px 12px', fontSize: 12, fontFamily: FONT_FAMILY, fontWeight: 500, color: 'var(--sub)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Split mode selector */}
                      <div style={{ padding: '14px 4px 0' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" onClick={() => { setSplitMode('even'); triggerHaptic('light') }} aria-pressed={splitMode === 'even'} style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 500, fontFamily: FONT_FAMILY, cursor: 'pointer', transition: 'background 0.15s, color 0.15s', textAlign: 'center', color: splitMode === 'even' ? 'var(--text)' : 'var(--muted)', background: splitMode === 'even' ? 'rgba(129, 140, 248, 0.12)' : 'transparent' }}>Even</button>
                          <button type="button" onClick={() => { setSplitMode('custom'); triggerHaptic('light') }} aria-pressed={splitMode === 'custom'} style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 500, fontFamily: FONT_FAMILY, cursor: 'pointer', transition: 'background 0.15s, color 0.15s', textAlign: 'center', color: splitMode === 'custom' ? 'var(--text)' : 'var(--muted)', background: splitMode === 'custom' ? 'rgba(129, 140, 248, 0.12)' : 'transparent' }}>Custom</button>
                          {!showAdvancedSplit && (
                            <button type="button" onClick={() => { setShowAdvancedSplit(true); triggerHaptic('light') }} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 500, fontFamily: FONT_FAMILY, cursor: 'pointer', color: 'var(--muted)', background: 'transparent' }} aria-label="More split options">More ›</button>
                          )}
                        </div>

                        {/* Advanced modes — percent & shares */}
                        <AnimatePresence>
                          {showAdvancedSplit && (
                            <motion.div key="income-advanced-split" initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }} exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }} transition={springs.snappy} style={{ overflow: 'hidden' }}>
                              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                <button type="button" onClick={() => { setSplitMode('percent'); triggerHaptic('light') }} aria-pressed={splitMode === 'percent'} style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 500, fontFamily: FONT_FAMILY, cursor: 'pointer', transition: 'background 0.15s, color 0.15s', textAlign: 'center', color: splitMode === 'percent' ? 'var(--text)' : 'var(--muted)', background: splitMode === 'percent' ? 'rgba(129, 140, 248, 0.12)' : 'transparent' }}>By %</button>
                                <button type="button" onClick={() => { setSplitMode('shares'); triggerHaptic('light') }} aria-pressed={splitMode === 'shares'} style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 500, fontFamily: FONT_FAMILY, cursor: 'pointer', transition: 'background 0.15s, color 0.15s', textAlign: 'center', color: splitMode === 'shares' ? 'var(--text)' : 'var(--muted)', background: splitMode === 'shares' ? 'rgba(129, 140, 248, 0.12)' : 'transparent' }}>By shares</button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Split count stepper — even mode, no participants */}
                      {splitMode === 'even' && splitParticipants.length === 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px 4px', gap: 12 }}>
                          <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--sub)' }}>Split between</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button type="button" onClick={() => setSplitCount((c) => Math.max(2, c - 1))} disabled={splitCount <= 2} aria-label="Decrease split count" style={{ ...roundButton, color: splitCount <= 2 ? 'var(--muted)' : 'var(--text)', cursor: splitCount <= 2 ? 'not-allowed' : 'pointer', opacity: splitCount <= 2 ? 0.4 : 1 }}>−</button>
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 18, fontWeight: 600, color: 'var(--text)', minWidth: 50, textAlign: 'center' }} aria-live="polite" aria-label={`${splitCount} people`}>{splitCount} 👥</span>
                            <button type="button" onClick={() => setSplitCount((c) => Math.min(20, c + 1))} disabled={splitCount >= 20} aria-label="Increase split count" style={{ ...roundButton, color: splitCount >= 20 ? 'var(--muted)' : 'var(--text)', cursor: splitCount >= 20 ? 'not-allowed' : 'pointer', opacity: splitCount >= 20 ? 0.4 : 1 }}>+</button>
                          </div>
                        </div>
                      )}

                      {/* Custom share input */}
                      {splitMode === 'custom' && (
                        <div style={{ padding: '14px 4px 4px' }}>
                          <label style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--sub)', display: 'block', marginBottom: 6 }}>Your share</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: FONT_FAMILY, fontSize: 14, color: 'var(--muted)', pointerEvents: 'none' }}>$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={customShareInput}
                              onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ''); const parts = raw.split('.'); if (parts.length > 2) return; if (parts[1] && parts[1].length > 2) return; setCustomShareInput(raw) }}
                              aria-label="Your custom share amount"
                              style={{ width: '100%', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: borderRadius.md, outline: 'none', fontSize: 14, fontFamily: FONT_FAMILY, color: 'var(--text)', padding: '10px 14px 10px 24px', caretColor: 'var(--text)' }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Percent inputs */}
                      {splitMode === 'percent' && splitParticipants.length > 0 && (
                        <div style={{ padding: '14px 4px 4px' }}>
                          <label style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--sub)', display: 'block', marginBottom: 8 }}>Percentage per person (must total 100%)</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--text)', minWidth: 60 }}>You</span>
                            <input type="number" inputMode="numeric" min={0} max={100} value={100 - percentInputs.reduce((s, v) => s + v, 0)} readOnly aria-label="Your percentage" style={{ width: 60, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: borderRadius.sm, fontSize: 13, fontFamily: FONT_FAMILY, color: 'var(--muted)', padding: '6px 8px', textAlign: 'center' }} />
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 12, color: 'var(--muted)' }}>%</span>
                          </div>
                          {splitParticipants.map((p, i) => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--text)', minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                              <input type="number" inputMode="numeric" min={0} max={100} value={percentInputs[i] ?? 0} onChange={(e) => { const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)); setPercentInputs((prev) => { const next = [...prev]; next[i] = val; return next }) }} aria-label={`${p.name}'s percentage`} style={{ width: 60, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: borderRadius.sm, fontSize: 13, fontFamily: FONT_FAMILY, color: 'var(--text)', padding: '6px 8px', textAlign: 'center' }} />
                              <span style={{ fontFamily: FONT_FAMILY, fontSize: 12, color: 'var(--muted)' }}>%</span>
                            </div>
                          ))}
                          {percentInputs.reduce((s, v) => s + v, 0) > 100 && (
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 11, color: 'var(--warning)' }}>Total exceeds 100%</span>
                          )}
                        </div>
                      )}

                      {/* Shares inputs */}
                      {splitMode === 'shares' && splitParticipants.length > 0 && (
                        <div style={{ padding: '14px 4px 4px' }}>
                          <label style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--sub)', display: 'block', marginBottom: 8 }}>Shares per person (proportional)</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--text)', minWidth: 60 }}>You</span>
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--muted)' }}>1 share</span>
                          </div>
                          {splitParticipants.map((p, i) => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--text)', minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button type="button" onClick={() => setShareInputs((prev) => { const next = [...prev]; next[i] = Math.max(1, (next[i] ?? 1) - 1); return next })} disabled={(shareInputs[i] ?? 1) <= 1} aria-label={`Decrease ${p.name}'s shares`} style={{ ...roundButton, width: 26, height: 26, fontSize: 14, opacity: (shareInputs[i] ?? 1) <= 1 ? 0.4 : 1, cursor: (shareInputs[i] ?? 1) <= 1 ? 'not-allowed' : 'pointer' }}>−</button>
                                <span style={{ fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 600, color: 'var(--text)', minWidth: 24, textAlign: 'center' }}>{shareInputs[i] ?? 1}</span>
                                <button type="button" onClick={() => setShareInputs((prev) => { const next = [...prev]; next[i] = Math.min(10, (next[i] ?? 1) + 1); return next })} disabled={(shareInputs[i] ?? 1) >= 10} aria-label={`Increase ${p.name}'s shares`} style={{ ...roundButton, width: 26, height: 26, fontSize: 14, opacity: (shareInputs[i] ?? 1) >= 10 ? 0.4 : 1, cursor: (shareInputs[i] ?? 1) >= 10 ? 'not-allowed' : 'pointer' }}>+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Breakdown */}
                      {(() => {
                        const parsed = parseFloat(amount)
                        if (!parsed || parsed <= 0) return null

                        const friends = splitFriends.length > 0 ? splitFriends : (splitWith.trim() ? [splitWith.trim()] : [])
                        let userShare: number
                        let perFriendBreakdown: { name: string; owes: number }[]

                        if (splitMode === 'custom') {
                          const customVal = parseFloat(customShareInput)
                          userShare = (customVal > 0 && customVal <= parsed) ? customVal : parsed
                          perFriendBreakdown = friends.length > 0 ? computePerFriendOwedCustom(parsed, userShare, friends) : []
                        } else if (splitMode === 'percent' && splitParticipants.length > 0) {
                          const yourPct = 100 - percentInputs.reduce((s, v) => s + v, 0)
                          userShare = Math.round((parsed * Math.max(0, yourPct)) / 100 * 100) / 100
                          const amounts = computePercentSplit(parsed, percentInputs)
                          perFriendBreakdown = splitParticipants.map((p, i) => ({ name: p.name, owes: amounts[i] ?? 0 }))
                        } else if (splitMode === 'shares' && splitParticipants.length > 0) {
                          const allShares = [1, ...shareInputs.slice(0, splitParticipants.length)]
                          const amounts = computeShareSplit(parsed, allShares)
                          userShare = amounts[0] ?? parsed
                          perFriendBreakdown = splitParticipants.map((p, i) => ({ name: p.name, owes: amounts[i + 1] ?? 0 }))
                        } else {
                          userShare = computeSplitAmount(parsed, splitCount)
                          perFriendBreakdown = friends.length > 0 ? computePerFriendOwed(parsed, friends, splitCount) : []
                        }

                        const shareStr = userShare % 1 === 0 ? `$${userShare}` : `$${userShare.toFixed(2)}`
                        const totalStr = parsed % 1 === 0 ? `$${parsed}` : `$${parsed.toFixed(2)}`

                        return (
                          <div style={{ padding: '14px 4px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--sub)', textAlign: 'center' }}>Total: {totalStr}</div>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 500, color: 'var(--text)', background: 'rgba(129, 140, 248, 0.08)', border: '1px solid rgba(129, 140, 248, 0.2)', borderRadius: borderRadius.full, padding: '6px 14px', display: 'inline-block' }} aria-live="polite">Your share: {shareStr}</span>
                            </div>
                            {perFriendBreakdown.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                                {perFriendBreakdown.map(({ name, owes }) => {
                                  const owesStr = owes % 1 === 0 ? `$${owes}` : `$${owes.toFixed(2)}`
                                  return (
                                    <span key={name} style={{ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 500, color: 'var(--success)', opacity: 0.9 }} aria-live="polite">
                                      {name} gets {owesStr} 💸
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                            {/* View settle-up link */}
                            {onOpenSettleUp && perFriendBreakdown.length > 0 && (
                              <div style={{ textAlign: 'center', marginTop: 4 }}>
                                <button type="button" onClick={() => { onOpenSettleUp(); triggerHaptic('light') }} style={{ background: 'transparent', border: 'none', padding: '4px 0', cursor: 'pointer', fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 500, color: 'rgba(129, 140, 248, 0.8)' }} aria-label="View settle-up ledger">
                                  View settle-up →
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })()}
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
                    ? 'var(--gradient-action)'
                    : 'var(--dim)',
                  color: canSubmit ? 'var(--text)' : 'var(--muted)',
                  fontFamily: FONT_FAMILY,
                  fontSize: pxToRem(16),
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  opacity: canSubmit ? 1 : 0.5,
                  boxShadow: canSubmit ? shadows.glowAccentStrong : 'none',
                  transition: 'opacity 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                Done
              </button>
            </div>
      )}
    </Sheet>
  )
}
