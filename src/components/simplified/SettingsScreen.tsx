"use client"

/**
 * SettingsScreen — Hub-and-spoke navigation list.
 *
 * The main settings screen is now a flat list of ~10 navigation rows. Each row
 * shows an icon, a label, an optional current-value badge, and a chevron.
 * Tapping opens the corresponding sub-screen (or a placeholder for screens
 * not yet built). All inline forms, embedded components, and collapsible logic
 * have been removed from this surface.
 *
 * Search is preserved at the top and filters across all category labels/keywords.
 *
 * Requirements: 20.1, 20.2
 */

import { useState, useMemo, useRef, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import { SectionHeader, ListRow } from "@/components/ui"
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
import { textColors, semanticColors } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { useFeatureFlags } from "@/hooks/useFeatureFlags"
import type { CategorizationRule } from "@/lib/categorizationRules"
import { SettingsSubScreen } from "./SettingsSubScreen"
import { SettingsProfileScreen } from "./SettingsProfileScreen"
import { SettingsSpendingStyleScreen } from "./SettingsSpendingStyleScreen"
import { SettingsBudgetIncomeScreen } from "./SettingsBudgetIncomeScreen"
import { SettingsHeroDisplayScreen } from "./SettingsHeroDisplayScreen"
import { SettingsHomeExtrasScreen } from "./SettingsHomeExtrasScreen"
import { SettingsLookFeelScreen } from "./SettingsLookFeelScreen"
import { SettingsToolsFeaturesScreen } from "./SettingsToolsFeaturesScreen"
import { SettingsNotificationsScreen } from "./SettingsNotificationsScreen"

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
}

// ============================================================================
// Navigation row definitions
// ============================================================================

type SettingsCategory =
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

interface NavRowDef {
  id: SettingsCategory
  icon: string
  label: string
  keywords: string[]
  /** Visual group index — rows in the same group have no gap between them. */
  group: number
}

const NAV_ROWS: NavRowDef[] = [
  { id: 'profile', icon: '👤', label: 'Profile', keywords: ['account', 'handle', 'avatar', 'email', 'sign out'], group: 0 },
  { id: 'spending-style', icon: '🎯', label: 'Spending style', keywords: ['mode', 'tracker', 'guided', 'structured', 'over-limit', 'focus', 'goal'], group: 1 },
  { id: 'budget-income', icon: '💰', label: 'Budget & income', keywords: ['budget', 'limits', 'income', 'categories', 'term', 'smoothing'], group: 1 },
  { id: 'hero-display', icon: '🔢', label: 'What the number shows', keywords: ['hero', 'big number', 'allowance', 'spent', 'balance', 'period'], group: 1 },
  { id: 'home-screen', icon: '🏠', label: 'Home screen', keywords: ['extras', 'pace', 'savings', 'badge', 'cards', 'pin', 'style'], group: 2 },
  { id: 'look-feel', icon: '🎨', label: 'Look & feel', keywords: ['theme', 'warm', 'dark', 'region', 'currency', 'appearance'], group: 2 },
  { id: 'notifications', icon: '🔔', label: 'Notifications', keywords: ['nudge', 'alert', 'buffer', 'balance', 'reminder'], group: 3 },
  { id: 'tools-features', icon: '🧩', label: 'Tools & features', keywords: ['feature', 'visibility', 'toggle', 'categorization', 'rules'], group: 3 },
  { id: 'privacy-security', icon: '🔒', label: 'Privacy & security', keywords: ['lock', 'pin', 'biometric', 'session', 'data', 'dashboard'], group: 4 },
  { id: 'data-export', icon: '📤', label: 'Data & export', keywords: ['export', 'csv', 'pdf', 'sharing', 'reports'], group: 4 },
]

// ============================================================================
// Hero meaning labels for badge display
// ============================================================================

const HERO_MEANING_LABELS: Record<string, string> = {
  allowance: 'Safe to spend',
  spent_today: 'Spent today',
  spent_week: 'Spent this week',
  balance: 'Money on hand',
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

  // ── Sub-screen navigation ────────────────────────────────────────────
  const [activeSubScreen, setActiveSubScreen] = useState<SettingsCategory | null>(null)

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
  const getBadge = (id: SettingsCategory): string | undefined => {
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
  }

  // ── Filtered rows ────────────────────────────────────────────────────
  const visibleRows = useMemo(() => {
    if (!debouncedSearch) return NAV_ROWS
    return NAV_ROWS.filter(row =>
      row.label.toLowerCase().includes(debouncedSearch) ||
      row.keywords.some(kw => kw.includes(debouncedSearch))
    )
  }, [debouncedSearch])

  // ── Row press handler ────────────────────────────────────────────────
  const handleRowPress = (id: SettingsCategory) => {
    switch (id) {
      case 'profile':
        setActiveSubScreen('profile')
        return
      case 'budget-income':
        setActiveSubScreen('budget-income')
        return
      default:
        setActiveSubScreen(id)
    }
  }

  // ── Delete account state ─────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  // ── Render sub-screen placeholder ────────────────────────────────────
  const renderSubScreen = () => {
    if (!activeSubScreen) return null

    // Profile sub-screen — dedicated component
    if (activeSubScreen === 'profile') {
      return (
        <SettingsProfileScreen
          onBack={() => setActiveSubScreen(null)}
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
      )
    }

    // Spending style sub-screen — dedicated component
    if (activeSubScreen === 'spending-style') {
      return (
        <SettingsSpendingStyleScreen
          onBack={() => setActiveSubScreen(null)}
          spendingMode={spendingMode}
          onSetSpendingMode={props.onSetSpendingMode ?? (() => {})}
          overLimitResponse={props.overLimitResponse ?? 'gentle'}
          onSetOverLimitResponse={props.onSetOverLimitResponse ?? (() => {})}
          userGoal={props.userGoal}
          onGoalChange={props.onGoalChange}
        />
      )
    }

    // Hero display sub-screen — dedicated component
    if (activeSubScreen === 'hero-display') {
      return (
        <SettingsHeroDisplayScreen
          onBack={() => setActiveSubScreen(null)}
          heroMeaning={heroMeaning}
          onSetHeroMeaning={props.onSetHeroMeaning ?? (() => {})}
        />
      )
    }

    // Home screen extras sub-screen — dedicated component
    if (activeSubScreen === 'home-screen') {
      return (
        <SettingsHomeExtrasScreen
          onBack={() => setActiveSubScreen(null)}
        />
      )
    }

    // Look & feel sub-screen — dedicated component
    if (activeSubScreen === 'look-feel') {
      return (
        <SettingsLookFeelScreen
          onBack={() => setActiveSubScreen(null)}
        />
      )
    }

    // Budget & income sub-screen — dedicated component
    if (activeSubScreen === 'budget-income') {
      return (
        <SettingsBudgetIncomeScreen
          onBack={() => setActiveSubScreen(null)}
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
      )
    }

    // Tools & features sub-screen — dedicated component
    if (activeSubScreen === 'tools-features') {
      return (
        <SettingsToolsFeaturesScreen
          onBack={() => setActiveSubScreen(null)}
          onOpenCategorizationRules={props.onOpenCategorizationRules}
        />
      )
    }

    // Notifications sub-screen — dedicated component
    if (activeSubScreen === 'notifications') {
      return (
        <SettingsNotificationsScreen
          onBack={() => setActiveSubScreen(null)}
        />
      )
    }

    const row = NAV_ROWS.find(r => r.id === activeSubScreen)
    const title = row?.label ?? 'Settings'

    return (
      <SettingsSubScreen title={title} onBack={() => setActiveSubScreen(null)}>
        <p style={{ ...typography['body-sm'], color: textColors.sub, textAlign: 'center', paddingTop: spacingScale['40'] }}>
          This screen is coming soon.
        </p>
      </SettingsSubScreen>
    )
  }

  // ── Group rendering helper ───────────────────────────────────────────
  const renderNavList = () => {
    const elements: React.ReactNode[] = []
    let lastGroup: number | null = null

    visibleRows.forEach((row) => {
      // Insert spacing gap between groups
      if (lastGroup !== null && row.group !== lastGroup) {
        elements.push(
          <div key={`gap-${row.id}`} style={{ height: spacingScale["16"] }} />
        )
      }
      lastGroup = row.group

      const badge = getBadge(row.id)

      elements.push(
        <ListRow
          key={row.id}
          variant="dense"
          onPress={() => handleRowPress(row.id)}
          aria-label={`Open ${row.label} settings`}
          style={{
            minHeight: '58px',
            paddingLeft: spacingScale["20"],
            paddingRight: spacingScale["16"],
            background: 'transparent',
            border: 'none',
            borderRadius: 0,
          }}
        >
          {/* Icon */}
          <span
            aria-hidden="true"
            style={{
              fontSize: '20px',
              lineHeight: 1,
              width: '28px',
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            {row.icon}
          </span>

          {/* Label + badge */}
          <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: spacingScale["8"] }}>
            <span style={{ ...typography.body, color: textColors.text }}>
              {row.label}
            </span>
            {badge && (
              <span style={{ ...typography.caption, color: textColors.muted }}>
                {badge}
              </span>
            )}
          </span>

          {/* Chevron */}
          <span
            aria-hidden="true"
            style={{
              ...typography.body,
              color: textColors.muted,
              flexShrink: 0,
            }}
          >
            ›
          </span>
        </ListRow>
      )
    })

    return elements
  }

  // ── Main render ──────────────────────────────────────────────────────
  return (
    <div
      style={{
        ...contentColumn,
        paddingTop: spacingScale["24"],
        paddingBottom: safeAreaBottom(100),
        position: 'relative',
      }}
    >
      {/* Screen title */}
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

      {/* Navigation list (370.1, 370.3) */}
      {visibleRows.length > 0 && (
        <div style={{ marginTop: spacingScale["8"] }}>
          {renderNavList()}
        </div>
      )}

      {/* Danger zone — always visible at the bottom */}
      {onDeleteAccount && (
        <div style={{ marginTop: spacingScale["32"] }}>
          <div
            style={{
              paddingLeft: spacingScale["20"],
              paddingRight: spacingScale["16"],
            }}
          >
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  background: "none",
                  border: "none",
                  ...typography["body-sm"],
                  color: semanticColors.error,
                  cursor: "pointer",
                  padding: `${spacingScale["12"]} 0`,
                }}
                aria-label="Delete account"
              >
                Delete account
              </button>
            ) : (
              <div style={{
                padding: spacingScale["16"],
                borderRadius: radius.control,
                background: elevations.sunken.fill,
                border: `1px solid ${semanticColors.error}`,
              }}>
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
                    border: `1px solid ${semanticColors.error}`,
                    borderRadius: radius.control,
                    outline: "none",
                  }}
                  aria-label="Type DELETE to confirm"
                />
                <div style={{ display: "flex", gap: spacingScale["8"] }}>
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); onDeleteAccount() }}
                    disabled={deleteConfirmText !== "DELETE"}
                    style={{
                      padding: `${spacingScale["8"]} ${spacingScale["16"]}`,
                      borderRadius: radius.control,
                      background: deleteConfirmText === "DELETE" ? semanticColors.error : elevations.sunken.fill,
                      border: "none",
                      color: textColors.text,
                      ...typography["body-sm"],
                      cursor: deleteConfirmText === "DELETE" ? "pointer" : "not-allowed",
                      opacity: deleteConfirmText === "DELETE" ? 1 : 0.4,
                    }}
                    aria-label="Confirm delete account"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText("") }}
                    style={{
                      background: "none",
                      border: "none",
                      ...typography["body-sm"],
                      color: textColors.muted,
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label="Cancel delete"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-screen overlay */}
      <AnimatePresence>
        {activeSubScreen && renderSubScreen()}
      </AnimatePresence>
    </div>
  )
}
