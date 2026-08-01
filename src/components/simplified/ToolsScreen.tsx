"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
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
  emoji: string
  title: string
  description: string
  onOpen?: () => void
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
    toolIds: ["debt", "recurring-bills", "reimbursements", "subscriptions", "cancel-negotiate"],
  },
  {
    id: "planning",
    label: "Planning",
    toolIds: ["sinking-funds", "savings-projections", "manage-savings", "cash-flow-forecast", "compound-growth", "credit-payoff"],
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
 * with emoji, title, and description.
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
    "cash-flow-forecast": "cashFlowForecast",
    "compound-growth": "compoundGrowthCalculator",
    "credit-payoff": "creditPayoffCalculator",
    "learn": "lessons",
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
      emoji: "📊",
      title: "Financial Trajectory",
      description: "See how your money habits are trending — no intimidating numbers.",
      onOpen: onOpenTrajectory,
    },
    {
      id: "debt",
      emoji: "💳",
      title: "Debt Tracking",
      description: "Track balances, APRs, and payoff timelines for your debts.",
      onOpen: onOpenDebt,
    },
    {
      id: "recurring-bills",
      emoji: "📅",
      title: "Recurring Bills",
      description: "Track your monthly fixed costs like rent, subscriptions, and utilities.",
      onOpen: onOpenRecurringBills,
    },
    {
      id: "reimbursements",
      emoji: "🤝",
      title: "IOUs & Reimbursements",
      description: "Track money friends owe you — or that you owe them.",
      onOpen: onOpenReimbursements,
    },
    {
      id: "sinking-funds",
      emoji: "🎯",
      title: "Sinking Funds",
      description: "Save gradually for predictable large expenses like insurance or travel.",
      onOpen: onOpenSinkingFunds,
    },
    {
      id: "subscriptions",
      emoji: "🔄",
      title: "Subscription Audit",
      description: "Review detected recurring charges and decide what's worth keeping.",
      onOpen: onOpenSubscriptions,
    },
    {
      id: "cancel-negotiate",
      emoji: "💬",
      title: "Cancel or Negotiate Helper",
      description: "DIY steps and a friendly script to lower a bill or cancel a subscription yourself.",
      onOpen: onOpenCancelNegotiate,
    },
    {
      id: "savings-projections",
      emoji: "🏦",
      title: "Savings Projections",
      description: "Project how your savings accounts and investments might grow.",
      onOpen: onOpenSavingsProjections,
    },
    {
      id: "manage-savings",
      emoji: "✏️",
      title: "Manage Savings Accounts",
      description: "Add, edit, or remove your savings and investment accounts.",
      onOpen: onOpenManageSavings,
    },
    {
      id: "cash-flow-forecast",
      emoji: "📉",
      title: "Cash Flow Forecast",
      description: "See your projected balance through your next payday or end of term.",
      onOpen: onOpenCashFlowForecast,
    },
    {
      id: "compound-growth",
      emoji: "📈",
      title: "Compound Growth Calculator",
      description: "See how your savings could grow over time with compound interest.",
      onOpen: onOpenCompoundGrowth,
    },
    {
      id: "credit-payoff",
      emoji: "💰",
      title: "Credit Payoff Calculator",
      description: "Plan how to pay off credit card debt faster.",
      onOpen: onOpenCreditPayoff,
    },
    {
      id: "learn",
      emoji: "📚",
      title: "Learn",
      description: "Short lessons on budgeting, saving, and growing your money.",
      onOpen: onOpenLearn,
    },
  ]

  // Helper: check if a tool is visible based on feature flags
  const isToolVisible = (toolId: string): boolean => {
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
                <span style={{ fontSize: 18 }} aria-hidden="true">🏦</span>
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
                <span style={{ fontSize: 18 }} aria-hidden="true">💪</span>
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
                        <span
                          style={{ fontSize: 24, lineHeight: 1, flexShrink: 0, marginTop: 2 }}
                          aria-hidden="true"
                        >
                          {tool.emoji}
                        </span>
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
                              fontSize: 14,
                              color: "var(--muted)",
                              marginTop: 4,
                              flexShrink: 0,
                            }}
                            aria-hidden="true"
                          >
                            →
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
