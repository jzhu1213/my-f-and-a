"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { useTheme } from "@/contexts/ThemeContext"
import { BUDGET_CATEGORIES } from "@/types"
import type { Budget, Goal } from "@/types"
import type { IncomeSmoothing } from "@/types/folio"
import type { SpendingMode } from "@/lib/spendingModes"
import { SPENDING_MODE_LABELS, OVER_LIMIT_RESPONSE_LABELS } from "@/lib/spendingModes"
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
import { DailyReminderSetting } from "./DailyReminderSetting"
import { getInsightsEnabled, setInsightsEnabled } from "@/lib/insightPreferences"
import { useFeatureFlags } from "@/hooks/useFeatureFlags"
import type { FeatureFlags } from "@/lib/featureFlags"

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
  onOpenBackfill?: () => void
  onSignOut: () => void
  onResetOnboarding?: () => void
  onExportData?: () => void
  onDeleteAccount?: () => void
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
// SettingsScreen Component
// ============================================================================

/**
 * SettingsScreen — consolidated settings surface accessible from the dock.
 * Shows Budget Limits, Goals, Appearance, Learn, and Account sections
 * using GlassCard surfaces.
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
  onOpenBackfill,
  onSignOut,
  onResetOnboarding,
  onExportData,
  onDeleteAccount,
}: SettingsScreenProps) {
  const { theme, setTheme } = useTheme()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { flags, setFlag, resetFlags } = useFeatureFlags()
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [insightsEnabled, setInsightsEnabledState] = useState(() => getInsightsEnabled())
  const [countCreditImmediately, setCountCreditImmediatelyState] = useState(countCreditImmediatelyProp ?? true)

  // Resolve active spending mode — default to 'guided' when not provided
  const spendingMode: SpendingMode = spendingModeProp ?? 'guided'

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
          marginBottom: 20,
        }}
      >
        Settings
      </h2>

      {/* ── How do you want to manage spending? ────────────────────────── */}
      {onSetSpendingMode && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeadingStrong, marginBottom: 6 }}>
            How do you want to manage spending?
          </p>
          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.5 }}>
            {SPENDING_MODE_LABELS[spendingMode].description}
          </p>

          {/* Segmented control — same pattern as Appearance theme toggle */}
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
        </GlassCard>
      )}

      {/* ── When you go over, what should happen? ──────────────────────── */}
      {onSetOverLimitResponse && spendingMode !== 'tracker' && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
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
                  {/* Radio dot */}
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

                  {/* Label + description */}
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

      {/* ── What does the big number show? ─────────────────────────────── */}
      {onSetHeroMeaning && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
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
                  {/* Radio dot */}
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

                  {/* Label + description */}
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

      {/* ── Budget Limits ──────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong }}>
          Budget Limits
        </p>

        {/* Summary line */}
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

        {/* Category list */}
        {activeLimits.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {activeLimits.map(cat => (
              <div
                key={cat.category}
                style={listRow}
              >
                <span>
                  {cat.emoji} {cat.label}
                </span>
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

        <motion.button
          onClick={onOpenBudgetSettings}
          whileTap={{ scale: 0.97 }}
          transition={springs.snappy}
          style={linkButton}
          aria-label="Manage budget limits"
        >
          Manage limits →
        </motion.button>
      </GlassCard>

      {/* ── Income Calculation ────────────────────────────────────────────── */}
      {onSetIncomeSmoothing && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeadingStrong, marginBottom: 6 }}>
            Income
          </p>
          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.5 }}>
            How should your daily budget be calculated when income varies?
          </p>

          {/* Segmented control — same pattern as Appearance */}
          <div
            style={segmentedControl}
          >
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

      {/* ── Tools & More ──────────────────────────────────────────── */}
      {onOpenTools && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeadingStrong }}>
            More & Tools
          </p>

          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14 }}>
            Debt tracking, recurring bills, IOUs, calculators, and more advanced features.
          </p>

          {onOpenFundingSources && (
            <motion.button
              onClick={onOpenFundingSources}
              whileTap={{ scale: 0.97 }}
              transition={springs.snappy}
              style={{ ...linkButton, marginBottom: 8 }}
              aria-label="Manage payment methods"
            >
              💳 Payment Methods →
            </motion.button>
          )}

          <motion.button
            onClick={onOpenTools}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={linkButton}
            aria-label="Open more tools and advanced features"
          >
            Open more →
          </motion.button>
        </GlassCard>
      )}

      {/* ── Goals ──────────────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong }}>
          Goals
        </p>

        {activeGoals.length > 0 ? (
          <div style={{ marginBottom: 14 }}>
            {activeGoals.map(goal => {
              const progress = goal.targetAmount > 0
                ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                : 0
              return (
                <div
                  key={goal.id}
                  style={listRow}
                >
                  <span>
                    {goal.emoji} {goal.name}
                  </span>
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

      {/* ── Appearance ─────────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>
          Appearance
        </p>

        {/* Segmented theme toggle */}
        <div
          style={segmentedControl}
        >
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

      {/* ── Preferences ────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>
          Preferences
        </p>

        {/* Currency Display (informational for now) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 14, color: "var(--text)" }}>Currency</span>
          <span style={{ fontSize: 14, color: "var(--sub)" }}>USD ($)</span>
        </div>

        {/* Show daily insights toggle */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 0",
            borderBottom: "1px solid var(--border)",
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
              flexShrink: 0,
              width: 44,
              height: 26,
              borderRadius: 13,
              border: "none",
              cursor: "pointer",
              background: insightsEnabled
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
                left: insightsEnabled ? 21 : 3,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: insightsEnabled ? "#fff" : "rgba(255,255,255,0.4)",
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
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0",
              borderBottom: "1px solid var(--border)",
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
                flexShrink: 0,
                width: 44,
                height: 26,
                borderRadius: 13,
                border: "none",
                cursor: "pointer",
                background: countCreditImmediately
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
                  left: countCreditImmediately ? 21 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
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
            style={{
              ...linkButton,
              marginTop: 14,
            }}
            aria-label="Reset onboarding tutorial"
          >
            Reset tutorial →
          </motion.button>
        )}

        {/* Catch up on past spending (backfill flow) */}
        {onOpenBackfill && (
          <motion.button
            onClick={onOpenBackfill}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={{
              ...linkButton,
              marginTop: 10,
              display: 'block',
            }}
            aria-label="Catch up on past spending"
          >
            📝 Catch up on past spending →
          </motion.button>
        )}
      </GlassCard>

      {/* ── Daily Reminder ─────────────────────────────────────────────── */}
      <DailyReminderSetting />

      {/* ── Low-Balance Buffer ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <MinBalanceBufferSetting />
      </div>

      {/* ── Feature Visibility ──────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
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

      {/* ── Data & Account Management ──────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>
          Data & Account
        </p>

        {/* Export Data */}
        {onExportData && (
          <motion.button
            onClick={onExportData}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={{
              ...linkButton,
              marginBottom: 12,
            }}
            aria-label="Export your financial data"
          >
            Export my data →
          </motion.button>
        )}

        {/* Delete Account - Destructive Action */}
        {onDeleteAccount && !showDeleteConfirm && (
          <motion.button
            onClick={() => setShowDeleteConfirm(true)}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            style={{
              ...linkButton,
              color: "var(--error)",
            }}
            aria-label="Delete account"
          >
            Delete account →
          </motion.button>
        )}

        {/* Delete Confirmation UI */}
        {showDeleteConfirm && (
          <div
            style={{
              ...dangerZone,
              marginTop: 12,
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--error)",
                marginBottom: 8,
              }}
            >
              ⚠️ Delete Account
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--text)",
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              This will permanently delete all your data including transactions, budgets, and goals. This cannot be undone.
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--sub)",
                marginBottom: 12,
              }}
            >
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              style={{
                width: "100%",
                padding: "10px 12px",
                marginBottom: 12,
                fontSize: 14,
                fontFamily: FONT_FAMILY,
                color: "var(--text)",
                background: "rgba(0, 0, 0, 0.2)",
                border: "1px solid var(--border)",
                borderRadius: borderRadius.sm,
                outline: "none",
              }}
              aria-label="Type DELETE to confirm account deletion"
            />
            <div style={{ display: "flex", gap: 8 }}>
              <motion.button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText("")
                }}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  color: "var(--text)",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid var(--border)",
                  borderRadius: borderRadius.sm,
                  cursor: "pointer",
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
                  flex: 1,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: FONT_FAMILY,
                  color: deleteConfirmText === "DELETE" ? "#fff" : "var(--muted)",
                  background: deleteConfirmText === "DELETE" 
                    ? "var(--error)" 
                    : "rgba(255, 255, 255, 0.03)",
                  border: "none",
                  borderRadius: borderRadius.sm,
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

      {/* ── Account ────────────────────────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 14 }}>
          Account
        </p>

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
