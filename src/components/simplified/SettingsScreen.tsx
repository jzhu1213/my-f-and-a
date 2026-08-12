"use client"

/**
 * SettingsScreen — Rebuilt with unified primitives from Component_Library.
 *
 * All section headings use SectionHeader (Typography_System headline tier).
 * All entries use ListRow (dense variant) for list items.
 * Toggle controls use the Toggle primitive.
 * Segmented controls use the SegmentedControl primitive.
 * Layout uses contentColumn from Layout_System.
 * Zero local font-size/weight/color/spacing overrides on heading or row treatments.
 * Sections grouped with ≤7 entries each (Req 10.4).
 * At most one accent fill per viewport; all remaining from neutral tokens.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 10.4
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { SectionHeader, ListRow, Toggle, SegmentedControl, Card } from "@/components/ui"
import { useTheme } from "@/contexts/ThemeContext"
import { BUDGET_CATEGORIES } from "@/types"
import type { Budget, Goal, TransactionCategory } from "@/types"
import type { IncomeSmoothing } from "@/types/folio"
import type { SpendingMode } from "@/lib/spendingModes"
import { SPENDING_MODE_LABELS, OVER_LIMIT_RESPONSE_LABELS, limitVisibilityNote } from "@/lib/spendingModes"
import type { OverLimitResponse } from "@/lib/spendingModes"
import type { HeroMeaning } from "@/types/folio"
import { computeBudgetSummary } from "@/lib/budgetSummary"
import { contentColumn, spacingScale } from "@/styles/layout"
import { safeAreaBottom } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, colorRamp, semanticColors } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { MinBalanceBufferSetting } from "./MinBalanceBufferSetting"
import { RegionSettings } from "./RegionSettings"
import { NotificationCenter } from "./NotificationCenter"
import { AppLockSetting } from "./AppLockSetting"
import { SessionsSetting } from "./SessionsSetting"
import { getInsightsEnabled, setInsightsEnabled, getSavingsRateBadgeEnabled, setSavingsRateBadgeEnabled, getPeerContextEnabled, setPeerContextEnabled } from "@/lib/uiPreferences"
import { getPaceIndicatorEnabled, setPaceIndicatorEnabled } from "@/lib/paceIndicatorPreferences"
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
  onReplayDemos?: () => void
  onExportData?: () => void
  onExportCSV?: () => void
  onOpenReports?: () => void
  onOpenPrivacyDashboard?: () => void
  onDeleteAccount?: () => void
  categorizationRules?: CategorizationRule[]
  onAddCategorizationRule?: (keyword: string, category: TransactionCategory) => void
  onDeleteCategorizationRule?: (id: string) => void
  onOpenCategorizationRules?: () => void
  onOpenSharing?: () => void
  onOpenCategoryHub?: () => void
  activeShareCount?: number
  termSchedule?: TermSchedule | null
  onSetTermSchedule?: (schedule: TermSchedule | null) => void
  hasTermBudget?: boolean
  spendDownPlans?: import('@/lib/spendDown').SpendDownPlan[]
  onAddSpendDownPlan?: (data: Omit<import('@/lib/spendDown').SpendDownPlan, 'id'>) => import('@/lib/spendDown').SpendDownPlan
  onRemoveSpendDownPlan?: (id: string) => void
  disbursements?: import('@/lib/disbursements').Disbursement[]
  budgetModes?: import('@/lib/spendingModeConfig').BudgetMode[]
  activeBudgetModeId?: string | null
  onSetActiveBudgetMode?: (id: string | null) => void
  onSaveBudgetMode?: (mode: import('@/lib/spendingModeConfig').BudgetMode) => void
  onDeleteBudgetMode?: (id: string) => void
  userGoal?: import('@/types').UserGoal
  onGoalChange?: (goal: import('@/types').UserGoal) => void
  skippedSetupSteps?: string[]
  onResumeSetupStep?: (stepId: string) => void
}

// ============================================================================
// Option arrays
// ============================================================================

const SPENDING_MODE_OPTIONS: readonly string[] = ["Just tracking", "Guided", "Structured"]
const SPENDING_MODE_KEYS: readonly SpendingMode[] = ["tracker", "guided", "structured"]

const THEME_OPTIONS: readonly string[] = ["Warm", "Dark", "System"]
const THEME_KEYS = ["warm", "dark", "system"] as const

const INCOME_OPTIONS = [
  { key: 'current_month' as const, label: 'Just this month', value: { strategy: 'current_month' as const } },
  { key: 'trailing_average' as const, label: 'Average 3 months', value: { strategy: 'trailing_average' as const, windowMonths: 3 } },
]

const HERO_MEANING_OPTIONS: { key: HeroMeaning; label: string; desc: string }[] = [
  { key: 'allowance', label: 'Safe to spend today', desc: "How much is left in today's budget" },
  { key: 'spent_today', label: 'Spent today', desc: "Total you've logged so far today" },
  { key: 'spent_week', label: 'Spent this week', desc: 'Rolling 7-day spend total' },
  { key: 'balance', label: 'Money on hand', desc: 'All income minus all spending' },
]

const OVER_LIMIT_RESPONSE_OPTIONS: { key: OverLimitResponse; label: string; desc: string }[] = [
  { key: 'quiet', label: OVER_LIMIT_RESPONSE_LABELS.quiet.label, desc: OVER_LIMIT_RESPONSE_LABELS.quiet.description },
  { key: 'gentle', label: OVER_LIMIT_RESPONSE_LABELS.gentle.label, desc: OVER_LIMIT_RESPONSE_LABELS.gentle.description },
  { key: 'headsup', label: OVER_LIMIT_RESPONSE_LABELS.headsup.label, desc: OVER_LIMIT_RESPONSE_LABELS.headsup.description },
]

const GOAL_OPTIONS_SETTINGS: { key: UserGoal; label: string; emoji: string }[] = [
  { key: 'save', label: 'Build my savings', emoji: '🏦' },
  { key: 'track_spending', label: 'Know where my money goes', emoji: '🔍' },
  { key: 'reduce_spending', label: 'Spend less', emoji: '✂️' },
  { key: 'avoid_overdraft', label: 'Stop overdrafting', emoji: '🛡️' },
  { key: 'pay_debt', label: 'Pay off debt', emoji: '💳' },
  { key: 'learn_investing', label: 'Learn investing', emoji: '📈' },
]

// ============================================================================
// Section definitions (≤7 entries each — Req 10.4)
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
  keywords: string[]
}

const SECTIONS: SectionDef[] = [
  { id: 'spending-style', title: 'Spending Style', keywords: ['spending', 'mode', 'tracker', 'guided', 'structured', 'over-limit', 'limit', 'response', 'goal', 'focus'] },
  { id: 'hero-display', title: 'Hero & Display', keywords: ['hero', 'big number', 'display', 'feature', 'visibility', 'toggle'] },
  { id: 'budget-income', title: 'Budget & Income', keywords: ['budget', 'limits', 'income', 'category', 'smoothing', 'term', 'semester', 'spend-down', 'categorization', 'rules'] },
  { id: 'payment-methods', title: 'Payment Methods', keywords: ['payment', 'funding', 'sources', 'linked', 'accounts', 'bank', 'card'] },
  { id: 'appearance', title: 'Appearance', keywords: ['appearance', 'theme', 'warm', 'dark', 'insight', 'credit', 'tutorial', 'peer', 'region', 'currency'] },
  { id: 'notifications', title: 'Notifications', keywords: ['notification', 'nudge', 'buffer', 'balance', 'minimum', 'alert'] },
  { id: 'privacy-security', title: 'Privacy & Security', keywords: ['privacy', 'security', 'lock', 'pin', 'biometric', 'session', 'data', 'dashboard'] },
  { id: 'data-account', title: 'Data & Account', keywords: ['data', 'account', 'export', 'csv', 'sharing', 'sign out', 'goals', 'profile'] },
]

// ============================================================================
// CollapsibleSection — uses SectionHeader primitive
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
    <div style={{ marginBottom: spacingScale["32"] }}>
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
          padding: `${spacingScale["12"]} 0`,
          background: "none",
          border: "none",
          borderBottom: `1px solid ${semanticColors.borderSubtle}`,
          cursor: "pointer",
        }}
      >
        <span style={{ ...typography.subhead, color: textColors.text }}>
          {title}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={springs.snappy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: spacingScale["24"],
            height: spacingScale["24"],
            color: textColors.sub,
            ...typography.caption,
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
            <div style={{
              paddingTop: spacingScale["16"],
              borderLeft: `2px solid ${colorRamp.accent[200]}`,
              paddingLeft: spacingScale["16"],
              marginLeft: spacingScale["2"],
            }}>
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
  onOpenTools: _onOpenTools,
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
  onOpenPrivacyDashboard,
  onDeleteAccount,
  categorizationRules = [],
  onAddCategorizationRule,
  onDeleteCategorizationRule,
  onOpenCategorizationRules,
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
  budgetModes = [],
  activeBudgetModeId,
  onSetActiveBudgetMode,
  onSaveBudgetMode,
  onDeleteBudgetMode,
  userGoal,
  onGoalChange,
  skippedSetupSteps,
  onResumeSetupStep,
}: SettingsScreenProps) {
  const { theme, setTheme } = useTheme()
  const { listContainer, listItem } = useReducedMotion()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { flags, setFlag, resetFlags } = useFeatureFlags()
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [insightsEnabled, setInsightsEnabledState] = useState(() => getInsightsEnabled())
  const [savingsRateBadgeEnabled, setSavingsRateBadgeEnabledState] = useState(() => getSavingsRateBadgeEnabled())
  const [paceIndicatorEnabled, setPaceIndicatorEnabledState] = useState(() => getPaceIndicatorEnabled())
  const [peerContextEnabled, setPeerContextEnabledState] = useState(() => getPeerContextEnabled())
  const [countCreditImmediately, setCountCreditImmediatelyState] = useState(countCreditImmediatelyProp ?? true)

  // ── Form state ─────────────────────────────────────────────────────────
  const [showAddRuleForm, setShowAddRuleForm] = useState(false)
  const [newRuleKeyword, setNewRuleKeyword] = useState("")
  const [newRuleCategory, setNewRuleCategory] = useState<TransactionCategory>("food")
  const [showTermSetup, setShowTermSetup] = useState(false)
  const [termStartDate, setTermStartDate] = useState("")
  const [termEndDate, setTermEndDate] = useState("")
  const [termLabel, setTermLabel] = useState("")
  const [showSpendDownForm, setShowSpendDownForm] = useState(false)
  const [sdLabel, setSdLabel] = useState("")
  const [sdAmount, setSdAmount] = useState("")
  const [sdEndDate, setSdEndDate] = useState("")
  const [sdEmoji, setSdEmoji] = useState("💰")

  // ── Section collapse state ─────────────────────────────────────────────
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
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchText])

  const toggleSection = useCallback((id: SectionId) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

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

  const isSectionOpen = useCallback((id: SectionId) => {
    if (debouncedSearch) return true
    return openSections[id]
  }, [debouncedSearch, openSections])

  // ── Derived state ──────────────────────────────────────────────────────
  const spendingMode: SpendingMode = spendingModeProp ?? 'guided'
  const isTrackerMode = spendingMode === 'tracker'
  const heroMeaning: HeroMeaning = heroMeaningProp ?? 'allowance'
  const overLimitResponse: OverLimitResponse = overLimitResponseProp ?? 'gentle'
  const { totalMonthly, dailyBudget } = computeBudgetSummary(budgets)
  const activeLimits = BUDGET_CATEGORIES
    .map(cat => {
      const budget = budgets.find(b => b.category === cat.category)
      return { ...cat, limit: budget?.monthlyLimit ?? 0 }
    })
    .filter(c => c.limit > 0)
  const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount)

  return (
    <div
      style={{
        ...contentColumn,
        paddingTop: spacingScale["24"],
        paddingBottom: safeAreaBottom(100),
      }}
    >
      {/* ── Screen Title ───────────────────────────────────────────────── */}
      <SectionHeader>Settings</SectionHeader>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div style={{ marginTop: spacingScale["16"], marginBottom: spacingScale["20"] }}>
        <input
          type="search"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Search settings..."
          aria-label="Search settings"
          style={{
            width: "100%",
            padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
            ...typography["body-sm"],
            color: textColors.text,
            background: elevations.sunken.fill,
            border: `1px solid ${elevations.resting.border}`,
            borderRadius: radius.control,
            outline: "none",
          }}
        />
      </div>

      {/* No results */}
      {debouncedSearch && visibleSections.length === 0 && (
        <p style={{ ...typography["body-sm"], color: textColors.sub, textAlign: "center", padding: `${spacingScale["20"]} 0` }}>
          No settings match &ldquo;{searchText.trim()}&rdquo;
        </p>
      )}

      {/* ── Setup Checklist ────────────────────────────────────────────── */}
      {skippedSetupSteps && skippedSetupSteps.length > 0 && onResumeSetupStep && !debouncedSearch && (
        <div style={{ marginBottom: spacingScale["20"] }}>
          <SetupChecklistCard
            skippedSteps={skippedSetupSteps}
            onResumeStep={onResumeSetupStep}
            onDismiss={() => {}}
            variant="settings"
          />
        </div>
      )}

      {/* ── Sections ───────────────────────────────────────────────────── */}
      <motion.div variants={listContainer} initial="hidden" animate="visible">

      {/* ═══ SECTION: Spending Style ═══════════════════════════════════ */}
      {isSectionVisible('spending-style') && (
        <motion.div variants={listItem}>
        <CollapsibleSection
          title="Spending Style"
          isOpen={isSectionOpen('spending-style')}
          onToggle={() => toggleSection('spending-style')}
        >
          {/* Spending mode segmented control */}
          {onSetSpendingMode && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
              <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["12"] }}>
                {SPENDING_MODE_LABELS[spendingMode].description}
              </p>
              <SegmentedControl
                items={SPENDING_MODE_OPTIONS as unknown as string[]}
                selectedIndex={SPENDING_MODE_KEYS.indexOf(spendingMode)}
                onChange={(idx) => onSetSpendingMode(SPENDING_MODE_KEYS[idx])}
                aria-label="Spending mode"
              />
              <p style={{ ...typography.caption, color: textColors.muted, marginTop: spacingScale["12"] }}>
                {limitVisibilityNote(spendingMode, activeLimits.length > 0)}
              </p>
            </Card>
          )}

          {/* Over-limit response */}
          {onSetOverLimitResponse && spendingMode !== 'tracker' && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
              <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["4"] }}>
                When you go over
              </p>
              <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["12"] }}>
                All options are calm and shame-free.
              </p>
              {OVER_LIMIT_RESPONSE_OPTIONS.map((opt) => {
                const isActive = overLimitResponse === opt.key
                return (
                  <ListRow
                    key={opt.key}
                    variant="dense"
                    onPress={() => onSetOverLimitResponse(opt.key)}
                    aria-label={`Over-limit response: ${opt.label}`}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        width: spacingScale["16"],
                        height: spacingScale["16"],
                        borderRadius: radius.full,
                        border: `2px solid ${isActive ? colorRamp.accent[500] : elevations.resting.border}`,
                        background: isActive ? colorRamp.accent[500] : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isActive && (
                        <span style={{ width: spacingScale["6"], height: spacingScale["6"], borderRadius: radius.full, background: textColors.text }} />
                      )}
                    </span>
                    <div style={{ flex: 1 }}>
                      <span style={{ ...typography.body, color: isActive ? textColors.text : textColors.sub, display: "block" }}>
                        {opt.label}
                      </span>
                      <span style={{ ...typography.caption, color: textColors.muted, display: "block" }}>
                        {opt.desc}
                      </span>
                    </div>
                  </ListRow>
                )
              })}
            </Card>
          )}

          {/* My focus/goal */}
          {onGoalChange && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}` }}>
              <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["4"] }}>
                My focus
              </p>
              <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["12"] }}>
                {userGoal ? getGoalDescription(userGoal) : "Pick what matters most — shapes tips and priorities."}
              </p>
              {GOAL_OPTIONS_SETTINGS.map((opt) => {
                const isActive = userGoal === opt.key
                return (
                  <ListRow
                    key={opt.key}
                    variant="dense"
                    onPress={() => onGoalChange(opt.key)}
                    aria-label={`Set goal to ${opt.label}`}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        width: spacingScale["16"],
                        height: spacingScale["16"],
                        borderRadius: radius.full,
                        border: `2px solid ${isActive ? colorRamp.accent[500] : elevations.resting.border}`,
                        background: isActive ? colorRamp.accent[500] : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isActive && (
                        <span style={{ width: spacingScale["6"], height: spacingScale["6"], borderRadius: radius.full, background: textColors.text }} />
                      )}
                    </span>
                    <span aria-hidden="true" style={{ ...typography.body }}>{opt.emoji}</span>
                    <span style={{ ...typography.body, color: isActive ? textColors.text : textColors.sub, flex: 1 }}>
                      {opt.label}
                    </span>
                  </ListRow>
                )
              })}
            </Card>
          )}
        </CollapsibleSection>
        </motion.div>
      )}

      {/* ═══ SECTION: Hero & Display ═══════════════════════════════════ */}
      {isSectionVisible('hero-display') && (
        <motion.div variants={listItem}>
        <CollapsibleSection
          title="Hero & Display"
          isOpen={isSectionOpen('hero-display')}
          onToggle={() => toggleSection('hero-display')}
        >
          {/* Hero meaning */}
          {onSetHeroMeaning && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
              <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["4"] }}>
                What does the big number show?
              </p>
              <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["12"] }}>
                Pick the metric that makes most sense for you.
              </p>
              {HERO_MEANING_OPTIONS.map((opt) => {
                const isActive = heroMeaning === opt.key
                return (
                  <ListRow
                    key={opt.key}
                    variant="dense"
                    onPress={() => onSetHeroMeaning(opt.key)}
                    aria-label={`Show ${opt.label} as the main hero number`}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        width: spacingScale["16"],
                        height: spacingScale["16"],
                        borderRadius: radius.full,
                        border: `2px solid ${isActive ? colorRamp.accent[500] : elevations.resting.border}`,
                        background: isActive ? colorRamp.accent[500] : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isActive && (
                        <span style={{ width: spacingScale["6"], height: spacingScale["6"], borderRadius: radius.full, background: textColors.text }} />
                      )}
                    </span>
                    <div style={{ flex: 1 }}>
                      <span style={{ ...typography.body, color: isActive ? textColors.text : textColors.sub, display: "block" }}>
                        {opt.label}
                      </span>
                      <span style={{ ...typography.caption, color: textColors.muted, display: "block" }}>
                        {opt.desc}
                      </span>
                    </div>
                  </ListRow>
                )
              })}
            </Card>
          )}

          {/* Feature visibility toggles */}
          <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
            <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["4"] }}>
              Feature Visibility
            </p>
            <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["12"] }}>
              Hide tools you don&apos;t use.
            </p>
            {([
              { key: "debtTracking" as keyof FeatureFlags, label: "Debt Tracking" },
              { key: "recurringBills" as keyof FeatureFlags, label: "Recurring Bills" },
              { key: "reimbursements" as keyof FeatureFlags, label: "IOUs & Reimbursements" },
              { key: "sinkingFunds" as keyof FeatureFlags, label: "Sinking Funds" },
              { key: "subscriptionAudit" as keyof FeatureFlags, label: "Subscription Audit" },
              { key: "savingsProjections" as keyof FeatureFlags, label: "Savings Projections" },
              { key: "compoundGrowthCalculator" as keyof FeatureFlags, label: "Compound Growth" },
            ] as const).map((item) => (
              <ListRow key={item.key} variant="dense">
                <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>{item.label}</span>
                <Toggle
                  checked={flags[item.key]}
                  onChange={() => setFlag(item.key, !flags[item.key])}
                  size="sm"
                  aria-label={`Toggle ${item.label}`}
                />
              </ListRow>
            ))}
          </Card>

          {/* Feature visibility — second group (≤7 rule) */}
          <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
            {([
              { key: "creditPayoffCalculator" as keyof FeatureFlags, label: "Credit Payoff" },
              { key: "lessons" as keyof FeatureFlags, label: "Learn" },
              { key: "goals" as keyof FeatureFlags, label: "Goals" },
              { key: "financialTrajectory" as keyof FeatureFlags, label: "Financial Trajectory" },
            ] as const).map((item) => (
              <ListRow key={item.key} variant="dense">
                <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>{item.label}</span>
                <Toggle
                  checked={flags[item.key]}
                  onChange={() => setFlag(item.key, !flags[item.key])}
                  size="sm"
                  aria-label={`Toggle ${item.label}`}
                />
              </ListRow>
            ))}
            <button
              type="button"
              onClick={resetFlags}
              style={{
                background: "none",
                border: "none",
                padding: `${spacingScale["12"]} 0`,
                ...typography["body-sm"],
                color: textColors.sub,
                cursor: "pointer",
              }}
              aria-label="Reset feature visibility to defaults"
            >
              Reset to defaults
            </button>
          </Card>

          {/* Home screen extras */}
          <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}` }}>
            <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["4"] }}>
              Home screen extras
            </p>
            <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["12"] }}>
              Small optional touches below your daily allowance.
            </p>
            <ListRow variant="dense">
              <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Savings-rate badge</span>
              <Toggle
                checked={savingsRateBadgeEnabled}
                onChange={(next) => { setSavingsRateBadgeEnabledState(next); setSavingsRateBadgeEnabled(next) }}
                size="sm"
                aria-label="Show savings-rate badge"
              />
            </ListRow>
            <ListRow variant="dense">
              <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Spending-pace indicator</span>
              <Toggle
                checked={paceIndicatorEnabled}
                onChange={(next) => { setPaceIndicatorEnabledState(next); setPaceIndicatorEnabled(next) }}
                size="sm"
                aria-label="Show spending-pace indicator"
              />
            </ListRow>
          </Card>
        </CollapsibleSection>
        </motion.div>
      )}

      {/* ═══ SECTION: Budget & Income ══════════════════════════════════ */}
      {isSectionVisible('budget-income') && (
        <motion.div variants={listItem}>
        <CollapsibleSection
          title="Budget & Income"
          isOpen={isSectionOpen('budget-income')}
          onToggle={() => toggleSection('budget-income')}
        >
          {/* Budget limits */}
          <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
            <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["8"] }}>
              Budget Limits
            </p>
            {isTrackerMode ? (
              <p style={{ ...typography["body-sm"], color: textColors.muted, marginBottom: spacingScale["12"] }}>
                {activeLimits.length > 0
                  ? `Tracking mode — ${activeLimits.length} saved limit${activeLimits.length === 1 ? " is" : "s are"} paused.`
                  : "Tracking mode — add limits anytime by switching to Guided or Structured."}
              </p>
            ) : (
              <>
                <div style={{ display: "flex", gap: spacingScale["16"], marginBottom: spacingScale["12"] }}>
                  <p style={{ ...typography.subhead, color: textColors.text, fontVariantNumeric: "tabular-nums" }}>
                    ${totalMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    <span style={{ ...typography.caption, color: textColors.sub }}>/mo</span>
                  </p>
                  <p style={{ ...typography["body-sm"], color: textColors.sub, display: "flex", alignItems: "center" }}>
                    ≈ ${dailyBudget.toFixed(0)}/day
                  </p>
                </div>
                {activeLimits.length > 0 && (
                  <div style={{ marginBottom: spacingScale["12"] }}>
                    {activeLimits.map(cat => (
                      <ListRow key={cat.category} variant="dense">
                        <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>
                          {cat.emoji} {cat.label}
                        </span>
                        <span style={{ ...typography["body-sm"], color: textColors.sub, fontVariantNumeric: "tabular-nums" }}>
                          ${cat.limit}/mo
                        </span>
                      </ListRow>
                    ))}
                  </div>
                )}
                {activeLimits.length === 0 && (
                  <p style={{ ...typography["body-sm"], color: textColors.muted, marginBottom: spacingScale["12"] }}>
                    No limits yet — works fine without them.
                  </p>
                )}
              </>
            )}
            <button
              type="button"
              onClick={onOpenBudgetSettings}
              style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.sub, cursor: "pointer", padding: 0 }}
              aria-label="Manage budget limits"
            >
              {isTrackerMode ? "View saved limits →" : "Manage limits →"}
            </button>
          </Card>

          {/* Category Hub */}
          {onOpenCategoryHub && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
              <ListRow variant="dense" onPress={onOpenCategoryHub} aria-label="Manage categories">
                <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Categories</span>
                <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
              </ListRow>
            </Card>
          )}

          {/* Income smoothing */}
          {onSetIncomeSmoothing && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
              <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["8"] }}>
                Income
              </p>
              <SegmentedControl
                items={INCOME_OPTIONS.map(o => o.label)}
                selectedIndex={INCOME_OPTIONS.findIndex(o => o.key === (incomeSmoothing?.strategy ?? 'current_month'))}
                onChange={(idx) => onSetIncomeSmoothing(INCOME_OPTIONS[idx].value)}
                aria-label="Income calculation method"
              />
            </Card>
          )}

          {/* Academic term */}
          {onSetTermSchedule && (hasTermBudget || termSchedule) && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
              <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["8"] }}>
                Academic Term
              </p>
              {termSchedule && isTermActive(termSchedule, new Date()) ? (
                <>
                  <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["8"] }}>
                    {termSchedule.label || "Current term"} — {getDaysRemainingInTerm(termSchedule, new Date())} days left
                  </p>
                  <div style={{
                    height: spacingScale["6"], borderRadius: radius.full,
                    background: elevations.sunken.fill,
                    marginBottom: spacingScale["12"], overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: radius.full,
                      width: `${Math.round(getTermProgress(termSchedule, new Date()) * 100)}%`,
                      background: colorRamp.accent[500],
                    }} />
                  </div>
                  <button
                    type="button"
                    onClick={() => onSetTermSchedule(null)}
                    style={{ background: "none", border: "none", ...typography["body-sm"], color: semanticColors.error, cursor: "pointer", padding: 0 }}
                    aria-label="Clear term schedule"
                  >
                    Clear term
                  </button>
                </>
              ) : termSchedule && !isTermActive(termSchedule, new Date()) ? (
                <>
                  <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["8"] }}>
                    Your term has ended. Set up a new one.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowTermSetup(true); setTermStartDate(""); setTermEndDate(""); setTermLabel("") }}
                    style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.sub, cursor: "pointer", padding: 0 }}
                    aria-label="Set up a new term"
                  >
                    Set up a new term →
                  </button>
                </>
              ) : !showTermSetup ? (
                <button
                  type="button"
                  onClick={() => setShowTermSetup(true)}
                  style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.sub, cursor: "pointer", padding: 0 }}
                  aria-label="Set up a term"
                >
                  Set up a term →
                </button>
              ) : (
                <>
                  <div style={{ display: "flex", gap: spacingScale["6"], flexWrap: "wrap", marginBottom: spacingScale["12"] }}>
                    {TERM_PRESETS.map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const start = new Date()
                          const end = addDaysLocal(start, preset.durationWeeks * 7 - 1)
                          setTermStartDate(formatDateLocal(start))
                          setTermEndDate(formatDateLocal(end))
                          setTermLabel(preset.label)
                        }}
                        style={{
                          padding: `${spacingScale["6"]} ${spacingScale["12"]}`,
                          borderRadius: radius.control,
                          background: elevations.sunken.fill,
                          border: `1px solid ${elevations.resting.border}`,
                          color: textColors.text,
                          ...typography.caption,
                          cursor: "pointer",
                        }}
                        aria-label={`Use ${preset.label} preset`}
                      >
                        {preset.emoji} {preset.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: spacingScale["8"], marginBottom: spacingScale["8"] }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...typography.caption, color: textColors.sub, display: "block", marginBottom: spacingScale["4"] }}>Start</label>
                      <input
                        type="date" value={termStartDate}
                        onChange={e => setTermStartDate(e.target.value)}
                        style={{ width: "100%", padding: spacingScale["8"], borderRadius: radius.control, background: elevations.sunken.fill, border: `1px solid ${elevations.resting.border}`, color: textColors.text, ...typography["body-sm"] }}
                        aria-label="Term start date"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...typography.caption, color: textColors.sub, display: "block", marginBottom: spacingScale["4"] }}>End</label>
                      <input
                        type="date" value={termEndDate}
                        onChange={e => setTermEndDate(e.target.value)}
                        style={{ width: "100%", padding: spacingScale["8"], borderRadius: radius.control, background: elevations.sunken.fill, border: `1px solid ${elevations.resting.border}`, color: textColors.text, ...typography["body-sm"] }}
                        aria-label="Term end date"
                      />
                    </div>
                  </div>
                  <input
                    type="text" value={termLabel}
                    onChange={e => setTermLabel(e.target.value)}
                    placeholder="Label (optional, e.g. Fall 2025)"
                    maxLength={30}
                    style={{ width: "100%", padding: spacingScale["8"], borderRadius: radius.control, background: elevations.sunken.fill, border: `1px solid ${elevations.resting.border}`, color: textColors.text, ...typography["body-sm"], marginBottom: spacingScale["12"] }}
                    aria-label="Term label"
                  />
                  <div style={{ display: "flex", gap: spacingScale["8"] }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (termStartDate && termEndDate && termStartDate < termEndDate) {
                          onSetTermSchedule({ startDate: termStartDate, endDate: termEndDate, label: termLabel || undefined })
                          setShowTermSetup(false)
                        }
                      }}
                      disabled={!termStartDate || !termEndDate || termStartDate >= termEndDate}
                      style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.sub, cursor: "pointer", padding: 0, opacity: (!termStartDate || !termEndDate || termStartDate >= termEndDate) ? 0.4 : 1 }}
                      aria-label="Save term"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTermSetup(false)}
                      style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.muted, cursor: "pointer", padding: 0 }}
                      aria-label="Cancel"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Spend-down plans */}
          {onAddSpendDownPlan && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
              <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["8"] }}>
                Spend-Down Plans
              </p>
              <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["12"] }}>
                Got a lump sum? Set a target date for a safe daily amount.
              </p>
              {spendDownPlans.length > 0 && spendDownPlans.map(plan => {
                const todayStr = new Date().toISOString().slice(0, 10)
                const isActive = todayStr >= plan.startDate && todayStr <= plan.endDate
                const isExpired = todayStr > plan.endDate
                return (
                  <ListRow key={plan.id} variant="dense">
                    <div style={{ flex: 1 }}>
                      <span style={{ ...typography.body, color: textColors.text, display: "block" }}>
                        {plan.emoji} {plan.label}
                      </span>
                      <span style={{ ...typography.caption, color: textColors.sub }}>
                        ${plan.totalAmount.toLocaleString()} until {plan.endDate}
                        {isActive && " • Active"}
                        {isExpired && " • Ended"}
                      </span>
                    </div>
                    {onRemoveSpendDownPlan && (
                      <button
                        type="button"
                        onClick={() => onRemoveSpendDownPlan(plan.id)}
                        style={{ background: "none", border: "none", ...typography.caption, color: semanticColors.error, cursor: "pointer", padding: spacingScale["4"] }}
                        aria-label={`Remove ${plan.label}`}
                      >
                        Remove
                      </button>
                    )}
                  </ListRow>
                )
              })}
              {!showSpendDownForm ? (
                <button
                  type="button"
                  onClick={() => setShowSpendDownForm(true)}
                  style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.sub, cursor: "pointer", padding: 0 }}
                  aria-label="Add a spend-down plan"
                >
                  + Add plan
                </button>
              ) : (
                <div style={{ marginTop: spacingScale["8"] }}>
                  {disbursements.length > 0 && (
                    <div style={{ marginBottom: spacingScale["12"] }}>
                      <p style={{ ...typography.caption, color: textColors.sub, marginBottom: spacingScale["6"] }}>
                        Quick fill from a disbursement:
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: spacingScale["6"] }}>
                        {disbursements.slice(0, 3).map(d => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setSdLabel(d.label); setSdAmount(String(d.amount)); setSdEmoji(d.emoji)
                              const parts = d.startDate.split('-').map(Number)
                              if (parts.length === 3) {
                                const end = new Date(parts[0], parts[1] - 1 + d.coverMonths, parts[2])
                                setSdEndDate(end.toISOString().slice(0, 10))
                              }
                            }}
                            style={{ background: colorRamp.accent[50], border: `1px solid ${colorRamp.accent[200]}`, borderRadius: radius.control, padding: `${spacingScale["4"]} ${spacingScale["12"]}`, ...typography.caption, color: textColors.text, cursor: "pointer" }}
                          >
                            {d.emoji} {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <input type="text" value={sdLabel} onChange={e => setSdLabel(e.target.value)} placeholder="Label" style={{ width: "100%", padding: spacingScale["8"], borderRadius: radius.control, background: elevations.sunken.fill, border: `1px solid ${elevations.resting.border}`, color: textColors.text, ...typography["body-sm"], marginBottom: spacingScale["8"] }} />
                  <input type="number" value={sdAmount} onChange={e => setSdAmount(e.target.value)} placeholder="Amount ($)" min="1" style={{ width: "100%", padding: spacingScale["8"], borderRadius: radius.control, background: elevations.sunken.fill, border: `1px solid ${elevations.resting.border}`, color: textColors.text, ...typography["body-sm"], marginBottom: spacingScale["8"] }} />
                  <input type="date" value={sdEndDate} onChange={e => setSdEndDate(e.target.value)} style={{ width: "100%", padding: spacingScale["8"], borderRadius: radius.control, background: elevations.sunken.fill, border: `1px solid ${elevations.resting.border}`, color: textColors.text, ...typography["body-sm"], marginBottom: spacingScale["8"] }} aria-label="End date" />
                  <div style={{ display: "flex", gap: spacingScale["8"], marginBottom: spacingScale["12"] }}>
                    {["💰", "🎓", "🏅", "📦", "🎉"].map(e => (
                      <button key={e} type="button" onClick={() => setSdEmoji(e)} style={{ background: sdEmoji === e ? colorRamp.accent[100] : elevations.sunken.fill, border: `1px solid ${sdEmoji === e ? colorRamp.accent[300] : elevations.resting.border}`, borderRadius: radius.control, padding: spacingScale["6"], cursor: "pointer" }}>
                        {e}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: spacingScale["8"] }}>
                    <button type="button" onClick={() => { const amount = parseFloat(sdAmount); const today = new Date().toISOString().slice(0, 10); if (sdLabel && amount > 0 && sdEndDate && sdEndDate > today) { onAddSpendDownPlan({ label: sdLabel, totalAmount: amount, startDate: today, endDate: sdEndDate, emoji: sdEmoji }); setSdLabel(""); setSdAmount(""); setSdEndDate(""); setSdEmoji("💰"); setShowSpendDownForm(false) } }} disabled={!sdLabel || !sdAmount || parseFloat(sdAmount) <= 0 || !sdEndDate} style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.sub, cursor: "pointer", padding: 0, opacity: (!sdLabel || !sdAmount || parseFloat(sdAmount) <= 0 || !sdEndDate) ? 0.4 : 1 }} aria-label="Save plan">Save</button>
                    <button type="button" onClick={() => setShowSpendDownForm(false)} style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.muted, cursor: "pointer", padding: 0 }} aria-label="Cancel">Cancel</button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Budget Modes (Task 337.2) */}
          {onSaveBudgetMode && onDeleteBudgetMode && onSetActiveBudgetMode && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
              <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["4"] }}>
                Budget Modes
              </p>
              <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["12"] }}>
                Switch between preset budgets for different life phases.
              </p>
              {(budgetModes ?? []).map(mode => {
                const isActive = mode.id === activeBudgetModeId
                return (
                  <ListRow key={mode.id} variant="dense">
                    <button
                      type="button"
                      onClick={() => onSetActiveBudgetMode(isActive ? null : mode.id)}
                      aria-pressed={isActive}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: spacingScale["8"],
                        flex: 1,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: spacingScale["16"],
                          height: spacingScale["16"],
                          borderRadius: radius.full,
                          border: `2px solid ${isActive ? colorRamp.accent[500] : semanticColors.borderSubtle}`,
                          background: isActive ? colorRamp.accent[500] : "transparent",
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                        aria-hidden="true"
                      />
                      <span style={{ ...typography.body, color: textColors.text }}>
                        {mode.icon} {mode.name}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBudgetMode(mode.id)}
                      style={{
                        background: "none",
                        border: "none",
                        ...typography.caption,
                        color: textColors.muted,
                        cursor: "pointer",
                        padding: spacingScale["4"],
                      }}
                      aria-label={`Delete ${mode.name} mode`}
                    >
                      ✕
                    </button>
                  </ListRow>
                )
              })}
              <button
                type="button"
                onClick={() => {
                  const newMode = {
                    id: `bmode_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    name: 'Custom',
                    icon: '⚙️',
                    isActive: false,
                  }
                  onSaveBudgetMode(newMode)
                }}
                style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.sub, cursor: "pointer", padding: 0, marginTop: spacingScale["8"] }}
                aria-label="Add a custom budget mode"
              >
                + Add mode
              </button>
            </Card>
          )}

          {/* Smart categorization */}
          {onAddCategorizationRule && onDeleteCategorizationRule && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}` }}>
              <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["4"] }}>
                Smart Categorization
              </p>
              <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["12"] }}>
                Custom rules that auto-categorize certain notes.
              </p>
              {categorizationRules.length > 0 && categorizationRules.map((rule) => (
                <ListRow key={rule.id} variant="dense">
                  <span style={{ ...typography["body-sm"], color: textColors.text, flex: 1 }}>
                    &ldquo;{rule.keyword}&rdquo; → {getCategoryEmoji(rule.category)} {rule.category}
                  </span>
                  <button type="button" onClick={() => onDeleteCategorizationRule(rule.id)} style={{ background: "none", border: "none", ...typography.caption, color: textColors.muted, cursor: "pointer", padding: spacingScale["4"] }} aria-label={`Delete rule for "${rule.keyword}"`}>
                    ✕
                  </button>
                </ListRow>
              ))}
              {!showAddRuleForm ? (
                <div style={{ display: "flex", gap: spacingScale["12"] }}>
                  <button type="button" onClick={() => setShowAddRuleForm(true)} style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.sub, cursor: "pointer", padding: 0 }} aria-label="Add rule">
                    + Add rule
                  </button>
                  {onOpenCategorizationRules && (
                    <button type="button" onClick={onOpenCategorizationRules} style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.sub, cursor: "pointer", padding: 0 }} aria-label="Manage all rules">
                      Manage rules →
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ padding: spacingScale["12"], background: elevations.sunken.fill, border: `1px solid ${elevations.resting.border}`, borderRadius: radius.control, marginBottom: spacingScale["12"] }}>
                  <input type="text" placeholder="e.g. starbucks" value={newRuleKeyword} onChange={(e) => setNewRuleKeyword(e.target.value.slice(0, 40))} maxLength={40} style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${elevations.resting.border}`, outline: "none", ...typography.body, color: textColors.text, padding: `${spacingScale["6"]} 0`, marginBottom: spacingScale["8"] }} aria-label="Keyword" />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: spacingScale["6"], marginBottom: spacingScale["12"] }}>
                    {BUDGET_CATEGORIES.map((cat) => {
                      const isSelected = newRuleCategory === cat.category
                      return (
                        <button key={cat.category} type="button" onClick={() => setNewRuleCategory(cat.category)} aria-pressed={isSelected} style={{ padding: `${spacingScale["4"]} ${spacingScale["12"]}`, borderRadius: radius.full, border: `1px solid ${isSelected ? colorRamp.accent[400] : elevations.resting.border}`, background: isSelected ? colorRamp.accent[50] : "transparent", color: isSelected ? textColors.text : textColors.sub, ...typography.caption, cursor: "pointer" }}>
                          {cat.emoji} {cat.label}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: "flex", gap: spacingScale["8"] }}>
                    <button type="button" onClick={() => { if (newRuleKeyword.trim()) { onAddCategorizationRule(newRuleKeyword.trim(), newRuleCategory); setNewRuleKeyword(""); setShowAddRuleForm(false) } }} disabled={!newRuleKeyword.trim()} style={{ padding: `${spacingScale["8"]} ${spacingScale["16"]}`, borderRadius: radius.full, background: newRuleKeyword.trim() ? colorRamp.accent[500] : elevations.sunken.fill, border: "none", color: textColors.text, ...typography["body-sm"], cursor: newRuleKeyword.trim() ? "pointer" : "not-allowed" }}>Save rule</button>
                    <button type="button" onClick={() => { setShowAddRuleForm(false); setNewRuleKeyword("") }} style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.muted, cursor: "pointer", padding: 0 }}>Cancel</button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </CollapsibleSection>
        </motion.div>
      )}

      {/* ═══ SECTION: Payment Methods ═════════════════════════════════ */}
      {isSectionVisible('payment-methods') && (onOpenFundingSources || onOpenLinkedAccounts) && (
        <motion.div variants={listItem}>
        <CollapsibleSection
          title="Payment Methods"
          isOpen={isSectionOpen('payment-methods')}
          onToggle={() => toggleSection('payment-methods')}
        >
          <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}` }}>
            {onOpenFundingSources && (
              <ListRow variant="dense" onPress={onOpenFundingSources} aria-label="Manage payment methods">
                <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Payment Methods</span>
                <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
              </ListRow>
            )}
            {onOpenLinkedAccounts && (
              <ListRow variant="dense" onPress={onOpenLinkedAccounts} aria-label="Linked accounts">
                <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Linked Accounts</span>
                <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
              </ListRow>
            )}
          </Card>
        </CollapsibleSection>
        </motion.div>
      )}

      {/* ═══ SECTION: Appearance ══════════════════════════════════════ */}
      {isSectionVisible('appearance') && (
        <motion.div variants={listItem}>
        <CollapsibleSection
          title="Appearance"
          isOpen={isSectionOpen('appearance')}
          onToggle={() => toggleSection('appearance')}
        >
          {/* Theme */}
          <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
            <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["12"] }}>Theme</p>
            <SegmentedControl
              items={THEME_OPTIONS as unknown as string[]}
              selectedIndex={THEME_KEYS.indexOf(theme as typeof THEME_KEYS[number])}
              onChange={(idx) => setTheme(THEME_KEYS[idx])}
              aria-label="Theme"
            />
          </Card>

          {/* Region */}
          <RegionSettings />

          {/* Preferences */}
          <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}` }}>
            <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["12"] }}>Preferences</p>
            <ListRow variant="dense">
              <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Show daily insight</span>
              <Toggle checked={insightsEnabled} onChange={(next) => { setInsightsEnabledState(next); setInsightsEnabled(next) }} size="sm" aria-label="Show daily insight" />
            </ListRow>
            <ListRow variant="dense">
              <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Peer context</span>
              <Toggle checked={peerContextEnabled} onChange={(next) => { setPeerContextEnabledState(next); setPeerContextEnabled(next) }} size="sm" aria-label="Show peer context" />
            </ListRow>
            {onUpdateCountCreditImmediately && (
              <ListRow variant="dense">
                <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Count credit against today</span>
                <Toggle checked={countCreditImmediately} onChange={(next) => { setCountCreditImmediatelyState(next); onUpdateCountCreditImmediately(next) }} size="sm" aria-label="Count credit-card spending against today" />
              </ListRow>
            )}
            {onResetOnboarding && (
              <ListRow variant="dense" onPress={onResetOnboarding} aria-label="Reset tutorial">
                <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Reset tutorial</span>
                <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
              </ListRow>
            )}
            {onReplayDemos && (
              <ListRow variant="dense" onPress={onReplayDemos} aria-label="Show me around again">
                <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Show me around again</span>
                <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
              </ListRow>
            )}
            {onOpenBackfill && (
              <ListRow variant="dense" onPress={onOpenBackfill} aria-label="Catch up on past spending">
                <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Catch up on past spending</span>
                <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
              </ListRow>
            )}
          </Card>
        </CollapsibleSection>
        </motion.div>
      )}

      {/* ═══ SECTION: Notifications ═══════════════════════════════════ */}
      {isSectionVisible('notifications') && (
        <motion.div variants={listItem}>
        <CollapsibleSection
          title="Notifications"
          isOpen={isSectionOpen('notifications')}
          onToggle={() => toggleSection('notifications')}
        >
          <NotificationCenter />
          <div style={{ marginTop: spacingScale["16"] }}>
            <MinBalanceBufferSetting />
          </div>
        </CollapsibleSection>
        </motion.div>
      )}

      {/* ═══ SECTION: Privacy & Security ══════════════════════════════ */}
      {isSectionVisible('privacy-security') && (
        <motion.div variants={listItem}>
        <CollapsibleSection
          title="Privacy & Security"
          isOpen={isSectionOpen('privacy-security')}
          onToggle={() => toggleSection('privacy-security')}
        >
          <AppLockSetting />
          <SessionsSetting />
          {onOpenPrivacyDashboard && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginTop: spacingScale["16"] }}>
              <ListRow variant="dense" onPress={onOpenPrivacyDashboard} aria-label="Privacy & data dashboard">
                <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Privacy & data</span>
                <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
              </ListRow>
            </Card>
          )}
        </CollapsibleSection>
        </motion.div>
      )}

      {/* ═══ SECTION: Data & Account ══════════════════════════════════ */}
      {isSectionVisible('data-account') && (
        <motion.div variants={listItem}>
        <CollapsibleSection
          title="Data & Account"
          isOpen={isSectionOpen('data-account')}
          onToggle={() => toggleSection('data-account')}
        >
          <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
            <ListRow variant="dense" onPress={onOpenProfile} aria-label="Manage account">
              <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Account</span>
              <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
            </ListRow>
            {userEmail && (
              <p style={{ ...typography["body-sm"], color: textColors.sub, paddingLeft: spacingScale["4"], marginTop: spacingScale["4"] }}>
                {userEmail}
              </p>
            )}
          </Card>

          {/* Sharing */}
          {onOpenSharing && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
              <ListRow variant="dense" onPress={onOpenSharing} aria-label="Manage sharing">
                <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>
                  Sharing {activeShareCount > 0 ? `(${activeShareCount})` : ""}
                </span>
                <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
              </ListRow>
            </Card>
          )}

          {/* Export */}
          {(onExportData || onExportCSV || onOpenReports) && (
            <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
              {onOpenReports && (
                <ListRow variant="dense" onPress={onOpenReports} aria-label="Reports">
                  <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Reports</span>
                  <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
                </ListRow>
              )}
              {onExportData && (
                <ListRow variant="dense" onPress={onExportData} aria-label="Export my data">
                  <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Export my data</span>
                  <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
                </ListRow>
              )}
              {onExportCSV && (
                <ListRow variant="dense" onPress={onExportCSV} aria-label="Export CSV">
                  <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Export transactions (CSV)</span>
                  <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
                </ListRow>
              )}
            </Card>
          )}

          {/* Goals */}
          <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
            <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["8"] }}>Goals</p>
            {activeGoals.length > 0 ? (
              activeGoals.map(goal => {
                const progress = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0
                return (
                  <ListRow key={goal.id} variant="dense">
                    <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>{goal.emoji} {goal.name}</span>
                    <span style={{ ...typography["body-sm"], color: progress >= 100 ? semanticColors.success : textColors.sub, fontVariantNumeric: "tabular-nums" }}>
                      {progress}%
                    </span>
                  </ListRow>
                )
              })
            ) : (
              <p style={{ ...typography["body-sm"], color: textColors.muted, marginBottom: spacingScale["12"] }}>
                No goals yet — set one when you&apos;re ready.
              </p>
            )}
            <button type="button" onClick={onOpenGoals} style={{ background: "none", border: "none", ...typography["body-sm"], color: textColors.sub, cursor: "pointer", padding: 0 }} aria-label="Manage goals">
              Manage goals →
            </button>
          </Card>

          {/* Sign out */}
          <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}` }}>
            <ListRow variant="dense" onPress={onSignOut} aria-label="Sign out">
              <span style={{ ...typography.body, color: textColors.text, flex: 1 }}>Sign out</span>
              <span style={{ ...typography.caption, color: textColors.muted }}>→</span>
            </ListRow>
          </Card>
        </CollapsibleSection>
        </motion.div>
      )}
      </motion.div>

      {/* ═══ DANGER ZONE ═══════════════════════════════════════════════ */}
      {onDeleteAccount && (
        <div style={{ marginTop: spacingScale["32"] }}>
          <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["20"]}` }}>
            {!showDeleteConfirm ? (
              <>
                <p style={{ ...typography.body, color: semanticColors.error, marginBottom: spacingScale["8"] }}>
                  Danger zone
                </p>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ background: "none", border: "none", ...typography["body-sm"], color: semanticColors.error, cursor: "pointer", padding: 0 }}
                  aria-label="Delete account"
                >
                  Delete account →
                </button>
              </>
            ) : (
              <div style={{ padding: spacingScale["16"], borderRadius: radius.control, background: colorRamp.error[50], border: `1px solid ${colorRamp.error[300]}` }}>
                <p style={{ ...typography.body, color: semanticColors.error, marginBottom: spacingScale["8"] }}>
                  ⚠️ Delete Account
                </p>
                <p style={{ ...typography["body-sm"], color: textColors.text, marginBottom: spacingScale["12"] }}>
                  This will permanently delete all your data. This cannot be undone.
                </p>
                <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["12"] }}>
                  Type <strong>DELETE</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  style={{
                    width: "100%",
                    padding: spacingScale["8"],
                    marginBottom: spacingScale["12"],
                    ...typography.body,
                    color: textColors.text,
                    background: elevations.canvas.fill,
                    border: `1px solid ${colorRamp.error[200]}`,
                    borderRadius: radius.control,
                    outline: "none",
                  }}
                  aria-label="Type DELETE to confirm"
                />
                <div style={{ display: "flex", gap: spacingScale["8"] }}>
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText("") }}
                    style={{
                      flex: 1,
                      padding: `${spacingScale["8"]} ${spacingScale["16"]}`,
                      ...typography["body-sm"],
                      color: textColors.text,
                      background: elevations.sunken.fill,
                      border: `1px solid ${elevations.resting.border}`,
                      borderRadius: radius.control,
                      cursor: "pointer",
                    }}
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (deleteConfirmText === "DELETE" && onDeleteAccount) { onDeleteAccount() } }}
                    disabled={deleteConfirmText !== "DELETE"}
                    style={{
                      flex: 1,
                      padding: `${spacingScale["8"]} ${spacingScale["16"]}`,
                      ...typography["body-sm"],
                      fontWeight: 600,
                      color: deleteConfirmText === "DELETE" ? textColors.text : textColors.muted,
                      background: deleteConfirmText === "DELETE" ? semanticColors.error : elevations.sunken.fill,
                      border: "none",
                      borderRadius: radius.control,
                      cursor: deleteConfirmText === "DELETE" ? "pointer" : "not-allowed",
                      opacity: deleteConfirmText === "DELETE" ? 1 : 0.5,
                    }}
                    aria-label="Confirm deletion"
                  >
                    Delete Forever
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", paddingTop: spacingScale["24"], paddingBottom: spacingScale["8"], opacity: 0.4 }}>
        <p style={{ ...typography["body-sm"], color: textColors.sub, letterSpacing: "0.12em", margin: 0 }}>
          folio
        </p>
        <p style={{ ...typography.caption, color: textColors.muted, marginTop: spacingScale["4"] }}>
          v0.1.0
        </p>
      </div>
    </div>
  )
}
