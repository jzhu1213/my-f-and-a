"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence, PanInfo, Variants, Reorder, LayoutGroup } from "framer-motion"
import type { Transaction, Budget, TransactionCategory } from "@/types"
import { BUDGET_CATEGORIES } from "@/types"
import type { QuickTransaction, SmartSuggestion, CustomCategory } from "@/types/folio"
import { generateSmartSuggestions } from "@/lib/suggestionUtils"
import { lookupMerchant, getMerchantCategoryContext, getMerchantAverageAmount } from "@/lib/merchantMemory"
import { useToast } from "@/contexts/ToastContext"
import { useTranslation } from "@/contexts/I18nContext"
import { springs, timings, STAGGER_STEP, useReducedMotion } from "@/lib/animations"
import { CategoryIcon } from "@/components/ui/CategoryIcon"
import type { IconName } from "@/lib/icons"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { getCategoryAccent } from '@/styles/shared'
import { radius } from '@/styles/surfaces'
import { getTravelCurrency } from '@/lib/travelMode'
import { formatCurrency as formatCurrencyUtil } from '@/lib/currencyUtils'
import { getRate } from '@/lib/exchangeRates'
import { getHomeCurrency } from '@/lib/currencyPreferences'
import {
  loadCategoryGridPrefs,
  saveCategoryGridPrefs,
  mergePrefsWithDefaults,
  categoriesToPrefs,
  recordCategoryUsage,
  getCategoryFrequencies,
  loadSortMode,
  saveSortMode,
} from "@/lib/categoryGridPreferences"
import type { CategorySortMode } from "@/lib/categoryGridPreferences"

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum allowed transaction amount (Requirement 10.5) */
const MAX_AMOUNT = 99_999

/** Maximum note length in characters (Requirement 10.7) */
const MAX_NOTE_LENGTH = 60

/** Minimum swipe distance (px) to reveal custom amount input (Requirement 3.5) */
const SWIPE_THRESHOLD = 60

/** Spring for category icon bounce micro-interaction (task 252.2). */
const ICON_BOUNCE_SPRING = { type: "spring", stiffness: 500, damping: 22 } as const

/** How long (ms) a chip must be held before the pulse-ring haptic fires. */
const LONG_PRESS_MS = 350

/** How long (ms) the success ripple plays before the selection resets. */
const RIPPLE_MS = 700

// ── Validation & Sanitization ────────────────────────────────────────────────

/**
 * Validates that an amount is positive and within allowed range.
 * Requirement 10.5
 */
function validateAmount(amount: number): string | null {
  if (!isFinite(amount) || isNaN(amount)) return "Enter a valid amount"
  if (amount <= 0) return "Amount must be greater than $0"
  if (amount > MAX_AMOUNT) return `Amount cannot exceed $${MAX_AMOUNT.toLocaleString()}`
  return null
}

/**
 * Sanitizes a note: strips HTML tags and trims to max 60 characters.
 * Requirement 10.7
 */
function sanitizeNote(raw: string): string {
  // Strip HTML tags using a simple regex (no DOM manipulation needed for plain text input)
  const stripped = raw.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim()
  return stripped.slice(0, MAX_NOTE_LENGTH)
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface CategoryButtonProps {
  category: TransactionCategory
  emoji: string
  label: string
  isSelected: boolean
  onSelect: () => void
  reducedMotion: boolean
  tabIndex?: number
  /** True when this is a user-defined custom category. */
  isCustom?: boolean
  /** Resolved icon for a custom category (falls back to emoji when absent). */
  iconName?: IconName
}

/**
 * Large tappable category button — icon-centric pill with colored chip.
 *
 * Phase 6 task 252 redesign: a prominent tinted circle icon chip as the
 * primary visual element, with a subtle text label beneath. Fixed 72px width
 * for consistent optical alignment across the grid. On selection the shared-
 * layout highlight slides in and a subtle glow ring appears around the icon
 * chip. Tap triggers a crisp bounce on the icon (stiffness 500 / damping 22).
 *
 * Requirement 3.1, 8.4, 13.5, 15.2
 */
function CategoryButton({
  category,
  emoji,
  label,
  isSelected,
  onSelect,
  reducedMotion,
  tabIndex,
  isCustom = false,
  iconName,
}: CategoryButtonProps) {
  // Variant maps drive the tap gesture. Framer propagates the active gesture
  // variant ("tap") to any child that defines the same key, so the icon
  // bounces no matter where inside the card the press lands.
  const cardTapVariants: Variants = reducedMotion
    ? { tap: {} }
    : { tap: { scale: 0.94 } }

  const iconBounceVariants: Variants = reducedMotion
    ? { tap: {} }
    : { tap: { scale: 1.25 } }

  // Selection lift — subtle float upward with gentle scale increase.
  const selectionAnimate = reducedMotion
    ? {}
    : { y: isSelected ? -3 : 0, scale: isSelected ? 1.02 : 1 }

  // Per-category accent for the selection glow ring around the icon chip.
  const accent = getCategoryAccent(category)

  return (
    <motion.button
      type="button"
      className={`cat-pill cat-pill--glass${isSelected ? " selected" : ""}`}
      onClick={onSelect}
      variants={cardTapVariants}
      initial={false}
      animate={selectionAnimate}
      whileTap="tap"
      transition={springs.snappy}
      aria-pressed={isSelected}
      aria-label={`${label} category${isSelected ? ", selected" : ""}`}
      tabIndex={tabIndex}
    >
      {/* Expanding backdrop — shared layout element animates between cards */}
      {isSelected && (
        reducedMotion ? (
          <span className="cat-pill-highlight" aria-hidden="true" />
        ) : (
          <motion.span
            layoutId="cat-pill-highlight"
            className="cat-pill-highlight"
            transition={springs.snappy}
            aria-hidden="true"
          />
        )
      )}

      <span
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        {/* Icon chip — prominent tinted circle with selection glow ring */}
        <motion.span
          style={{
            display: "inline-flex",
            borderRadius: "50%",
            boxShadow: isSelected
              ? `0 0 0 2px ${accent}40, 0 0 8px ${accent}20`
              : "none",
            transition: "box-shadow 0.15s ease-out",
          }}
          variants={iconBounceVariants}
          transition={ICON_BOUNCE_SPRING}
          aria-hidden="true"
        >
          <CategoryIcon
            category={category}
            emoji={emoji}
            isCustom={isCustom}
            iconName={iconName}
            size={44}
          />
        </motion.span>
        {/* Label beneath — subtle, smaller text */}
        <span
          style={{
            fontSize: typography.caption.fontSize,
            fontWeight: fontWeights.medium,
            color: isSelected ? "var(--text)" : "var(--sub)",
            letterSpacing: "0.02em",
            maxWidth: 60,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "center",
          }}
        >
          {label}
        </span>
      </span>
    </motion.button>
  )
}

interface SuggestionChipProps {
  suggestion: SmartSuggestion
  onTap: () => void
  /** True while the success ripple should emanate from this chip. */
  rippleActive: boolean
  reducedMotion: boolean
  /** When travel mode is active, show amount in travel currency (task 422.3). */
  travelCurrency?: string | null
  /** Conversion rate from home → travel currency (task 422.3). */
  travelConversionRate?: number | null
}

/**
 * Chip showing a suggested amount with optional label.
 *
 * Restyled as a floating glass pill with a soft shadow (task 9.4). Tapping
 * immediately logs the expense and triggers a multi-ring success ripple with
 * haptic feedback; pressing and holding fires a haptic buzz and shows a
 * breathing pulse ring.
 *
 * Requirements 3.3, 3.4, 8.4, 13.5
 */
function SuggestionChip({ suggestion, onTap, rippleActive, reducedMotion, travelCurrency, travelConversionRate }: SuggestionChipProps) {
  const [isHolding, setIsHolding] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When travel mode is active and we have a rate, show in travel currency
  const showInTravel = travelCurrency && travelConversionRate && travelConversionRate > 0
  const displayAmount = showInTravel
    ? suggestion.amount * travelConversionRate
    : suggestion.amount
  const amountStr = showInTravel
    ? formatCurrencyUtil(displayAmount, travelCurrency)
    : suggestion.amount % 1 === 0
      ? `$${suggestion.amount}`
      : `$${suggestion.amount.toFixed(2)}`

  function clearHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    if (isHolding) setIsHolding(false)
  }

  function handlePointerDown() {
    holdTimer.current = setTimeout(() => {
      setIsHolding(true)
      // Press-and-hold haptic pattern (no-op where unsupported).
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([10, 30, 10])
      }
    }, LONG_PRESS_MS)
  }

  // Fire haptic when the ripple activates (success feedback).
  useEffect(() => {
    if (rippleActive && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(12)
    }
  }, [rippleActive])

  // Clean up any pending timer on unmount.
  useEffect(() => clearHold, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.button
      type="button"
      className="amount-chip active chip--glass flex-shrink-0"
      style={{
        position: "relative",
        minHeight: 52,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "12px 20px",
        borderRadius: radius.full,
      }}
      onClick={onTap}
      onPointerDown={handlePointerDown}
      onPointerUp={clearHold}
      onPointerLeave={clearHold}
      onPointerCancel={clearHold}
      whileTap={reducedMotion ? undefined : { scale: 0.95 }}
      aria-label={
        suggestion.label
          ? `Log ${amountStr} for ${suggestion.label}`
          : `Log ${amountStr}`
      }
    >
      {/* Press-and-hold pulse ring */}
      {isHolding && !reducedMotion && (
        <span className="chip-pulse-ring" aria-hidden="true" />
      )}
      {/* Filled flash — "confirmed" pulse behind the chip */}
      {rippleActive && <span className="chip-ripple-flash" aria-hidden="true" />}
      {/* Multi-ring success ripple emanating from the tapped chip */}
      {rippleActive && <span className="chip-ripple" aria-hidden="true" />}

      <span
        style={{
          position: "relative",
          zIndex: 3,
          fontSize: typography.body.fontSize,
          fontWeight: fontWeights.semibold,
          color: "var(--text)",
          fontVariantNumeric: "tabular-nums",
          fontFamily: FONT_FAMILY,
        }}
      >
        {amountStr}
      </span>
      {suggestion.label && (
        <span
          style={{
            position: "relative",
            zIndex: 3,
            fontSize: typography.caption.fontSize,
            color: "var(--muted)",
            maxWidth: 88,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: FONT_FAMILY,
          }}
        >
          {suggestion.label}
        </span>
      )}
    </motion.button>
  )
}

// ── Edit Category Inline (Task 133.1) ────────────────────────────────────────

interface EditCategoryInlineProps {
  emoji: string
  label: string
  onSave: (emoji: string, label: string) => void
  onCancel: () => void
  reducedMotion: boolean
}

/**
 * Small inline form to rename a category's label and emoji.
 * Appears when tapping a category in customize/edit mode.
 */
function EditCategoryInline({ emoji, label, onSave, onCancel, reducedMotion }: EditCategoryInlineProps) {
  const [editEmoji, setEditEmoji] = useState(emoji)
  const [editLabel, setEditLabel] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedLabel = editLabel.trim()
    if (trimmedLabel.length === 0) return
    onSave(editEmoji.trim() || emoji, trimmedLabel)
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      transition={springs.snappy}
      style={{
        display: "flex",
        gap: spacing.xs,
        alignItems: "center",
        padding: "10px 12px",
        background: "var(--fill-04)",
        border: "1px solid var(--fill-10)",
        borderRadius: radius.control,
      }}
      aria-label={`Edit ${label} category`}
    >
      <input
        type="text"
        value={editEmoji}
        onChange={(e) => setEditEmoji(e.target.value)}
        style={{
          width: 36,
          height: 36,
          fontSize: typography.subhead.fontSize,
          textAlign: "center",
          background: "var(--fill-06)",
          border: "1px solid var(--fill-10)",
          borderRadius: radius.control,
          color: "var(--text)",
          padding: 0,
        }}
        aria-label="Category emoji"
        maxLength={4}
      />
      <input
        ref={inputRef}
        type="text"
        value={editLabel}
        onChange={(e) => setEditLabel(e.target.value.slice(0, 20))}
        style={{
          flex: 1,
          height: 36,
          fontSize: typography['body-sm'].fontSize,
          fontWeight: fontWeights.medium,
          background: "var(--fill-06)",
          border: "1px solid var(--fill-10)",
          borderRadius: radius.control,
          color: "var(--text)",
          padding: "0 10px",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Category label"
        maxLength={20}
      />
      <button
        type="submit"
        style={{
          height: 36,
          padding: "0 12px",
          fontSize: typography['body-sm'].fontSize,
          fontWeight: fontWeights.medium,
          background: "var(--accent-200)",
          border: "1px solid var(--accent-400)",
          borderRadius: radius.control,
          color: "var(--text)",
          cursor: "pointer",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Save category changes"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          height: 36,
          padding: "0 10px",
          fontSize: typography['body-sm'].fontSize,
          fontWeight: fontWeights.medium,
          background: "none",
          border: "1px solid var(--fill-10)",
          borderRadius: radius.control,
          color: "var(--muted)",
          cursor: "pointer",
          fontFamily: FONT_FAMILY,
        }}
        aria-label="Cancel editing"
      >
        ✕
      </button>
    </motion.form>
  )
}

interface CustomAmountPanelProps {
  category: TransactionCategory
  onSubmit: (transaction: QuickTransaction) => void
  onCancel: () => void
  reducedMotion: boolean
}

/**
 * Swipe-revealed custom amount entry panel.
 * Validates amount and sanitizes note before submitting.
 * Requirements 3.5, 10.5, 10.7, 14.1
 */
function CustomAmountPanel({ category, onSubmit, onCancel, reducedMotion }: CustomAmountPanelProps) {
  const t = useTranslation()
  const [rawAmount, setRawAmount] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [merchantContext, setMerchantContext] = useState<string | null>(null)
  const [merchantAvg, setMerchantAvg] = useState<{ amount: number; label: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRawAmount(e.target.value)
    setError(null)
  }

  function handleNoteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const sanitized = sanitizeNote(e.target.value)
    setNote(sanitized)

    // Merchant memory detection (task 340.1, 340.2)
    if (sanitized.trim().length >= 2) {
      const merchant = lookupMerchant(sanitized)
      if (merchant) {
        // Pre-fill amount from merchant memory if user hasn't typed one
        if (!rawAmount) {
          setRawAmount(merchant.amount % 1 === 0 ? String(merchant.amount) : merchant.amount.toFixed(2))
        }
        const catCtx = getMerchantCategoryContext(sanitized)
        setMerchantContext(catCtx?.message ?? null)
        const avgCtx = getMerchantAverageAmount(sanitized)
        setMerchantAvg(avgCtx)
        return
      }
    }
    setMerchantContext(null)
    setMerchantAvg(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(rawAmount)
    const validationError = validateAmount(amount)
    if (validationError) {
      setError(validationError)
      inputRef.current?.focus()
      return
    }
    // Keep category selection intact on validation failure (Requirement 14.5)
    const sanitizedNote = note ? sanitizeNote(note) : undefined
    onSubmit({ category, amount, note: sanitizedNote })
  }

  const categoryInfo = BUDGET_CATEGORIES.find((c) => c.category === category)

  return (
    <motion.form
      layout={!reducedMotion}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      transition={springs.gentle}
      aria-label={`Custom amount for ${categoryInfo?.label ?? category}`}
    >
      <div className="flex items-center gap-2">
        <CategoryIcon category={category} size={28} />
        <span style={{ fontSize: typography.body.fontSize, color: "var(--sub)", fontWeight: fontWeights.medium }}>
          {categoryInfo?.label ?? category}
        </span>
      </div>

      {/* Amount field */}
      <div className="flex flex-col gap-1">
        <div
          className="flex items-center gap-2"
          style={{
            background: "var(--raised)",
            borderRadius: "var(--radius-sm)",
            padding: "0 12px",
            border: error ? "1px solid var(--error)" : "1px solid var(--border)",
          }}
        >
          <span style={{ color: "var(--sub)", fontSize: typography.subhead.fontSize, fontWeight: fontWeights.medium }}>$</span>
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max={MAX_AMOUNT}
            value={rawAmount}
            onChange={handleAmountChange}
            placeholder="0.00"
            className="t-input"
            style={{ border: "none", padding: "14px 0", fontSize: typography.subhead.fontSize, fontWeight: fontWeights.medium }}
            aria-label="Amount"
            aria-describedby={error ? "amount-error" : undefined}
            autoFocus
          />
        </div>
        {error && (
          <p
            id="amount-error"
            role="alert"
            style={{ fontSize: typography['body-sm'].fontSize, color: "var(--error)", marginTop: 2 }}
          >
            {error}
          </p>
        )}
      </div>

      {/* Note field */}
      <input
        type="text"
        value={note}
        onChange={handleNoteChange}
        placeholder={t('quicklog.notePlaceholderShort')}
        className="t-input"
        maxLength={MAX_NOTE_LENGTH}
        aria-label={t('quicklog.notePlaceholderShort')}
        style={{ fontSize: typography.body.fontSize }}
      />
      {note.length >= MAX_NOTE_LENGTH - 5 && (
        <p style={{ fontSize: typography.caption.fontSize, color: "var(--muted)", textAlign: "right" }}>
          {note.length}/{MAX_NOTE_LENGTH}
        </p>
      )}

      {/* Merchant context message (task 340.1) */}
      {merchantContext && (
        <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)", margin: 0, fontFamily: FONT_FAMILY }}>
          {merchantContext}
        </p>
      )}

      {/* Merchant average amount chip (task 340.2) */}
      {merchantAvg && (
        <button
          type="button"
          onClick={() => setRawAmount(merchantAvg.amount % 1 === 0 ? String(merchantAvg.amount) : merchantAvg.amount.toFixed(2))}
          style={{
            alignSelf: "flex-start",
            padding: "6px 12px",
            fontSize: typography['body-sm'].fontSize,
            fontWeight: fontWeights.medium,
            fontFamily: FONT_FAMILY,
            background: "var(--accent-100)",
            border: "1px solid var(--accent-300)",
            borderRadius: radius.full,
            color: "var(--text)",
            cursor: "pointer",
          }}
          aria-label={`Use average amount: ${merchantAvg.label}`}
        >
          {merchantAvg.label}
        </button>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-ghost"
          style={{ flex: 1, height: 48, fontSize: typography['body-sm'].fontSize }}
          onClick={onCancel}
        >
          {t('quicklog.cancel')}
        </button>
        <button
          type="submit"
          className="btn-primary"
          style={{ flex: 2, height: 48, fontSize: typography['body-sm'].fontSize }}
        >
          {t('quicklog.logExpense')}
        </button>
      </div>
    </motion.form>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface QuickLogAreaProps {
  /** User's transaction history for smart suggestions and frequency sorting */
  recentTransactions: Transaction[]
  /** Budget data (reserved for future category-aware suggestions) */
  budgets: Budget[]
  /** Callback when an expense is logged */
  onLogExpense: (transaction: QuickTransaction) => void
  /** Callback when income is logged */
  onLogIncome: (amount: number, note?: string) => void
  /** User-defined custom categories to show in the category grid (task 69) */
  customCategories?: CustomCategory[]
}

/**
 * QuickLogArea — enables one-tap and swipe-to-custom expense logging.
 *
 * Features:
 * - Category icons sorted by usage frequency (most-used first)
 * - Smart suggestions displayed on category tap (up to 4 chips)
 * - "Repeat last" chips for frequent transactions
 * - One-tap logging from suggestion chip
 * - Swipe-down gesture to reveal custom amount entry
 * - Amount validation and note sanitization
 * - Success toast feedback after logging
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 10.5, 10.7
 */
export function QuickLogArea({
  recentTransactions,
  budgets,
  onLogExpense,
  onLogIncome,
  customCategories = [],
}: QuickLogAreaProps) {
  const { showToast } = useToast()
  const t = useTranslation()
  const { prefersReducedMotion } = useReducedMotion()
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)
  /** Id of the chip currently playing the success ripple (task 9.4). */
  const [rippleChipId, setRippleChipId] = useState<string | null>(null)
  /** Whether the user dismissed the category budget insight line (task 341.1). */
  const [dismissedCategoryInsight, setDismissedCategoryInsight] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Customize mode state (Task 133.1) ──────────────────────────────────────
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [customizedCategories, setCustomizedCategories] = useState<
    { category: TransactionCategory; emoji: string; label: string }[]
  >([])

  // ── Sort mode state (Task 339.2) ──────────────────────────────────────────
  const [sortMode, setSortMode] = useState<CategorySortMode>('manual')

  // ── Travel mode: convert suggestion amounts to travel currency (task 422.3) ──
  const [travelConversionRate, setTravelConversionRate] = useState<number | null>(null)
  const travelCurrency = getTravelCurrency()

  // Load saved preferences on mount
  useEffect(() => {
    const prefs = loadCategoryGridPrefs()
    if (prefs) {
      setCustomizedCategories(mergePrefsWithDefaults(prefs))
    }
    setSortMode(loadSortMode())
  }, [])

  // Fetch travel conversion rate on mount (home → travel, task 422.3)
  useEffect(() => {
    if (!travelCurrency) {
      setTravelConversionRate(null)
      return
    }
    let cancelled = false
    const home = getHomeCurrency()
    getRate(home, travelCurrency).then((rate) => {
      if (!cancelled && rate !== null) {
        setTravelConversionRate(rate)
      }
    })
    return () => { cancelled = true }
  }, [travelCurrency])

  // Clean up the ripple reset timer on unmount.
  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  // Scale + fade entrance stagger for suggestion chips (task 9.4).
  const chipContainerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: prefersReducedMotion ? 0 : STAGGER_STEP } },
  }
  const chipItemVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, scale: 0.8, y: 8 },
        visible: { opacity: 1, scale: 1, y: 0, transition: springs.snappy },
      }

  // ── 6.2: Sort categories by usage frequency (Requirement 3.2) ──────────────
  const sortedCategories = useMemo(() => {
    // Build the custom category entries (shared across modes)
    const custom = [...customCategories]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((c) => ({
        category: 'other' as TransactionCategory,
        emoji: c.emoji,
        label: c.label,
        customId: c.id,
        icon: c.icon,
      }))

    // ── Auto mode (Task 339.2): sort by 30-day frequency data ──
    if (sortMode === 'auto') {
      const frequencies = getCategoryFrequencies()
      const prefs = loadCategoryGridPrefs()

      // Determine "pinned" categories — ones user has manually arranged
      // A category is pinned if it exists in the saved manual prefs
      const pinnedPositions = new Map<string, number>()
      if (prefs && prefs.length > 0) {
        for (const pref of prefs) {
          pinnedPositions.set(pref.categoryId, pref.order)
        }
      }

      // Get the base list with any emoji/label overrides from prefs
      const baseList = prefs && prefs.length > 0
        ? mergePrefsWithDefaults(prefs)
        : [...BUDGET_CATEGORIES]

      // Separate pinned and unpinned categories
      const pinned: { cat: typeof baseList[0]; order: number }[] = []
      const unpinned: typeof baseList = []

      for (const cat of baseList) {
        if (pinnedPositions.has(cat.category)) {
          pinned.push({ cat, order: pinnedPositions.get(cat.category)! })
        } else {
          unpinned.push(cat)
        }
      }

      // Sort unpinned by frequency (highest first), then by default order for ties
      const defaultOrder = BUDGET_CATEGORIES.map(c => c.category)
      unpinned.sort((a, b) => {
        const freqA = frequencies.get(a.category) ?? 0
        const freqB = frequencies.get(b.category) ?? 0
        if (freqB !== freqA) return freqB - freqA
        return defaultOrder.indexOf(a.category) - defaultOrder.indexOf(b.category)
      })

      // Merge: place pinned categories at their saved positions, fill rest with frequency-sorted
      const result: typeof baseList = []
      const maxLen = baseList.length
      let unpinnedIdx = 0

      // Sort pinned by their saved order
      pinned.sort((a, b) => a.order - b.order)
      let pinnedIdx = 0

      for (let i = 0; i < maxLen; i++) {
        if (pinnedIdx < pinned.length && pinned[pinnedIdx].order === i) {
          result.push(pinned[pinnedIdx].cat)
          pinnedIdx++
        } else if (unpinnedIdx < unpinned.length) {
          result.push(unpinned[unpinnedIdx])
          unpinnedIdx++
        }
      }

      // Append any remaining (edge case safety)
      while (pinnedIdx < pinned.length) {
        result.push(pinned[pinnedIdx].cat)
        pinnedIdx++
      }
      while (unpinnedIdx < unpinned.length) {
        result.push(unpinned[unpinnedIdx])
        unpinnedIdx++
      }

      return [...result, ...custom]
    }

    // ── Manual mode: use saved customization or fallback to recency ──
    if (customizedCategories.length > 0) {
      return [...customizedCategories, ...custom]
    }

    // Fallback: frequency-based sorting for new users (no prefs saved)
    // Count transactions per expense category (look at the last 50 for performance)
    const usageCount = new Map<TransactionCategory, number>()
    const sample = recentTransactions.slice(0, 50)
    for (const tx of sample) {
      if (tx.type === "expense") {
        usageCount.set(tx.category, (usageCount.get(tx.category) ?? 0) + 1)
      }
    }
    // Only show expense categories (BUDGET_CATEGORIES excludes income)
    const builtIn = [...BUDGET_CATEGORIES].sort(
      (a, b) => (usageCount.get(b.category) ?? 0) - (usageCount.get(a.category) ?? 0)
    )

    return [...builtIn, ...custom]
  }, [recentTransactions, customCategories, customizedCategories, sortMode])

  // ── 6.3: Smart suggestions for selected category (Requirements 3.3, 3.6) ───
  const suggestions = useMemo<SmartSuggestion[]>(() => {
    if (!selectedCategory) return []
    return generateSmartSuggestions(selectedCategory, recentTransactions)
  }, [selectedCategory, recentTransactions])

  // ── Category budget insight (Task 341.1, Requirement 18.4) ─────────────────
  const categoryInsight = useMemo<string | null>(() => {
    if (!selectedCategory) return null
    const budget = budgets.find(b => b.category === selectedCategory)
    if (!budget) return null

    const remaining = budget.monthlyLimit - budget.spent
    const ratio = budget.monthlyLimit > 0 ? remaining / budget.monthlyLimit : 0

    // Approximate weeks left in month (use current date)
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth = now.getDate()
    const daysLeft = Math.max(1, daysInMonth - dayOfMonth)
    const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7))
    const weeklyRemaining = Math.max(0, Math.round(remaining / weeksLeft))

    const label = BUDGET_CATEGORIES.find(c => c.category === selectedCategory)?.label ?? selectedCategory

    if (ratio > 0.5) {
      return `${label}: on track`
    } else if (ratio >= 0.25) {
      return `${label}: $${weeklyRemaining} left this week`
    } else if (ratio >= 0) {
      return `${label}: a little tight this month`
    }
    // Overspent — still non-judgmental
    return `${label}: over budget, but tomorrow's a new day`
  }, [selectedCategory, budgets])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCategorySelect(category: TransactionCategory) {
    if (selectedCategory === category) {
      // Deselect — collapse suggestions
      setSelectedCategory(null)
      setShowCustomInput(false)
    } else {
      setSelectedCategory(category)
      setShowCustomInput(false)
      setDismissedCategoryInsight(false) // Reset insight dismissal on category change (task 341.1)
    }
  }

  /** ── 6.4: One-tap expense logging (Requirements 3.4, 3.7) ── */
  function handleSuggestionTap(suggestion: SmartSuggestion) {
    if (!selectedCategory) return
    const transaction: QuickTransaction = {
      category: selectedCategory,
      amount: suggestion.amount,
      note: suggestion.label,
    }
    onLogExpense(transaction)
    // Record category usage for frequency-based sorting (Task 339.1)
    recordCategoryUsage(selectedCategory)
    const amountStr =
      suggestion.amount % 1 === 0
        ? `$${suggestion.amount}`
        : `$${suggestion.amount.toFixed(2)}`
    showToast(`Logged ${amountStr} for ${categoryLabel(selectedCategory)} ✓`, "success")

    // Reset to the default state (Requirement 3.7). When motion is enabled we
    // briefly keep the tapped chip mounted so the success ripple can play.
    if (prefersReducedMotion) {
      setSelectedCategory(null)
      setShowCustomInput(false)
      return
    }
    setRippleChipId(suggestion.id)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => {
      setSelectedCategory(null)
      setShowCustomInput(false)
      setRippleChipId(null)
    }, RIPPLE_MS)
  }

  /** ── 6.5: Custom amount submitted from panel ── */
  function handleCustomSubmit(transaction: QuickTransaction) {
    onLogExpense(transaction)
    // Record category usage for frequency-based sorting (Task 339.1)
    recordCategoryUsage(transaction.category)
    const amountStr =
      transaction.amount % 1 === 0
        ? `$${transaction.amount}`
        : `$${transaction.amount.toFixed(2)}`
    showToast(`Logged ${amountStr} for ${categoryLabel(transaction.category)} ✓`, "success")
    // Clear category and return to default state (Requirement 3.7)
    setSelectedCategory(null)
    setShowCustomInput(false)
  }

  /**
   * ── 6.5: Swipe gesture to reveal custom amount (Requirement 3.5) ──
   * Detect a downward swipe on the suggestions row.
   */
  function handleSuggestionsPan(_: unknown, info: PanInfo) {
    if (info.offset.y > SWIPE_THRESHOLD && !showCustomInput) {
      setShowCustomInput(true)
    }
  }

  function categoryLabel(category: TransactionCategory): string {
    return BUDGET_CATEGORIES.find((c) => c.category === category)?.label ?? category
  }

  // ── Customize mode handlers (Task 133.1) ───────────────────────────────────

  /** Enter customize mode — copy current order into editable state */
  const handleStartCustomize = useCallback(() => {
    setIsCustomizing(true)
    setSelectedCategory(null)
    setShowCustomInput(false)
    setEditingCategoryId(null)
    // Use only built-in categories for reorder (custom categories handled separately)
    const builtInCats = sortedCategories.filter(c => !('customId' in c))
    setCustomizedCategories(builtInCats)
  }, [sortedCategories])

  /** Toggle sort mode between manual and auto (Task 339.2) */
  const handleToggleSortMode = useCallback(() => {
    const newMode: CategorySortMode = sortMode === 'auto' ? 'manual' : 'auto'
    setSortMode(newMode)
    saveSortMode(newMode)
  }, [sortMode])

  /** Save customized order + labels and exit edit mode */
  const handleDoneCustomize = useCallback(() => {
    const prefs = categoriesToPrefs(customizedCategories)
    saveCategoryGridPrefs(prefs)
    setIsCustomizing(false)
    setEditingCategoryId(null)
    showToast("Categories updated ✓", "success")
  }, [customizedCategories, showToast])

  /** Update a category's label/emoji inline */
  const handleSaveCategoryEdit = useCallback((categoryId: string, newEmoji: string, newLabel: string) => {
    setCustomizedCategories(prev =>
      prev.map(c =>
        c.category === categoryId
          ? { ...c, emoji: newEmoji, label: newLabel }
          : c
      )
    )
    setEditingCategoryId(null)
  }, [])

  /** Handle reorder from framer-motion Reorder.Group */
  const handleReorder = useCallback((newOrder: { category: TransactionCategory; emoji: string; label: string }[]) => {
    setCustomizedCategories(newOrder)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Quick log expense"
      style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
        <span
          style={{
            fontSize: typography['body-sm'].fontSize,
            fontWeight: fontWeights.medium,
            color: "var(--sub)",
            letterSpacing: "0.02em",
          }}
        >
          {t('quicklog.logExpense')}
        </span>
        <div className="flex items-center gap-3">
          {isCustomizing ? (
            <motion.button
              type="button"
              onClick={handleDoneCustomize}
              style={{
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.medium,
                color: "var(--text)",
                background: "var(--accent-200)",
                border: "1px solid var(--accent-400)",
                borderRadius: radius.full,
                padding: "5px 12px",
                cursor: "pointer",
                fontFamily: FONT_FAMILY,
              }}
              whileTap={{ scale: 0.95 }}
              aria-label="Done customizing categories"
            >
              Done
            </motion.button>
          ) : (
            <>
              {!selectedCategory && (
                <>
                  {/* Auto sort toggle (Task 339.2) */}
                  <motion.button
                    type="button"
                    onClick={handleToggleSortMode}
                    style={{
                      fontSize: typography['body-sm'].fontSize,
                      color: sortMode === 'auto' ? "var(--text)" : "var(--muted)",
                      background: sortMode === 'auto' ? "var(--accent-200)" : "none",
                      border: sortMode === 'auto' ? "1px solid var(--accent-300)" : "1px solid transparent",
                      borderRadius: radius.full,
                      cursor: "pointer",
                      padding: "5px 10px",
                      fontFamily: FONT_FAMILY,
                    }}
                    whileTap={{ scale: 0.95 }}
                    aria-label={sortMode === 'auto' ? "Switch to manual category order" : "Switch to auto-sorted categories"}
                    aria-pressed={sortMode === 'auto'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    Auto
                  </motion.button>
                  {/* Customize button — hidden when in auto mode */}
                  {sortMode !== 'auto' && (
                    <motion.button
                      type="button"
                      onClick={handleStartCustomize}
                      style={{
                        fontSize: typography['body-sm'].fontSize,
                        color: "var(--muted)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px 0",
                        fontFamily: FONT_FAMILY,
                      }}
                      whileTap={{ scale: 0.95 }}
                      aria-label="Customize category order and labels"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      Customize
                    </motion.button>
                  )}
                </>
              )}
              {selectedCategory && !showCustomInput && (
                <motion.button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="chip--glass"
                  style={{
                    fontSize: typography['body-sm'].fontSize,
                    fontWeight: fontWeights.medium,
                    color: "var(--text)",
                    background: "var(--accent-100)",
                    border: "0.5px solid var(--accent-200)",
                    cursor: "pointer",
                    padding: "5px 14px",
                    borderRadius: radius.full,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontFamily: FONT_FAMILY,
                  }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Enter custom amount"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Custom
                  <motion.span
                    aria-hidden="true"
                    animate={{ y: [0, 3, 0] }}
                    transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                    style={{ display: "inline-block", fontSize: typography.caption.fontSize }}
                  >
                    ↓
                  </motion.span>
                </motion.button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Category grid (Requirement 3.1) ── */}
      {isCustomizing ? (
        /* ── Customize mode: drag-to-reorder (Task 133.1) ── */
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <Reorder.Group
            axis="x"
            values={customizedCategories}
            onReorder={handleReorder}
            style={{
              display: "flex",
              gap: spacing.xs,
              listStyle: "none",
              padding: 0,
              margin: 0,
              overflowX: "auto",
              paddingBottom: 4,
            }}
            aria-label="Drag to reorder expense categories"
          >
            {customizedCategories.map((cat) => (
              <Reorder.Item
                key={cat.category}
                value={cat}
                style={{ cursor: "grab", touchAction: "none" }}
                whileDrag={prefersReducedMotion ? undefined : { scale: 1.05, boxShadow: 'var(--shadow-md)' }}
                dragListener={editingCategoryId !== cat.category}
              >
                <motion.button
                  type="button"
                  className="cat-pill cat-pill--glass"
                  style={{
                    minHeight: 80,
                    minWidth: 48,
                    position: "relative",
                    border: editingCategoryId === cat.category
                      ? "1.5px solid var(--accent-400)"
                      : undefined,
                  }}
                  onClick={() =>
                    setEditingCategoryId(
                      editingCategoryId === cat.category ? null : cat.category
                    )
                  }
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                  aria-label={`Edit ${cat.label} category. Drag to reorder.`}
                >
                  {/* Drag handle indicator */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 6,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 16,
                      height: 3,
                      borderRadius: 2,
                      background: "var(--fill-15)",
                    }}
                  />
                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: spacing.xs,
                      paddingTop: 6,
                    }}
                  >
                    <span style={{ fontSize: typography.headline.fontSize }} aria-hidden="true">
                      {cat.emoji}
                    </span>
                    <span
                      style={{
                        fontSize: typography.caption.fontSize,
                        fontWeight: fontWeights.medium,
                        color: "var(--sub)",
                        letterSpacing: "0.03em",
                        maxWidth: 60,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cat.label}
                    </span>
                  </span>
                </motion.button>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          {/* Inline edit form for tapped category */}
          <AnimatePresence mode="wait">
            {editingCategoryId && (
              <EditCategoryInline
                key={editingCategoryId}
                emoji={customizedCategories.find(c => c.category === editingCategoryId)?.emoji ?? "📦"}
                label={customizedCategories.find(c => c.category === editingCategoryId)?.label ?? ""}
                onSave={(emoji, label) => handleSaveCategoryEdit(editingCategoryId, emoji, label)}
                onCancel={() => setEditingCategoryId(null)}
                reducedMotion={prefersReducedMotion}
              />
            )}
          </AnimatePresence>

          <p
            style={{
              fontSize: typography.caption.fontSize,
              color: "var(--muted)",
              textAlign: "center",
              marginTop: 2,
              fontFamily: FONT_FAMILY,
            }}
            aria-live="polite"
          >
            Drag to reorder · Tap to rename
          </p>
        </div>
      ) : (
        /* ── Normal mode: category grid (task 252 — icon-centric pills) ── */
        <LayoutGroup>
          <div
            className="flex flex-wrap gap-2 justify-center"
            role="group"
            aria-label="Expense categories"
            onKeyDown={(e) => {
              const items = sortedCategories
              const currentIndex = selectedCategory
                ? items.findIndex(c => c.category === selectedCategory)
                : -1
              let nextIndex = -1
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault()
                nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault()
                nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
              } else if (e.key === "Home") {
                e.preventDefault()
                nextIndex = 0
              } else if (e.key === "End") {
                e.preventDefault()
                nextIndex = items.length - 1
              }
              if (nextIndex >= 0) {
                handleCategorySelect(items[nextIndex].category)
                // Focus the next button
                const container = e.currentTarget
                const buttons = container.querySelectorAll<HTMLButtonElement>('[role="group"] > button, button[aria-pressed]')
                buttons[nextIndex]?.focus()
              }
            }}
          >
            {sortedCategories.map((cat, index) => (
              <motion.div
                key={'customId' in cat && cat.customId ? `custom-${cat.customId}` : cat.category}
                layout={!prefersReducedMotion}
                transition={springs.snappy}
              >
                <CategoryButton
                  category={cat.category}
                  emoji={cat.emoji}
                  label={cat.label}
                  isCustom={'customId' in cat && !!cat.customId}
                  iconName={'icon' in cat && cat.icon ? (cat.icon as IconName) : undefined}
                  isSelected={selectedCategory === cat.category}
                  onSelect={() => handleCategorySelect(cat.category)}
                  reducedMotion={prefersReducedMotion}
                  tabIndex={
                    selectedCategory === cat.category ? 0
                      : selectedCategory === null && index === 0 ? 0
                      : -1
                  }
                />
              </motion.div>
            ))}
          </div>
        </LayoutGroup>
      )}

      {/* ── First-time user prompt (Requirement 14.4) ── */}
      {recentTransactions.length === 0 && !selectedCategory && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={timings.normal}
          style={{
            fontSize: typography['body-sm'].fontSize,
            color: "var(--muted)",
            textAlign: "center",
            padding: "4px 0",
            fontFamily: FONT_FAMILY,
          }}
        >
          Tap a category to see common amounts and log your first expense
        </motion.p>
      )}

      {/* ── Category budget insight (Task 341.1, Requirement 18.4) ── */}
      <AnimatePresence>
        {selectedCategory && categoryInsight && !dismissedCategoryInsight && (
          <motion.button
            key="category-insight"
            type="button"
            onClick={() => setDismissedCategoryInsight(true)}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={timings.fast}
            style={{
              display: "block",
              width: "100%",
              textAlign: "center",
              fontSize: typography['body-sm'].fontSize,
              fontFamily: FONT_FAMILY,
              color: "var(--muted)",
              background: "none",
              border: "none",
              padding: "6px 0",
              cursor: "pointer",
              lineHeight: 1.4,
            }}
            aria-label={`${categoryInsight}. Tap to dismiss.`}
            role="status"
          >
            {categoryInsight}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Suggestions & custom input area (Requirements 3.3, 3.4, 3.5, 3.6) ── */}
      <AnimatePresence mode="wait">
        {selectedCategory && !showCustomInput && suggestions.length > 0 && (
          <motion.div
            key={`suggestions-${selectedCategory}`}
            ref={suggestionsRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={timings.normal}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleSuggestionsPan}
            style={{ overflow: "hidden", touchAction: "none" }}
            aria-label={`Suggestions for ${categoryLabel(selectedCategory)}`}
          >
            {/* Label: "Common amounts" for presets, hidden for history-based (Requirement 14.4) */}
            {suggestions.every((s) => s.source === "preset") && (
              <p
                style={{
                  fontSize: typography['body-sm'].fontSize,
                  color: "var(--muted)",
                  fontWeight: fontWeights.medium,
                  marginBottom: 6,
                  fontFamily: FONT_FAMILY,
                }}
              >
                Common amounts
              </p>
            )}
            <motion.div
              className="flex gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: "none", paddingTop: 4 }}
              role="list"
              aria-label="Suggested amounts"
              variants={chipContainerVariants}
              initial="hidden"
              animate="visible"
            >
              {suggestions.slice(0, 4).map((s) => (
                <motion.div key={s.id} role="listitem" variants={chipItemVariants}>
                  <SuggestionChip
                    suggestion={s}
                    onTap={() => handleSuggestionTap(s)}
                    rippleActive={rippleChipId === s.id}
                    reducedMotion={prefersReducedMotion}
                    travelCurrency={travelCurrency}
                    travelConversionRate={travelConversionRate}
                  />
                </motion.div>
              ))}
            </motion.div>

            {/* Swipe hint — styled as a subtle animated pill */}
            <motion.p
              style={{
                fontSize: typography.caption.fontSize,
                color: "var(--muted)",
                textAlign: "center",
                marginTop: spacing.xs,
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.6, ...timings.slow }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 10px",
                  borderRadius: radius.full,
                  background: "var(--accent-50)",
                  border: "0.5px solid var(--accent-100)",
                }}
              >
                Swipe down for custom
                <motion.span
                  animate={{ y: [0, 2, 0] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                  style={{ display: "inline-block" }}
                >
                  ↓
                </motion.span>
              </span>
            </motion.p>
          </motion.div>
        )}

        {/* Empty state: category selected but no suggestions yet */}
        {selectedCategory && !showCustomInput && suggestions.length === 0 && (
          <motion.div
            key={`empty-${selectedCategory}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={timings.fast}
            style={{ textAlign: "center", padding: "8px 0" }}
          >
            <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)" }}>
              No suggestions yet — enter a custom amount.
            </p>
          </motion.div>
        )}

        {/* ── Custom amount panel (Requirement 3.5) — fluid slide-up ── */}
        {selectedCategory && showCustomInput && (
          <motion.div
            key={`custom-${selectedCategory}`}
            layout={!prefersReducedMotion}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={prefersReducedMotion ? timings.fast : springs.gentle}
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              padding: spacing.md,
              overflow: "hidden",
            }}
          >
            <CustomAmountPanel
              category={selectedCategory}
              onSubmit={handleCustomSubmit}
              onCancel={() => setShowCustomInput(false)}
              reducedMotion={prefersReducedMotion}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
