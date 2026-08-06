"use client"

import { useMemo, useState, useEffect } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { getPeerContextEnabled } from "@/lib/peerContextPreferences"
import { GlassCard } from "@/components/ui/GlassCard"
import { Icon } from "@/components/ui/Icon"
import type { IconName } from "@/lib/icons"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  borderRadius,
  sectionHeadingStrong,
} from "@/styles/shared"
import { SourceBalancesView } from "./SourceBalancesView"
import { ObligationsSummary } from "./ObligationsSummary"
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
  /** Semantic registry icon name resolved through the {@link Icon} wrapper. */
  iconName: IconName
  title: string
  description: string
  onOpen?: () => void
}

/**
 * Subtle, tinted icon-chip that backs every tool's icon. Uses a muted tint of
 * the warm-purple `--accent` token (via `color-mix`) so the tools grid reads as
 * a designed dashboard rather than an emoji list. The icon inherits the accent
 * through `currentColor`. Decorative — each chip is paired with a visible tool
 * title, so it is hidden from assistive tech.
 */
function ToolIconChip({ name, size = 40 }: { name: IconName; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: borderRadius.md,
        background: "color-mix(in srgb, var(--accent) 12%, transparent)",
        color: "var(--accent)",
      }}
    >
      <Icon name={name} size={Math.round(size * 0.5)} />
    </span>
  )
}

// ============================================================================
// Section definitions
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
    label: "Planning",
    toolIds: ["sinking-funds", "savings-projections", "manage-savings", "portfolio-allocation", "investment-explorer", "cash-flow-forecast", "compound-growth", "credit-payoff"],
  },
  {
    id: "reviews",
    label: "Reviews",
    toolIds: ["term-review", "year-in-review", "peer-context"],
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

/**
 * ToolsScreen — opt-in "Tools" area for advanced features that don't pass
 * the "would a typical sophomore use this in a normal week?" test.
 *
 * Accessible from the dock navigation. Presents advanced tools grouped into
 * logical sections (Money Map, Obligations, Planning, Learn) as glass cards
 * with a tinted icon-chip, title, and description.
 */
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

  // Peer context (task 186.1) is opt-in and OFF by default — gate its tool card
  // on the user's Settings preference rather than a feature flag. Re-read on
  // mount so toggling it in Settings takes effect when returning to Tools.
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

  // Compute net obligations from existing Debt and Reimbursement models
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
    {
      id: "trajectory",
      iconName: "tool:trajectory",
      title: "Financial Trajectory",
      description: "See how your money habits are trending — no intimidating numbers.",
      onOpen: onOpenTrajectory,
    },
    {
      id: "debt",
      iconName: "tool:debt",
      title: "Debt Tracking",
      description: "Track balances, APRs, and payoff timelines for your debts.",
      onOpen: onOpenDebt,
    },
    {
      id: "recurring-bills",
      iconName: "tool:recurring-bills",
      title: "Recurring Bills",
      description: "Track your monthly fixed costs like rent, subscriptions, and utilities.",
      onOpen: onOpenRecurringBills,
    },
    {
      id: "reimbursements",
      iconName: "tool:reimbursements",
      title: "IOUs & Reimbursements",
      description: "Track money friends owe you — or that you owe them.",
      onOpen: onOpenReimbursements,
    },
    {
      id: "sinking-funds",
      iconName: "tool:sinking-funds",
      title: "Sinking Funds",
      description: "Save gradually for predictable large expenses like insurance or travel.",
      onOpen: onOpenSinkingFunds,
    },
    {
      id: "subscriptions",
      iconName: "tool:subscriptions",
      title: "Subscription Audit",
      description: "Review detected recurring charges and decide what's worth keeping.",
      onOpen: onOpenSubscriptions,
    },
    {
      id: "cancel-negotiate",
      iconName: "tool:cancel-negotiate",
      title: "Cancel or Negotiate Helper",
      description: "DIY steps and a friendly script to lower a bill or cancel a subscription yourself.",
      onOpen: onOpenCancelNegotiate,
    },
    {
      id: "household-pool",
      iconName: "tool:household-pool",
      title: "Shared Pools",
      description: "Split shared expenses like groceries and utilities with roommates — separate from your daily number.",
      onOpen: onOpenHouseholdPool,
    },
    {
      id: "invite-roommate",
      iconName: "tool:invite-roommate",
      title: "Invite a Roommate",
      description: "Share a pool or goal with a roommate so you can split and save together.",
      onOpen: onOpenInviteRoommate,
    },
    {
      id: "savings-projections",
      iconName: "tool:savings-projections",
      title: "Savings Projections",
      description: "Project how your savings accounts and investments might grow.",
      onOpen: onOpenSavingsProjections,
    },
    {
      id: "manage-savings",
      iconName: "tool:manage-savings",
      title: "Manage Savings Accounts",
      description: "Add, edit, or remove your savings and investment accounts.",
      onOpen: onOpenManageSavings,
    },
    {
      id: "portfolio-allocation",
      iconName: "tool:portfolio-allocation",
      title: "Portfolio Allocation",
      description: "See your savings broken down by account type — where your money lives and grows.",
      onOpen: onOpenPortfolioAllocation,
    },
    {
      id: "investment-explorer",
      iconName: "tool:investment-explorer",
      title: "What If I Invest?",
      description: "Model how different contributions and returns could grow over time.",
      onOpen: onOpenInvestmentExplorer,
    },
    {
      id: "cash-flow-forecast",
      iconName: "tool:cash-flow-forecast",
      title: "Cash Flow Forecast",
      description: "See your projected balance through your next payday or end of term.",
      onOpen: onOpenCashFlowForecast,
    },
    {
      id: "compound-growth",
      iconName: "tool:compound-growth",
      title: "Compound Growth Calculator",
      description: "See how your savings could grow over time with compound interest.",
      onOpen: onOpenCompoundGrowth,
    },
    {
      id: "credit-payoff",
      iconName: "tool:credit-payoff",
      title: "Credit Payoff Calculator",
      description: "Plan how to pay off credit card debt faster.",
      onOpen: onOpenCreditPayoff,
    },
    {
      id: "term-review",
      iconName: "tool:term-review",
      title: "Term in Review",
      description: "A warm end-of-term (or end-of-month) recap of your savings, streaks, and wins.",
      onOpen: onOpenTermReview,
    },
    {
      id: "year-in-review",
      iconName: "tool:year-in-review",
      title: "Year in Review",
      description: "A warm, once-a-year look back at your streaks, savings, and wins.",
      onOpen: onOpenYearInReview,
    },
    {
      id: "peer-context",
      iconName: "tool:peer-context",
      title: "How you compare",
      description: "Optional, anonymized context against rough student ranges — reassuring, never a scoreboard.",
      onOpen: onOpenPeerContext,
    },
    {
      id: "learn",
      iconName: "tool:learn",
      title: "Learn",
      description: "Short lessons on budgeting, saving, and growing your money.",
      onOpen: onOpenLearn,
    },
  ]

  // Helper: check if a tool is visible based on feature flags
  const isToolVisible = (toolId: string): boolean => {
    // Peer context is opt-in (task 186.1) — hidden unless enabled in Settings.
    if (toolId === "peer-context") return peerContextEnabled
    const flagKey = toolFlagMap[toolId]
    if (!flagKey) return true // no flag = always show
    return flags[flagKey]
  }

  // Filter tools for a given section
  const getVisibleToolsForSection = (section: ToolSection): ToolItem[] => {
    return allTools.filter(
      (tool) => section.toolIds.includes(tool.id) && isToolVisible(tool.id)
    )
  }

  // Check if the Money Map section's inline widget (SourceBalancesView) is visible
  const hasSourceBalances =
    fundingSources != null && fundingSources.length > 0 && transactions != null

  // Determine which sections have at least one visible item
  const visibleSections = SECTIONS.filter((section) => {
    const visibleTools = getVisibleToolsForSection(section)
    // Money map also has SourceBalancesView inline widget
    if (section.id === "money-map") return visibleTools.length > 0 || hasSourceBalances
    // Obligations also has ObligationsSummary inline widget (always shows if section renders)
    if (section.id === "obligations") return visibleTools.length > 0
    return visibleTools.length > 0
  })

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM - 20}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ── Title ──────────────────────────────────────────────────────── */}
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: 8,
        }}
      >
        More & Tools
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--sub)",
          marginBottom: 20,
          lineHeight: 1.5,
        }}
      >
        Advanced features, calculators, and tracking tools.
      </p>

      {/* ── Stat Cards (Set Aside / Savings Rate) ──────────────────────── */}
      {((totalSetAside ?? 0) > 0 || (savingsRate ?? 0) > 0) && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {(totalSetAside ?? 0) > 0 && (
            <GlassCard elevation="low" style={{ padding: "14px 16px", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ToolIconChip name="stat:set-aside" size={32} />
                <div>
                  <p style={{ fontSize: 11, color: "var(--sub)", marginBottom: 2 }}>
                    Set aside this month
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                    ${Math.round(totalSetAside ?? 0).toLocaleString("en-US")}
                  </p>
                </div>
              </div>
            </GlassCard>
          )}
          {(savingsRate ?? 0) > 0 && (
            <GlassCard elevation="low" style={{ padding: "14px 16px", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ToolIconChip name="stat:savings-rate" size={32} />
                <div>
                  <p style={{ fontSize: 11, color: "var(--sub)", marginBottom: 2 }}>
                    Savings rate
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
                    {savingsRate}%
                  </p>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* ── Grouped Sections ───────────────────────────────────────────── */}
      {visibleSections.map((section) => {
        const sectionTools = getVisibleToolsForSection(section)

        return (
          <div key={section.id} style={{ marginBottom: 24 }}>
            {/* Section heading */}
            <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>
              {section.label}
            </p>

            {/* Money Map inline widget: SourceBalancesView */}
            {section.id === "money-map" && hasSourceBalances && (
              <div style={{ marginBottom: sectionTools.length > 0 ? 12 : 0 }}>
                <SourceBalancesView
                  fundingSources={fundingSources!}
                  transactions={transactions!}
                />
              </div>
            )}

            {/* Obligations inline widget: ObligationsSummary */}
            {section.id === "obligations" && (
              <div style={{ marginBottom: sectionTools.length > 0 ? 12 : 0 }}>
                <ObligationsSummary obligations={obligations} />
              </div>
            )}

            {/* Tool Cards */}
            {sectionTools.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sectionTools.map((tool) => (
                  <motion.div
                    key={tool.id}
                    whileTap={{ scale: 0.98 }}
                    transition={springs.snappy}
                  >
                    <GlassCard
                      elevation="low"
                      style={{
                        padding: "16px 18px",
                        cursor: tool.onOpen ? "pointer" : "default",
                        opacity: tool.onOpen ? 1 : 0.5,
                      }}
                      onClick={tool.onOpen}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                        <ToolIconChip name={tool.iconName} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: 15,
                              fontWeight: 600,
                              color: "var(--text)",
                              marginBottom: 4,
                            }}
                          >
                            {tool.title}
                          </p>
                          <p
                            style={{
                              fontSize: 13,
                              color: "var(--sub)",
                              lineHeight: 1.4,
                            }}
                          >
                            {tool.description}
                          </p>
                        </div>
                        {tool.onOpen && (
                          <span
                            style={{
                              color: "var(--muted)",
                              marginTop: 4,
                              flexShrink: 0,
                              display: "inline-flex",
                            }}
                          >
                            <Icon name="action:forward" size={18} />
                          </span>
                        )}
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Savings Automation ─────────────────────────────────────────── */}
      <div style={{ marginTop: 28 }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>
          Savings Automation
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
