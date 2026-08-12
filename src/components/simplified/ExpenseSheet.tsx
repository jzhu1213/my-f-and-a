"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { Sheet } from '@/components/ui/primitives/Sheet'
import { generateSmartSuggestions } from '@/lib/suggestionUtils'
import { computeSplitAmount, computeOwedAmount, computePerFriendOwed, computePerFriendOwedCustom, computeShareSplit } from '@/lib/splitUtils'
import { autoCategorizeWithRules } from '@/lib/autoCategorize'
import type { CategorizationRule } from '@/lib/categorizationRules'
import { hasExistingRule, applyRouteRule } from '@/lib/categorizationRules'
import { lookupMerchant, recordMerchant, getMerchantCategoryContext, getMerchantAverageAmount } from '@/lib/merchantMemory'
import { triggerHaptic } from '@/lib/haptics'
import { listFriends, type Friendship } from '@/lib/social/friends'
import { searchPublicProfiles, type PublicProfile } from '@/lib/social/profiles'
import type { SplitMethod } from '@/lib/social/splits.types'
import { predictHabit, getTopHabitChips } from '@/lib/habitEngine'
import { getMostRecentExpenseCategory } from '@/lib/transactionUtils'
import { useToast } from '@/contexts/ToastContext'
import { checkPerTransactionAlert } from '@/lib/budgetUtils'
import type { TransactionCategory, Transaction, Budget } from '@/types'
import type { SmartSuggestion, CustomCategory } from '@/types/folio'
import type { HabitChip } from '@/lib/habitEngine'
import type { CategoryDisplayItem } from '@/lib/customCategories'
import { mergeCategories } from '@/lib/customCategories'
import { getCategoryEmoji } from '@/lib/vocabulary'
import { Icon } from '@/components/ui/Icon'
import { CUSTOM_CATEGORY_ICON_CHOICES, type IconName } from '@/lib/icons'
import { FONT_FAMILY, spacing, pxToRem } from '@/styles/typography'
import { borderRadius, roundButton, shadows, fills, colorRamp } from '@/styles/shared'
import { TagInput } from './TagInput'
import { getRecentTags } from '@/lib/tagUtils'
import type { FundingSource } from '@/lib/fundingSources'
import { predictFundingSource } from '@/lib/fundingSources'
import type { SpendingMode } from '@/lib/spendingModes'

/** A split participant — either a linked friend (with userId) or a name-only entry */
interface SplitParticipant {
  id: string
  name: string
  userId: string | null
  avatarUrl?: string | null
}

interface ExpenseSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { amount: number; category: TransactionCategory; note?: string; date?: string; fundingSourceId?: string; trackAsIOU?: boolean; splitWith?: string; splitOwedAmount?: number; tags?: string[]; splitData?: { totalAmount: number; splitMethod: SplitMethod; participants: { name: string; userId: string | null; shareAmount: number; isPayer: boolean }[] } }) => void
  onUndo?: () => void
  defaultCategory?: TransactionCategory
  transactions?: Transaction[]
  customCategories?: CustomCategory[]
  /** Callback to create a new custom category inline (task 69, icon: task 234.2) */
  onAddCustomCategory?: (label: string, emoji: string, icon?: string) => Promise<CustomCategory | null>
  /** When true, the split toggle starts enabled (task 65 — one-tap split flow) */
  splitPreEnabled?: boolean
  /** Available funding sources (payment methods) for the user */
  fundingSources?: FundingSource[]
  /** Recent split partner names for quick-select chips (task 5.3 polish) */
  recentSplitPartners?: string[]
  /** Budgets array — used to check per-transaction alert thresholds (task 102.2) */
  budgets?: Budget[]
  /**
   * Called after a successful expense log if the amount exceeds the category's
   * per-transaction alert threshold. The parent can display the message as a
   * dismissable inline notice. (task 102.2)
   */
  onAlertMessage?: (message: string) => void
  /**
   * Current spending mode (task 105.1).
   * In 'tracker' mode the category field becomes optional — users can log
   * without picking a category and the transaction falls back to 'other'.
   */
  spendingMode?: SpendingMode
  /**
   * User-defined categorization rules (task 113.3).
   * Passed in so the ExpenseSheet can apply user rules during auto-categorization
   * and show the "Always categorize as?" prompt when appropriate.
   */
  categorizationRules?: CategorizationRule[]
  /**
   * Callback when user taps "Always categorize [note] as [category]" (task 113.3).
   */
  onAddCategorizationRule?: (keyword: string, category: TransactionCategory) => void
  /**
   * Current daily allowance amount — used to show the estimated remaining after
   * entering an amount. Reinforces the core "can I afford this?" identity. (Task 117.1)
   */
  dailyAllowanceAmount?: number
  /**
   * When true, animates the sheet in from the FAB's center-bottom position
   * (origin-scale) rather than the default slide-up. (Task 246.2)
   */
  originFromFab?: boolean
  /**
   * Called when user taps "View settle-up" to navigate to the ReimbursementLedger (task 284.1).
   */
  onOpenSettleUp?: () => void
}

// ── Date helper utilities (task 87.1) ────────────────────────────────────
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
function getRelativeDateLabel(dateStr: string): string {
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
function isFutureDate(dateStr: string): boolean {
  const todayStr = new Date().toISOString().slice(0, 10)
  return dateStr > todayStr
}

const CATEGORY_GRID: { category: TransactionCategory; emoji: string; label: string }[] = [
  { category: 'food', emoji: getCategoryEmoji('food'), label: 'Food' },
  { category: 'drinks', emoji: getCategoryEmoji('drinks'), label: 'Drinks' },
  { category: 'transport', emoji: getCategoryEmoji('transport'), label: 'Transportation' },
  { category: 'fun', emoji: getCategoryEmoji('fun'), label: 'Fun' },
  { category: 'school', emoji: getCategoryEmoji('school'), label: 'School' },
  { category: 'rent', emoji: getCategoryEmoji('rent'), label: 'Rent & Bills' },
  { category: 'other', emoji: getCategoryEmoji('other'), label: 'Other' },
]

const MAX_AMOUNT = 99999

/** Spring config matching animations.ts snappy preset (task 3.5, task 9.4). */
const ICON_BOUNCE_SPRING = springs.snappy

export function ExpenseSheet({
  isOpen,
  onClose,
  onSubmit,
  onUndo,
  defaultCategory,
  transactions,
  customCategories = [],
  onAddCustomCategory,
  splitPreEnabled = false,
  fundingSources = [],
  recentSplitPartners = [],
  budgets = [],
  onAlertMessage,
  spendingMode = 'guided',
  categorizationRules = [],
  onAddCategorizationRule,
  dailyAllowanceAmount,
  originFromFab = false,
  onOpenSettleUp,
}: ExpenseSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const { showToast } = useToast()
  const amountRef = useRef<HTMLInputElement>(null)
  const splitWithRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<TransactionCategory | null>(null)
  const [note, setNote] = useState('')
  const [showNoteField, setShowNoteField] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [splitEnabled, setSplitEnabled] = useState(false)
  const [splitCount, setSplitCount] = useState(2)
  const [splitWith, setSplitWith] = useState('')
  // Split mode: 'even' (auto-divide) or 'custom' (user enters their share) or 'percent'/'shares' (task 284.1)
  const [splitMode, setSplitMode] = useState<SplitMethod>('even')
  // Custom split: user's manual share amount
  const [customShareInput, setCustomShareInput] = useState('')
  // Multiple friends as chips
  const [splitFriends, setSplitFriends] = useState<string[]>([])
  // Split participants with optional userId for linked friends (task 284.1)
  const [splitParticipants, setSplitParticipants] = useState<SplitParticipant[]>([])
  // Percent inputs (one per participant, must sum to 100)
  const [percentInputs, setPercentInputs] = useState<number[]>([])
  // Shares inputs (one per participant, positive integers)
  const [shareInputs, setShareInputs] = useState<number[]>([])
  // Whether to show advanced split modes (percent/shares)
  const [showAdvancedSplit, setShowAdvancedSplit] = useState(false)
  // Friends list from the data layer
  const [friendsList, setFriendsList] = useState<{ userId: string; name: string; avatarUrl?: string | null }[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  // Whether "type a name" mode is active (vs friend picker)
  const [showNameInput, setShowNameInput] = useState(false)
  // Tracks whether category was manually selected (true) or auto-suggested (false)
  const [manualCategorySelection, setManualCategorySelection] = useState(false)
  // Tracks whether the current category was auto-suggested
  const [isAutoSuggested, setIsAutoSuggested] = useState(false)
  // Tracks whether merchant memory pre-filled category/amount (task 130.3)
  const [merchantMatched, setMerchantMatched] = useState(false)
  // Merchant context message — "You usually file X under Y" (task 340.1)
  const [merchantContextMsg, setMerchantContextMsg] = useState<string | null>(null)
  // Merchant average amount for suggestion chip (task 340.2)
  const [merchantAvg, setMerchantAvg] = useState<{ amount: number; label: string } | null>(null)

  // ── Date selection state (task 87.1) ────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showDateInput, setShowDateInput] = useState(false)

  // ── Funding source selection state (task 81.1) ─────────────────────────
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [showSourcePicker, setShowSourcePicker] = useState(false)

  // ── IOU toggle state (task 84.1) ──────────────────────────────────────
  const [trackAsIOU, setTrackAsIOU] = useState(false)

  // ── Inline "Add custom category" form state (task 69) ───────────────────
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('✨')
  // Chosen icon for the new custom category (task 234.2). Defaults to the
  // neutral fallback glyph; the stored emoji stays as a backward-compat fallback.
  const [newCategoryIcon, setNewCategoryIcon] = useState<IconName>('category:fallback')
  const [isAddingCategory, setIsAddingCategory] = useState(false)


  // Compute smart suggestions when category is selected
  const suggestions: SmartSuggestion[] = useMemo(() => {
    if (!category || !transactions || transactions.length === 0) return []
    return generateSmartSuggestions(category, transactions)
  }, [category, transactions])

  // Merged display list: built-in categories + user custom categories
  const displayCategories: CategoryDisplayItem[] = useMemo(() => {
    return mergeCategories(customCategories)
  }, [customCategories])

  // Compute effective default: explicit prop > most recently used > null
  const effectiveDefault = useMemo(() => {
    if (defaultCategory) return defaultCategory
    return getMostRecentExpenseCategory(transactions)
  }, [defaultCategory, transactions])

  // Habit prediction: pre-fill category + amount based on time-of-day patterns
  const habitPrediction = useMemo(() => {
    if (defaultCategory) return null // Don't override explicit category
    return predictHabit(transactions ?? [], new Date())
  }, [defaultCategory, transactions])

  // Top habit chips: frequency-weighted common transactions for one-tap logging
  const habitChips: HabitChip[] = useMemo(() => {
    return getTopHabitChips(transactions ?? [], 3)
  }, [transactions])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      // Pre-fill from habit prediction if no explicit default
      const prefillCategory = effectiveDefault ?? habitPrediction?.category ?? null
      const prefillAmount = (!defaultCategory && habitPrediction?.amount)
        ? String(habitPrediction.amount)
        : ''

      setAmount(prefillAmount)
      setCategory(prefillCategory)
      setNote('')
      setShowNoteField(false)
      setTags([])
      setSplitEnabled(splitPreEnabled)
      setSplitCount(2)
      setSplitWith('')
      setSplitMode('even')
      setCustomShareInput('')
      setSplitFriends([])
      setSplitParticipants([])
      setPercentInputs([])
      setShareInputs([])
      setShowAdvancedSplit(false)
      setShowNameInput(false)
      setManualCategorySelection(!!effectiveDefault)
      setIsAutoSuggested(!!(!defaultCategory && !effectiveDefault && habitPrediction))
      setMerchantMatched(false)
      setMerchantContextMsg(null)
      setMerchantAvg(null)
      setShowAddCategoryForm(false)
      setNewCategoryLabel('')
      setNewCategoryEmoji('✨')
      setNewCategoryIcon('category:fallback')
      setIsAddingCategory(false)
      
      // Reset date to today (task 87.1)
      setSelectedDate(new Date().toISOString().slice(0, 10))
      setShowDatePicker(false)
      setShowDateInput(false)
      
      // Smart source prediction (task 81.2)
      // Predict funding source based on category and time of day
      const predictedSourceId = prefillCategory
        ? predictFundingSource(transactions ?? [], prefillCategory, fundingSources, new Date())
        : null
      // Fall back to first source if no prediction
      setSelectedSourceId(predictedSourceId ?? (fundingSources.length > 0 ? fundingSources[0].id : null))
      setShowSourcePicker(false)
      setTrackAsIOU(false)
      
      // NOTE: Do NOT auto-focus the amount input here. On iOS, focusing an input
      // triggers the virtual keyboard which resizes the viewport and pushes the
      // fixed-position sheet up awkwardly. The user can tap the input when ready.
    }
  }, [isOpen, effectiveDefault, defaultCategory, habitPrediction, splitPreEnabled, fundingSources, transactions])

  // Auto-focus friend name input when split is pre-enabled and amount is filled (task 5.3 polish)
  // This fires when the user enters an amount (or taps a habit chip) in split-pre-enabled mode,
  // naturally guiding them to the "who are you splitting with?" field next.
  useEffect(() => {
    if (splitPreEnabled && splitEnabled && amount && parseFloat(amount) > 0 && !splitWith.trim()) {
      // Small delay to let the split section animate open
      const timer = setTimeout(() => {
        splitWithRef.current?.focus()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [splitPreEnabled, splitEnabled, amount, splitWith])

  // Re-predict funding source when category changes (task 81.2)
  useEffect(() => {
    if (category && transactions && fundingSources.length > 0) {
      const predictedSourceId = predictFundingSource(transactions, category, fundingSources, new Date())
      if (predictedSourceId) {
        setSelectedSourceId(predictedSourceId)
      }
    }
  }, [category, transactions, fundingSources])

  // Auto-sync splitCount with friend chips (task 123.1 — Splitwise-level ease)
  // When friends are added/removed, count = friends + 1 (you). No manual stepper needed.
  useEffect(() => {
    if (splitFriends.length > 0) {
      setSplitCount(splitFriends.length + 1)
    }
  }, [splitFriends])

  // Load friends list when split is enabled (task 284.1)
  useEffect(() => {
    if (splitEnabled && friendsList.length === 0 && !friendsLoading) {
      setFriendsLoading(true)
      listFriends().then(async (friendships) => {
        // Resolve friend profiles — get display names from public_profiles
        // For each friendship, the "other" user is the friend
        const { data: session } = await (await import('@/lib/supabaseClient')).supabase.auth.getSession()
        const userId = session?.session?.user?.id
        if (!userId || friendships.length === 0) {
          setFriendsLoading(false)
          return
        }
        const friendUserIds = friendships.map((f) =>
          f.requesterId === userId ? f.addresseeId : f.requesterId
        )
        // Fetch profiles for these IDs
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

  // Sync splitParticipants with percent/share inputs length
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

  // Determine if selected funding source is borrowed (task 84.1)
  const selectedSourceIsBorrowed = useMemo(() => {
    if (!selectedSourceId || fundingSources.length === 0) return false
    const source = fundingSources.find(s => s.id === selectedSourceId)
    return source?.kind === 'borrowed'
  }, [selectedSourceId, fundingSources])

  // ── Inline add-category submit handler (task 69) ────────────────────────
  const handleAddCategorySubmit = useCallback(async () => {
    const trimmedLabel = newCategoryLabel.trim()
    if (!trimmedLabel || !onAddCustomCategory) return
    setIsAddingCategory(true)
    try {
      const created = await onAddCustomCategory(trimmedLabel, newCategoryEmoji, newCategoryIcon)
      if (created) {
        // Select the newly created category and close the form
        setCategory('other')
        setManualCategorySelection(true)
        setIsAutoSuggested(false)
        setShowAddCategoryForm(false)
        setNewCategoryLabel('')
        setNewCategoryEmoji('✨')
        setNewCategoryIcon('category:fallback')
      }
    } finally {
      setIsAddingCategory(false)
    }
  }, [newCategoryLabel, newCategoryEmoji, newCategoryIcon, onAddCustomCategory])

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

  const handleSubmit = useCallback(() => {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return

    // In tracker mode category is optional — fall back to 'other' when not picked
    const effectiveCategory: TransactionCategory = category ?? (spendingMode === 'tracker' ? 'other' : null!)
    if (!effectiveCategory) return

    // Determine the user's share based on split mode
    let submittedAmount: number
    // Per-participant amounts for percent/shares modes
    let perParticipantAmounts: number[] = []
    if (splitEnabled) {
      if (splitMode === 'custom') {
        const customShare = parseFloat(customShareInput)
        submittedAmount = (customShare > 0 && customShare <= parsed) ? customShare : parsed
      } else if (splitMode === 'percent' && splitParticipants.length > 0) {
        // Compute participant amounts as raw rounded values (not reconciled against totalAmount
        // since percentInputs only contains non-payer percents, not the full 100%)
        const participantAmounts = percentInputs.map((p) => Math.round((parsed * p) / 100 * 100) / 100)
        const participantSum = participantAmounts.reduce((s, a) => s + a, 0)
        submittedAmount = Math.round((parsed - participantSum) * 100) / 100
        perParticipantAmounts = participantAmounts
      } else if (splitMode === 'shares' && splitParticipants.length > 0) {
        const allShares = [1, ...shareInputs.slice(0, splitParticipants.length)]
        const amounts = computeShareSplit(parsed, allShares)
        submittedAmount = amounts[0] ?? parsed
        perParticipantAmounts = amounts.slice(1)
      } else {
        submittedAmount = computeSplitAmount(parsed, splitCount)
      }
    } else {
      submittedAmount = parsed
    }

    // Validate the computed share is within bounds
    if (submittedAmount <= 0 || submittedAmount > MAX_AMOUNT) return

    // Build comma-separated friend names
    const allFriends = splitFriends.length > 0
      ? splitFriends.join(', ')
      : splitWith.trim() || undefined

    // Compute total owed by others
    let totalOwed = 0
    if (splitEnabled && allFriends) {
      if (splitMode === 'custom') {
        totalOwed = Math.round((parsed - submittedAmount) * 100) / 100
      } else if ((splitMode === 'percent' || splitMode === 'shares') && perParticipantAmounts.length > 0) {
        totalOwed = Math.round(perParticipantAmounts.reduce((s, a) => s + a, 0) * 100) / 100
      } else {
        totalOwed = computeOwedAmount(parsed, splitCount)
      }
    }

    // Build per-participant split data for createSplit when participants are present
    let splitData: { totalAmount: number; splitMethod: SplitMethod; participants: { name: string; userId: string | null; shareAmount: number; isPayer: boolean }[] } | undefined
    if (splitEnabled && splitParticipants.length > 0) {
      const participantEntries: { name: string; userId: string | null; shareAmount: number; isPayer: boolean }[] = []
      // Payer (the user) gets their share
      participantEntries.push({ name: 'You', userId: null, shareAmount: submittedAmount, isPayer: true })
      // Each other participant gets their computed amount
      for (let i = 0; i < splitParticipants.length; i++) {
        const p = splitParticipants[i]
        let shareAmt: number
        if (splitMode === 'percent' || splitMode === 'shares') {
          shareAmt = perParticipantAmounts[i] ?? 0
        } else if (splitMode === 'custom') {
          const perFriend = splitParticipants.length > 0
            ? Math.round((parsed - submittedAmount) / splitParticipants.length * 100) / 100
            : 0
          shareAmt = perFriend
        } else {
          // even
          shareAmt = computeSplitAmount(parsed, splitParticipants.length + 1)
        }
        participantEntries.push({ name: p.name, userId: p.userId, shareAmount: shareAmt, isPayer: false })
      }
      splitData = { totalAmount: parsed, splitMethod: splitMode, participants: participantEntries }
    }

    onSubmit({
      amount: submittedAmount,
      category: effectiveCategory,
      note: note.trim() || undefined,
      date: selectedDate,
      fundingSourceId: selectedSourceId || undefined,
      trackAsIOU: selectedSourceIsBorrowed && trackAsIOU ? true : undefined,
      splitWith: splitEnabled && allFriends ? allFriends : undefined,
      splitOwedAmount: splitEnabled && allFriends && totalOwed > 0 ? totalOwed : undefined,
      tags: tags.length > 0 ? tags : undefined,
      splitData,
    })
    // Show success toast with split-aware copy (task 123.1 — Splitwise-level ease)
    const categoryLabel = displayCategories.find(c => c.categoryValue === effectiveCategory)?.label ?? effectiveCategory
    const amountStr = submittedAmount % 1 === 0 ? `$${submittedAmount}` : `$${submittedAmount.toFixed(2)}`
    let toastMessage: string
    if (splitEnabled && allFriends && totalOwed > 0) {
      const owedStr = totalOwed % 1 === 0 ? `$${totalOwed}` : `$${totalOwed.toFixed(2)}`
      // Show who owes what: single friend gets named, multiple shows "friends"
      const friendNames = splitFriends.length > 0 ? splitFriends : (splitWith.trim() ? [splitWith.trim()] : [])
      if (friendNames.length === 1) {
        toastMessage = `Logged ${amountStr} (your share) — ${friendNames[0]} owes you ${owedStr} 💸`
      } else {
        toastMessage = `Logged ${amountStr} (your share) — friends owe you ${owedStr} 💸`
      }
    } else {
      toastMessage = `Logged ${amountStr} for ${categoryLabel} ✓`
    }
    showToast(
      toastMessage,
      'success',
      onUndo ? { label: 'Undo', onClick: onUndo } : undefined
    )

    // Check per-transaction alert threshold (task 102.2)
    // Fire after successful log — gentle nudge, never blocking
    if (onAlertMessage) {
      const budget = budgets.find(b => b.category === effectiveCategory)
      const alertMsg = checkPerTransactionAlert(submittedAmount, budget)
      if (alertMsg) {
        onAlertMessage(alertMsg)
      }
    }

    // Record merchant memory for future pre-fill (task 130.3)
    if (note.trim()) {
      recordMerchant(note.trim(), effectiveCategory, submittedAmount)
    }

    onClose()
  }, [amount, category, spendingMode, note, tags, splitEnabled, splitCount, splitWith, splitFriends, splitMode, splitParticipants, percentInputs, shareInputs, customShareInput, selectedSourceId, selectedSourceIsBorrowed, trackAsIOU, selectedDate, displayCategories, onSubmit, onClose, onUndo, showToast, budgets, onAlertMessage])

  const canSubmit = (() => {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0 || parsed > MAX_AMOUNT) return false
    // In tracker mode, category is optional — amount alone is enough
    if (spendingMode !== 'tracker' && !category) return false
    if (splitEnabled) {
      const share = computeSplitAmount(parsed, splitCount)
      return share > 0 && share <= MAX_AMOUNT && splitCount >= 2
    }
    return true
  })()

  // Compute recent notes for selected category (up to 4 unique)
  const recentNotes: string[] = useMemo(() => {
    if (!category || !transactions || transactions.length === 0) return []
    const seen = new Set<string>()
    const notes: string[] = []
    for (const tx of transactions) {
      if (tx.category !== category) continue
      const n = tx.note?.trim()
      if (!n || seen.has(n)) continue
      seen.add(n)
      notes.push(n)
      if (notes.length >= 4) break
    }
    return notes
  }, [category, transactions])

  // Compute recent tag suggestions for the suggestion chips
  const recentTagSuggestions: string[] = useMemo(() => {
    if (!transactions || transactions.length === 0) return []
    return getRecentTags(transactions, 6)
  }, [transactions])

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

    // Merchant memory has highest priority (task 130.3)
    if (!manualCategorySelection && sanitized.trim().length >= 2) {
      const merchant = lookupMerchant(sanitized)
      if (merchant) {
        setCategory(merchant.category)
        setAmount(merchant.amount % 1 === 0 ? String(merchant.amount) : merchant.amount.toFixed(2))
        setIsAutoSuggested(true)
        setMerchantMatched(true)

        // Enhanced merchant context (task 340.1, 340.2)
        const catContext = getMerchantCategoryContext(sanitized)
        setMerchantContextMsg(catContext?.message ?? null)
        const avgContext = getMerchantAverageAmount(sanitized)
        setMerchantAvg(avgContext)

        return
      }
    }

    setMerchantMatched(false)
    setMerchantContextMsg(null)
    setMerchantAvg(null)

    // Auto-categorize: only apply if user hasn't manually picked a category
    if (!manualCategorySelection) {
      const result = autoCategorizeWithRules(sanitized, categorizationRules)
      if (result) {
        setCategory(result.category)
        setIsAutoSuggested(true)
      } else {
        // If no match, revert to effective default and clear suggestion indicator
        setCategory(effectiveDefault)
        setIsAutoSuggested(false)
      }
    }

    // Auto-route: if a user rule targets a funding source and still exists,
    // pre-select it (task 187.1). Reversible — the user can change the picker.
    const routedSourceId = applyRouteRule(sanitized, categorizationRules)
    if (routedSourceId && fundingSources.some(s => s.id === routedSourceId)) {
      setSelectedSourceId(routedSourceId)
    }
  }, [showNoteField, manualCategorySelection, effectiveDefault, categorizationRules, fundingSources])

  // ── Category button animation variants ──────────────────────────────────
  const cardTapVariants: Variants = prefersReducedMotion
    ? { tap: {} }
    : { tap: { scale: 0.94 } }

  const iconBounceVariants: Variants = prefersReducedMotion
    ? { tap: {} }
    : { tap: { scale: 1.3 } }

  return (
    <Sheet open={isOpen} onClose={onClose} size="full" aria-label="Log expense">
      <div style={{ padding: '0 24px 32px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              {habitChips.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: 20,
                    paddingTop: 4,
                  }}
                  aria-label="Quick log habits"
                >
                  {habitChips.map((chip, i) => (
                    <button
                      key={`habit-${chip.category}-${chip.amount}-${i}`}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light')
                        onSubmit({
                          amount: chip.amount,
                          category: chip.category,
                          note: chip.note,
                          date: selectedDate,
                        })
                        const amountStr = chip.amount % 1 === 0 ? `$${chip.amount}` : `$${chip.amount.toFixed(2)}`
                        const categoryLabel = displayCategories.find(c => c.categoryValue === chip.category)?.label ?? chip.category
                        showToast(
                          `Logged ${amountStr} for ${categoryLabel} ✓`,
                          'success',
                          onUndo ? { label: 'Undo', onClick: onUndo } : undefined
                        )
                        onClose()
                      }}
                      aria-label={`Quick log: ${chip.label}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '10px 14px',
                        background: 'rgba(129, 140, 248, 0.06)',
                        border: '1px solid rgba(129, 140, 248, 0.2)',
                        borderRadius: borderRadius.full,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontFamily: FONT_FAMILY,
                        fontWeight: 500,
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ fontSize: 14 }} aria-hidden="true">⚡</span>
                      <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {chip.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* ── Habit pre-fill indicator ── */}
              {!defaultCategory && !effectiveDefault && habitPrediction && (
                <div
                  style={{
                    textAlign: 'center',
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 400,
                      color: 'var(--muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    aria-live="polite"
                  >
                    <span aria-hidden="true">🕐</span> pre-filled from your habits
                  </span>
                </div>
              )}

              {/* ── Smart Suggestions (shown when category selected) ── */}
              <AnimatePresence>
                {category && suggestions.length > 0 && (
                  <motion.div
                    key={`suggestions-${category}`}
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={springs.snappy}
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                    aria-label="Suggested amounts"
                  >
                    {suggestions.slice(0, 4).map((s) => {
                      const amountStr = s.amount % 1 === 0 ? `$${s.amount}` : `$${s.amount.toFixed(2)}`
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            // One-tap log: immediately submit with suggested amount (Req 3.4)
                            onSubmit({
                              amount: s.amount,
                              category,
                              note: s.label || undefined,
                              date: selectedDate,
                            })
                            const categoryLabel = displayCategories.find(c => c.categoryValue === category)?.label ?? category
                            showToast(
                              `Logged ${amountStr} for ${categoryLabel} ✓`,
                              'success',
                              onUndo ? { label: 'Undo', onClick: onUndo } : undefined
                            )
                            onClose()
                          }}
                          aria-label={s.label ? `Log ${amountStr} for ${s.label}` : `Log ${amountStr}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            padding: '8px 14px',
                            background: fills[6],
                            border: `1px solid ${fills[10]}`,
                            borderRadius: borderRadius.full,
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 500, fontFamily: FONT_FAMILY, color: 'var(--text)' }}>
                            {amountStr}
                          </span>
                          {s.label && (
                            <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: FONT_FAMILY, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.label}
                            </span>
                          )}
                        </button>
                      )
                    })}
                    {/* Merchant average amount chip (task 340.2) */}
                    {merchantAvg && merchantMatched && (
                      <button
                        type="button"
                        onClick={() => {
                          setAmount(merchantAvg.amount % 1 === 0 ? String(merchantAvg.amount) : merchantAvg.amount.toFixed(2))
                          triggerHaptic('light')
                        }}
                        aria-label={`Use average amount: ${merchantAvg.label}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                          padding: '8px 14px',
                          background: fills[6],
                          border: `1px solid ${colorRamp.success[400]}40`,
                          borderRadius: borderRadius.full,
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 500, fontFamily: FONT_FAMILY, color: colorRamp.success[400] }}>
                          {merchantAvg.amount % 1 === 0 ? `$${merchantAvg.amount}` : `$${merchantAvg.amount.toFixed(2)}`}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--sub)', fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>
                          avg
                        </span>
                      </button>
                    )}
                    {/* Custom chip */}
                    <button
                      type="button"
                      onClick={() => { setAmount(''); amountRef.current?.focus() }}
                      aria-label="Enter custom amount"
                      style={{
                        padding: '8px 14px',
                        background: 'transparent',
                        border: `1px dashed ${fills[15]}`,
                        borderRadius: borderRadius.full,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontFamily: FONT_FAMILY,
                        fontWeight: 500,
                        color: 'var(--sub)',
                      }}
                    >
                      Custom
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Amount Input (calculator-style) ─────────────────── */}
              <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
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
                      color: 'var(--muted)',
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
                    aria-label="Expense amount"
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
                  How much did you spend?
                </p>

                {/* ── "Remaining after this" indicator (Task 117.1) ── */}
                {dailyAllowanceAmount != null && dailyAllowanceAmount > 0 && parseFloat(amount) > 0 && (
                  <p
                    style={{
                      fontSize: 12,
                      color: (dailyAllowanceAmount - parseFloat(amount)) >= 0 ? 'var(--success)' : 'var(--error)',
                      marginTop: 6,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 500,
                      fontVariantNumeric: 'tabular-nums',
                      opacity: 0.85,
                    }}
                    aria-live="polite"
                  >
                    {(dailyAllowanceAmount - parseFloat(amount)) >= 0
                      ? `$${Math.round(dailyAllowanceAmount - parseFloat(amount))} left after this`
                      : `$${Math.abs(Math.round(dailyAllowanceAmount - parseFloat(amount)))} over today\u2019s budget`}
                  </p>
                )}

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
                        background: fills[4],
                        border: `1px solid ${fills[10]}`,
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
                            background: fills[4],
                            border: `1px solid ${fills[10]}`,
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
                                  ? 'rgba(129, 140, 248, 0.12)'
                                  : 'transparent',
                                border: selectedSourceId === source.id
                                  ? '1px solid rgba(129, 140, 248, 0.4)'
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

              {/* ── Category Grid (3×2) with glass-pill glow ────────── */}
              {/* In tracker mode the entire section is optional — the label reflects that */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: spacing.sm,
                  marginBottom: spacing.lg,
                }}
                role="group"
                aria-label={spendingMode === 'tracker' ? 'Category (optional)' : 'Expense categories'}
                onKeyDown={(e) => {
                  const currentIndex = category
                    ? displayCategories.findIndex(c => c.categoryValue === category)
                    : -1
                  let nextIndex = -1
                  if (e.key === "ArrowRight") {
                    e.preventDefault()
                    nextIndex = currentIndex < displayCategories.length - 1 ? currentIndex + 1 : 0
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault()
                    nextIndex = currentIndex > 0 ? currentIndex - 1 : displayCategories.length - 1
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault()
                    nextIndex = currentIndex + 3 < displayCategories.length ? currentIndex + 3 : currentIndex % 3
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault()
                    nextIndex = currentIndex - 3 >= 0 ? currentIndex - 3 : displayCategories.length - 3 + (currentIndex % 3)
                  }
                  if (nextIndex >= 0 && nextIndex < displayCategories.length) {
                    setCategory(displayCategories[nextIndex].categoryValue as TransactionCategory)
                    setManualCategorySelection(true)
                    setIsAutoSuggested(false)
                    triggerHaptic('light')
                    const container = e.currentTarget
                    const buttons = container.querySelectorAll<HTMLButtonElement>('button')
                    buttons[nextIndex]?.focus()
                  }
                }}
              >
                {/* In tracker mode: show a small helper label above the grid */}
                {spendingMode === 'tracker' && (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      fontSize: 12,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 400,
                      color: 'var(--muted)',
                      marginBottom: 2,
                    }}
                  >
                    Category <span style={{ opacity: 0.7 }}>(optional)</span>
                  </div>
                )}

                {/* In tracker mode: "No category / General" first option so users can skip picking */}
                {spendingMode === 'tracker' && (
                  <motion.button
                    type="button"
                    onClick={() => { setCategory(null); setManualCategorySelection(false); setIsAutoSuggested(false); triggerHaptic('light') }}
                    aria-label="No category — log without picking"
                    aria-pressed={category === null}
                    tabIndex={category === null ? 0 : -1}
                    className="cat-pill"
                    variants={cardTapVariants}
                    initial={false}
                    animate={prefersReducedMotion ? {} : { y: category === null ? -2 : 0, scale: category === null ? 1.02 : 1 }}
                    whileTap="tap"
                    transition={springs.snappy}
                    style={{
                      minHeight: 72,
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      ...(category === null
                        ? {
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            background: colorRamp.accent[100],
                            border: `1.5px solid ${colorRamp.accent[400]}`,
                            boxShadow: shadows.glowAccent,
                          }
                        : {
                            background: fills[3],
                            border: `1px solid ${fills[6]}`,
                          }),
                    }}
                  >
                    <motion.span
                      style={{ fontSize: 24, lineHeight: 1, display: 'inline-block' }}
                      variants={iconBounceVariants}
                      transition={ICON_BOUNCE_SPRING}
                      aria-hidden="true"
                    >
                      ·
                    </motion.span>
                    <span
                      style={{
                        fontFamily: FONT_FAMILY,
                        fontSize: 12,
                        fontWeight: 500,
                        color: category === null ? 'var(--text)' : 'var(--sub)',
                      }}
                    >
                      General
                    </span>
                  </motion.button>
                )}

                {displayCategories.map((cat, index) => {
                  const selected = category === cat.categoryValue
                  // In tracker mode the "General" button is the roving anchor when nothing is selected
                  const isRovingActive = selected || (category === null && index === 0 && spendingMode !== 'tracker')

                  // Selection lift: slight upward shift + scale
                  const selectionAnimate = prefersReducedMotion
                    ? {}
                    : { y: selected ? -2 : 0, scale: selected ? 1.02 : 1 }

                  return (
                    <motion.button
                      key={cat.isCustom ? `custom-${cat.customId}` : cat.categoryValue}
                      type="button"
                      onClick={() => { setCategory(cat.categoryValue as TransactionCategory); setManualCategorySelection(true); setIsAutoSuggested(false); triggerHaptic('light') }}
                      aria-label={`Category: ${cat.label}`}
                      aria-pressed={selected}
                      tabIndex={isRovingActive ? 0 : -1}
                      className="cat-pill"
                      variants={cardTapVariants}
                      initial={false}
                      animate={selectionAnimate}
                      whileTap="tap"
                      transition={springs.snappy}
                      style={{
                        minHeight: 72,
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        // Glass-pill glow for selected, subtle surface for unselected
                        ...(selected
                          ? {
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)',
                              background: colorRamp.accent[100],
                              border: `1.5px solid ${colorRamp.accent[400]}`,
                              boxShadow: shadows.glowAccent,
                            }
                          : {
                              background: fills[3],
                              border: `1px solid ${fills[6]}`,
                            }),
                      }}
                    >
                      {/* Emoji icon with bounce micro-interaction */}
                      <motion.span
                        style={{ fontSize: 24, lineHeight: 1, display: 'inline-block' }}
                        variants={iconBounceVariants}
                        transition={ICON_BOUNCE_SPRING}
                        aria-hidden="true"
                      >
                        {cat.emoji}
                      </motion.span>
                      <span
                        style={{
                          fontFamily: FONT_FAMILY,
                          fontSize: 12,
                          fontWeight: 500,
                          color: selected ? 'var(--text)' : 'var(--sub)',
                        }}
                      >
                        {cat.label}
                      </span>
                    </motion.button>
                  )
                })}

                {/* ── "+ Add" button — only shown when onAddCustomCategory is wired up (task 69) ── */}
                {onAddCustomCategory && !showAddCategoryForm && (
                  <motion.button
                    type="button"
                    onClick={() => { setShowAddCategoryForm(true); triggerHaptic('light') }}
                    aria-label="Add a custom category"
                    tabIndex={-1}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                    transition={springs.snappy}
                    style={{
                      minHeight: 72,
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      background: 'transparent',
                      border: '1px dashed rgba(255, 255, 255, 0.15)',
                    }}
                  >
                    <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden="true">+</span>
                    <span
                      style={{
                        fontFamily: FONT_FAMILY,
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--muted)',
                      }}
                    >
                      Add
                    </span>
                  </motion.button>
                )}
              </div>

              {/* ── Inline "Add custom category" form (task 69) ─────────────────── */}
              <AnimatePresence>
                {showAddCategoryForm && onAddCustomCategory && (
                  <motion.div
                    key="add-category-form"
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={springs.gentle}
                    style={{
                      overflow: 'hidden',
                      marginBottom: 16,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 14px 12px',
                    }}
                  >
                    {/* Icon palette (task 234.2) — pick a themeable icon instead
                        of an emoji. The stored emoji stays as a fallback. */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginBottom: 12,
                      }}
                      role="group"
                      aria-label="Choose an icon for your category"
                    >
                      {CUSTOM_CATEGORY_ICON_CHOICES.map((choice) => {
                        const isSelected = newCategoryIcon === choice
                        return (
                          <button
                            key={choice}
                            type="button"
                            onClick={() => setNewCategoryIcon(choice)}
                            aria-label={`Use ${choice.split(':')[1]} icon`}
                            aria-pressed={isSelected}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 'var(--radius-sm)',
                              border: isSelected
                                ? '1.5px solid rgba(129, 140, 248, 0.6)'
                                : '1px solid rgba(255, 255, 255, 0.08)',
                              background: isSelected
                                ? 'rgba(129, 140, 248, 0.1)'
                                : 'transparent',
                              color: isSelected ? 'var(--accent)' : 'var(--sub)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Icon name={choice} size={18} />
                          </button>
                        )
                      })}
                    </div>

                    {/* Label input + action row */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span
                        style={{
                          flexShrink: 0,
                          width: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent)',
                        }}
                        aria-hidden="true"
                      >
                        <Icon name={newCategoryIcon} size={20} />
                      </span>
                      <input
                        type="text"
                        placeholder="Category name"
                        value={newCategoryLabel}
                        onChange={(e) => setNewCategoryLabel(e.target.value.slice(0, 30))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); void handleAddCategorySubmit() }
                          if (e.key === 'Escape') { setShowAddCategoryForm(false) }
                        }}
                        maxLength={30}
                        aria-label="New category name"
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                          outline: 'none',
                          fontSize: 14,
                          fontFamily: FONT_FAMILY,
                          color: 'var(--text)',
                          padding: '6px 0',
                        }}
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddCategorySubmit()}
                        disabled={!newCategoryLabel.trim() || isAddingCategory}
                        aria-label="Save new category"
                        style={{
                          flexShrink: 0,
                          padding: '6px 14px',
                          borderRadius: borderRadius.full,
                          background: newCategoryLabel.trim()
                            ? 'rgba(129, 140, 248, 0.8)'
                            : 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          color: newCategoryLabel.trim() ? 'var(--text)' : 'var(--muted)',
                          fontSize: 13,
                          fontFamily: FONT_FAMILY,
                          fontWeight: 600,
                          cursor: newCategoryLabel.trim() ? 'pointer' : 'not-allowed',
                          opacity: isAddingCategory ? 0.6 : 1,
                        }}
                      >
                        {isAddingCategory ? '…' : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddCategoryForm(false)}
                        aria-label="Cancel adding category"
                        style={{
                          flexShrink: 0,
                          padding: '6px 10px',
                          borderRadius: borderRadius.full,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--muted)',
                          fontSize: 13,
                          fontFamily: FONT_FAMILY,
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Auto-category suggestion indicator ──────────────── */}
              {isAutoSuggested && category && (
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: -16,
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 400,
                      color: 'var(--muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    aria-live="polite"
                  >
                    <span aria-hidden="true">✨</span> suggested from note
                  </span>
                </div>
              )}

              {/* ── "Always categorize as?" prompt (task 113.3) ──────── */}
              {/* Shows when user manually overrides an auto-suggestion and has a note */}
              {manualCategorySelection && note.trim().length > 0 && category && onAddCategorizationRule && !hasExistingRule(note, categorizationRules) && (
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: -8,
                    marginBottom: 16,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onAddCategorizationRule(note.trim(), category)
                      triggerHaptic('light')
                    }}
                    aria-label={`Always categorize notes with "${note}" as ${category}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      fontSize: 12,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 500,
                      color: 'rgba(167, 139, 250, 0.8)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span aria-hidden="true">⚡</span> Always categorize &ldquo;{note.trim().slice(0, 20)}{note.trim().length > 20 ? '…' : ''}&rdquo; as {getCategoryEmoji(category)} {category}?
                  </button>
                </div>
              )}

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
                      aria-label="Expense note"
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
                          fontSize: 11,
                          fontFamily: FONT_FAMILY,
                          fontWeight: 400,
                          color: 'var(--muted)',
                        }}
                      >
                        {note.length}/60
                      </span>
                    )}
                    {/* Merchant remembered indicator (task 130.3, enhanced task 340.1) */}
                    {merchantMatched && note.length < 50 && (
                      <span
                        style={{
                          position: 'absolute',
                          right: 0,
                          bottom: 14,
                          fontSize: 11,
                          fontFamily: FONT_FAMILY,
                          fontWeight: 400,
                          color: colorRamp.success[400],
                        }}
                      >
                        ✓ remembered
                      </span>
                    )}
                  </div>

                  {/* Merchant category context message (task 340.1) */}
                  {merchantContextMsg && merchantMatched && (
                    <p
                      style={{
                        fontSize: 12,
                        fontFamily: FONT_FAMILY,
                        fontWeight: 400,
                        color: 'var(--sub)',
                        marginTop: 4,
                        marginBottom: 0,
                      }}
                    >
                      {merchantContextMsg}
                    </p>
                  )}

                  {/* Note suggestion chips */}
                  {category && recentNotes.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      {recentNotes.map((recentNote) => (
                        <button
                          key={recentNote}
                          type="button"
                          onClick={() => {
                            setNote(recentNote)
                            setShowNoteField(true)
                          }}
                          aria-label={`Use note: ${recentNote}`}
                          style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: borderRadius.full,
                            padding: '5px 12px',
                            fontSize: 12,
                            fontFamily: FONT_FAMILY,
                            fontWeight: 400,
                            color: 'var(--sub)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {recentNote.length > 20
                            ? recentNote.slice(0, 20) + '…'
                            : recentNote}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tags (optional, progressive disclosure) ─────────────────────── */}
              <div style={{ marginBottom: 20 }}>
                <TagInput
                  tags={tags}
                  onChange={setTags}
                  suggestions={recentTagSuggestions}
                  collapsible
                />
              </div>

              {/* ── Date Picker (optional, task 87.1) ─────────────────────────────── */}
              <div style={{ marginBottom: 20, textAlign: 'center' }}>
                {!showDatePicker ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDatePicker(true)
                      triggerHaptic('light')
                    }}
                    aria-label={`Date: ${getRelativeDateLabel(selectedDate)}. Tap to change.`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      background: selectedDate === new Date().toISOString().slice(0, 10)
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(129, 140, 248, 0.12)',
                      border: selectedDate === new Date().toISOString().slice(0, 10)
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(129, 140, 248, 0.4)',
                      borderRadius: borderRadius.full,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 500,
                      color: 'var(--sub)',
                    }}
                  >
                    <span style={{ fontSize: 13 }} aria-hidden="true">📅</span>
                    <span>{getRelativeDateLabel(selectedDate)}</span>
                  </button>
                ) : (
                  <AnimatePresence>
                    <motion.div
                      key="date-picker-expanded"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={springs.snappy}
                      style={{ overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                          justifyContent: 'center',
                          paddingTop: 4,
                        }}
                        role="group"
                        aria-label="Select expense date"
                      >
                        {/* Today chip */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(new Date().toISOString().slice(0, 10))
                            setShowDatePicker(false)
                            setShowDateInput(false)
                            triggerHaptic('light')
                          }}
                          aria-pressed={selectedDate === new Date().toISOString().slice(0, 10)}
                          style={{
                            padding: '7px 14px',
                            background: selectedDate === new Date().toISOString().slice(0, 10)
                              ? 'rgba(129, 140, 248, 0.12)'
                              : 'rgba(255, 255, 255, 0.04)',
                            border: selectedDate === new Date().toISOString().slice(0, 10)
                              ? '1px solid rgba(129, 140, 248, 0.4)'
                              : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: borderRadius.full,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontFamily: FONT_FAMILY,
                            fontWeight: 500,
                            color: selectedDate === new Date().toISOString().slice(0, 10) ? 'var(--text)' : 'var(--sub)',
                          }}
                        >
                          Today
                        </button>

                        {/* Yesterday chip */}
                        {(() => {
                          const yesterday = new Date()
                          yesterday.setDate(yesterday.getDate() - 1)
                          const yesterdayStr = yesterday.toISOString().slice(0, 10)
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(yesterdayStr)
                                setShowDatePicker(false)
                                setShowDateInput(false)
                                triggerHaptic('light')
                              }}
                              aria-pressed={selectedDate === yesterdayStr}
                              style={{
                                padding: '7px 14px',
                                background: selectedDate === yesterdayStr
                                  ? 'rgba(129, 140, 248, 0.12)'
                                  : 'rgba(255, 255, 255, 0.04)',
                                border: selectedDate === yesterdayStr
                                  ? '1px solid rgba(129, 140, 248, 0.4)'
                                  : '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: borderRadius.full,
                                cursor: 'pointer',
                                fontSize: 13,
                                fontFamily: FONT_FAMILY,
                                fontWeight: 500,
                                color: selectedDate === yesterdayStr ? 'var(--text)' : 'var(--sub)',
                              }}
                            >
                              Yesterday
                            </button>
                          )
                        })()}

                        {/* Last Fri chip */}
                        {(() => {
                          const lastFriStr = getLastFriday(new Date())
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(lastFriStr)
                                setShowDatePicker(false)
                                setShowDateInput(false)
                                triggerHaptic('light')
                              }}
                              aria-pressed={selectedDate === lastFriStr}
                              style={{
                                padding: '7px 14px',
                                background: selectedDate === lastFriStr
                                  ? 'rgba(129, 140, 248, 0.12)'
                                  : 'rgba(255, 255, 255, 0.04)',
                                border: selectedDate === lastFriStr
                                  ? '1px solid rgba(129, 140, 248, 0.4)'
                                  : '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: borderRadius.full,
                                cursor: 'pointer',
                                fontSize: 13,
                                fontFamily: FONT_FAMILY,
                                fontWeight: 500,
                                color: selectedDate === lastFriStr ? 'var(--text)' : 'var(--sub)',
                              }}
                            >
                              Last Fri
                            </button>
                          )
                        })()}

                        {/* Next Mon chip (task 90.1 — future date shortcut) */}
                        {(() => {
                          const nextMonStr = getNextMonday(new Date())
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(nextMonStr)
                                setShowDatePicker(false)
                                setShowDateInput(false)
                                triggerHaptic('light')
                              }}
                              aria-pressed={selectedDate === nextMonStr}
                              style={{
                                padding: '7px 14px',
                                background: selectedDate === nextMonStr
                                  ? 'rgba(129, 140, 248, 0.12)'
                                  : 'rgba(255, 255, 255, 0.04)',
                                border: selectedDate === nextMonStr
                                  ? '1px solid rgba(129, 140, 248, 0.4)'
                                  : '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: borderRadius.full,
                                cursor: 'pointer',
                                fontSize: 13,
                                fontFamily: FONT_FAMILY,
                                fontWeight: 500,
                                color: selectedDate === nextMonStr ? 'var(--text)' : 'var(--sub)',
                              }}
                            >
                              Next Mon
                            </button>
                          )
                        })()}

                        {/* Pick date chip */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowDateInput(true)
                            triggerHaptic('light')
                          }}
                          aria-pressed={showDateInput}
                          style={{
                            padding: '7px 14px',
                            background: showDateInput
                              ? 'rgba(129, 140, 248, 0.12)'
                              : 'rgba(255, 255, 255, 0.04)',
                            border: showDateInput
                              ? '1px solid rgba(129, 140, 248, 0.4)'
                              : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: borderRadius.full,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontFamily: FONT_FAMILY,
                            fontWeight: 500,
                            color: showDateInput ? 'var(--text)' : 'var(--sub)',
                          }}
                        >
                          Pick date
                        </button>
                      </div>

                      {/* HTML date input — revealed when "Pick date" is tapped */}
                      <AnimatePresence>
                        {showDateInput && (
                          <motion.div
                            key="date-input"
                            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                            transition={springs.snappy}
                            style={{ overflow: 'hidden', marginTop: 10, textAlign: 'center' }}
                          >
                            <input
                              type="date"
                              value={selectedDate}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setSelectedDate(e.target.value)
                                  setShowDatePicker(false)
                                  setShowDateInput(false)
                                }
                              }}
                              aria-label="Pick a date"
                              style={{
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: borderRadius.md,
                                padding: '8px 14px',
                                fontSize: 14,
                                fontFamily: FONT_FAMILY,
                                color: 'var(--text)',
                                colorScheme: 'dark',
                              }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {/* ── Scheduled indicator (task 90.1) — shows when a future date is selected ── */}
              {isFutureDate(selectedDate) && (
                <div
                  style={{
                    marginBottom: 16,
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      background: 'rgba(129, 140, 248, 0.08)',
                      border: '1px solid rgba(129, 140, 248, 0.25)',
                      borderRadius: borderRadius.full,
                      fontSize: 12,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 500,
                      color: 'rgba(129, 140, 248, 0.9)',
                    }}
                    role="status"
                    aria-label={`This expense is scheduled for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  >
                    <span aria-hidden="true">📅</span>
                    Scheduled for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}

              {/* ── Split Toggle (optional, between note and Log button) ────── */}
              <div style={{ marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={() => {
                    setSplitEnabled((prev) => !prev)
                    triggerHaptic('light')
                  }}
                  aria-pressed={splitEnabled}
                  aria-label="Split this expense"
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
                  {/* Toggle indicator */}
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
                      key="split-controls"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={springs.snappy}
                      style={{ overflow: 'hidden' }}
                    >
                      {/* Split with — friend picker + name fallback (task 284.1) */}
                      <div style={{ padding: '14px 4px 0' }}>
                        {/* Selected participant chips */}
                        {splitParticipants.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              gap: 6,
                              flexWrap: 'wrap',
                              marginBottom: 10,
                            }}
                            aria-label="Added split partners"
                          >
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
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '0 2px',
                                    cursor: 'pointer',
                                    color: 'var(--muted)',
                                    fontSize: 14,
                                    lineHeight: 1,
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Friends quick-select chips (task 284.1) */}
                        {friendsList.length > 0 && !showNameInput && (
                          <div style={{ marginBottom: 10 }}>
                            <span
                              style={{
                                fontFamily: FONT_FAMILY,
                                fontSize: 11,
                                color: 'var(--muted)',
                                display: 'block',
                                marginBottom: 6,
                              }}
                            >
                              Friends
                            </span>
                            <div
                              style={{
                                display: 'flex',
                                gap: 6,
                                flexWrap: 'wrap',
                              }}
                              aria-label="Select a friend to split with"
                            >
                              {friendsList
                                .filter((f) => !splitParticipants.some((p) => p.userId === f.userId))
                                .slice(0, 8)
                                .map((friend) => (
                                  <button
                                    key={friend.userId}
                                    type="button"
                                    onClick={() => {
                                      const newP: SplitParticipant = {
                                        id: friend.userId,
                                        name: friend.name,
                                        userId: friend.userId,
                                        avatarUrl: friend.avatarUrl,
                                      }
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
                          <span style={{ fontFamily: FONT_FAMILY, fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                            Loading friends…
                          </span>
                        )}

                        {/* "Just type a name" fallback toggle */}
                        {!showNameInput && (
                          <button
                            type="button"
                            onClick={() => { setShowNameInput(true); triggerHaptic('light') }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: '4px 0',
                              cursor: 'pointer',
                              fontFamily: FONT_FAMILY,
                              fontSize: 12,
                              fontWeight: 500,
                              color: 'rgba(129, 140, 248, 0.8)',
                              marginBottom: 4,
                            }}
                            aria-label="Type a name instead"
                          >
                            + Just type a name
                          </button>
                        )}

                        {/* Name input — shown when toggled or when no friends available */}
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
                                    const newP: SplitParticipant = {
                                      id: `name-${Date.now()}-${name}`,
                                      name,
                                      userId: null,
                                    }
                                    setSplitParticipants((prev) => [...prev, newP])
                                    setSplitFriends((prev) => [...prev, name])
                                  }
                                  setSplitWith('')
                                  triggerHaptic('light')
                                }
                              }}
                              maxLength={40}
                              aria-label="Friend's name to split with"
                              style={{
                                width: '100%',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: borderRadius.md,
                                outline: 'none',
                                fontSize: 14,
                                fontFamily: FONT_FAMILY,
                                color: 'var(--text)',
                                padding: '10px 14px',
                                caretColor: 'var(--text)',
                              }}
                            />
                            <span
                              style={{
                                fontFamily: FONT_FAMILY,
                                fontSize: 11,
                                color: 'var(--muted)',
                                marginTop: 4,
                                display: 'block',
                              }}
                            >
                              Press Enter or comma to add
                            </span>
                          </>
                        )}

                        {/* Recent split partner chips — shown when no friends loaded or as extra suggestions */}
                        {recentSplitPartners.filter((n) => !splitFriends.includes(n)).length > 0 && !splitWith.trim() && (
                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              flexWrap: 'wrap',
                              marginTop: 10,
                            }}
                            aria-label={splitParticipants.length > 0 ? 'Add another split partner' : 'Recent split partners'}
                          >
                            {splitParticipants.length > 0 && (
                              <span
                                style={{
                                  fontFamily: FONT_FAMILY,
                                  fontSize: 11,
                                  color: 'var(--muted)',
                                  alignSelf: 'center',
                                }}
                              >
                                Recent:
                              </span>
                            )}
                            {recentSplitPartners.filter((n) => !splitFriends.includes(n)).slice(0, 5).map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  const newP: SplitParticipant = {
                                    id: `recent-${name}`,
                                    name,
                                    userId: null,
                                  }
                                  setSplitParticipants((prev) => [...prev, newP])
                                  setSplitFriends((prev) => [...prev, name])
                                  triggerHaptic('light')
                                }}
                                aria-label={`Split with ${name}`}
                                style={{
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
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Split mode selector — Even / Custom + More options (task 284.1) */}
                      <div style={{ padding: '14px 4px 0' }}>
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => { setSplitMode('even'); triggerHaptic('light') }}
                            aria-pressed={splitMode === 'even'}
                            style={{
                              flex: 1,
                              padding: '8px 0',
                              borderRadius: 9,
                              border: 'none',
                              fontSize: 13,
                              fontWeight: 500,
                              fontFamily: FONT_FAMILY,
                              cursor: 'pointer',
                              transition: 'background 0.15s, color 0.15s',
                              textAlign: 'center',
                              color: splitMode === 'even' ? 'var(--text)' : 'var(--muted)',
                              background: splitMode === 'even' ? 'rgba(129, 140, 248, 0.12)' : 'transparent',
                            }}
                          >
                            Even
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSplitMode('custom'); triggerHaptic('light') }}
                            aria-pressed={splitMode === 'custom'}
                            style={{
                              flex: 1,
                              padding: '8px 0',
                              borderRadius: 9,
                              border: 'none',
                              fontSize: 13,
                              fontWeight: 500,
                              fontFamily: FONT_FAMILY,
                              cursor: 'pointer',
                              transition: 'background 0.15s, color 0.15s',
                              textAlign: 'center',
                              color: splitMode === 'custom' ? 'var(--text)' : 'var(--muted)',
                              background: splitMode === 'custom' ? 'rgba(129, 140, 248, 0.12)' : 'transparent',
                            }}
                          >
                            Custom
                          </button>
                          {!showAdvancedSplit && (
                            <button
                              type="button"
                              onClick={() => { setShowAdvancedSplit(true); triggerHaptic('light') }}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 9,
                                border: 'none',
                                fontSize: 13,
                                fontWeight: 500,
                                fontFamily: FONT_FAMILY,
                                cursor: 'pointer',
                                color: 'var(--muted)',
                                background: 'transparent',
                              }}
                              aria-label="More split options"
                            >
                              More ›
                            </button>
                          )}
                        </div>

                        {/* Advanced modes — percent & shares (progressive, task 284.1) */}
                        <AnimatePresence>
                          {showAdvancedSplit && (
                            <motion.div
                              key="advanced-split-modes"
                              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                              transition={springs.snappy}
                              style={{ overflow: 'hidden' }}
                            >
                              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => { setSplitMode('percent'); triggerHaptic('light') }}
                                  aria-pressed={splitMode === 'percent'}
                                  style={{
                                    flex: 1,
                                    padding: '8px 0',
                                    borderRadius: 9,
                                    border: 'none',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    fontFamily: FONT_FAMILY,
                                    cursor: 'pointer',
                                    transition: 'background 0.15s, color 0.15s',
                                    textAlign: 'center',
                                    color: splitMode === 'percent' ? 'var(--text)' : 'var(--muted)',
                                    background: splitMode === 'percent' ? 'rgba(129, 140, 248, 0.12)' : 'transparent',
                                  }}
                                >
                                  By %
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setSplitMode('shares'); triggerHaptic('light') }}
                                  aria-pressed={splitMode === 'shares'}
                                  style={{
                                    flex: 1,
                                    padding: '8px 0',
                                    borderRadius: 9,
                                    border: 'none',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    fontFamily: FONT_FAMILY,
                                    cursor: 'pointer',
                                    transition: 'background 0.15s, color 0.15s',
                                    textAlign: 'center',
                                    color: splitMode === 'shares' ? 'var(--text)' : 'var(--muted)',
                                    background: splitMode === 'shares' ? 'rgba(129, 140, 248, 0.12)' : 'transparent',
                                  }}
                                >
                                  By shares
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Split count stepper — only in even mode AND when no participants added (task 123.1) */}
                      {splitMode === 'even' && splitParticipants.length === 0 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 4px 4px',
                            gap: 12,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: FONT_FAMILY,
                              fontSize: 13,
                              color: 'var(--sub)',
                            }}
                          >
                            Split between
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setSplitCount((c) => Math.max(2, c - 1))}
                              disabled={splitCount <= 2}
                              aria-label="Decrease split count"
                              style={{
                                ...roundButton,
                                color: splitCount <= 2 ? 'var(--muted)' : 'var(--text)',
                                cursor: splitCount <= 2 ? 'not-allowed' : 'pointer',
                                opacity: splitCount <= 2 ? 0.4 : 1,
                              }}
                            >
                              −
                            </button>
                            <span
                              style={{
                                fontFamily: FONT_FAMILY,
                                fontSize: 18,
                                fontWeight: 600,
                                color: 'var(--text)',
                                minWidth: 50,
                                textAlign: 'center',
                              }}
                              aria-live="polite"
                              aria-label={`${splitCount} people`}
                            >
                              {splitCount} 👥
                            </span>
                            <button
                              type="button"
                              onClick={() => setSplitCount((c) => Math.min(20, c + 1))}
                              disabled={splitCount >= 20}
                              aria-label="Increase split count"
                              style={{
                                ...roundButton,
                                color: splitCount >= 20 ? 'var(--muted)' : 'var(--text)',
                                cursor: splitCount >= 20 ? 'not-allowed' : 'pointer',
                                opacity: splitCount >= 20 ? 0.4 : 1,
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Custom share input — only in custom mode */}
                      {splitMode === 'custom' && (
                        <div style={{ padding: '14px 4px 4px' }}>
                          <label
                            style={{
                              fontFamily: FONT_FAMILY,
                              fontSize: 13,
                              color: 'var(--sub)',
                              display: 'block',
                              marginBottom: 6,
                            }}
                          >
                            Your share
                          </label>
                          <div style={{ position: 'relative' }}>
                            <span
                              style={{
                                position: 'absolute',
                                left: 12,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontFamily: FONT_FAMILY,
                                fontSize: 14,
                                color: 'var(--muted)',
                                pointerEvents: 'none',
                              }}
                            >
                              $
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={customShareInput}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9.]/g, '')
                                const parts = raw.split('.')
                                if (parts.length > 2) return
                                if (parts[1] && parts[1].length > 2) return
                                setCustomShareInput(raw)
                              }}
                              aria-label="Your custom share amount"
                              style={{
                                width: '100%',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: borderRadius.md,
                                outline: 'none',
                                fontSize: 14,
                                fontFamily: FONT_FAMILY,
                                color: 'var(--text)',
                                padding: '10px 14px 10px 24px',
                                caretColor: 'var(--text)',
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Percent inputs — only in percent mode (task 284.1) */}
                      {splitMode === 'percent' && splitParticipants.length > 0 && (
                        <div style={{ padding: '14px 4px 4px' }}>
                          <label style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--sub)', display: 'block', marginBottom: 8 }}>
                            Percentage per person (must total 100%)
                          </label>
                          {/* You (the payer) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--text)', minWidth: 60 }}>You</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100}
                              value={100 - percentInputs.reduce((s, v) => s + v, 0)}
                              readOnly
                              aria-label="Your percentage"
                              style={{
                                width: 60,
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: borderRadius.sm,
                                fontSize: 13,
                                fontFamily: FONT_FAMILY,
                                color: 'var(--muted)',
                                padding: '6px 8px',
                                textAlign: 'center',
                              }}
                            />
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 12, color: 'var(--muted)' }}>%</span>
                          </div>
                          {splitParticipants.map((p, i) => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--text)', minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={100}
                                value={percentInputs[i] ?? 0}
                                onChange={(e) => {
                                  const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                                  setPercentInputs((prev) => { const next = [...prev]; next[i] = val; return next })
                                }}
                                aria-label={`${p.name}'s percentage`}
                                style={{
                                  width: 60,
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: borderRadius.sm,
                                  fontSize: 13,
                                  fontFamily: FONT_FAMILY,
                                  color: 'var(--text)',
                                  padding: '6px 8px',
                                  textAlign: 'center',
                                }}
                              />
                              <span style={{ fontFamily: FONT_FAMILY, fontSize: 12, color: 'var(--muted)' }}>%</span>
                            </div>
                          ))}
                          {(() => {
                            const totalPct = percentInputs.reduce((s, v) => s + v, 0)
                            if (totalPct > 100) return (
                              <span style={{ fontFamily: FONT_FAMILY, fontSize: 11, color: 'var(--warning)' }}>Total exceeds 100%</span>
                            )
                            return null
                          })()}
                        </div>
                      )}

                      {/* Shares inputs — only in shares mode (task 284.1) */}
                      {splitMode === 'shares' && splitParticipants.length > 0 && (
                        <div style={{ padding: '14px 4px 4px' }}>
                          <label style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--sub)', display: 'block', marginBottom: 8 }}>
                            Shares per person (proportional)
                          </label>
                          {/* You (the payer) — always 1 share by default */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--text)', minWidth: 60 }}>You</span>
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--muted)' }}>1 share</span>
                          </div>
                          {splitParticipants.map((p, i) => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: 'var(--text)', minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  type="button"
                                  onClick={() => setShareInputs((prev) => { const next = [...prev]; next[i] = Math.max(1, (next[i] ?? 1) - 1); return next })}
                                  disabled={(shareInputs[i] ?? 1) <= 1}
                                  aria-label={`Decrease ${p.name}'s shares`}
                                  style={{ ...roundButton, width: 26, height: 26, fontSize: 14, opacity: (shareInputs[i] ?? 1) <= 1 ? 0.4 : 1, cursor: (shareInputs[i] ?? 1) <= 1 ? 'not-allowed' : 'pointer' }}
                                >−</button>
                                <span style={{ fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 600, color: 'var(--text)', minWidth: 24, textAlign: 'center' }}>{shareInputs[i] ?? 1}</span>
                                <button
                                  type="button"
                                  onClick={() => setShareInputs((prev) => { const next = [...prev]; next[i] = Math.min(10, (next[i] ?? 1) + 1); return next })}
                                  disabled={(shareInputs[i] ?? 1) >= 10}
                                  aria-label={`Increase ${p.name}'s shares`}
                                  style={{ ...roundButton, width: 26, height: 26, fontSize: 14, opacity: (shareInputs[i] ?? 1) >= 10 ? 0.4 : 1, cursor: (shareInputs[i] ?? 1) >= 10 ? 'not-allowed' : 'pointer' }}
                                >+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Owed breakdown (task 113.1, extended task 284.1) */}
                      {(() => {
                        const parsed = parseFloat(amount)
                        if (!parsed || parsed <= 0) return null

                        const friends = splitFriends.length > 0 ? splitFriends : (splitWith.trim() ? [splitWith.trim()] : [])

                        let userShare: number
                        let perFriendBreakdown: { name: string; owes: number }[]

                        if (splitMode === 'custom') {
                          const customVal = parseFloat(customShareInput)
                          userShare = (customVal > 0 && customVal <= parsed) ? customVal : parsed
                          perFriendBreakdown = friends.length > 0
                            ? computePerFriendOwedCustom(parsed, userShare, friends)
                            : []
                        } else if (splitMode === 'percent' && splitParticipants.length > 0) {
                          // Compute participant amounts as raw rounded values (not reconciled against totalAmount)
                          const participantAmounts = percentInputs.map((p) => Math.round((parsed * p) / 100 * 100) / 100)
                          const participantSum = participantAmounts.reduce((s, a) => s + a, 0)
                          userShare = Math.round((parsed - participantSum) * 100) / 100
                          perFriendBreakdown = splitParticipants.map((p, i) => ({
                            name: p.name,
                            owes: participantAmounts[i] ?? 0,
                          }))
                        } else if (splitMode === 'shares' && splitParticipants.length > 0) {
                          const allShares = [1, ...shareInputs.slice(0, splitParticipants.length)]
                          const amounts = computeShareSplit(parsed, allShares)
                          userShare = amounts[0] ?? parsed
                          perFriendBreakdown = splitParticipants.map((p, i) => ({
                            name: p.name,
                            owes: amounts[i + 1] ?? 0,
                          }))
                        } else {
                          userShare = computeSplitAmount(parsed, splitCount)
                          perFriendBreakdown = friends.length > 0
                            ? computePerFriendOwed(parsed, friends, splitCount)
                            : []
                        }

                        const shareStr = userShare % 1 === 0 ? `$${userShare}` : `$${userShare.toFixed(2)}`
                        const totalStr = parsed % 1 === 0 ? `$${parsed}` : `$${parsed.toFixed(2)}`

                        return (
                          <div
                            style={{
                              padding: '14px 4px 4px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            {/* Total */}
                            <div
                              style={{
                                fontFamily: FONT_FAMILY,
                                fontSize: 13,
                                color: 'var(--sub)',
                                textAlign: 'center',
                              }}
                            >
                              Total: {totalStr}
                            </div>

                            {/* Your share pill */}
                            <div style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  fontFamily: FONT_FAMILY,
                                  fontSize: 14,
                                  fontWeight: 500,
                                  color: 'var(--text)',
                                  background: 'rgba(129, 140, 248, 0.08)',
                                  border: '1px solid rgba(129, 140, 248, 0.2)',
                                  borderRadius: borderRadius.full,
                                  padding: '6px 14px',
                                  display: 'inline-block',
                                }}
                                aria-live="polite"
                              >
                                Your share: {shareStr}
                              </span>
                            </div>

                            {/* Per-friend breakdown */}
                            {perFriendBreakdown.length > 0 && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4,
                                  alignItems: 'center',
                                }}
                              >
                                {perFriendBreakdown.map(({ name, owes }) => {
                                  const owesStr = owes % 1 === 0 ? `$${owes}` : `$${owes.toFixed(2)}`
                                  return (
                                    <span
                                      key={name}
                                      style={{
                                        fontFamily: FONT_FAMILY,
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: 'var(--success)',
                                        opacity: 0.9,
                                      }}
                                      aria-live="polite"
                                    >
                                      {name} owes you {owesStr} 💸
                                    </span>
                                  )
                                })}
                              </div>
                            )}

                            {/* View settle-up link (task 284.2) */}
                            {onOpenSettleUp && perFriendBreakdown.length > 0 && (
                              <div style={{ textAlign: 'center', marginTop: 4 }}>
                                <button
                                  type="button"
                                  onClick={() => { onOpenSettleUp(); triggerHaptic('light') }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '4px 0',
                                    cursor: 'pointer',
                                    fontFamily: FONT_FAMILY,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: 'rgba(129, 140, 248, 0.8)',
                                  }}
                                  aria-label="View settle-up ledger"
                                >
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

              {/* ── IOU Toggle (shown when borrowed source selected, task 84.1) ── */}
              <AnimatePresence>
                {selectedSourceIsBorrowed && (
                  <motion.div
                    key="iou-toggle"
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={springs.snappy}
                    style={{ overflow: 'hidden', marginBottom: 20 }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setTrackAsIOU((prev) => !prev)
                        triggerHaptic('light')
                      }}
                      aria-pressed={trackAsIOU}
                      aria-label="Track as IOU — I owe this back"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '12px 14px',
                        background: trackAsIOU
                          ? colorRamp.warning[100]
                          : 'transparent',
                        border: trackAsIOU
                          ? `1px solid ${colorRamp.warning[300]}`
                          : `1px solid ${fills[8]}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Toggle indicator */}
                      <span
                        style={{
                          width: 36,
                          height: 20,
                          borderRadius: 10,
                          background: trackAsIOU
                            ? 'rgba(251, 191, 36, 0.8)'
                            : fills[12],
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
                            left: trackAsIOU ? 18 : 2,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: 'var(--text)',
                            transition: 'left 0.15s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }}
                        />
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                        <span
                          style={{
                            fontFamily: FONT_FAMILY,
                            fontSize: 14,
                            fontWeight: 500,
                            color: trackAsIOU ? 'var(--text)' : 'var(--sub)',
                          }}
                        >
                          Track as IOU
                        </span>
                        <span
                          style={{
                            fontFamily: FONT_FAMILY,
                            fontSize: 11,
                            fontWeight: 400,
                            color: 'var(--muted)',
                          }}
                        >
                          I owe this back
                        </span>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Log Button (thumb zone — pinned at bottom of sheet) ── */}
              <motion.button
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-label="Log expense"
                whileTap={canSubmit && !prefersReducedMotion ? { scale: 0.97 } : undefined}
                transition={springs.bouncy}
                style={{
                  width: '100%',
                  height: 56,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 'auto',
                  background: canSubmit
                    ? 'linear-gradient(135deg, rgba(129, 140, 248, 1) 0%, rgba(99, 102, 241, 1) 100%)'
                    : 'var(--dim)',
                  color: canSubmit ? 'var(--text)' : 'var(--muted)',
                  fontFamily: FONT_FAMILY,
                  fontSize: pxToRem(17),
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  opacity: canSubmit ? 1 : 0.5,
                  boxShadow: canSubmit ? shadows.glowAccentStrong : 'none',
                  transition: 'opacity 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                Log
              </motion.button>
            </div>
    </Sheet>
  )
}
