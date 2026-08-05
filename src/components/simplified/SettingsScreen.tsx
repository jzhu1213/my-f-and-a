"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { useTheme } from "@/contexts/ThemeContext"
import { BUDGET_CATEGORIES } from "@/types"
import type { Budget, Goal, TransactionCategory } from "@/types"
import type { IncomeSmoothing } from "@/types/folio"
import type { SpendingMode } from "@/lib/spendingModes"
import { SPENDING_MODE_LABELS, OVER_LIMIT_RESPONSE_LABELS, limitVisibilityNote } from "@/lib/spendingModes"
import type { OverLimitResponse } from "@/lib/spendingModes"
import type { HeroMeaning } from "@/types/folio"
import { computeBudgetSummary } from "@/lib/budgetSummary"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeadingStrong,
  linkButton,
  listRow,
  borderRadius,
  segmentedControl,
  segmentedButtonBase,
  segmentedButtonActive,
  segmentedButtonInactive,
  dangerZone,
} from "@/styles/shared"
import { MinBalanceBufferSetting } from "./MinBalanceBufferSetting"
import { NotificationCenter } from "./NotificationCenter"
import { AppLockSetting } from "./AppLockSetting"
import { getInsightsEnabled, setInsightsEnabled } from "@/lib/insightPreferences"
import { getSavingsRateBadgeEnabled, setSavingsRateBadgeEnabled } from "@/lib/savingsBadgePreferences"
import { getPeerContextEnabled, setPeerContextEnabled } from "@/lib/peerContextPreferences"
import { useFeatureFlags } from "@/hooks/useFeatureFlags"
import type { FeatureFlags } from "@/lib/featureFlags"
import type { CategorizationRule } from "@/lib/categorizationRules"
import { getCategoryEmoji } from "@/lib/vocabulary"
import type { TermSchedule } from "@/lib/termSchedule"
import { TERM_PRESETS, isTermActive, getDaysRemainingInTerm, getTermProgress } from "@/lib/termSchedule"
import { formatDateLocal, addDaysLocal } from "@/lib/dateUtils"
import type { UserGoal } from "@/types"
import { getGoalDescription } from "@/lib/goalDefaults"
import { SetupChecklistCard } from "./SetupChecklistCard"

// ============================================================================
// Types
// ============================================================================

export interface SettingsScreenProps {
  budgets: Budget[]
  goals: Goal[]
  userEmail?: string
  incomeSmoothing?: IncomeSmoothing | null
  spendingMode?: SpendingMode
  onSetSpendingMode?: (mode: SpendingMode) => void
  heroMeaning?: HeroMeaning
  onSetHeroMeaning?: (meaning: HeroMeaning) => void
  overLimitResponse?: OverLimitResponse
  onSetOverLimitResponse?: (response: OverLimitResponse) => void
  countCreditImmediately?: boolean
  onSetIncomeSmoothing?: (s: IncomeSmoothing) => void
  onUpdateCountCreditImmediately?: (value: boolean) => void
  onOpenBudgetSettings: () => void
  onOpenGoals: () => void
  onOpenTools?: () => void
  onOpenProfile: () => void
  onOpenFundingSources?: () => void
  onOpenLinkedAccounts?: () => void
  onOpenBackfill?: () => void
  onSignOut: () => void
  onResetOnboarding?: () => void
  /** Replay the interactive feature demos without resetting onboarding (task 224.2) */
  onReplayDemos?: () => void
  onExportData?: () => void
  onExportCSV?: () => void
  /** Callback to open the filtered Reports overlay (task 185.1) */
  onOpenReports?: () => void
  onDeleteAccount?: () => void
  /** User-defined categorization rules (task 113.3) */
  categorizationRules?: CategorizationRule[]
  /** Callback to add a new categorization rule (task 113.3) */
  onAddCategorizationRule?: (keyword: string, category: TransactionCategory) => void
  /** Callback to delete a categorization rule (task 113.3) */
  onDeleteCategorizationRule?: (id: string) => void
  /** Callback to open the Sharing overlay (task 115.1) */
  onOpenSharing?: () => void
  /** Callback to open the Category Hub overlay (task 138.1) */
  onOpenCategoryHub?: () => void
  /** Number of active share links (task 115.1) */
  activeShareCount?: number
  /** Current term schedule (task 121.1) */
  termSchedule?: TermSchedule | null
  /** Callback to set/clear the term schedule (task 121.1) */
  onSetTermSchedule?: (schedule: TermSchedule | null) => void
  /** Whether any budget has period === 'semester' (task 121.1) */
  hasTermBudget?: boolean
  /** Spend-down plans (task 122.1) */
  spendDownPlans?: import('@/lib/spendDown').SpendDownPlan[]
  /** Callback to add a new spend-down plan (task 122.1) */
  onAddSpendDownPlan?: (data: Omit<import('@/lib/spendDown').SpendDownPlan, 'id'>) => import('@/lib/spendDown').SpendDownPlan
  /** Callback to remove a spend-down plan (task 122.1) */
  onRemoveSpendDownPlan?: (id: string) => void
  /** Existing disbursements (for "from a disbursement" quick preset) */
  disbursements?: import('@/lib/disbursements').Disbursement[]
  /** User's primary financial goal — editable in settings (task 222.3) */
  userGoal?: import('@/types').UserGoal
  /** Callback to update the user's primary goal (task 222.3) */
  onGoalChange?: (goal: import('@/types').UserGoal) => void
  /** Skipped onboarding step IDs — used for the setup checklist mirror (task 223.2) */
  skippedSetupSteps?: string[]
  /** Called when the user resumes a specific setup step from Settings (task 223.2) */
  onResumeSetupStep?: (stepId: string) => void
}

// ============================================================================
// Theme options
// ============================================================================

type ThemeOption = { key: "warm" | "dark" | "system"; label: string }

const THEME_OPTIONS: ThemeOption[] = [
  { key: "warm", label: "Warm" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
]

// ============================================================================
// Income smoothing options
// ============================================================================

type IncomeOption = {
  key: 'current_month' | 'trailing_average'
  label: string
  desc: string
  value: IncomeSmoothing
}

const INCOME_OPTIONS: IncomeOption[] = [
  {
    key: 'current_month',
    label: 'Just this month',
    desc: 'Uses your income recorded this month',
    value: { strategy: 'current_month' },
  },
  {
    key: 'trailing_average',
    label: 'Average the last 3 months',
    desc: 'Steadier for gig income or irregular pay',
    value: { strategy: 'trailing_average', windowMonths: 3 },
  },
]

// ============================================================================
// Spending mode options
// ============================================================================

type SpendingModeOption = { key: SpendingMode; label: string }

const SPENDING_MODE_OPTIONS: SpendingModeOption[] = [
  { key: 'tracker', label: 'Just tracking' },
  { key: 'guided', label: 'Guided' },
  { key: 'structured', label: 'Structured' },
]

// ============================================================================
// Hero meaning options
// ============================================================================

type HeroMeaningOption = {
  key: HeroMeaning
  label: string
  desc: string
}

const HERO_MEANING_OPTIONS: HeroMeaningOption[] = [
  {
    key: 'allowance',
    label: 'Safe to spend today',
    desc: "How much is left in today\u2019s budget \u2014 the classic view",
  },
  {
    key: 'spent_today',
    label: 'Spent today',
    desc: "Total you\u2019ve logged so far today",
  },
  {
    key: 'spent_week',
    label: 'Spent this week',
    desc: 'Rolling 7-day spend total',
  },
  {
    key: 'balance',
    label: 'Money on hand',
    desc: 'All income logged minus all spending \u2014 your net balance',
  },
]

// ============================================================================
// Over-limit response options
// ============================================================================

type OverLimitResponseOption = {
  key: OverLimitResponse
  label: string
  desc: string
}

const OVER_LIMIT_RESPONSE_OPTIONS: OverLimitResponseOption[] = [
  {
    key: 'quiet',
    label: OVER_LIMIT_RESPONSE_LABELS.quiet.label,
    desc: OVER_LIMIT_RESPONSE_LABELS.quiet.description,
  },
  {
    key: 'gentle',
    label: OVER_LIMIT_RESPONSE_LABELS.gentle.label,
    desc: OVER_LIMIT_RESPONSE_LABELS.gentle.description,
  },
  {
    key: 'headsup',
    label: OVER_LIMIT_RESPONSE_LABELS.headsup.label,
    desc: OVER_LIMIT_RESPONSE_LABELS.headsup.description,
  },
]

// ============================================================================
// Goal options (task 222.3 — editable goal picker in settings)
// ============================================================================

type GoalOption = { key: UserGoal; label: string; emoji: string }

const GOAL_OPTIONS_SETTINGS: GoalOption[] = [
  { key: 'save', label: 'Build my savings', emoji: '🏦' },
  { key: 'track_spending', label: 'Know where my money goes', emoji: '🔍' },
  { key: 'reduce_spending', label: 'Spend less', emoji: '✂️' },
  { key: 'avoid_overdraft', label: 'Stop overdrafting', emoji: '🛡️' },
  { key: 'pay_debt', label: 'Pay off debt', emoji: '💳' },
  { key: 'learn_investing', label: 'Learn investing', emoji: '📈' },
]

// ============================================================================
// Section definition (for collapsible groups)
// ============================================================================

type SectionId =
  | 'spending-style'
  | 'hero-display'
  | 'budget-income'
  | 'payment-methods'
  | 'appearance'
  | 'notifications'
  | 'privacy-security'
  | 'data-account'

interface SectionDef {
  id: SectionId
  title: string
  /** Keywords used to match against search query */
  keywords: string[]
}

const SECTIONS: SectionDef[] = [
  {
    id: 'spending-style',
    title: 'Spending style',
    keywords: ['spending', 'mode', 'tracker', 'guided', 'structured', 'over-limit', 'over limit', 'limit', 'response', 'quiet', 'gentle', 'heads-up', 'goal', 'priority', 'focus'],
  },
  {
    id: 'hero-display',
    title: 'Hero & display',
    keywords: ['hero', 'big number', 'display', 'feature', 'visibility', 'show', 'hide', 'tools', 'toggle'],
  },
  {
    id: 'budget-income',
    title: 'Budget & income',
    keywords: ['budget', 'limits', 'income', 'category', 'categories', 'smoothing', 'term', 'academic', 'semester', 'spend-down', 'spend down', 'categorization', 'rules', 'smart'],
  },
  {
    id: 'payment-methods',
    title: 'Payment methods',
    keywords: ['payment', 'funding', 'sources', 'linked', 'accounts', 'bank', 'card', 'credit'],
  },
  {
    id: 'appearance',
    title: 'Appearance',
    keywords: ['appearance', 'theme', 'warm', 'dark', 'system', 'currency', 'insight', 'credit', 'tutorial', 'onboarding', 'backfill', 'preferences', 'peer', 'compare', 'typical', 'students', 'benchmark'],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    keywords: ['notification', 'notifications', 'nudge', 'buffer', 'balance', 'minimum', 'alert'],
  },
  {
    id: 'privacy-security',
    title: 'Privacy & security',
    keywords: ['privacy', 'security', 'lock', 'app lock', 'pin', 'biometric', 'biometrics', 'face id', 'touch id', 'passcode', 'protect'],
  },
  {
    id: 'data-account',
    title: 'Data & account',
    keywords: ['data', 'account', 'export', 'csv', 'sharing', 'share', 'sign out', 'logout', 'goals', 'profile'],
  },
]

// ============================================================================
// CollapsibleSection component
// ============================================================================

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title} section`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "14px 0",
          background: "none",
          border: "none",
          borderBottom: "1px solid var(--border)",
          cursor: "pointer",
          fontFamily: FONT_FAMILY,
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: "0.01em",
          }}
        >
          {title}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={springs.snappy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            color: "var(--sub)",
            fontSize: 14,
          }}
          aria-hidden="true"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.gentle}
            style={{ overflow: "hidden" }}
          >
            <div style={{ paddingTop: 16 }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// SettingsScreen Component
// ============================================================================

/**
 * SettingsScreen — consolidated settings surface accessible from the dock.
 * Shows collapsible sections with search filtering. Destructive actions
 * (delete account) are separated into a danger zone at the bottom.
 *
 * Validates: Requirements 12.1–12.6
 */
export function SettingsScreen({
  budgets,
  goals,
  userEmail,
  incomeSmoothing,
  spendingMode: spendingModeProp,
  onSetSpendingMode,
  heroMeaning: heroMeaningProp,
  onSetHeroMeaning,
  overLimitResponse: overLimitResponseProp,
  onSetOverLimitResponse,
  countCreditImmediately: countCreditImmediatelyProp,
  onSetIncomeSmoothing,
  onUpdateCountCreditImmediately,
  onOpenBudgetSettings,
  onOpenGoals,
  onOpenTools,
  onOpenProfile,
  onOpenFundingSources,
  onOpenLinkedAccounts,
  onOpenBackfill,
  onSignOut,
  onResetOnboarding,
  onReplayDemos,
  onExportData,
  onExportCSV,
  onOpenReports,
  onDeleteAccount,
  categorizationRules = [],
  onAddCategorizationRule,
  onDeleteCategorizationRule,
  onOpenSharing,
  onOpenCategoryHub,
  activeShareCount = 0,
  termSchedule,
  onSetTermSchedule,
  hasTermBudget = false,
  spendDownPlans = [],
  onAddSpendDownPlan,
  onRemoveSpendDownPlan,
  disbursements = [],
  userGoal,
  onGoalChange,
  skippedSetupSteps,
  onResumeSetupStep,
}: SettingsScreenProps) {
  const { theme, setTheme } = useTheme()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { flags, setFlag, resetFlags } = useFeatureFlags()
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [insightsEnabled, setInsightsEnabledState] = useState(() => getInsightsEnabled())
  const [savingsRateBadgeEnabled, setSavingsRateBadgeEnabledState] = useState(() => getSavingsRateBadgeEnabled())
  const [peerContextEnabled, setPeerContextEnabledState] = useState(() => getPeerContextEnabled())
  const [countCreditImmediately, setCountCreditImmediatelyState] = useState(countCreditImmediatelyProp ?? true)

  // ── Smart categorization rule form state (task 113.3) ─────────────────
  const [showAddRuleForm, setShowAddRuleForm] = useState(false)
  const [newRuleKeyword, setNewRuleKeyword] = useState("")
  const [newRuleCategory, setNewRuleCategory] = useState<TransactionCategory>("food")

  // ── Term schedule form state (task 121.1) ─────────────────────────────
  const [showTermSetup, setShowTermSetup] = useState(false)
  const [termStartDate, setTermStartDate] = useState("")
  const [termEndDate, setTermEndDate] = useState("")
  const [termLabel, setTermLabel] = useState("")

  // ── Spend-down plan form state (task 122.1) ────────────────────────────
  const [showSpendDownForm, setShowSpendDownForm] = useState(false)
  const [sdLabel, setSdLabel] = useState("")
  const [sdAmount, setSdAmount] = useState("")
  const [sdEndDate, setSdEndDate] = useState("")
  const [sdEmoji, setSdEmoji] = useState("💰")

  // ── Collapsible section state ──────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    'spending-style': true,
    'hero-display': false,
    'budget-income': false,
    'payment-methods': false,
    'appearance': false,
    'notifications': false,
    'privacy-security': false,
    'data-account': false,
  })

  // ── Search state ───────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchText.toLowerCase().trim())
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchText])

  const toggleSection = useCallback((id: SectionId) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Filter sections based on search
  const visibleSections = useMemo(() => {
    if (!debouncedSearch) return SECTIONS
    return SECTIONS.filter(s =>
      s.title.toLowerCase().includes(debouncedSearch) ||
      s.keywords.some(kw => kw.includes(debouncedSearch))
    )
  }, [debouncedSearch])

  const isSectionVisible = useCallback((id: SectionId) => {
    return visibleSections.some(s => s.id === id)
  }, [visibleSections])

  // When search is active, expand all matched sections
  const isSectionOpen = useCallback((id: SectionId) => {
    if (debouncedSearch) return true
    return openSections[id]
  }, [debouncedSearch, openSections])

  // Resolve active spending mode — default to 'guided' when not provided
  const spendingMode: SpendingMode = spendingModeProp ?? 'guided'
  // Tracker mode pauses (but never deletes) limit visibility (Task 106.1)
  const isTrackerMode = spendingMode === 'tracker'

  // Resolve active hero meaning — default to 'allowance' when not provided
  const heroMeaning: HeroMeaning = heroMeaningProp ?? 'allowance'

  // Resolve over-limit response — default to 'gentle' when not provided
  const overLimitResponse: OverLimitResponse = overLimitResponseProp ?? 'gentle'

  // ── Budget summary computations ────────────────────────────────────────────
  const { totalMonthly, dailyBudget } = computeBudgetSummary(budgets)

  // Active budgets with a limit set
  const activeLimits = BUDGET_CATEGORIES
    .map(cat => {
      const budget = budgets.find(b => b.category === cat.category)
      return { ...cat, limit: budget?.monthlyLimit ?? 0 }
    })
    .filter(c => c.limit > 0)

  // ── Goal summary ───────────────────────────────────────────────────────────
  const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount)

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM - 20}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ── Title ──────────────────────────────────────────────────────────── */}
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: 16,
        }}
      >
        Settings
      </h2>

      {/* ── Search field ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="search"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Search settings..."
          aria-label="Search settings"
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: 14,
            fontFamily: FONT_FAMILY,
            color: "var(--text)",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--border)",
            borderRadius: borderRadius.md,
            outline: "none",
          }}
        />
      </div>

      {/* ── No results message ─────────────────────────────────────────────── */}
      {debouncedSearch && visibleSections.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--sub)", textAlign: "center", padding: "20px 0" }}>
          No settings match &ldquo;{searchText.trim()}&rdquo;
        </p>
      )}

      {/* ── Setup Checklist Mirror (task 223.2) ────────────────────────────── */}
      {skippedSetupSteps && skippedSetupSteps.length > 0 && onResumeSetupStep && !debouncedSearch && (
        <div style={{ marginBottom: 20 }}>
          <SetupChecklistCard
            skippedSteps={skippedSetupSteps}
            onResumeStep={onResumeSetupStep}
            onDismiss={() => {/* Settings variant is non-dismissible — always visible */}}
            variant="settings"
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Spending style                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {isSectionVisible('spending-style') && (
        <CollapsibleSection
          title="Spending style"
          isOpen={isSectionOpen('spending-style')}
          onToggle={() => toggleSection('spending-style')}
        >
          {/* ── How do you want to manage spending? ────────────────────────── */}
          {onSetSpendingMode && (
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
              <p style={{ ...sectionHeadingStrong, marginBottom: 6 }}>
                How do you want to manage spending?
              </p>
              <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.5 }}>
                {SPENDING_MODE_LABELS[spendingMode].description}
              </p>

              <div style={segmentedControl}>
                {SPENDING_MODE_OPTIONS.map(opt => {
                  const isActive = spendingMode === opt.key
                  return (
                    <motion.button
                      key={opt.key}
                      onClick={() => onSetSpendingMode(opt.key)}
                      whileTap={{ scale: 0.97 }}
                      transition={springs.snappy}
                      style={{
                        ...segmentedButtonBase,
                        ...(isActive ? segmentedButtonActive : segmentedButtonInactive),
                      }}
                      aria-pressed={isActive}
                      aria-label={`Set spending mode to ${opt.label}`}
                    >
                      {opt.label}
                    </motion.button>
                  )
                })}
              </div>

              <p
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  lineHeight: 1.5,
                  marginTop: 12,
                }}
              >
                {limitVisibilityNote(spendingMode, activeLimits.length > 0)}
              </p>
            </GlassCard>
          )}

          {/* ── When you go over, what should happen? ──────────────────────── */}
          {onSetOverLimitResponse && spendingMode !== 'tracker' && (
            <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
              <p style={{ ...sectionHeadingStrong, marginBottom: 4 }}>
                When you go over, what should happen?
              </p>
              <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.5 }}>
                All options are calm and shame-free — the loudest is still just one quiet line.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {OVER_LIMIT_RESPONSE_OPTIONS.map((opt, idx) => {
                  const isActive = overLimitResponse === opt.key
                  return (
                    <motion.button
                      key={opt.key}
                      onClick={() => onSetOverLimitResponse(opt.key)}
                      whileTap={{ scale: 0.98 }}
                      transition={springs.snappy}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "12px 0",
                        background: "transparent",
                        border: "none",
                        borderBottom: idx < OVER_LIMIT_RESPONSE_OPTIONS.length - 1 ? "1px solid var(--border)" : "none",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                      }}
                      aria-pressed={isActive}
                      aria-label={`Over-limit response: ${opt.label}`}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          marginTop: 3,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: `2px solid ${isActive ? "rgba(167, 139, 250, 0.9)" : "rgba(255, 255, 255, 0.2)"}`,
                          background: isActive ? "rgba(167, 139, 250, 0.9)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "border-color 0.15s ease, background 0.15s ease",
                        }}
                        aria-hidden="true"
                      >
                        {isActive && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "#fff",
                            }}
                          />
                        )}
                      </span>

                      <span style={{ flex: 1 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? "var(--text)" : "var(--sub)",
                            lineHeight: 1.4,
                            transition: "color 0.15s ease, font-weight 0.15s ease",
                          }}
                        >
                          {opt.label}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            color: "var(--muted)",
                            lineHeight: 1.4,
                            marginTop: 2,
                          }}
                        >
                          {opt.desc}
                        </span>
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </GlassCard>
          )}

          {/* ── My goal (task 222.3) ────────────────────────────────────────── */}
          {onGoalChange && (
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginTop: 16 }}>
              <p style={{ ...sectionHeadingStrong, marginBottom: 4 }}>
                My focus
              </p>
              <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.5 }}>
                {userGoal
                  ? getGoalDescription(userGoal)
                  : "Pick what matters most — this shapes tips and priorities."}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {GOAL_OPTIONS_SETTINGS.map((opt, idx) => {
                  const isActive = userGoal === opt.key
                  return (
                    <motion.button
                      key={opt.key}
                      onClick={() => onGoalChange(opt.key)}
                      whileTap={{ scale: 0.98 }}
                      transition={springs.snappy}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "11px 0",
                        background: "transparent",
                        border: "none",
                        borderBottom: idx < GOAL_OPTIONS_SETTINGS.length - 1 ? "1px solid var(--border)" : "none",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                      }}
                      aria-pressed={isActive}
                      aria-label={`Set goal to ${opt.label}`}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: `2px solid ${isActive ? "rgba(167, 139, 250, 0.9)" : "rgba(255, 255, 255, 0.2)"}`,
                          background: isActive ? "rgba(167, 139, 250, 0.9)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "border-color 0.15s ease, background 0.15s ease",
                        }}
                        aria-hidden="true"
                      >
                        {isActive && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "#fff",
                            }}
                          />
                        )}
                      </span>

                      <span style={{ fontSize: 16, flexShrink: 0 }} aria-hidden="true">
                        {opt.emoji}
                      </span>

                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? "var(--text)" : "var(--sub)",
                          lineHeight: 1.4,
                          transition: "color 0.15s ease, font-weight 0.15s ease",
                        }}
                      >
                        {opt.label}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </GlassCard>
          )}
        </CollapsibleSection>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Hero & display                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {isSectionVisible('hero-display') && (
        <CollapsibleSection
          title="Hero & display"
          isOpen={isSectionOpen('hero-display')}
          onToggle={() => toggleSection('hero-display')}
        >
          {/* ── What does the big number show? ─────────────────────────────── */}
          {onSetHeroMeaning && (
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
              <p style={{ ...sectionHeadingStrong, marginBottom: 4 }}>
                What does the big number show?
              </p>
              <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.5 }}>
                Pick the metric that makes most sense for how you use Folio.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {HERO_MEANING_OPTIONS.map((opt, idx) => {
                  const isActive = heroMeaning === opt.key
                  return (
                    <motion.button
                      key={opt.key}
                      onClick={() => onSetHeroMeaning(opt.key)}
                      whileTap={{ scale: 0.98 }}
                      transition={springs.snappy}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "12px 0",
                        background: "transparent",
                        border: "none",
                        borderBottom: idx < HERO_MEANING_OPTIONS.length - 1 ? "1px solid var(--border)" : "none",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                      }}
                      aria-pressed={isActive}
                      aria-label={`Show ${opt.label} as the main hero number`}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          marginTop: 3,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: `2px solid ${isActive ? "rgba(167, 139, 250, 0.9)" : "rgba(255, 255, 255, 0.2)"}`,
                          background: isActive ? "rgba(167, 139, 250, 0.9)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "border-color 0.15s ease, background 0.15s ease",
                        }}
                        aria-hidden="true"
                      >
                        {isActive && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "#fff",
                            }}
                          />
                        )}
                      </span>

                      <span style={{ flex: 1 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? "var(--text)" : "var(--sub)",
                            lineHeight: 1.4,
                            transition: "color 0.15s ease, font-weight 0.15s ease",
                          }}
                        >
                          {opt.label}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            color: "var(--muted)",
                            lineHeight: 1.4,
                            marginTop: 2,
                          }}
                        >
                          {opt.desc}
                        </span>
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </GlassCard>
          )}

          {/* ── Feature Visibility ──────────────────────────────────────── */}
          <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
            <p style={{ ...sectionHeadingStrong, marginBottom: 6 }}>
              Feature Visibility
            </p>
            <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.5 }}>
              Hide tools you don&apos;t use to keep your Tools tab clean.
            </p>

            {(
              [
                { key: "debtTracking" as keyof FeatureFlags, emoji: "💳", label: "Debt Tracking" },
                { key: "recurringBills" as keyof FeatureFlags, emoji: "📅", label: "Recurring Bills" },
                { key: "reimbursements" as keyof FeatureFlags, emoji: "🤝", label: "IOUs & Reimbursements" },
                { key: "sinkingFunds" as keyof FeatureFlags, emoji: "🎯", label: "Sinking Funds" },
                { key: "subscriptionAudit" as keyof FeatureFlags, emoji: "🔄", label: "Subscription Audit" },
                { key: "savingsProjections" as keyof FeatureFlags, emoji: "🏦", label: "Savings Projections" },
                { key: "compoundGrowthCalculator" as keyof FeatureFlags, emoji: "📈", label: "Compound Growth" },
                { key: "creditPayoffCalculator" as keyof FeatureFlags, emoji: "💰", label: "Credit Payoff" },
                { key: "lessons" as keyof FeatureFlags, emoji: "📚", label: "Learn" },
                { key: "goals" as keyof FeatureFlags, emoji: "🎯", label: "Goals" },
                { key: "financialTrajectory" as keyof FeatureFlags, emoji: "📊", label: "Financial Trajectory" },
              ] as const
            ).map((item, idx, arr) => (
              <div
                key={item.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: idx < arr.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <span style={{ fontSize: 14, color: "var(--text)" }}>
                  <span aria-hidden="true">{item.emoji}</span>{" "}
                  {item.label}
                </span>
                <motion.button
                  type="button"
                  role="switch"
                  aria-checked={flags[item.key]}
                  aria-label={`Toggle ${item.label}`}
                  onClick={() => setFlag(item.key, !flags[item.key])}
                  whileTap={{ scale: 0.92 }}
                  transition={springs.snappy}
                  style={{
                    flexShrink: 0,
                    width: 44,
                    height: 26,
                    borderRadius: 13,
                    border: "none",
                    cursor: "pointer",
                    background: flags[item.key]
                      ? "rgba(167, 139, 250, 0.6)"
                      : "rgba(255, 255, 255, 0.1)",
                    position: "relative",
                    transition: "background 0.2s ease",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      left: flags[item.key] ? 21 : 3,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: flags[item.key] ? "#fff" : "rgba(255,255,255,0.4)",
                      transition: "left 0.2s ease, background 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </motion.button>
              </div>
            ))}

            <motion.button
              onClick={resetFlags}
              whileTap={{ scale: 0.97 }}
              transition={springs.snappy}
              style={{
                ...linkButton,
                marginTop: 14,
              }}
              aria-label="Reset feature visibility to defaults"
            >
              Reset to defaults →
            </motion.button>
          </GlassCard>

          {/* ── Home screen extras (task 159.2) ─────────────────────────── */}
          <GlassCard elevation="low" style={{ padding: "18px 20px", marginTop: 16 }}>
            <p style={{ ...sectionHeadingStrong, marginBottom: 6 }}>
              Home screen extras
            </p>
            <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 8, lineHeight: 1.5 }}>
              Small optional touches below your daily allowance. Off by default
              to keep the home screen calm.
            </p>

            {/* Savings-rate badge toggle */}
            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 0",
              }}
            >
              <div style={{ flex: 1, marginRight: 12 }}>
                <span style={{ fontSize: 14, color: "var(--text)", display: "block" }}>
                  Show savings-rate badge
                </span>
                <span style={{ fontSize: 12, color: "var(--sub)", lineHeight: 1.4, marginTop: 2, display: "block" }}>
                  A gentle reminder of how much of your income you&apos;re saving this month
                </span>
              </div>
              <motion.button
                type="button"
                role="switch"
                aria-checked={savingsRateBadgeEnabled}
                aria-label="Show savings-rate badge on home screen"
                onClick={() => {
                  const next = !savingsRateBadgeEnabled
                  setSavingsRateBadgeEnabledState(next)
                  setSavingsRateBadgeEnabled(next)
                }}
                whileTap={{ scale: 0.92 }}
                transition={springs.snappy}
                style={{
                  flexShrink: 0, width: 44, height: 26, borderRadius: 13,
                  border: "none", cursor: "pointer",
                  background: savingsRateBadgeEnabled ? "rgba(167, 139, 250, 0.6)" : "rgba(255, 255, 255, 0.1)",
                  position: "relative", transition: "background 0.2s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute", top: 3,
                    left: savingsRateBadgeEnabled ? 21 : 3,
                    width: 20, height: 20, borderRadius: "50%",
                    background: savingsRateBadgeEnabled ? "#fff" : "rgba(255,255,255,0.4)",
                    transition: "left 0.2s ease, background 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </motion.button>
            </div>
          </GlassCard>
        </CollapsibleSection>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Budget & income                                            */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {isSectionVisible('budget-income') && (
        <CollapsibleSection
          title="Budget & income"
          isOpen={isSectionOpen('budget-income')}
          onToggle={() => toggleSection('budget-income')}
        >
          {/* ── Budget Limits ──────────────────────────────────────────────── */}
          <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
            <p style={{ ...sectionHeadingStrong }}>
              Budget Limits
            </p>

            {isTrackerMode ? (
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14, marginTop: 6, lineHeight: 1.5 }}>
                {activeLimits.length > 0
                  ? `You're in tracking mode, so limits are paused. Your ${activeLimits.length} saved ${activeLimits.length === 1 ? "limit is" : "limits are"} safe — switch to Guided or Structured to bring them back.`
                  : "You're in tracking mode — Folio just reflects what you spend. Add limits anytime by switching to Guided or Structured."}
              </p>
            ) : (
              <>
                <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
                      ${totalMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      <span style={{ fontSize: 13, fontWeight: 400, color: "var(--sub)", marginLeft: 3 }}>/mo</span>
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <p style={{ fontSize: 14, color: "var(--sub)" }}>
                      ≈ ${dailyBudget.toFixed(0)}/day
                    </p>
                  </div>
                </div>

                {activeLimits.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    {activeLimits.map(cat => (
                      <div key={cat.category} style={listRow}>
                        <span>{cat.emoji} {cat.label}</span>
                        <span style={{ color: "var(--sub)", fontVariantNumeric: "tabular-nums" }}>
                          ${cat.limit}/mo
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {activeLimits.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                    No limits yet — Folio works fine without them, or add some anytime.
                  </p>
                )}
              </>
            )}

            <motion.button
              onClick={onOpenBudgetSettings}
              whileTap={{ scale: 0.97 }}
              transition={springs.snappy}
              style={linkButton}
              aria-label={isTrackerMode ? "View saved budget limits" : "Manage budget limits"}
            >
              {isTrackerMode ? "View saved limits →" : "Manage limits →"}
            </motion.button>
          </GlassCard>

          {/* ── Category Hub (task 138.1) ─────────────────────────────────── */}
          {onOpenCategoryHub && (
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
              <p style={{ ...sectionHeadingStrong }}>Categories</p>
              <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.5 }}>
                Add, rename, reorder, or archive your spending categories.
              </p>
              <motion.button
                onClick={onOpenCategoryHub}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={linkButton}
                aria-label="Manage categories"
              >
                Manage categories →
              </motion.button>
            </GlassCard>
          )}

          {/* ── Income Calculation ────────────────────────────────────────── */}
          {onSetIncomeSmoothing && (
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
              <p style={{ ...sectionHeadingStrong, marginBottom: 6 }}>Income</p>
              <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.5 }}>
                How should your daily budget be calculated when income varies?
              </p>

              <div style={segmentedControl}>
                {INCOME_OPTIONS.map(opt => {
                  const isActive = (incomeSmoothing?.strategy ?? 'current_month') === opt.key
                  return (
                    <motion.button
                      key={opt.key}
                      onClick={() => onSetIncomeSmoothing(opt.value)}
                      whileTap={{ scale: 0.97 }}
                      transition={springs.snappy}
                      style={{
                        ...segmentedButtonBase,
                        ...(isActive ? segmentedButtonActive : segmentedButtonInactive),
                        padding: "10px 8px",
                        fontSize: 12,
                        lineHeight: 1.3,
                      }}
                      aria-pressed={isActive}
                      aria-label={opt.label}
                      title={opt.desc}
                    >
                      {opt.label}
                    </motion.button>
                  )
                })}
              </div>
            </GlassCard>
          )}

          {/* ── Academic Term (task 121.1) ─────────────────────────────────── */}
          {onSetTermSchedule && (hasTermBudget || termSchedule) && (
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
              <p style={{ ...sectionHeadingStrong, marginBottom: 6 }}>📚 Academic Term</p>

              {termSchedule && isTermActive(termSchedule, new Date()) ? (
                <>
                  <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 10, lineHeight: 1.5 }}>
                    {termSchedule.label || "Current term"} — {getDaysRemainingInTerm(termSchedule, new Date())} days left
                  </p>
                  <div style={{
                    height: 6, borderRadius: 3,
                    background: "rgba(255,255,255,0.08)",
                    marginBottom: 14, overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${Math.round(getTermProgress(termSchedule, new Date()) * 100)}%`,
                      background: "var(--accent, #818cf8)",
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                  <motion.button
                    onClick={() => onSetTermSchedule(null)}
                    whileTap={{ scale: 0.97 }}
                    transition={springs.snappy}
                    style={{ ...linkButton, color: "var(--error, #f87171)" }}
                    aria-label="Clear term schedule"
                  >
                    Clear term
                  </motion.button>
                </>
              ) : termSchedule && !isTermActive(termSchedule, new Date()) ? (
                <>
                  <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 10, lineHeight: 1.5 }}>
                    Your term has ended. Set up a new one to keep your budget on track.
                  </p>
                  <motion.button
                    onClick={() => { setShowTermSetup(true); setTermStartDate(""); setTermEndDate(""); setTermLabel(""); }}
                    whileTap={{ scale: 0.97 }}
                    transition={springs.snappy}
                    style={linkButton}
                    aria-label="Set up a new term"
                  >
                    Set up a new term →
                  </motion.button>
                </>
              ) : !showTermSetup ? (
                <>
                  <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 10, lineHeight: 1.5 }}>
                    Set a semester or term window so your budgets pace correctly.
                  </p>
                  <motion.button
                    onClick={() => setShowTermSetup(true)}
                    whileTap={{ scale: 0.97 }}
                    transition={springs.snappy}
                    style={linkButton}
                    aria-label="Set up a term"
                  >
                    Set up a term →
                  </motion.button>
                </>
              ) : (
                <>
                  {/* Quick presets */}
                  <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 8 }}>Quick start:</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {TERM_PRESETS.map(preset => (
                      <motion.button
                        key={preset.label}
                        onClick={() => {
                          const start = new Date()
                          const end = addDaysLocal(start, preset.durationWeeks * 7 - 1)
                          setTermStartDate(formatDateLocal(start))
                          setTermEndDate(formatDateLocal(end))
                          setTermLabel(preset.label)
                        }}
                        whileTap={{ scale: 0.95 }}
                        transition={springs.snappy}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "var(--text)",
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: FONT_FAMILY,
                        }}
                        aria-label={`Use ${preset.label} preset`}
                      >
                        {preset.emoji} {preset.label}
                      </motion.button>
                    ))}
                  </div>

                  {/* Date inputs */}
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "var(--sub)", display: "block", marginBottom: 4 }}>Start date</label>
                      <input
                        type="date"
                        value={termStartDate}
                        onChange={e => setTermStartDate(e.target.value)}
                        style={{
                          width: "100%", padding: "8px 10px", borderRadius: 8,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "var(--text)", fontSize: 13, fontFamily: FONT_FAMILY,
                        }}
                        aria-label="Term start date"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "var(--sub)", display: "block", marginBottom: 4 }}>End date</label>
                      <input
                        type="date"
                        value={termEndDate}
                        onChange={e => setTermEndDate(e.target.value)}
                        style={{
                          width: "100%", padding: "8px 10px", borderRadius: 8,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "var(--text)", fontSize: 13, fontFamily: FONT_FAMILY,
                        }}
                        aria-label="Term end date"
                      />
                    </div>
                  </div>

                  {/* Optional label */}
                  <input
                    type="text"
                    value={termLabel}
                    onChange={e => setTermLabel(e.target.value)}
                    placeholder="Label (optional, e.g. Fall 2025)"
                    maxLength={30}
                    style={{
                      width: "100%", padding: "8px 10px", borderRadius: 8,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "var(--text)", fontSize: 13, fontFamily: FONT_FAMILY,
                      marginBottom: 14,
                    }}
                    aria-label="Term label"
                  />

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <motion.button
                      onClick={() => {
                        if (termStartDate && termEndDate && termStartDate < termEndDate) {
                          onSetTermSchedule({
                            startDate: termStartDate,
                            endDate: termEndDate,
                            label: termLabel || undefined,
                          })
                          setShowTermSetup(false)
                        }
                      }}
                      disabled={!termStartDate || !termEndDate || termStartDate >= termEndDate}
                      whileTap={{ scale: 0.97 }}
                      transition={springs.snappy}
                      style={{
                        ...linkButton,
                        opacity: (!termStartDate || !termEndDate || termStartDate >= termEndDate) ? 0.4 : 1,
                      }}
                      aria-label="Save term schedule"
                    >
                      Save
                    </motion.button>
                    <motion.button
                      onClick={() => setShowTermSetup(false)}
                      whileTap={{ scale: 0.97 }}
                      transition={springs.snappy}
                      style={{ ...linkButton, color: "var(--sub)" }}
                      aria-label="Cancel term setup"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </>
              )}
            </GlassCard>
          )}

          {/* ── Spend-Down Plans (task 122.1) ─────────────────────────────── */}
          {onAddSpendDownPlan && (
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
              <p style={{ ...sectionHeadingStrong, marginBottom: 6 }}>💰 Spend-Down Plans</p>
              <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 12, lineHeight: 1.5 }}>
                Got a lump sum? Set a target date and we'll show you a safe daily amount.
              </p>

              {spendDownPlans.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {spendDownPlans.map(plan => {
                    const now = new Date()
                    const todayStr = now.toISOString().slice(0, 10)
                    const isActive = todayStr >= plan.startDate && todayStr <= plan.endDate
                    const isExpired = todayStr > plan.endDate
                    return (
                      <div
                        key={plan.id}
                        style={{
                          display: "flex", alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 0",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 14, color: "var(--text)" }}>
                            {plan.emoji} {plan.label}
                          </span>
                          <br />
                          <span style={{ fontSize: 12, color: "var(--sub)" }}>
                            ${plan.totalAmount.toLocaleString()} until {plan.endDate}
                            {isActive && " • Active"}
                            {isExpired && " • Ended"}
                          </span>
                        </div>
                        {onRemoveSpendDownPlan && (
                          <motion.button
                            onClick={() => onRemoveSpendDownPlan(plan.id)}
                            whileTap={{ scale: 0.95 }}
                            transition={springs.snappy}
                            style={{
                              background: "none", border: "none",
                              color: "var(--error, #f87171)",
                              fontSize: 12, cursor: "pointer", padding: "4px 8px",
                            }}
                            aria-label={`Remove ${plan.label} plan`}
                          >
                            Remove
                          </motion.button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {showSpendDownForm ? (
                <div style={{ marginTop: 8 }}>
                  {disbursements.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 6 }}>
                        Quick fill from a disbursement:
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {disbursements.slice(0, 3).map(d => (
                          <motion.button
                            key={d.id}
                            onClick={() => {
                              setSdLabel(d.label)
                              setSdAmount(String(d.amount))
                              setSdEmoji(d.emoji)
                              const parts = d.startDate.split('-').map(Number)
                              if (parts.length === 3) {
                                const end = new Date(parts[0], parts[1] - 1 + d.coverMonths, parts[2])
                                setSdEndDate(end.toISOString().slice(0, 10))
                              }
                            }}
                            whileTap={{ scale: 0.95 }}
                            transition={springs.snappy}
                            style={{
                              background: "rgba(129, 140, 248, 0.1)",
                              border: "1px solid rgba(129, 140, 248, 0.2)",
                              borderRadius: 8, padding: "4px 10px",
                              fontSize: 12, color: "var(--accent, #818cf8)", cursor: "pointer",
                            }}
                          >
                            {d.emoji} {d.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>Label</label>
                  <input
                    type="text" value={sdLabel}
                    onChange={e => setSdLabel(e.target.value)}
                    placeholder="e.g. Fall Aid Refund"
                    style={{
                      width: "100%", padding: "8px 12px", fontSize: 14,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, color: "var(--text)", marginBottom: 10, outline: "none",
                    }}
                  />

                  <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>Total Amount ($)</label>
                  <input
                    type="number" value={sdAmount}
                    onChange={e => setSdAmount(e.target.value)}
                    placeholder="3000" min="1"
                    style={{
                      width: "100%", padding: "8px 12px", fontSize: 14,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, color: "var(--text)", marginBottom: 10, outline: "none",
                    }}
                  />

                  <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>Make it last until</label>
                  <input
                    type="date" value={sdEndDate}
                    onChange={e => setSdEndDate(e.target.value)}
                    style={{
                      width: "100%", padding: "8px 12px", fontSize: 14,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, color: "var(--text)", marginBottom: 10, outline: "none",
                    }}
                  />

                  <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>Emoji</label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {["💰", "🎓", "🏅", "📦", "🎉"].map(e => (
                      <motion.button
                        key={e}
                        onClick={() => setSdEmoji(e)}
                        whileTap={{ scale: 0.9 }}
                        style={{
                          background: sdEmoji === e ? "rgba(129, 140, 248, 0.2)" : "rgba(255,255,255,0.05)",
                          border: sdEmoji === e ? "1px solid rgba(129, 140, 248, 0.4)" : "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8, padding: "6px 10px", fontSize: 16, cursor: "pointer",
                        }}
                      >
                        {e}
                      </motion.button>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <motion.button
                      onClick={() => {
                        const amount = parseFloat(sdAmount)
                        const today = new Date().toISOString().slice(0, 10)
                        if (sdLabel && amount > 0 && sdEndDate && sdEndDate > today) {
                          onAddSpendDownPlan({
                            label: sdLabel, totalAmount: amount,
                            startDate: today, endDate: sdEndDate, emoji: sdEmoji,
                          })
                          setSdLabel(""); setSdAmount(""); setSdEndDate(""); setSdEmoji("💰")
                          setShowSpendDownForm(false)
                        }
                      }}
                      disabled={!sdLabel || !sdAmount || parseFloat(sdAmount) <= 0 || !sdEndDate}
                      whileTap={{ scale: 0.97 }}
                      transition={springs.snappy}
                      style={{
                        ...linkButton,
                        opacity: (!sdLabel || !sdAmount || parseFloat(sdAmount) <= 0 || !sdEndDate) ? 0.4 : 1,
                      }}
                      aria-label="Save spend-down plan"
                    >
                      Save Plan
                    </motion.button>
                    <motion.button
                      onClick={() => setShowSpendDownForm(false)}
                      whileTap={{ scale: 0.97 }}
                      transition={springs.snappy}
                      style={{ ...linkButton, color: "var(--sub)" }}
                      aria-label="Cancel spend-down plan setup"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              ) : (
                <motion.button
                  onClick={() => setShowSpendDownForm(true)}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={linkButton}
                  aria-label="Add a spend-down plan"
                >
                  + Add plan
                </motion.button>
              )}
            </GlassCard>
          )}

          {/* ── Smart Categorization (task 113.3) ───────────────────── */}
          {onAddCategorizationRule && onDeleteCategorizationRule && (
            <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
              <p style={{ ...sectionHeadingStrong, marginBottom: 6 }}>Smart Categorization</p>
              <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.5 }}>
                Custom rules that always categorize certain notes for you.
              </p>

              {categorizationRules.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  {categorizationRules.map((rule) => (
                    <div
                      key={rule.id}
                      style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", padding: "8px 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <span style={{ fontSize: 13, color: "var(--text)", flex: 1 }}>
                        &ldquo;{rule.keyword}&rdquo; → {getCategoryEmoji(rule.category)} {rule.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteCategorizationRule(rule.id)}
                        aria-label={`Delete rule for "${rule.keyword}"`}
                        style={{
                          background: "transparent", border: "none",
                          padding: "4px 8px", fontSize: 14,
                          color: "var(--muted)", cursor: "pointer", flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {categorizationRules.length === 0 && !showAddRuleForm && (
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                  No rules yet — add one, or Folio will suggest creating them when you override a category.
                </p>
              )}

              {showAddRuleForm ? (
                <div
                  style={{
                    padding: "12px 14px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: borderRadius.md,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ marginBottom: 10 }}>
                    <label
                      htmlFor="rule-keyword-input"
                      style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}
                    >
                      When note contains
                    </label>
                    <input
                      id="rule-keyword-input"
                      type="text"
                      placeholder="e.g. starbucks"
                      value={newRuleKeyword}
                      onChange={(e) => setNewRuleKeyword(e.target.value.slice(0, 40))}
                      maxLength={40}
                      style={{
                        width: "100%", background: "transparent", border: "none",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
                        outline: "none", fontSize: 14, fontFamily: FONT_FAMILY,
                        color: "var(--text)", padding: "6px 0",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 6 }}>
                      Categorize as
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {BUDGET_CATEGORIES.map((cat) => {
                        const isSelected = newRuleCategory === cat.category
                        return (
                          <button
                            key={cat.category}
                            type="button"
                            onClick={() => setNewRuleCategory(cat.category)}
                            aria-label={`Categorize as ${cat.label}`}
                            aria-pressed={isSelected}
                            style={{
                              padding: "6px 12px",
                              borderRadius: borderRadius.full,
                              border: isSelected
                                ? "1.5px solid rgba(129, 140, 248, 0.6)"
                                : "1px solid rgba(255, 255, 255, 0.1)",
                              background: isSelected ? "rgba(129, 140, 248, 0.1)" : "transparent",
                              color: isSelected ? "var(--text)" : "var(--sub)",
                              fontSize: 12, fontFamily: FONT_FAMILY, fontWeight: 500, cursor: "pointer",
                            }}
                          >
                            {cat.emoji} {cat.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <motion.button
                      type="button"
                      onClick={() => {
                        if (newRuleKeyword.trim()) {
                          onAddCategorizationRule(newRuleKeyword.trim(), newRuleCategory)
                          setNewRuleKeyword("")
                          setShowAddRuleForm(false)
                        }
                      }}
                      disabled={!newRuleKeyword.trim()}
                      whileTap={{ scale: 0.97 }}
                      transition={springs.snappy}
                      style={{
                        padding: "8px 16px", borderRadius: borderRadius.full,
                        background: newRuleKeyword.trim() ? "rgba(129, 140, 248, 0.8)" : "rgba(255, 255, 255, 0.08)",
                        border: "none",
                        color: newRuleKeyword.trim() ? "#fff" : "var(--muted)",
                        fontSize: 13, fontFamily: FONT_FAMILY, fontWeight: 600,
                        cursor: newRuleKeyword.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      Save rule
                    </motion.button>
                    <button
                      type="button"
                      onClick={() => { setShowAddRuleForm(false); setNewRuleKeyword("") }}
                      style={{
                        padding: "8px 12px", borderRadius: borderRadius.full,
                        background: "transparent", border: "none",
                        color: "var(--muted)", fontSize: 13, fontFamily: FONT_FAMILY, cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <motion.button
                  onClick={() => setShowAddRuleForm(true)}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={linkButton}
                  aria-label="Add a categorization rule"
                >
                  + Add rule →
                </motion.button>
              )}
            </GlassCard>
          )}
        </CollapsibleSection>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Payment methods                                            */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {isSectionVisible('payment-methods') && (onOpenFundingSources || onOpenLinkedAccounts) && (
        <CollapsibleSection
          title="Payment methods"
          isOpen={isSectionOpen('payment-methods')}
          onToggle={() => toggleSection('payment-methods')}
        >
          <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
            {onOpenFundingSources && (
              <motion.button
                onClick={onOpenFundingSources}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={{ ...linkButton, marginBottom: 12, display: "block" }}
                aria-label="Manage payment methods"
              >
                💳 Payment Methods →
              </motion.button>
            )}

            {onOpenLinkedAccounts && (
              <motion.button
                onClick={onOpenLinkedAccounts}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={{ ...linkButton, display: "block" }}
                aria-label="Manage linked accounts (optional)"
              >
                🔗 Linked Accounts (optional) →
              </motion.button>
            )}
          </GlassCard>
        </CollapsibleSection>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Appearance                                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {isSectionVisible('appearance') && (
        <CollapsibleSection
          title="Appearance"
          isOpen={isSectionOpen('appearance')}
          onToggle={() => toggleSection('appearance')}
        >
          {/* Theme toggle */}
          <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
            <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>Theme</p>
            <div style={segmentedControl}>
              {THEME_OPTIONS.map(opt => {
                const isActive = theme === opt.key
                return (
                  <motion.button
                    key={opt.key}
                    onClick={() => setTheme(opt.key)}
                    whileTap={{ scale: 0.97 }}
                    transition={springs.snappy}
                    style={{
                      ...segmentedButtonBase,
                      ...(isActive ? segmentedButtonActive : segmentedButtonInactive),
                    }}
                    aria-pressed={isActive}
                    aria-label={`Set theme to ${opt.label}`}
                  >
                    {opt.label}
                  </motion.button>
                )
              })}
            </div>
          </GlassCard>

          {/* Preferences */}
          <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
            <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>Preferences</p>

            {/* Currency Display */}
            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: 14, color: "var(--text)" }}>Currency</span>
              <span style={{ fontSize: 14, color: "var(--sub)" }}>USD ($)</span>
            </div>

            {/* Show daily insights toggle */}
            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 0", borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ flex: 1, marginRight: 12 }}>
                <span style={{ fontSize: 14, color: "var(--text)", display: "block" }}>
                  Show daily insight
                </span>
                <span style={{ fontSize: 12, color: "var(--sub)", lineHeight: 1.4, marginTop: 2, display: "block" }}>
                  A brief, rotating tip or celebration on your home screen
                </span>
              </div>
              <motion.button
                type="button"
                role="switch"
                aria-checked={insightsEnabled}
                aria-label="Show daily insight on home screen"
                onClick={() => {
                  const next = !insightsEnabled
                  setInsightsEnabledState(next)
                  setInsightsEnabled(next)
                }}
                whileTap={{ scale: 0.92 }}
                transition={springs.snappy}
                style={{
                  flexShrink: 0, width: 44, height: 26, borderRadius: 13,
                  border: "none", cursor: "pointer",
                  background: insightsEnabled ? "rgba(167, 139, 250, 0.6)" : "rgba(255, 255, 255, 0.1)",
                  position: "relative", transition: "background 0.2s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute", top: 3,
                    left: insightsEnabled ? 21 : 3,
                    width: 20, height: 20, borderRadius: "50%",
                    background: insightsEnabled ? "#fff" : "rgba(255,255,255,0.4)",
                    transition: "left 0.2s ease, background 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </motion.button>
            </div>

            {/* Encouraging peer context toggle (task 186.1) — opt-in, OFF by default */}
            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 0", borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ flex: 1, marginRight: 12 }}>
                <span style={{ fontSize: 14, color: "var(--text)", display: "block" }}>
                  Show &ldquo;typical for a student&rdquo; context
                </span>
                <span style={{ fontSize: 12, color: "var(--sub)", lineHeight: 1.4, marginTop: 2, display: "block" }}>
                  Optional, anonymized, encouraging ranges in Tools — never a ranking or a scoreboard
                </span>
              </div>
              <motion.button
                type="button"
                role="switch"
                aria-checked={peerContextEnabled}
                aria-label="Show typical-for-a-student context in Tools"
                onClick={() => {
                  const next = !peerContextEnabled
                  setPeerContextEnabledState(next)
                  setPeerContextEnabled(next)
                }}
                whileTap={{ scale: 0.92 }}
                transition={springs.snappy}
                style={{
                  flexShrink: 0, width: 44, height: 26, borderRadius: 13,
                  border: "none", cursor: "pointer",
                  background: peerContextEnabled ? "rgba(167, 139, 250, 0.6)" : "rgba(255, 255, 255, 0.1)",
                  position: "relative", transition: "background 0.2s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute", top: 3,
                    left: peerContextEnabled ? 21 : 3,
                    width: 20, height: 20, borderRadius: "50%",
                    background: peerContextEnabled ? "#fff" : "rgba(255,255,255,0.4)",
                    transition: "left 0.2s ease, background 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </motion.button>
            </div>

            {/* Count credit-card spending against today toggle */}
            {onUpdateCountCreditImmediately && (
              <div
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 0", borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ flex: 1, marginRight: 12 }}>
                  <span style={{ fontSize: 14, color: "var(--text)", display: "block" }}>
                    Count credit-card spending against today?
                  </span>
                  <span style={{ fontSize: 12, color: "var(--sub)", lineHeight: 1.4, marginTop: 2, display: "block" }}>
                    When off, credit purchases won&apos;t reduce your daily allowance until you pay the bill
                  </span>
                </div>
                <motion.button
                  type="button"
                  role="switch"
                  aria-checked={countCreditImmediately}
                  aria-label="Count credit-card spending against today"
                  onClick={() => {
                    const next = !countCreditImmediately
                    setCountCreditImmediatelyState(next)
                    onUpdateCountCreditImmediately(next)
                  }}
                  whileTap={{ scale: 0.92 }}
                  transition={springs.snappy}
                  style={{
                    flexShrink: 0, width: 44, height: 26, borderRadius: 13,
                    border: "none", cursor: "pointer",
                    background: countCreditImmediately ? "rgba(167, 139, 250, 0.6)" : "rgba(255, 255, 255, 0.1)",
                    position: "relative", transition: "background 0.2s ease",
                  }}
                >
                  <span
                    style={{
                      position: "absolute", top: 3,
                      left: countCreditImmediately ? 21 : 3,
                      width: 20, height: 20, borderRadius: "50%",
                      background: countCreditImmediately ? "#fff" : "rgba(255,255,255,0.4)",
                      transition: "left 0.2s ease, background 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </motion.button>
              </div>
            )}

            {/* Reset Tutorial/Onboarding */}
            {onResetOnboarding && (
              <motion.button
                onClick={onResetOnboarding}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={{ ...linkButton, marginTop: 14 }}
                aria-label="Reset onboarding tutorial"
              >
                Reset tutorial →
              </motion.button>
            )}

            {/* Show me around again — replay demos without resetting (task 224.2) */}
            {onReplayDemos && (
              <motion.button
                onClick={onReplayDemos}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={{ ...linkButton, marginTop: 10 }}
                aria-label="Show me around again"
              >
                🎓 Show me around again →
              </motion.button>
            )}

            {/* Catch up on past spending (backfill flow) */}
            {onOpenBackfill && (
              <motion.button
                onClick={onOpenBackfill}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={{ ...linkButton, marginTop: 10, display: 'block' }}
                aria-label="Catch up on past spending"
              >
                📝 Catch up on past spending →
              </motion.button>
            )}
          </GlassCard>
        </CollapsibleSection>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Notifications                                              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {isSectionVisible('notifications') && (
        <CollapsibleSection
          title="Notifications"
          isOpen={isSectionOpen('notifications')}
          onToggle={() => toggleSection('notifications')}
        >
          <NotificationCenter />
          <div style={{ marginTop: 16 }}>
            <MinBalanceBufferSetting />
          </div>
        </CollapsibleSection>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Privacy & security                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {isSectionVisible('privacy-security') && (
        <CollapsibleSection
          title="Privacy & security"
          isOpen={isSectionOpen('privacy-security')}
          onToggle={() => toggleSection('privacy-security')}
        >
          <AppLockSetting />
        </CollapsibleSection>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Data & account                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {isSectionVisible('data-account') && (
        <CollapsibleSection
          title="Data & account"
          isOpen={isSectionOpen('data-account')}
          onToggle={() => toggleSection('data-account')}
        >
          {/* Account */}
          <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
            <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>Account</p>
            <motion.button
              onClick={onOpenProfile}
              whileTap={{ scale: 0.97 }}
              transition={springs.snappy}
              style={linkButton}
              aria-label="Open account settings"
            >
              Manage account →
            </motion.button>
          </GlassCard>

          {/* Sharing (task 115.1) */}
          {onOpenSharing && (
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
              <p style={{ ...sectionHeadingStrong }}>Sharing</p>
              <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.5 }}>
                {activeShareCount > 0
                  ? `Sharing a snapshot with ${activeShareCount} ${activeShareCount === 1 ? "person" : "people"}`
                  : "Not sharing with anyone"}
              </p>
              <motion.button
                onClick={onOpenSharing}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={linkButton}
                aria-label="Manage sharing"
              >
                Manage sharing →
              </motion.button>
            </GlassCard>
          )}

          {/* Export options */}
          {(onExportData || onExportCSV || onOpenReports) && (
            <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
              <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>Export</p>
              {onOpenReports && (
                <motion.button
                  onClick={onOpenReports}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={{ ...linkButton, marginBottom: 12, display: "block" }}
                  aria-label="Open reports to filter and export by tag, merchant, or category"
                >
                  Reports (filter &amp; PDF) →
                </motion.button>
              )}
              {onExportData && (
                <motion.button
                  onClick={onExportData}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={{ ...linkButton, marginBottom: 12, display: "block" }}
                  aria-label="Export your financial data"
                >
                  Export my data →
                </motion.button>
              )}
              {onExportCSV && (
                <motion.button
                  onClick={onExportCSV}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={{ ...linkButton, display: "block" }}
                  aria-label="Export transactions as CSV"
                >
                  Export transactions (CSV) →
                </motion.button>
              )}
            </GlassCard>
          )}

          {/* Goals */}
          <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
            <p style={{ ...sectionHeadingStrong }}>Goals</p>
            {activeGoals.length > 0 ? (
              <div style={{ marginBottom: 14 }}>
                {activeGoals.map(goal => {
                  const progress = goal.targetAmount > 0
                    ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                    : 0
                  return (
                    <div key={goal.id} style={listRow}>
                      <span>{goal.emoji} {goal.name}</span>
                      <span
                        style={{
                          fontSize: 13,
                          color: progress >= 100 ? "var(--success)" : "var(--sub)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {progress}%
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                No goals yet — set one when you&apos;re ready to save toward something.
              </p>
            )}
            <motion.button
              onClick={onOpenGoals}
              whileTap={{ scale: 0.97 }}
              transition={springs.snappy}
              style={linkButton}
              aria-label="Manage savings goals"
            >
              Manage goals →
            </motion.button>
          </GlassCard>

          {/* Sign out */}
          <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
            <motion.button
              onClick={onSignOut}
              whileTap={{ scale: 0.97 }}
              transition={springs.snappy}
              style={linkButton}
              aria-label="Sign out"
            >
              Sign out →
            </motion.button>
          </GlassCard>
        </CollapsibleSection>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DANGER ZONE: Delete account (always visible, not collapsible)       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {onDeleteAccount && (
        <div style={{ marginTop: 32 }}>
          <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
            {!showDeleteConfirm ? (
              <>
                <p style={{ ...sectionHeadingStrong, marginBottom: 8, color: "var(--error, #f87171)" }}>
                  Danger zone
                </p>
                <motion.button
                  onClick={() => setShowDeleteConfirm(true)}
                  whileTap={{ scale: 0.97 }}
                  transition={springs.snappy}
                  style={{ ...linkButton, color: "var(--error)" }}
                  aria-label="Delete account"
                >
                  Delete account →
                </motion.button>
              </>
            ) : (
              <div style={dangerZone}>
                <p
                  style={{
                    fontSize: 14, fontWeight: 600,
                    color: "var(--error)", marginBottom: 8,
                  }}
                >
                  ⚠️ Delete Account
                </p>
                <p
                  style={{
                    fontSize: 13, color: "var(--text)",
                    marginBottom: 12, lineHeight: 1.5,
                  }}
                >
                  This will permanently delete all your data including transactions, budgets, and goals. This cannot be undone.
                </p>
                <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 12 }}>
                  Type <strong>DELETE</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  style={{
                    width: "100%", padding: "10px 12px", marginBottom: 12,
                    fontSize: 14, fontFamily: FONT_FAMILY,
                    color: "var(--text)",
                    background: "rgba(0, 0, 0, 0.2)",
                    border: "1px solid var(--border)",
                    borderRadius: borderRadius.sm, outline: "none",
                  }}
                  aria-label="Type DELETE to confirm account deletion"
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <motion.button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText("") }}
                    whileTap={{ scale: 0.97 }}
                    transition={springs.snappy}
                    style={{
                      flex: 1, padding: "10px 16px", fontSize: 14,
                      fontWeight: 500, fontFamily: FONT_FAMILY,
                      color: "var(--text)",
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid var(--border)",
                      borderRadius: borderRadius.sm, cursor: "pointer",
                    }}
                    aria-label="Cancel account deletion"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      if (deleteConfirmText === "DELETE" && onDeleteAccount) {
                        onDeleteAccount()
                      }
                    }}
                    whileTap={{ scale: deleteConfirmText === "DELETE" ? 0.97 : 1 }}
                    transition={springs.snappy}
                    disabled={deleteConfirmText !== "DELETE"}
                    style={{
                      flex: 1, padding: "10px 16px", fontSize: 14,
                      fontWeight: 600, fontFamily: FONT_FAMILY,
                      color: deleteConfirmText === "DELETE" ? "#fff" : "var(--muted)",
                      background: deleteConfirmText === "DELETE" ? "var(--error)" : "rgba(255, 255, 255, 0.03)",
                      border: "none", borderRadius: borderRadius.sm,
                      cursor: deleteConfirmText === "DELETE" ? "pointer" : "not-allowed",
                      opacity: deleteConfirmText === "DELETE" ? 1 : 0.5,
                    }}
                    aria-label="Confirm account deletion"
                  >
                    Delete Forever
                  </motion.button>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ── Branded footer ────────────────────────────────────────────────── */}
      <div
        style={{
          textAlign: "center",
          paddingTop: 24,
          paddingBottom: 8,
          opacity: 0.4,
        }}
      >
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 14,
            fontWeight: 300,
            letterSpacing: "0.12em",
            color: "var(--sub)",
            margin: 0,
          }}
        >
          folio
        </p>
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 10,
            color: "var(--muted)",
            marginTop: 4,
            letterSpacing: "0.04em",
          }}
        >
          v0.1.0
        </p>
      </div>
    </div>
  )
}
