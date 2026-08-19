"use client"

/**
 * ToolsScreen — Rebuilt with unified primitives from Component_Library.
 *
 * All section headings use SectionHeader (Typography_System headline tier).
 * All entries use ListRow (dense variant for compact density).
 * Layout uses contentColumn from Layout_System.
 * Zero local font-size/weight/color/spacing overrides.
 * Sections are grouped with ≤7 entries each (Req 10.4).
 * At most one accent fill per viewport; all remaining from neutral tokens.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 10.4
 */

import { useMemo, useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { layoutTransition, MAX_STAGGER_ITEMS, useReducedMotion } from "@/lib/animations"
import { getPeerContextEnabled, setPeerContextEnabled } from "@/lib/uiPreferences"
import { recordToolUsage, getRecentlyUsedTools, hasSectionBeenUsed } from "@/lib/toolUsageTracker"
import { SectionHeader, ListRow, Card } from "@/components/ui"
import { Icon } from "@/components/ui/Icon"
import type { IconName } from "@/lib/icons"
import { useRovingTabindex } from "@/hooks/useRovingTabindex"
import { contentColumn, spacingScale, CONTENT_MAX_WIDTH, HORIZONTAL_PADDING } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { safeAreaBottom } from "@/styles/layout"
import { SourceBalancesView } from "./SourceBalancesView"
import { ObligationsSummary } from "./ObligationsSummary"
import { SharedActivityView } from "./SharedActivityView"
import { RoundUpSetting } from "./RoundUpSetting"
import { AutoSaveSetting } from "./AutoSaveSetting"
import { computeNetObligations } from "@/lib/obligationsUtils"
import { useFeatureFlags } from "@/hooks/useFeatureFlags"
import type { FeatureFlags } from "@/lib/featureFlags"
import type { FundingSource } from "@/lib/fundingSources"
import type { Transaction, Goal, Budget } from "@/types"
import type { Debt, SavingsAccount } from "@/types/folio"
import type { Reimbursement } from "@/lib/reimbursements"
import {
  isChallengesActive,
} from "@/lib/gamificationPreferences"

// ============================================================================
// Types
// ============================================================================

export interface ToolsScreenProps {
  onOpenCompoundGrowth?: () => void
  onOpenCreditPayoff?: () => void
  onOpenSubscriptions?: () => void
  onOpenSinkingFunds?: () => void
  onOpenLearn?: () => void
  onOpenDebt?: () => void
  onOpenReimbursements?: () => void
  onOpenTrajectory?: () => void
  onOpenCashFlowForecast?: () => void
  /** Open the wish list screen (task 352.1) */
  onOpenWishList?: () => void
  /** Open the income trends screen (task 355) */
  onOpenIncomeTrends?: () => void
  /** Open the bank statement import screen (task 362) */
  onOpenStatementImport?: () => void
  /** Open the confidence score screen (task 365) */
  onOpenConfidence?: () => void
  /** Trigger a celebration event (task 432.2) */
  onCelebrate?: (event: import('@/types/folio').CelebrationEvent) => void
  onOpenYearInReview?: () => void
  onOpenTermReview?: () => void
  /** Open the opt-in "typical for a student" peer context (task 186.1) */
  onOpenPeerContext?: () => void
  // ── Merged screen handlers (task 489) ──
  /** Open the merged Recurring screen (bills + patterns) */
  onOpenRecurring?: () => void
  /** Open the merged Savings screen (projections + manage + allocation) */
  onOpenSavings?: () => void
  /** Open the merged Shared screen (pools + budgets + invite) */
  onOpenShared?: () => void
  /** Open the merged Progress & Milestones screen */
  onOpenProgressMilestones?: () => void
  /** Open the challenges screen (task 491) */
  onOpenChallenges?: () => void
  /** Open the weekly insights screen (task 492.3) */
  onOpenWeeklyInsights?: () => void
  /** Display-only: total set-aside amount this month */
  totalSetAside?: number
  /** Display-only: savings rate percentage */
  savingsRate?: number
  /** Funding sources for the "Where my money is" balance view */
  fundingSources?: FundingSource[]
  /** Transactions for computing per-source balances */
  transactions?: Transaction[]
  /** Debts for net obligations summary */
  debts?: Debt[]
  /** Reimbursements (IOUs) for net obligations summary */
  reimbursements?: Reimbursement[]
  /** User's goals — for savings automation settings */
  goals?: Goal[]
  /** User's budgets — for auto-earmark computation */
  budgets?: Budget[]
  /** Contribute to a goal (auto-sweep uses this) */
  contributeToGoal?: (goalId: string, amount: number) => Promise<unknown>
  /** User's daily budget/allowance amount — for insights feed */
  dailyBudget?: number
  /** Savings accounts — for gating advanced investment tools (task 490.2) */
  savingsAccounts?: SavingsAccount[]
}

// ============================================================================
// Tool definitions
// ============================================================================

interface ToolItem {
  id: string
  iconName: IconName
  title: string
  description: string
  onOpen?: () => void
}

// ============================================================================
// Section definitions (≤7 entries per section — Req 10.4)
// ============================================================================

interface ToolSection {
  id: string
  label: string
  toolIds: string[]
}

const SECTIONS: ToolSection[] = [
  {
    id: "money-map",
    label: "Money Map",
    toolIds: ["trajectory", "cash-flow-forecast"],
  },
  {
    id: "bills-subscriptions",
    label: "Bills & Subscriptions",
    toolIds: ["recurring", "subscriptions"],
  },
  {
    id: "saving-planning",
    label: "Saving & Planning",
    toolIds: ["savings", "sinking-funds", "wish-list"],
  },
  {
    id: "people-splits",
    label: "People & Splits",
    toolIds: ["reimbursements", "shared"],
  },
  {
    id: "debt",
    label: "Debt",
    toolIds: ["debt", "credit-payoff"],
  },
  {
    id: "insights-reviews",
    label: "Insights & Reviews",
    toolIds: ["weekly-insights", "income-trends", "term-review", "year-in-review", "peer-context", "confidence", "statement-import"],
  },
  {
    id: "learn-grow",
    label: "Learn & Grow",
    toolIds: ["learn", "progress-milestones", "challenges"],
  },
  {
    id: "calculators",
    label: "Calculators",
    toolIds: ["compound-growth"],
  },
]

// ============================================================================
// ToolSectionList — applies roving tabindex to a section's tool items
// ============================================================================

interface ToolSectionListProps {
  tools: ToolItem[]
  listContainer: import("framer-motion").Variants
  listItem: import("framer-motion").Variants
  prefersReducedMotion: boolean
}

function ToolSectionList({ tools, listContainer, listItem, prefersReducedMotion }: ToolSectionListProps) {
  const { getItemProps } = useRovingTabindex({
    itemCount: tools.length,
    orientation: "vertical",
  })

  return (
    <motion.div
      variants={listContainer}
      initial="hidden"
      animate="visible"
      role="group"
      style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}
    >
      {tools.map((tool, toolIdx) => {
        const rovingProps = getItemProps(toolIdx)
        return (
          <motion.div
            key={tool.id}
            variants={listItem}
            custom={Math.min(toolIdx, MAX_STAGGER_ITEMS)}
            layout={!prefersReducedMotion ? "position" : false}
            layoutId={`tool-${tool.id}`}
            transition={layoutTransition}
          >
            <ListRow
              ref={rovingProps.ref as React.Ref<HTMLDivElement>}
              variant="dense"
              onPress={tool.onOpen}
              tabIndex={rovingProps.tabIndex}
              onKeyDown={rovingProps.onKeyDown as (e: React.KeyboardEvent<HTMLDivElement>) => void}
              aria-label={tool.title}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: spacingScale["40"],
                  height: spacingScale["40"],
                  flexShrink: 0,
                  borderRadius: radius.control,
                  background: colorRamp.accent[50],
                  color: textColors.text,
                }}
              >
                <Icon name={tool.iconName} size={20} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["2"] }}>
                  {tool.title}
                </p>
                <p style={{ ...typography["body-sm"], color: textColors.sub }}>
                  {tool.description}
                </p>
              </div>
              {tool.onOpen && (
                <span style={{ color: textColors.muted, flexShrink: 0, display: "inline-flex" }}>
                  <Icon name="action:forward" size={16} />
                </span>
              )}
            </ListRow>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

// ============================================================================
// ToolsScreen Component
// ============================================================================

export function ToolsScreen({
  onOpenCompoundGrowth,
  onOpenCreditPayoff,
  onOpenSubscriptions,
  onOpenSinkingFunds,
  onOpenLearn,
  onOpenDebt,
  onOpenReimbursements,
  onOpenTrajectory,
  onOpenCashFlowForecast,
  onOpenWishList,
  onOpenIncomeTrends,
  onOpenStatementImport,
  onOpenConfidence,
  onCelebrate,
  onOpenYearInReview,
  onOpenTermReview,
  onOpenPeerContext,
  // Merged screen handlers (task 489)
  onOpenRecurring,
  onOpenSavings,
  onOpenShared,
  onOpenProgressMilestones,
  onOpenChallenges,
  onOpenWeeklyInsights,
  totalSetAside,
  savingsRate,
  fundingSources,
  transactions,
  debts,
  reimbursements,
  goals,
  budgets,
  contributeToGoal,
  dailyBudget,
  savingsAccounts,
}: ToolsScreenProps) {
  const { flags } = useFeatureFlags()
  const { listContainer, listItem, prefersReducedMotion } = useReducedMotion()

  // Peer context is opt-in and OFF by default
  const [peerContextEnabled, setPeerContextEnabledState] = useState(false)
  useEffect(() => {
    setPeerContextEnabledState(getPeerContextEnabled())
  }, [])

  // ── Task 490.1: "Start Here" curated view for new users ────────────────
  // A user is "new" if all their transactions are within the last 14 days (or none exist).
  const isNewUser = useMemo(() => {
    if (!transactions || transactions.length === 0) return true
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
    const earliestTxDate = Math.min(...transactions.map((t) => new Date(t.date).getTime()))
    return earliestTxDate >= fourteenDaysAgo
  }, [transactions])

  const START_HERE_STORAGE_KEY = 'folio-show-all-tools'
  const [showAllTools, setShowAllTools] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(START_HERE_STORAGE_KEY)
      if (stored === 'true') setShowAllTools(true)
    } catch { /* localStorage unavailable */ }
  }, [])

  const handleToggleShowAll = useCallback(() => {
    setShowAllTools((prev) => {
      const next = !prev
      try { localStorage.setItem(START_HERE_STORAGE_KEY, String(next)) } catch { /* */ }
      return next
    })
  }, [])

  /** The curated tool IDs for the "Start Here" view */
  const START_HERE_TOOL_IDS = ['recurring', 'learn', 'subscriptions']

  // Whether to show the curated view (new user who hasn't toggled "show all")
  const showCuratedView = isNewUser && !showAllTools
  // Map tool IDs to feature flag keys
  const toolFlagMap: Record<string, keyof FeatureFlags> = {
    "trajectory": "financialTrajectory",
    "debt": "debtTracking",
    "recurring": "recurringBills",
    "reimbursements": "reimbursements",
    "sinking-funds": "sinkingFunds",
    "subscriptions": "subscriptionAudit",
    "savings": "savingsProjections",
    "cash-flow-forecast": "cashFlowForecast",
    "compound-growth": "compoundGrowthCalculator",
    "credit-payoff": "creditPayoffCalculator",
    "learn": "lessons",
    "shared": "householdPool",
  }

  // Compute net obligations
  const obligations = useMemo(
    () => computeNetObligations(
      debts ?? [],
      reimbursements ?? [],
      transactions ?? [],
      fundingSources ?? []
    ),
    [debts, reimbursements, transactions, fundingSources]
  )

  const allTools: ToolItem[] = [
    { id: "trajectory", iconName: "tool:trajectory", title: "Financial Trajectory", description: "See how your money habits are trending.", onOpen: onOpenTrajectory },
    { id: "debt", iconName: "tool:debt", title: "Debt Tracking", description: "Track balances, APRs, and payoff timelines.", onOpen: onOpenDebt },
    // Merged: Recurring (task 489.1) — replaces individual recurring-bills + recurrence-management
    { id: "recurring", iconName: "tool:recurring-bills", title: "Recurring", description: "Bills and auto-detected patterns in one place.", onOpen: onOpenRecurring },
    { id: "reimbursements", iconName: "tool:reimbursements", title: "IOUs & Reimbursements", description: "Track money friends owe you — or that you owe them.", onOpen: onOpenReimbursements },
    { id: "sinking-funds", iconName: "tool:sinking-funds", title: "Sinking Funds", description: "Save gradually for predictable large expenses.", onOpen: onOpenSinkingFunds },
    { id: "subscriptions", iconName: "tool:subscriptions", title: "Subscriptions", description: "Review and manage recurring charges.", onOpen: onOpenSubscriptions },
    // Merged: Shared (task 489.4) — replaces individual household-pool + invite-roommate + shared-budgets
    { id: "shared", iconName: "tool:household-pool", title: "Shared", description: "Pools, budgets, and invites — all shared money.", onOpen: onOpenShared },
    // Merged: Savings (task 489.3) — replaces individual savings-projections + manage-savings + portfolio-allocation
    { id: "savings", iconName: "tool:savings-projections", title: "Savings", description: "Projections, accounts, and allocation in one view.", onOpen: onOpenSavings },
    { id: "wish-list", iconName: "tool:wish-list", title: "Wish List", description: "Track what you want and see when you can afford it.", onOpen: onOpenWishList },
    { id: "cash-flow-forecast", iconName: "tool:cash-flow-forecast", title: "Cash Flow Forecast", description: "See projected balance through next payday.", onOpen: onOpenCashFlowForecast },
    { id: "compound-growth", iconName: "tool:compound-growth", title: "Compound Growth", description: "See how savings grow with compound interest.", onOpen: onOpenCompoundGrowth },
    { id: "credit-payoff", iconName: "tool:credit-payoff", title: "Credit Payoff", description: "Plan how to pay off credit card debt faster.", onOpen: onOpenCreditPayoff },
    { id: "term-review", iconName: "tool:term-review", title: "Term / Year in Review", description: "A warm recap of your wins — by term or year.", onOpen: onOpenTermReview },
    { id: "year-in-review", iconName: "tool:year-in-review", title: "Year in Review", description: "A once-a-year look back at your streaks and savings.", onOpen: onOpenYearInReview },
    { id: "peer-context", iconName: "tool:peer-context", title: "How You Compare", description: "Optional anonymized context against student ranges.", onOpen: onOpenPeerContext },
    { id: "learn", iconName: "tool:learn", title: "Lessons", description: "Short lessons on budgeting, saving, and investing.", onOpen: onOpenLearn },
    { id: "income-trends", iconName: "tool:income-trends", title: "Income Trends", description: "See how your earnings grow over time.", onOpen: onOpenIncomeTrends },
    { id: "statement-import", iconName: "tool:income-trends", title: "Import Statement", description: "Import transactions from a bank CSV.", onOpen: onOpenStatementImport },
    { id: "confidence", iconName: "tool:confidence", title: "Money Confidence", description: "A gentle journal of your financial habits.", onOpen: onOpenConfidence },
    { id: "weekly-insights", iconName: "tool:income-trends", title: "Weekly Insights", description: "Bite-sized spending patterns and tips each week.", onOpen: onOpenWeeklyInsights },
    // Merged: Progress & Milestones (task 489.5) — replaces individual milestones + activity-heatmap + progress-garden
    { id: "progress-milestones", iconName: "tip:goal", title: "Progress & Milestones", description: "Achievements, heatmap, and garden in one view.", onOpen: onOpenProgressMilestones },
    { id: "challenges", iconName: "tip:goal", title: "Challenges", description: "Fun weekly challenges to build better habits.", onOpen: onOpenChallenges },
  ]

  const isToolVisible = (toolId: string): boolean => {
    // Task 490.3: Peer context no longer appears as a standalone tool entry.
    // It only surfaces via the inline toggle in the Reviews section header.
    if (toolId === "peer-context") return false
    // Task 491: year-in-review is combined into term-review as a single entry
    if (toolId === "year-in-review") return false
    // Gamification tools respect per-feature toggles (Req 25.5)
    if (toolId === "challenges") return isChallengesActive()
    // Show merged entries only when their handler is provided
    if (toolId === "recurring" && !onOpenRecurring) return false
    if (toolId === "savings" && !onOpenSavings) return false
    if (toolId === "shared" && !onOpenShared) return false
    if (toolId === "progress-milestones" && !onOpenProgressMilestones) return false
    const flagKey = toolFlagMap[toolId]
    if (!flagKey) return true
    return flags[flagKey]
  }

  const getVisibleToolsForSection = (section: ToolSection): ToolItem[] => {
    return allTools.filter(
      (tool) => section.toolIds.includes(tool.id) && isToolVisible(tool.id)
    )
  }

  const hasSourceBalances =
    fundingSources != null && fundingSources.length > 0 && transactions != null

  const visibleSections = SECTIONS.filter((section) => {
    const visibleTools = getVisibleToolsForSection(section)
    if (section.id === "money-map") return visibleTools.length > 0 || hasSourceBalances
    if (section.id === "people-splits") return visibleTools.length > 0
    return visibleTools.length > 0
  })

  // ── Smart Collapse: default expand/collapse per section (Task 488.2) ──
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  // Initialize expanded state based on usage history (client-side only)
  useEffect(() => {
    const initialState: Record<string, boolean> = {}
    for (const section of SECTIONS) {
      const visibleToolIds = allTools
        .filter((t) => section.toolIds.includes(t.id) && isToolVisible(t.id))
        .map((t) => t.id)
      // Sections with at least one used tool default to expanded
      initialState[section.id] = hasSectionBeenUsed(visibleToolIds)
    }
    setExpandedSections(initialState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }, [])

  // ── Recently Used (Task 488.3) ────────────────────────────────────────
  const [recentToolIds, setRecentToolIds] = useState<string[]>([])

  useEffect(() => {
    const allVisibleIds = allTools.filter((t) => isToolVisible(t.id)).map((t) => t.id)
    setRecentToolIds(getRecentlyUsedTools(allVisibleIds, 4))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recentTools = useMemo(
    () => recentToolIds.map((id) => allTools.find((t) => t.id === id)).filter(Boolean) as ToolItem[],
    [recentToolIds, allTools]
  )

  // ── Wrap onOpen to record usage (Task 488.1) ──────────────────────────
  const wrapOnOpen = useCallback((tool: ToolItem): ToolItem => {
    if (!tool.onOpen) return tool
    return {
      ...tool,
      onOpen: () => {
        recordToolUsage(tool.id)
        tool.onOpen!()
      },
    }
  }, [])

  // ── Task 490.3: Inline peer-context toggle handler ─────────────────────
  const handlePeerContextToggle = useCallback(() => {
    const next = !peerContextEnabled
    setPeerContextEnabledState(next)
    setPeerContextEnabled(next)
  }, [peerContextEnabled])

  return (
    <div
      style={{
        ...contentColumn,
        paddingTop: spacingScale["24"],
        paddingBottom: safeAreaBottom(100),
      }}
    >
      {/* ── Screen Title ─────────────────────────────────────────────── */}
      <h1 style={{ ...typography.headline, color: textColors.text, margin: 0, paddingBottom: spacingScale["8"] }}>Tools</h1>
      <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["32"] }}>
        Advanced features, calculators, and tracking tools.
      </p>

      {/* ── Stat cards removed (task 491.3): savings rate is in HeroContextRow,
           "Set aside this month" is now inline in the Saving & Planning section ─── */}

      {/* ── Recently Used (Task 488.3) ────────────────────────────── */}
      {!showCuratedView && recentTools.length > 0 && (
        <div style={{ marginBottom: spacingScale["32"] }}>
          <SectionHeader>Recently Used</SectionHeader>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: spacingScale["8"],
            }}
          >
            {recentTools.map((tool) => {
              const wrapped = wrapOnOpen(tool)
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={wrapped.onOpen}
                  aria-label={tool.title}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: spacingScale["6"],
                    padding: `${spacingScale["12"]} ${spacingScale["8"]}`,
                    background: colorRamp.accent[50],
                    border: `1px solid ${colorRamp.accent[200]}`,
                    borderRadius: radius.control,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <span style={{ color: textColors.text, display: "inline-flex" }}>
                    <Icon name={tool.iconName} size={20} />
                  </span>
                  <span style={{ ...typography.caption, color: textColors.text }}>
                    {tool.title}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Task 490.1: Start Here curated view for new users ──────── */}
      {showCuratedView && (
        <div style={{ marginBottom: spacingScale["32"] }}>
          <SectionHeader>Start Here</SectionHeader>
          <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["16"] }}>
            These three tools will help you get started with budgeting.
          </p>
          <ToolSectionList
            tools={allTools
              .filter((t) => START_HERE_TOOL_IDS.includes(t.id) && isToolVisible(t.id))
              .map(wrapOnOpen)}
            listContainer={listContainer}
            listItem={listItem}
            prefersReducedMotion={prefersReducedMotion}
          />
          <button
            type="button"
            onClick={handleToggleShowAll}
            style={{
              ...typography.body,
              color: colorRamp.accent[400],
              background: "none",
              border: "none",
              padding: `${spacingScale["12"]} 0`,
              cursor: "pointer",
              marginTop: spacingScale["16"],
            }}
          >
            See all tools →
          </button>
        </div>
      )}

      {/* ── Grouped Sections (shown when NOT in curated view) ─────── */}
      {!showCuratedView && (
        <motion.div variants={listContainer} initial="hidden" animate="visible">
        {visibleSections.map((section, sectionIdx) => {
          const sectionTools = getVisibleToolsForSection(section).map(wrapOnOpen)
          const isExpanded = expandedSections[section.id] ?? false

          return (
            <motion.div
              key={section.id}
              variants={listItem}
              custom={sectionIdx}
              style={{ marginBottom: spacingScale["32"] }}
            >
              {/* Collapsible section header */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isExpanded}
                aria-controls={`section-${section.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacingScale["8"],
                  width: "100%",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  marginBottom: isExpanded ? undefined : 0,
                }}
              >
                <SectionHeader style={{ flex: 1, marginBottom: 0 }}>
                  {section.label}
                  {!isExpanded && (
                    <span
                      style={{
                        ...typography.caption,
                        color: textColors.muted,
                        marginLeft: spacingScale["6"],
                        fontWeight: 400,
                        textTransform: "none",
                        letterSpacing: "normal",
                      }}
                    >
                      ({sectionTools.length})
                    </span>
                  )}
                </SectionHeader>
                <span
                  style={{
                    color: textColors.muted,
                    display: "inline-flex",
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 200ms ease",
                  }}
                >
                  <Icon name="action:forward" size={14} />
                </span>
              </button>

              {/* Expandable content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    id={`section-${section.id}`}
                    initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    {/* Money Map inline widget */}
                    {section.id === "money-map" && hasSourceBalances && (
                      <div style={{ marginBottom: sectionTools.length > 0 ? spacingScale["12"] : 0 }}>
                        <SourceBalancesView
                          fundingSources={fundingSources!}
                          transactions={transactions!}
                        />
                      </div>
                    )}

                    {/* People & Splits: Obligations summary + shared activity */}
                    {section.id === "people-splits" && (
                      <div style={{ marginBottom: sectionTools.length > 0 ? spacingScale["12"] : 0 }}>
                        <ObligationsSummary obligations={obligations} />
                      </div>
                    )}

                    {section.id === "people-splits" && (
                      <SharedActivityView />
                    )}

                    {/* Saving & Planning: "Set aside this month" inline stat (task 491.3) */}
                    {section.id === "saving-planning" && (totalSetAside ?? 0) > 0 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: `${spacingScale["8"]} 0`,
                          marginBottom: spacingScale["12"],
                        }}
                      >
                        <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0 }}>
                          Set aside this month
                        </p>
                        <p style={{ ...typography.subhead, color: textColors.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                          ${Math.round(totalSetAside ?? 0).toLocaleString("en-US")}
                        </p>
                      </div>
                    )}

                    {/* Task 490.3: Inline peer-context toggle in Insights & Reviews section */}
                    {section.id === "insights-reviews" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: `${spacingScale["8"]} 0`,
                          marginBottom: spacingScale["8"],
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ ...typography["body-sm"], color: textColors.text, margin: 0 }}>
                            Show &ldquo;How You Compare&rdquo;
                          </p>
                          <p style={{ ...typography.caption, color: textColors.muted, margin: 0 }}>
                            Encouraging, anonymized peer context
                          </p>
                        </div>
                        <label
                          style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer" }}
                        >
                          <input
                            type="checkbox"
                            checked={peerContextEnabled}
                            onChange={handlePeerContextToggle}
                            aria-label="Enable peer context comparisons"
                            style={{
                              width: 40,
                              height: 22,
                              appearance: "none",
                              WebkitAppearance: "none",
                              background: peerContextEnabled ? colorRamp.accent[400] : colorRamp.accent[100],
                              borderRadius: 11,
                              position: "relative",
                              cursor: "pointer",
                              transition: "background 200ms ease",
                              border: "none",
                              outline: "none",
                            }}
                          />
                          <span
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              top: 3,
                              left: peerContextEnabled ? 21 : 3,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "#fff",
                              transition: "left 200ms ease",
                              pointerEvents: "none",
                            }}
                          />
                        </label>
                      </div>
                    )}

                    {/* Peer context tool (shown only when enabled via toggle above) */}
                    {section.id === "insights-reviews" && peerContextEnabled && onOpenPeerContext && (
                      <div style={{ marginBottom: spacingScale["8"] }}>
                        <ToolSectionList
                          tools={[wrapOnOpen(allTools.find((t) => t.id === "peer-context")!)]}
                          listContainer={listContainer}
                          listItem={listItem}
                          prefersReducedMotion={prefersReducedMotion}
                        />
                      </div>
                    )}

                    {/* Tool entries — roving tabindex per section (Req 27.2) */}
                    {sectionTools.length > 0 && (
                      <ToolSectionList
                        tools={sectionTools}
                        listContainer={listContainer}
                        listItem={listItem}
                        prefersReducedMotion={prefersReducedMotion}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </motion.div>
      )}

      {/* ── Savings Automation ─────────────────────────────────────────── */}
      <div style={{ marginTop: spacingScale["32"] }}>
        <SectionHeader>Savings Automation</SectionHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["12"] }}>
          <RoundUpSetting transactions={transactions} goals={goals} />
          <AutoSaveSetting
            transactions={transactions}
            budgets={budgets}
            goals={goals}
            contributeToGoal={contributeToGoal}
          />
        </div>
      </div>

    </div>
  )
}
