"use client"

/**
 * SettingsScreen — Hub-and-spoke navigation list.
 *
 * The main settings screen is a flat list of ~10 navigation rows. Each row
 * shows an icon, a label, an optional current-value badge, and a chevron.
 * Tapping opens the corresponding sub-screen. Search is preserved at the top.
 *
 * Sub-screen routing uses a lookup map — no long if-chains needed.
 *
 * Requirements: 20.1, 20.2, 20.5
 */

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { SectionHeader } from "@/components/ui"
import { useTheme } from "@/contexts/ThemeContext"
import type { Budget, Goal, TransactionCategory } from "@/types"
import type { IncomeSmoothing } from "@/types/folio"
import type { SpendingMode } from "@/lib/spendingModes"
import { SPENDING_MODE_LABELS } from "@/lib/spendingModes"
import type { OverLimitResponse } from "@/lib/spendingModes"
import type { HeroMeaning } from "@/types/folio"
import { computeBudgetSummary } from "@/lib/budgetSummary"
import { contentColumn, spacingScale } from "@/styles/layout"
import { safeAreaBottom } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { useFeatureFlags } from "@/hooks/useFeatureFlags"
import type { CategorizationRule } from "@/lib/categorizationRules"
import { SettingsProfileScreen } from "./SettingsProfileScreen"
import { SettingsSpendingStyleScreen } from "./SettingsSpendingStyleScreen"
import { SettingsBudgetIncomeScreen } from "./SettingsBudgetIncomeScreen"
import { SettingsHeroDisplayScreen } from "./SettingsHeroDisplayScreen"
import { SettingsHomeExtrasScreen } from "./SettingsHomeExtrasScreen"
import { SettingsLookFeelScreen } from "./SettingsLookFeelScreen"
import { SettingsToolsFeaturesScreen } from "./SettingsToolsFeaturesScreen"
import { SettingsNotificationsScreen } from "./SettingsNotificationsScreen"
import { SettingsPrivacySecurityScreen } from "./SettingsPrivacySecurityScreen"
import { SettingsDataExportScreen } from "./SettingsDataExportScreen"
import { SettingsNavList } from "./SettingsNavList"
import { SettingsDangerZone } from "./SettingsDangerZone"

// ============================================================================
// Types
// ============================================================================

export interface SettingsScreenProps {
  budgets: Budget[]
  goals: Goal[]
  userEmail?: string
  displayName?: string
  avatarUrl?: string
  handle?: string | null
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
  termSchedule?: import('@/lib/termSchedule').TermSchedule | null
  onSetTermSchedule?: (schedule: import('@/lib/termSchedule').TermSchedule | null) => void
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
  /** Called when user taps "Resume setup" to reactivate a dismissed checklist (task 392.2) */
  onResumeChecklist?: () => void
  /** Whether the resume setup option should be visible (dismissed but not complete) */
  showResumeChecklist?: boolean
  /** Deep-link: auto-open a specific sub-screen on mount (384.3). */
  initialSubScreen?: SettingsCategory | null
}

// ============================================================================
// Navigation row definitions
// ============================================================================

export type SettingsCategory =
  | 'profile'
  | 'spending-style'
  | 'budget-income'
  | 'hero-display'
  | 'home-screen'
  | 'look-feel'
  | 'notifications'
  | 'tools-features'
  | 'privacy-security'
  | 'data-export'

export interface NavRowDef {
  id: SettingsCategory
  icon: string
  label: string
  keywords: string[]
  /** Visual group index — rows in the same group have no gap between them. */
  group: number
}

const NAV_ROWS: NavRowDef[] = [
  { id: 'profile', icon: '👤', label: 'Profile', keywords: ['account', 'handle', 'avatar', 'email', 'sign out'], group: 0 },
  { id: 'spending-style', icon: '🎯', label: 'Spending', keywords: ['mode', 'tracker', 'guided', 'structured', 'over-limit', 'focus', 'goal', 'style'], group: 1 },
  { id: 'budget-income', icon: '💰', label: 'Budget', keywords: ['budget', 'limits', 'income', 'categories', 'term', 'smoothing'], group: 1 },
  { id: 'hero-display', icon: '🔢', label: 'Hero number', keywords: ['hero', 'big number', 'allowance', 'spent', 'balance', 'period', 'display'], group: 1 },
  { id: 'home-screen', icon: '🏠', label: 'Home', keywords: ['extras', 'pace', 'savings', 'badge', 'cards', 'pin', 'style', 'screen'], group: 2 },
  { id: 'look-feel', icon: '🎨', label: 'Appearance', keywords: ['theme', 'warm', 'dark', 'region', 'currency', 'look', 'feel'], group: 2 },
  { id: 'notifications', icon: '🔔', label: 'Notifications', keywords: ['nudge', 'alert', 'buffer', 'balance', 'reminder'], group: 3 },
  { id: 'tools-features', icon: '🧩', label: 'Features', keywords: ['feature', 'visibility', 'toggle', 'categorization', 'rules', 'tools'], group: 3 },
  { id: 'privacy-security', icon: '🔒', label: 'Privacy', keywords: ['lock', 'pin', 'biometric', 'session', 'data', 'dashboard', 'security'], group: 4 },
  { id: 'data-export', icon: '📤', label: 'Export', keywords: ['export', 'csv', 'pdf', 'sharing', 'reports', 'data'], group: 4 },
]

// ============================================================================
// Hero meaning labels for badge display
// ============================================================================

const HERO_MEANING_LABELS: Record<string, string> = {
  allowance: "Today's budget",
  spent_today: 'Spent today',
  spent_week: 'This week',
  balance: 'Balance',
}

// ============================================================================
// Component
// ============================================================================

export function SettingsScreen(props: SettingsScreenProps) {
  const {
    budgets,
    spendingMode: spendingModeProp,
    heroMeaning: heroMeaningProp,
    onOpenProfile,
    onOpenBudgetSettings,
    onDeleteAccount,
    activeShareCount = 0,
  } = props

  const { theme } = useTheme()
  const { flags } = useFeatureFlags()
  const { prefersReducedMotion } = useReducedMotion()

  // ── Sub-screen navigation ────────────────────────────────────────────
  const [activeSubScreen, setActiveSubScreen] = useState<SettingsCategory | null>(null)

  // ── Focus management (385.2) ─────────────────────────────────────────
  const rowRefs = useRef<Map<SettingsCategory, HTMLDivElement | null>>(new Map())
  const previousSubScreen = useRef<SettingsCategory | null>(null)

  useEffect(() => {
    if (previousSubScreen.current && !activeSubScreen) {
      const rowEl = rowRefs.current.get(previousSubScreen.current)
      if (rowEl) {
        requestAnimationFrame(() => rowEl.focus())
      }
    }
    previousSubScreen.current = activeSubScreen
  }, [activeSubScreen])

  // ── Deep-link support (384.3) ────────────────────────────────────────
  const initialSubScreenHandled = useRef(false)
  useEffect(() => {
    if (props.initialSubScreen && !initialSubScreenHandled.current) {
      initialSubScreenHandled.current = true
      setActiveSubScreen(props.initialSubScreen)
    }
  }, [props.initialSubScreen])

  // ── Search state ─────────────────────────────────────────────────────
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

  // ── Derived values for badges ────────────────────────────────────────
  const spendingMode: SpendingMode = spendingModeProp ?? 'guided'
  const heroMeaning: HeroMeaning = heroMeaningProp ?? 'allowance'
  const { totalMonthly } = computeBudgetSummary(budgets)

  const enabledFeatureCount = useMemo(() => {
    return Object.values(flags).filter(Boolean).length
  }, [flags])

  // ── Badge values ─────────────────────────────────────────────────────
  const getBadge = useCallback((id: SettingsCategory): string | undefined => {
    switch (id) {
      case 'spending-style':
        return SPENDING_MODE_LABELS[spendingMode]?.label ?? 'Guided'
      case 'budget-income':
        return totalMonthly > 0 ? `$${totalMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo` : undefined
      case 'hero-display':
        return HERO_MEANING_LABELS[heroMeaning] ?? undefined
      case 'look-feel': {
        const themeLabel = theme === 'warm' ? 'Warm' : theme === 'dark' ? 'Dark' : 'System'
        return themeLabel
      }
      case 'notifications':
        return 'On'
      case 'tools-features':
        return `${enabledFeatureCount} active`
      case 'data-export':
        return activeShareCount > 0 ? `${activeShareCount} shared` : undefined
      default:
        return undefined
    }
  }, [spendingMode, totalMonthly, heroMeaning, theme, enabledFeatureCount, activeShareCount])

  // ── Filtered rows ────────────────────────────────────────────────────
  const visibleRows = useMemo(() => {
    if (!debouncedSearch) return NAV_ROWS
    return NAV_ROWS.filter(row =>
      row.label.toLowerCase().includes(debouncedSearch) ||
      row.keywords.some(kw => kw.includes(debouncedSearch))
    )
  }, [debouncedSearch])

  // ── Navigation handlers ──────────────────────────────────────────────
  const handleRowPress = useCallback((id: SettingsCategory) => {
    setActiveSubScreen(id)
  }, [])

  const handleBack = useCallback(() => {
    setActiveSubScreen(null)
  }, [])

  // ── Sub-screen lookup map ────────────────────────────────────────────
  const subScreenMap: Record<SettingsCategory, React.ReactNode> = {
    profile: (
      <SettingsProfileScreen
        onBack={handleBack}
        userEmail={props.userEmail}
        displayName={props.displayName}
        avatarUrl={props.avatarUrl}
        handle={props.handle}
        onOpenProfile={onOpenProfile}
        onSignOut={props.onSignOut}
        onResetOnboarding={props.onResetOnboarding}
        onReplayDemos={props.onReplayDemos}
        onOpenBackfill={props.onOpenBackfill}
      />
    ),
    'spending-style': (
      <SettingsSpendingStyleScreen
        onBack={handleBack}
        spendingMode={spendingMode}
        onSetSpendingMode={props.onSetSpendingMode ?? (() => {})}
        overLimitResponse={props.overLimitResponse ?? 'gentle'}
        onSetOverLimitResponse={props.onSetOverLimitResponse ?? (() => {})}
        userGoal={props.userGoal}
        onGoalChange={props.onGoalChange}
      />
    ),
    'budget-income': (
      <SettingsBudgetIncomeScreen
        onBack={handleBack}
        budgets={budgets}
        incomeSmoothing={props.incomeSmoothing}
        onSetIncomeSmoothing={props.onSetIncomeSmoothing}
        countCreditImmediately={props.countCreditImmediately}
        onUpdateCountCreditImmediately={props.onUpdateCountCreditImmediately}
        onOpenBudgetSettings={onOpenBudgetSettings}
        onOpenCategoryHub={props.onOpenCategoryHub}
        termSchedule={props.termSchedule}
        onSetTermSchedule={props.onSetTermSchedule}
        spendDownPlans={props.spendDownPlans}
        onAddSpendDownPlan={props.onAddSpendDownPlan}
        onRemoveSpendDownPlan={props.onRemoveSpendDownPlan}
        disbursements={props.disbursements}
      />
    ),
    'hero-display': (
      <SettingsHeroDisplayScreen
        onBack={handleBack}
        heroMeaning={heroMeaning}
        onSetHeroMeaning={props.onSetHeroMeaning ?? (() => {})}
      />
    ),
    'home-screen': (
      <SettingsHomeExtrasScreen onBack={handleBack} />
    ),
    'look-feel': (
      <SettingsLookFeelScreen onBack={handleBack} />
    ),
    notifications: (
      <SettingsNotificationsScreen onBack={handleBack} />
    ),
    'tools-features': (
      <SettingsToolsFeaturesScreen
        onBack={handleBack}
        onOpenCategorizationRules={props.onOpenCategorizationRules}
      />
    ),
    'privacy-security': (
      <SettingsPrivacySecurityScreen
        onBack={handleBack}
        onOpenPrivacyDashboard={props.onOpenPrivacyDashboard}
      />
    ),
    'data-export': (
      <SettingsDataExportScreen
        onBack={handleBack}
        onExportData={props.onExportData}
        onExportCSV={props.onExportCSV}
        onOpenReports={props.onOpenReports}
        onOpenSharing={props.onOpenSharing}
        activeShareCount={props.activeShareCount}
      />
    ),
  }

  // ── Main render ──────────────────────────────────────────────────────
  return (
    <div
      style={{
        ...contentColumn,
        paddingTop: spacingScale["24"],
        paddingBottom: safeAreaBottom(100),
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Main list content — shifts/fades when sub-screen opens (384.1) */}
      <motion.div
        animate={activeSubScreen ? 'hidden' : 'visible'}
        variants={prefersReducedMotion ? {
          visible: { opacity: 1 },
          hidden: { opacity: 0 },
        } : {
          visible: { opacity: 1, x: 0 },
          hidden: { opacity: 0, x: -20 },
        }}
        transition={prefersReducedMotion ? timings.fast : springs.gentle}
        style={{ pointerEvents: activeSubScreen ? 'none' : 'auto' }}
      >
        <SectionHeader>Settings</SectionHeader>

        {/* Search (370.2) */}
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
        {debouncedSearch && visibleRows.length === 0 && (
          <p style={{ ...typography["body-sm"], color: textColors.sub, textAlign: "center", padding: `${spacingScale["20"]} 0` }}>
            No settings match &ldquo;{searchText.trim()}&rdquo;
          </p>
        )}

        {/* Navigation list (370.1, 370.3, 385.2) */}
        {visibleRows.length > 0 && (
          <nav aria-label="Settings categories">
            <div role="list" style={{ marginTop: spacingScale["8"] }}>
              <SettingsNavList
                rows={visibleRows}
                getBadge={getBadge}
                onRowPress={handleRowPress}
                rowRefs={rowRefs}
              />
            </div>
          </nav>
        )}

        {/* Resume setup (task 392.2) — shown when checklist is dismissed but not complete */}
        {props.showResumeChecklist && props.onResumeChecklist && (
          <button
            type="button"
            onClick={props.onResumeChecklist}
            style={{
              marginTop: spacingScale["16"],
              width: "100%",
              padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
              background: elevations.sunken.fill,
              border: `1px solid ${elevations.resting.border}`,
              borderRadius: radius.control,
              display: "flex",
              alignItems: "center",
              gap: spacingScale["8"],
              cursor: "pointer",
              ...typography["body-sm"],
              color: textColors.text,
              fontWeight: 500,
            }}
            aria-label="Resume setup checklist"
          >
            <span aria-hidden="true">🔄</span>
            <span>Resume setup</span>
          </button>
        )}

        {/* Danger zone */}
        {onDeleteAccount && <SettingsDangerZone onDeleteAccount={onDeleteAccount} />}
      </motion.div>

      {/* Sub-screen overlay (384.1) */}
      <AnimatePresence mode="wait">
        {activeSubScreen && subScreenMap[activeSubScreen]}
      </AnimatePresence>

      {/* Screen reader announcement for sub-screen navigation (385.2) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        {activeSubScreen
          ? `${NAV_ROWS.find(r => r.id === activeSubScreen)?.label ?? 'Settings'} settings opened`
          : ''
        }
      </div>
    </div>
  )
}
