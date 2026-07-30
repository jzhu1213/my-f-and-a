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
} from "@/styles/shared"
import { SourceBalancesView } from "./SourceBalancesView"
import { ObligationsSummary } from "./ObligationsSummary"
import { computeNetObligations } from "@/lib/obligationsUtils"
import { useFeatureFlags } from "@/hooks/useFeatureFlags"
import type { FeatureFlags } from "@/lib/featureFlags"
import type { FundingSource } from "@/lib/fundingSources"
import type { Transaction } from "@/types"
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
  onOpenDebt?: () => void
  onOpenRecurringBills?: () => void
  onOpenReimbursements?: () => void
  onOpenTrajectory?: () => void
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
// ToolsScreen Component
// ============================================================================

/**
 * ToolsScreen — opt-in "Tools" area for advanced features that don't pass
 * the "would a typical sophomore use this in a normal week?" test.
 *
 * Accessible from the dock navigation. Presents advanced tools as a simple
 * list of glass cards with emoji, title, and description.
 */
export function ToolsScreen({
  onOpenCompoundGrowth,
  onOpenCreditPayoff,
  onOpenSubscriptions,
  onOpenCancelNegotiate,
  onOpenSinkingFunds,
  onOpenLearn,
  onOpenSavingsProjections,
  onOpenDebt,
  onOpenRecurringBills,
  onOpenReimbursements,
  onOpenTrajectory,
  totalSetAside,
  savingsRate,
  fundingSources,
  transactions,
  debts,
  reimbursements,
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

  // Filter tools by feature flags
  const tools = allTools.filter(tool => {
    const flagKey = toolFlagMap[tool.id]
    if (!flagKey) return true // no flag = always show
    return flags[flagKey]
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

      {/* ── Where My Money Is ────────────────────────────────────────── */}
      {fundingSources && fundingSources.length > 0 && transactions && (
        <SourceBalancesView
          fundingSources={fundingSources}
          transactions={transactions}
        />
      )}

      {/* ── Net Obligations Summary ──────────────────────────────────── */}
      <ObligationsSummary obligations={obligations} />

      {/* ── Tool Cards ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tools.map((tool) => (
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
    </div>
  )
}
