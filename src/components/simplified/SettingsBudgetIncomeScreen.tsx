"use client"

/**
 * SettingsBudgetIncomeScreen — Budget & income settings sub-screen.
 *
 * Shows a budget summary card, income method selector, and navigation links
 * to related sub-flows (term schedule, spend-down plans, category hub).
 *
 * Requirements: Phase 12 — Task 373
 */

import { useState } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { spacingScale } from "@/styles/layout"
import { typography, fontWeights } from '@/styles/typography'
import { textColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { ListRow } from "@/components/ui/primitives/ListRow"
import { SettingsSubScreen } from "./SettingsSubScreen"
import { SettingsTermScheduleScreen } from "./SettingsTermScheduleScreen"
import { SettingsSpendDownPlansScreen } from "./SettingsSpendDownPlansScreen"
import { computeBudgetSummary } from "@/lib/budgetSummary"
import type { Budget } from "@/types"
import type { IncomeSmoothing } from "@/types/folio"
import type { TermSchedule } from "@/lib/termSchedule"
import type { SpendDownPlan } from "@/lib/spendDown"
import type { Disbursement } from "@/lib/disbursements"

// ============================================================================
// Types
// ============================================================================

export interface SettingsBudgetIncomeScreenProps {
  onBack: () => void
  budgets: Budget[]
  incomeSmoothing?: IncomeSmoothing | null
  onSetIncomeSmoothing?: (s: IncomeSmoothing) => void
  countCreditImmediately?: boolean
  onUpdateCountCreditImmediately?: (value: boolean) => void
  onOpenBudgetSettings: () => void
  onOpenCategoryHub?: () => void
  termSchedule?: TermSchedule | null
  onSetTermSchedule?: (schedule: TermSchedule | null) => void
  spendDownPlans?: SpendDownPlan[]
  onAddSpendDownPlan?: (data: Omit<SpendDownPlan, 'id'>) => SpendDownPlan
  onRemoveSpendDownPlan?: (id: string) => void
  disbursements?: Disbursement[]
}

// ============================================================================
// Sub-flow type
// ============================================================================

type SubFlow = 'term-schedule' | 'spend-down-plans' | null

// ============================================================================
// Section heading
// ============================================================================

function SectionHeading({ children, id }: { children: string; id?: string }) {
  return (
    <h2
      id={id}
      style={{
        ...typography["body-sm"],
        color: textColors.muted,
        margin: 0,
        marginBottom: spacingScale["12"],
        fontWeight: fontWeights.medium,
      }}
    >
      {children}
    </h2>
  )
}

// ============================================================================
// Link row (uses ListRow primitive)
// ============================================================================

interface LinkRowProps {
  label: string
  badge?: string | number
  onPress: () => void
}

function LinkRow({ label, badge, onPress }: LinkRowProps) {
  return (
    <ListRow
      variant="dense"
      onPress={onPress}
      aria-label={label}
      style={{
        background: elevations.resting.fill,
        border: `1px solid ${elevations.resting.border}`,
        borderRadius: radius.control,
      }}
    >
      <span style={{ flex: 1, ...typography.body, color: textColors.text }}>
        {label}
      </span>
      {badge !== undefined && (
        <span
          style={{
            ...typography.caption,
            color: textColors.text,
            background: colorRamp.accent[50],
            border: `1px solid ${colorRamp.accent[300]}`,
            borderRadius: "999px",
            padding: `2px ${spacingScale["8"]}`,
            fontWeight: fontWeights.medium,
            flexShrink: 0,
          }}
        >
          {badge}
        </span>
      )}
      <span aria-hidden="true" style={{ ...typography.body, color: textColors.muted, flexShrink: 0 }}>›</span>
    </ListRow>
  )
}

// ============================================================================
// Component
// ============================================================================

export function SettingsBudgetIncomeScreen({
  onBack,
  budgets,
  incomeSmoothing,
  onSetIncomeSmoothing,
  countCreditImmediately,
  onUpdateCountCreditImmediately,
  onOpenBudgetSettings,
  onOpenCategoryHub,
  termSchedule,
  onSetTermSchedule,
  spendDownPlans,
  onAddSpendDownPlan,
  onRemoveSpendDownPlan,
  disbursements,
}: SettingsBudgetIncomeScreenProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [activeSubFlow, setActiveSubFlow] = useState<SubFlow>(null)

  const { totalMonthly, dailyBudget } = computeBudgetSummary(budgets)

  const currentStrategy = incomeSmoothing?.strategy ?? 'current_month'
  const activePlanCount = spendDownPlans?.length ?? 0

  // ── Sub-flow rendering ───────────────────────────────────────────────
  if (activeSubFlow === 'term-schedule') {
    return (
      <SettingsTermScheduleScreen
        onBack={() => setActiveSubFlow(null)}
        termSchedule={termSchedule ?? null}
        onSetTermSchedule={onSetTermSchedule ?? (() => {})}
      />
    )
  }

  if (activeSubFlow === 'spend-down-plans') {
    return (
      <SettingsSpendDownPlansScreen
        onBack={() => setActiveSubFlow(null)}
        spendDownPlans={spendDownPlans ?? []}
        onAddSpendDownPlan={onAddSpendDownPlan}
        onRemoveSpendDownPlan={onRemoveSpendDownPlan}
        disbursements={disbursements}
      />
    )
  }

  return (
    <SettingsSubScreen title="Budget" description="Your monthly budget and how income flows in." onBack={onBack}>
      {/* Budget summary card */}
      <section aria-labelledby="budget-summary-heading">
        <SectionHeading id="budget-summary-heading">Budget summary</SectionHeading>
        <div
          style={{
            padding: spacingScale["16"],
            background: elevations.resting.fill,
            border: `1px solid ${elevations.resting.border}`,
            borderRadius: radius.control,
            marginBottom: spacingScale["12"],
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <span style={{ ...typography.subhead, color: textColors.text, fontVariantNumeric: "tabular-nums" }}>
                ${totalMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
              <span style={{ ...typography["body-sm"], color: textColors.muted, marginLeft: spacingScale["4"] }}>
                /mo
              </span>
            </div>
            <span style={{ ...typography["body-sm"], color: textColors.sub, fontVariantNumeric: "tabular-nums" }}>
              ≈ ${dailyBudget.toFixed(0)}/day
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenBudgetSettings}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            ...typography["body-sm"],
            color: colorRamp.accent[400],
            fontWeight: fontWeights.medium,
          }}
        >
          Manage limits →
        </button>
      </section>

      {/* Income method selector */}
      {onSetIncomeSmoothing && (
        <section
          aria-labelledby="income-method-heading"
          style={{ marginTop: spacingScale["32"] }}
        >
          <SectionHeading id="income-method-heading">Income method</SectionHeading>
          <div
            role="group"
            aria-label="Income smoothing strategy"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: spacingScale["8"],
            }}
          >
            {([
              { strategy: 'current_month' as const, label: 'This month' },
              { strategy: 'trailing_average' as const, label: 'Average' },
            ]).map(({ strategy, label }) => {
              const isSelected = currentStrategy === strategy
              return (
                <motion.button
                  key={strategy}
                  type="button"
                  onClick={() => onSetIncomeSmoothing({ strategy })}
                  whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
                  transition={springs.snappy}
                  aria-pressed={isSelected}
                  style={{
                    padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
                    background: isSelected ? colorRamp.accent[50] : elevations.resting.fill,
                    border: `1px solid ${isSelected ? colorRamp.accent[300] : elevations.resting.border}`,
                    borderRadius: radius.control,
                    cursor: "pointer",
                    textAlign: "center",
                    ...typography["body-sm"],
                    color: textColors.text,
                    fontWeight: isSelected ? 500 : 400,
                  }}
                >
                  {label}
                </motion.button>
              )
            })}
          </div>
        </section>
      )}

      {/* Navigation links */}
      <section style={{ marginTop: spacingScale["32"] }}>
        <SectionHeading>Manage</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
          {onOpenCategoryHub && (
            <LinkRow label="Categories →" onPress={onOpenCategoryHub} />
          )}
          <LinkRow
            label="Term schedule →"
            onPress={() => setActiveSubFlow('term-schedule')}
          />
          <LinkRow
            label="Spend-down plans →"
            badge={activePlanCount > 0 ? activePlanCount : undefined}
            onPress={() => setActiveSubFlow('spend-down-plans')}
          />
        </div>
      </section>

      {/* Count credit toggle */}
      {onUpdateCountCreditImmediately !== undefined && (
        <section style={{ marginTop: spacingScale["32"] }}>
          <SectionHeading>Advanced</SectionHeading>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: `${spacingScale["12"]} ${spacingScale["16"]}`,
              background: elevations.resting.fill,
              border: `1px solid ${elevations.resting.border}`,
              borderRadius: radius.control,
              cursor: "pointer",
            }}
          >
            <span style={{ ...typography.body, color: textColors.text }}>
              Count credit now
            </span>
            <input
              type="checkbox"
              checked={countCreditImmediately ?? false}
              onChange={(e) => onUpdateCountCreditImmediately(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: colorRamp.accent[400] }}
            />
          </label>
        </section>
      )}
    </SettingsSubScreen>
  )
}
