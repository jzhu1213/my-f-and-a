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

import { useMemo, useState, useEffect } from "react"
import { motion } from "framer-motion"
import { layoutTransition, MAX_STAGGER_ITEMS, useReducedMotion } from "@/lib/animations"
import { getPeerContextEnabled } from "@/lib/uiPreferences"
import { SectionHeader, ListRow, Card } from "@/components/ui"
import { Icon } from "@/components/ui/Icon"
import type { IconName } from "@/lib/icons"
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
import type { Debt } from "@/types/folio"
import type { Reimbursement } from "@/lib/reimbursements"

// ============================================================================
// Types
// ============================================================================

export interface ToolsScreenProps {
  onOpenCompoundGrowth?: () => void
  onOpenCreditPayoff?: () => void
  onOpenSubscriptions?: () => void
  onOpenCancelNegotiate?: () => void
  onOpenSinkingFunds?: () => void
  onOpenLearn?: () => void
  onOpenSavingsProjections?: () => void
  onOpenManageSavings?: () => void
  onOpenDebt?: () => void
  onOpenRecurringBills?: () => void
  onOpenReimbursements?: () => void
  onOpenTrajectory?: () => void
  onOpenCashFlowForecast?: () => void
  onOpenHouseholdPool?: () => void
  /** Open the warm invite-a-roommate flow (task 201.1) */
  onOpenInviteRoommate?: () => void
  /** Open the wish list screen (task 352.1) */
  onOpenWishList?: () => void
  /** Open the income trends screen (task 355) */
  onOpenIncomeTrends?: () => void
  onOpenPortfolioAllocation?: () => void
  onOpenInvestmentExplorer?: () => void
  onOpenYearInReview?: () => void
  onOpenTermReview?: () => void
  /** Open the opt-in "typical for a student" peer context (task 186.1) */
  onOpenPeerContext?: () => void
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
    toolIds: ["trajectory"],
  },
  {
    id: "obligations",
    label: "Obligations",
    toolIds: ["debt", "recurring-bills", "reimbursements", "subscriptions", "cancel-negotiate", "household-pool", "invite-roommate"],
  },
  {
    id: "planning",
    label: "Planning & Savings",
    toolIds: ["sinking-funds", "wish-list", "savings-projections", "manage-savings", "portfolio-allocation", "investment-explorer", "cash-flow-forecast"],
  },
  {
    id: "calculators",
    label: "Calculators",
    toolIds: ["compound-growth", "credit-payoff"],
  },
  {
    id: "reviews",
    label: "Reviews",
    toolIds: ["income-trends", "term-review", "year-in-review", "peer-context"],
  },
  {
    id: "learn",
    label: "Learn",
    toolIds: ["learn"],
  },
]

// ============================================================================
// ToolsScreen Component
// ============================================================================

export function ToolsScreen({
  onOpenCompoundGrowth,
  onOpenCreditPayoff,
  onOpenSubscriptions,
  onOpenCancelNegotiate,
  onOpenSinkingFunds,
  onOpenLearn,
  onOpenSavingsProjections,
  onOpenManageSavings,
  onOpenDebt,
  onOpenRecurringBills,
  onOpenReimbursements,
  onOpenTrajectory,
  onOpenCashFlowForecast,
  onOpenHouseholdPool,
  onOpenInviteRoommate,
  onOpenWishList,
  onOpenIncomeTrends,
  onOpenPortfolioAllocation,
  onOpenInvestmentExplorer,
  onOpenYearInReview,
  onOpenTermReview,
  onOpenPeerContext,
  totalSetAside,
  savingsRate,
  fundingSources,
  transactions,
  debts,
  reimbursements,
  goals,
  budgets,
  contributeToGoal,
}: ToolsScreenProps) {
  const { flags } = useFeatureFlags()
  const { listContainer, listItem, prefersReducedMotion } = useReducedMotion()

  // Peer context is opt-in and OFF by default
  const [peerContextEnabled, setPeerContextEnabled] = useState(false)
  useEffect(() => {
    setPeerContextEnabled(getPeerContextEnabled())
  }, [])

  // Map tool IDs to feature flag keys
  const toolFlagMap: Record<string, keyof FeatureFlags> = {
    "trajectory": "financialTrajectory",
    "debt": "debtTracking",
    "recurring-bills": "recurringBills",
    "reimbursements": "reimbursements",
    "sinking-funds": "sinkingFunds",
    "subscriptions": "subscriptionAudit",
    "cancel-negotiate": "subscriptionAudit",
    "savings-projections": "savingsProjections",
    "manage-savings": "savingsProjections",
    "portfolio-allocation": "savingsProjections",
    "investment-explorer": "savingsProjections",
    "cash-flow-forecast": "cashFlowForecast",
    "compound-growth": "compoundGrowthCalculator",
    "credit-payoff": "creditPayoffCalculator",
    "learn": "lessons",
    "household-pool": "householdPool",
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
    { id: "recurring-bills", iconName: "tool:recurring-bills", title: "Recurring Bills", description: "Track your monthly fixed costs.", onOpen: onOpenRecurringBills },
    { id: "reimbursements", iconName: "tool:reimbursements", title: "IOUs & Reimbursements", description: "Track money friends owe you — or that you owe them.", onOpen: onOpenReimbursements },
    { id: "sinking-funds", iconName: "tool:sinking-funds", title: "Sinking Funds", description: "Save gradually for predictable large expenses.", onOpen: onOpenSinkingFunds },
    { id: "subscriptions", iconName: "tool:subscriptions", title: "Subscription Audit", description: "Review detected recurring charges.", onOpen: onOpenSubscriptions },
    { id: "cancel-negotiate", iconName: "tool:cancel-negotiate", title: "Cancel or Negotiate", description: "Steps and scripts to lower a bill or cancel.", onOpen: onOpenCancelNegotiate },
    { id: "household-pool", iconName: "tool:household-pool", title: "Shared Pools", description: "Split shared expenses with roommates.", onOpen: onOpenHouseholdPool },
    { id: "invite-roommate", iconName: "tool:invite-roommate", title: "Invite a Roommate", description: "Share a pool or goal with a roommate.", onOpen: onOpenInviteRoommate },
    { id: "savings-projections", iconName: "tool:savings-projections", title: "Savings Projections", description: "Project how your savings might grow.", onOpen: onOpenSavingsProjections },
    { id: "wish-list", iconName: "tool:wish-list", title: "Wish List", description: "Track what you want and see when you can afford it.", onOpen: onOpenWishList },
    { id: "manage-savings", iconName: "tool:manage-savings", title: "Manage Savings", description: "Add, edit, or remove savings accounts.", onOpen: onOpenManageSavings },
    { id: "portfolio-allocation", iconName: "tool:portfolio-allocation", title: "Portfolio Allocation", description: "See savings broken down by account type.", onOpen: onOpenPortfolioAllocation },
    { id: "investment-explorer", iconName: "tool:investment-explorer", title: "What If I Invest?", description: "Model contributions and returns over time.", onOpen: onOpenInvestmentExplorer },
    { id: "cash-flow-forecast", iconName: "tool:cash-flow-forecast", title: "Cash Flow Forecast", description: "See projected balance through next payday.", onOpen: onOpenCashFlowForecast },
    { id: "compound-growth", iconName: "tool:compound-growth", title: "Compound Growth", description: "See how savings grow with compound interest.", onOpen: onOpenCompoundGrowth },
    { id: "credit-payoff", iconName: "tool:credit-payoff", title: "Credit Payoff", description: "Plan how to pay off credit card debt faster.", onOpen: onOpenCreditPayoff },
    { id: "term-review", iconName: "tool:term-review", title: "Term in Review", description: "A warm end-of-term recap of your wins.", onOpen: onOpenTermReview },
    { id: "year-in-review", iconName: "tool:year-in-review", title: "Year in Review", description: "A once-a-year look back at your streaks and savings.", onOpen: onOpenYearInReview },
    { id: "peer-context", iconName: "tool:peer-context", title: "How You Compare", description: "Optional anonymized context against student ranges.", onOpen: onOpenPeerContext },
    { id: "learn", iconName: "tool:learn", title: "Learn", description: "Short lessons on budgeting, saving, and investing.", onOpen: onOpenLearn },
    { id: "income-trends", iconName: "tool:income-trends", title: "Income Trends", description: "See how your earnings grow over time.", onOpen: onOpenIncomeTrends },
  ]

  const isToolVisible = (toolId: string): boolean => {
    if (toolId === "peer-context") return peerContextEnabled
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
    if (section.id === "obligations") return visibleTools.length > 0
    return visibleTools.length > 0
  })

  return (
    <div
      style={{
        ...contentColumn,
        paddingTop: spacingScale["24"],
        paddingBottom: safeAreaBottom(100),
      }}
    >
      {/* ── Screen Title ─────────────────────────────────────────────── */}
      <SectionHeader>Tools</SectionHeader>
      <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["32"] }}>
        Advanced features, calculators, and tracking tools.
      </p>

      {/* ── Stat Cards (Set Aside / Savings Rate) ─────────────────────── */}
      {((totalSetAside ?? 0) > 0 || (savingsRate ?? 0) > 0) && (
        <div style={{ display: "flex", gap: spacingScale["12"], marginBottom: spacingScale["32"] }}>
          {(totalSetAside ?? 0) > 0 && (
            <Card style={{ padding: `${spacingScale["12"]} ${spacingScale["16"]}`, flex: 1 }}>
              <p style={{ ...typography.caption, color: textColors.muted, marginBottom: spacingScale["2"] }}>
                Set aside this month
              </p>
              <p style={{ ...typography.subhead, color: textColors.text, fontVariantNumeric: "tabular-nums" }}>
                ${Math.round(totalSetAside ?? 0).toLocaleString("en-US")}
              </p>
            </Card>
          )}
          {(savingsRate ?? 0) > 0 && (
            <Card style={{ padding: `${spacingScale["12"]} ${spacingScale["16"]}`, flex: 1 }}>
              <p style={{ ...typography.caption, color: textColors.muted, marginBottom: spacingScale["2"] }}>
                Savings rate
              </p>
              <p style={{ ...typography.subhead, color: colorRamp.success[500], fontVariantNumeric: "tabular-nums" }}>
                {savingsRate}%
              </p>
            </Card>
          )}
        </div>
      )}

      {/* ── Grouped Sections ─────────────────────────────────────────── */}
      <motion.div variants={listContainer} initial="hidden" animate="visible">
        {visibleSections.map((section, sectionIdx) => {
          const sectionTools = getVisibleToolsForSection(section)

          return (
            <motion.div
              key={section.id}
              variants={listItem}
              custom={sectionIdx}
              style={{ marginBottom: spacingScale["32"] }}
            >
              <SectionHeader>{section.label}</SectionHeader>

              {/* Money Map inline widget */}
              {section.id === "money-map" && hasSourceBalances && (
                <div style={{ marginBottom: sectionTools.length > 0 ? spacingScale["12"] : 0 }}>
                  <SourceBalancesView
                    fundingSources={fundingSources!}
                    transactions={transactions!}
                  />
                </div>
              )}

              {/* Obligations inline widget */}
              {section.id === "obligations" && (
                <div style={{ marginBottom: sectionTools.length > 0 ? spacingScale["12"] : 0 }}>
                  <ObligationsSummary obligations={obligations} />
                </div>
              )}

              {/* Shared Activity — calm list of recent social events (after Obligations) */}
              {section.id === "obligations" && (
                <SharedActivityView />
              )}

              {/* Tool entries — each as a ListRow (dense) */}
              {sectionTools.length > 0 && (
                <motion.div
                  variants={listContainer}
                  initial="hidden"
                  animate="visible"
                  style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}
                >
                  {sectionTools.map((tool, toolIdx) => (
                    <motion.div
                      key={tool.id}
                      variants={listItem}
                      custom={Math.min(toolIdx, MAX_STAGGER_ITEMS)}
                      layout={!prefersReducedMotion ? "position" : false}
                      layoutId={`tool-${tool.id}`}
                      transition={layoutTransition}
                    >
                      <ListRow
                        variant="dense"
                        onPress={tool.onOpen}
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
                  ))}
                </motion.div>
              )}
            </motion.div>
          )
        })}
      </motion.div>

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
