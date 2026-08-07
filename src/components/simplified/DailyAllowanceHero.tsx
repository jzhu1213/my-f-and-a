"use client"

import { useEffect, useRef, useState } from "react"
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "framer-motion"
import type { AllowanceStatus, HeroMeaning, HeroDisplay, ConfidenceBand } from "@/types/folio"
import { getStatus, generateEncouragingMessage } from "@/lib/dailyAllowanceUtils"
import { GlassCard, AmbientGlow } from "@/components/ui"
import { useReducedMotion, springs, timings } from "@/lib/animations"
import { useTimeOfDay } from "@/hooks/useTimeOfDay"
import { typography, pxToRem, animatedFontWeight, fontWeights } from "@/styles/typography"
import { fills } from "@/styles/shared"
import { AllowanceRing } from "./AllowanceRing"
import { Icon } from "@/components/ui/Icon"
import { getStatusIconName, type IconName } from "@/lib/icons"
import { STATUS_LABELS } from "@/lib/vocabulary"
import type { SpendingMode } from "@/lib/spendingModes"

interface DailyAllowanceHeroProps {
  allowanceLeft: number
  dailyBudget: number
  spentToday: number
  rollover: number
  isOverBudget: boolean
  isLoading: boolean
  deferredSpending?: number
  reservedForBills?: number
  upcomingBillCount?: number
  reservedForScheduled?: number
  scheduledCount?: number
  /** Confidence band for variable income — "usually $X–$Y/day" (Task 164.2) */
  confidenceBand?: ConfidenceBand
  onTapForDetails: () => void
  /** Controls whether the hero shows "Safe to spend" (guided/structured) or "Spent today" (tracker) framing */
  spendingMode?: SpendingMode
  /**
   * When provided, overrides the default allowance framing with the user's chosen
   * hero meaning (spent_today, spent_week, balance, or allowance).
   * The hero renders heroDisplay.displayAmount / label / status / message instead.
   */
  heroMeaning?: HeroMeaning
  /** Pre-computed display values matching heroMeaning — pass alongside heroMeaning */
  heroDisplay?: HeroDisplay
}

/**
 * Returns the CSS color variable for a given allowance status.
 */
function getStatusColor(status: AllowanceStatus): string {
  switch (status) {
    case "healthy":
      return "var(--success)"
    case "caution":
      return "var(--warning)"
    case "warning":
      return "var(--warning)"
    case "over":
      return "var(--error)"
  }
}

/**
 * Maps an allowance status to the semantic glow preset understood by
 * GlassCard and AmbientGlow.
 */
function getStatusGlow(status: AllowanceStatus): AllowanceStatus {
  return status
}

/**
 * Maps an allowance status to an emoji and a short phrase for the instant
 * visual answer. Designed to communicate "am I okay today?" in under 1 second
 * — no number-reading required.
 *
 * Uses the canonical vocabulary for consistent emoji/labels across all surfaces.
 */
function getInstantStatus(status: AllowanceStatus): { iconName: IconName; phrase: string } {
  return { iconName: getStatusIconName(status), phrase: STATUS_LABELS[status] }
}

/**
 * In tracker mode there is no "budget" to be over or under — only a spend
 * level relative to the user's own history. Maps spend level to a neutral,
 * informational emoji + phrase rather than a budget-health signal.
 */
function getTrackerInstantStatus(spentToday: number, dailyBudget: number): { iconName: IconName; phrase: string; color: string } {
  // When there is no historical daily average to compare against, show neutral
  if (dailyBudget <= 0) {
    return { iconName: 'status:tracking', phrase: 'Tracking', color: 'var(--sub)' }
  }
  const ratio = spentToday / dailyBudget
  if (ratio < 0.5) {
    return { iconName: 'status:healthy', phrase: 'Light day', color: 'var(--success)' }
  }
  if (ratio < 0.9) {
    return { iconName: 'status:tracking', phrase: 'Typical', color: 'var(--accent, #a78bfa)' }
  }
  if (ratio < 1.3) {
    return { iconName: 'status:caution', phrase: 'Busy day', color: 'var(--warning)' }
  }
  return { iconName: 'status:elevated', phrase: 'High day', color: 'var(--warning)' }
}

/**
 * Generates a tracker-mode context message — informational, never shaming.
 * Uses "typical" / "a bit more than usual" language relative to history,
 * not budget-based language.
 */
function getTrackerMessage(spentToday: number, dailyBudget: number): string {
  if (dailyBudget <= 0) {
    return spentToday > 0
      ? `You've logged $${Math.round(spentToday)} so far today`
      : "Nothing logged yet today — tap to record spending"
  }
  const ratio = spentToday / dailyBudget
  if (spentToday === 0) {
    return "Nothing logged yet today — tap to record spending"
  }
  if (ratio < 0.5) {
    return "Light spending today — well below your usual"
  }
  if (ratio < 0.9) {
    return "About what you'd typically spend on a day like this"
  }
  if (ratio < 1.3) {
    return "A bit more than your usual — totally fine"
  }
  return "Higher than most days — just so you know"
}

/**
 * Two-stop gradient (per status) used for the slow-moving gradient text fill
 * on the dollar amount. Both stops stay bright enough for AA contrast on the
 * dark theme surface.
 */
function getStatusGradient(status: AllowanceStatus): { from: string; to: string } {
  switch (status) {
    case "healthy":
      return { from: "#4ade80", to: "#a7f3d0" }
    case "caution":
      return { from: "#fbbf24", to: "#fde68a" }
    case "warning":
      return { from: "#fb923c", to: "#fbbf24" }
    case "over":
      return { from: "#f87171", to: "#fca5a5" }
  }
}

/**
 * Formats a number as a currency string (e.g., "$42").
 * Shows negative amounts as "-$5".
 */
function formatCurrency(amount: number): string {
  const rounded = Math.round(Math.abs(amount))
  return amount < 0 ? `-$${rounded}` : `$${rounded}`
}

/**
 * Formats a confidence band amount — no decimals if >= $10, one decimal if < $10.
 */
function formatBandAmount(amount: number): string {
  if (amount >= 10) {
    return `$${Math.round(amount)}`
  }
  return `$${amount.toFixed(1)}`
}

/**
 * Triggers subtle haptic feedback if the device supports it.
 * Wrapped in try-catch for safety on unsupported browsers.
 */
function triggerHaptic(): void {
  try {
    if (navigator && "vibrate" in navigator) {
      navigator.vibrate(10)
    }
  } catch {
    // Silently ignore — haptic feedback is non-essential
  }
}

/** Spring used by the animated counter — bouncy settle with controlled overshoot (Task 248.2). */
const HERO_COUNTER_SPRING = { type: "spring" as const, stiffness: 300, damping: 20, restDelta: 0.5 }

/**
 * AnimatedAmount — the large dollar amount rendered with a spring-driven
 * counter and a slow-moving gradient text fill.
 *
 * The number ticks up/down toward the target `value` using framer-motion's
 * `useMotionValue` + `useSpring`. The visible text is derived from the spring
 * so it counts through the intermediate integers. Under reduced motion the
 * value is shown immediately with a static color (no gradient animation).
 *
 * Task 248.2: Applies a brief "bold flash" via `animatedFontWeight` when the
 * status changes, creating a perceptible emphasis pulse that settles back.
 *
 * Kept `aria-hidden` — the accessible amount lives on the parent button label.
 */
function AnimatedAmount({
  value,
  status,
  prefersReducedMotion,
}: {
  value: number
  status: AllowanceStatus
  prefersReducedMotion: boolean
}) {
  const grad = getStatusGradient(status)

  // Start from the actual value so the hero paints immediately (task 3.5).
  // On subsequent updates the spring animates the transition.
  const motionValue = useMotionValue(value)
  const spring = useSpring(motionValue, HERO_COUNTER_SPRING)
  const [display, setDisplay] = useState(value)

  // Task 248.2: bold flash on status change — briefly push weight to bold,
  // then settle back to semibold using animatedFontWeight's transition.
  const [emphasisWeight, setEmphasisWeight] = useState<number>(fontWeights.semibold)
  const prevStatusRef = useRef(status)

  useEffect(() => {
    if (prevStatusRef.current !== status && !prefersReducedMotion) {
      // Flash to bold
      setEmphasisWeight(fontWeights.bold)
      const timer = setTimeout(() => {
        setEmphasisWeight(fontWeights.semibold)
      }, 400)
      prevStatusRef.current = status
      return () => clearTimeout(timer)
    }
    prevStatusRef.current = status
  }, [status, prefersReducedMotion])

  // Subscribe to the spring so the visible number ticks through integers.
  useEffect(() => {
    if (prefersReducedMotion) return
    const unsubscribe = spring.on("change", (v) => setDisplay(v))
    return () => unsubscribe()
  }, [spring, prefersReducedMotion])

  // Drive the spring toward the latest target value.
  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value)
      return
    }
    motionValue.set(value)
  }, [value, prefersReducedMotion, motionValue])

  const shown = prefersReducedMotion ? value : display

  const fontWeightStyle = animatedFontWeight(
    emphasisWeight as Parameters<typeof animatedFontWeight>[0],
    300
  )

  return (
    <span
      className={prefersReducedMotion ? undefined : "hero-amount"}
      style={{
        ...typography.display,
        fontSize: "clamp(2rem, 10vw, 2.875rem)",
        lineHeight: 1.05,
        display: "block",
        textAlign: "center",
        ...fontWeightStyle,
        ...(prefersReducedMotion
          ? { color: grad.from }
          : ({
              ["--hero-grad-from" as string]: grad.from,
              ["--hero-grad-to" as string]: grad.to,
            } as Record<string, string>)),
      }}
      aria-hidden="true"
    >
      {formatCurrency(shown)}
    </span>
  )
}

/** Number of twinkle particles arranged around the ring when healthy. */
const SHIMMER_PARTICLE_COUNT = 4

/**
 * ShimmerParticles — a barely-visible ring of twinkling dots positioned
 * around the AllowanceRing. Rendered only when the status is healthy (and
 * motion is allowed). Purely decorative, so `aria-hidden`.
 */
function ShimmerParticles({ size }: { size: number }) {
  const radius = size / 2 - 2
  return (
    <div aria-hidden="true">
      {Array.from({ length: SHIMMER_PARTICLE_COUNT }).map((_, i) => {
        const angle = (i / SHIMMER_PARTICLE_COUNT) * Math.PI * 2
        const x = size / 2 + radius * Math.cos(angle)
        const y = size / 2 + radius * Math.sin(angle)
        return (
          <span
            key={i}
            className="hero-shimmer-particle"
            style={{
              left: x,
              top: y,
              marginLeft: -2,
              marginTop: -2,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        )
      })}
    </div>
  )
}

/**
 * Loading skeleton placeholder for the hero section.
 */
function HeroSkeleton() {
  return (
    <GlassCard
      elevation="high"
      className="flex flex-col items-center gap-3 w-full"
      style={{ padding: "28px 20px" }}
    >
      <div
        className="flex flex-col items-center gap-3"
        aria-label="Loading daily allowance"
        role="status"
      >
        {/* Amount skeleton */}
        <div
          className="rounded-lg animate-pulse"
          style={{ width: 160, height: 64, background: "var(--raised)" }}
        />
        {/* Message skeleton */}
        <div
          className="rounded animate-pulse"
          style={{ width: 220, height: 20, background: "var(--raised)" }}
        />
      </div>
    </GlassCard>
  )
}

/**
 * Formats the rollover amount into a human-friendly string.
 * e.g., "+$5 from yesterday" or "−$3 from yesterday (yesterday's extra)"
 * The annotation on negative rollovers adds context so it reads as calm
 * information rather than a warning.
 */
function formatRollover(rollover: number): string {
  const rounded = Math.round(Math.abs(rollover))
  if (rollover >= 0) {
    return `+$${rounded} from yesterday`
  }
  return `\u2212$${rounded} from yesterday (yesterday's extra)`
}

/**
 * DailyAllowanceHero — the centerpiece of the simplified home screen.
 *
 * Displays the user's remaining daily allowance inside a frosted GlassCard
 * with a status-based glow. The dollar amount is a spring-driven animated
 * counter with a slow-moving gradient text fill, sitting over a gently
 * breathing ambient light. An AllowanceRing visualizes budget consumption
 * with a soft depth shadow that shifts with progress, and — when the status
 * is healthy — a faint particle shimmer twinkles around the ring.
 *
 * Tapping reveals a detailed calculation breakdown (daily budget, rollover,
 * spent today) with spring-staggered rows, divider lines and icon accents.
 *
 * All motion respects prefers-reduced-motion and the accessible amount label
 * is preserved on the interactive button.
 *
 * Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 8.1, 13.5
 */
export function DailyAllowanceHero({
  allowanceLeft,
  dailyBudget,
  spentToday,
  rollover,
  isOverBudget,
  isLoading,
  deferredSpending,
  reservedForBills,
  upcomingBillCount,
  reservedForScheduled,
  scheduledCount,
  confidenceBand,
  onTapForDetails,
  spendingMode = 'guided',
  heroMeaning,
  heroDisplay,
}: DailyAllowanceHeroProps) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showExplainer, setShowExplainer] = useState(false)
  const { prefersReducedMotion, listContainer, listItem } = useReducedMotion()
  const atmosphere = useTimeOfDay()

  // When heroDisplay is provided (heroMeaning !== 'allowance' or explicit heroDisplay),
  // use it to override the default allowance framing entirely.
  const hasCustomDisplay = heroDisplay !== undefined && heroMeaning !== undefined && heroMeaning !== 'allowance'

  const isTrackerMode = spendingMode === 'tracker'

  // ── Tracker mode: derive neutral status/messaging from spend level ──────
  const trackerStatus = isTrackerMode
    ? getTrackerInstantStatus(spentToday, dailyBudget)
    : null

  // Determine status and message — heroDisplay takes priority, then tracker, then default
  const status: AllowanceStatus = hasCustomDisplay
    ? heroDisplay!.status
    : isOverBudget
      ? "over"
      : getStatus(allowanceLeft, dailyBudget)

  const message = hasCustomDisplay
    ? heroDisplay!.message
    : isTrackerMode
      ? getTrackerMessage(spentToday, dailyBudget)
      : generateEncouragingMessage(status, allowanceLeft, spentToday)

  // In tracker mode: use tracker color (neutral/accent), not budget-health color
  // For custom hero meaning: use status color (same logic as budget mode)
  const color = !hasCustomDisplay && isTrackerMode
    ? (trackerStatus?.color ?? 'var(--sub)')
    : getStatusColor(status)

  // Ring progress: for custom meanings, show neutral ring progress or suppress
  const ringProgress = hasCustomDisplay
    ? (heroMeaning === 'spent_today' && dailyBudget > 0
        ? Math.min(1, heroDisplay!.displayAmount / dailyBudget)
        : heroMeaning === 'spent_week' && dailyBudget > 0
          ? Math.min(1, heroDisplay!.displayAmount / (dailyBudget * 7))
          : 0.5) // neutral half-ring for balance
    : isTrackerMode
      ? (dailyBudget > 0 ? Math.min(1, spentToday / dailyBudget) : 0)
      : (dailyBudget > 0 ? spentToday / dailyBudget : 0)

  // The hero number
  const heroValue = hasCustomDisplay
    ? heroDisplay!.displayAmount
    : isTrackerMode ? spentToday : allowanceLeft

  // The hero label (shown above or below the ring when relevant)
  const heroLabel = hasCustomDisplay
    ? heroDisplay!.label
    : isTrackerMode ? 'Spent today' : null

  // The instant status badge
  const instantStatus: { iconName: IconName; phrase: string } = hasCustomDisplay
    ? { iconName: getStatusIconName(status), phrase: heroDisplay!.label }
    : isTrackerMode
      ? { iconName: trackerStatus?.iconName ?? 'status:tracking', phrase: trackerStatus?.phrase ?? 'Tracking' }
      : getInstantStatus(status)

  if (isLoading) {
    return <HeroSkeleton />
  }

  const ringSize = 180
  const progress = ringProgress
  const clampedProgress = Math.max(0, Math.min(1, progress))

  // Soft depth shadow beneath the ring shifts horizontally with progress.
  // Task 248.1: deeper blur + stronger opacity range for a floating effect.
  const shadowShift = (clampedProgress - 0.5) * ringSize * 0.25
  const shadowOpacity = 0.2 + clampedProgress * 0.25
  const shadowTransition = prefersReducedMotion ? { duration: 0 } : springs.gentle

  // Shimmer: show when status is healthy (works for all meanings)
  const showShimmer = !hasCustomDisplay && isTrackerMode
    ? (spentToday === 0 || (dailyBudget > 0 && spentToday / dailyBudget < 0.5)) && !prefersReducedMotion
    : status === "healthy" && !prefersReducedMotion

  // Glow: always follows the resolved status
  const glowStatus = getStatusGlow(status)

  // Breakdown rows — icon accent, label, formatted value and value color.
  // In tracker mode: "spent today" is the headline, no "safe to spend" concept.
  const breakdownRows: {
    key: string
    icon: IconName
    label: string
    value: string
    valueColor: string
    accentColor: string
  }[] = isTrackerMode
    ? [
        {
          key: "spent-today",
          icon: "breakdown:spent",
          label: "Spent today",
          value: formatCurrency(spentToday),
          valueColor: "var(--text)",
          accentColor: "#fb923c",
        },
        ...(dailyBudget > 0
          ? [{
              key: "daily-avg",
              icon: "breakdown:daily-budget" as IconName,
              label: "Your typical day",
              value: `${formatCurrency(dailyBudget)}/day`,
              valueColor: "var(--sub)",
              accentColor: "#818cf8",
            }]
          : []),
        ...(reservedForBills !== undefined && reservedForBills > 0 && upcomingBillCount !== undefined && upcomingBillCount > 0
          ? [{
              key: "reserved-bills",
              icon: "breakdown:reserved" as IconName,
              label: "Set aside for bills",
              value: `${formatCurrency(reservedForBills)} for ${upcomingBillCount} bill${upcomingBillCount === 1 ? '' : 's'}`,
              valueColor: "var(--sub)",
              accentColor: "#60a5fa",
            }]
          : []),
      ]
    : [
        {
          key: "daily-budget",
          icon: "breakdown:daily-budget",
          label: "Daily budget",
          value: `${formatCurrency(dailyBudget)}/day`,
          valueColor: "var(--text)",
          accentColor: "#818cf8",
        },
        {
          key: "rollover",
          icon: "breakdown:rollover",
          label: "Rollover",
          value: formatRollover(rollover),
          valueColor: rollover >= 0 ? "var(--success)" : "var(--sub)",
          accentColor: rollover >= 0 ? "#4ade80" : "#fbbf24",
        },
        {
          key: "spent-today",
          icon: "breakdown:spent",
          label: "Spent today",
          value: `${formatCurrency(spentToday)} spent today`,
          valueColor: "var(--text)",
          accentColor: "#fb923c",
        },
        // Reserved for bills row — only included when there are upcoming bills
        ...(reservedForBills !== undefined && reservedForBills > 0 && upcomingBillCount !== undefined && upcomingBillCount > 0
          ? [{
              key: "reserved-bills",
              icon: "breakdown:reserved" as IconName,
              label: "Set aside for bills",
              value: `${formatCurrency(reservedForBills)} for ${upcomingBillCount} bill${upcomingBillCount === 1 ? '' : 's'}`,
              valueColor: "var(--sub)",
              accentColor: "#60a5fa",
            }]
          : []),
        // Scheduled expenses row — only included when there are future-dated transactions (task 90.1)
        ...(reservedForScheduled !== undefined && reservedForScheduled > 0 && scheduledCount !== undefined && scheduledCount > 0
          ? [{
              key: "reserved-scheduled",
              icon: "breakdown:scheduled" as IconName,
              label: "Scheduled",
              value: `${formatCurrency(reservedForScheduled)} for ${scheduledCount} item${scheduledCount === 1 ? '' : 's'}`,
              valueColor: "var(--sub)",
              accentColor: "#22d3ee",
            }]
          : []),
        // Combined total reserved row (Task 90.2) — shown when BOTH bills and scheduled items exist
        ...(reservedForBills !== undefined && reservedForBills > 0 && reservedForScheduled !== undefined && reservedForScheduled > 0
          ? [{
              key: "reserved-total",
              icon: "breakdown:total-locked" as IconName,
              label: "Total reserved",
              value: formatCurrency(reservedForBills + reservedForScheduled),
              valueColor: "var(--sub)",
              accentColor: "#a78bfa",
            }]
          : []),
      ]

  function handleTap() {
    setShowBreakdown((prev) => !prev)
    triggerHaptic()
    onTapForDetails()
  }

  return (
    <GlassCard
      elevation="high"
      glow={glowStatus}
      className="w-full relative"
      style={{ padding: "28px 20px", overflow: "visible" }}
    >
      {/* Breathing ambient light behind the number — time-of-day atmosphere (Task 249.1) */}
      <div
        className={prefersReducedMotion ? undefined : "hero-breathe"}
        style={prefersReducedMotion ? undefined : {
          ["--hero-breathe-duration" as string]: `${atmosphere.breatheDuration}s`,
          ["--hero-breathe-opacity-min" as string]: String(atmosphere.breatheOpacityMin),
          ["--hero-breathe-opacity-max" as string]: String(atmosphere.breatheOpacityMax),
          ["--hero-breathe-scale" as string]: String(atmosphere.breatheScale),
        } as React.CSSProperties}
      >
        <AmbientGlow status={status} size="lg" intensity="medium" position="center" />
      </div>

      {/* Time-of-day tint — purely atmospheric, sits underneath status glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background: atmosphere.tintColor,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <motion.button
        type="button"
        className="flex flex-col items-center gap-2 w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-lg"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
        onClick={handleTap}
        aria-label={hasCustomDisplay
          ? `${heroDisplay!.label}: ${formatCurrency(heroDisplay!.displayAmount)}. ${message}. Tap for details.`
          : isTrackerMode
            ? `Spent today: ${formatCurrency(spentToday)}. ${instantStatus.phrase}. ${message}. Tap for details.`
            : `Daily allowance: ${formatCurrency(allowanceLeft)}. ${instantStatus.phrase}. ${message}.${reservedForBills && reservedForBills > 0 && upcomingBillCount ? ` ${formatCurrency(reservedForBills)} set aside for ${upcomingBillCount} upcoming bill${upcomingBillCount === 1 ? '' : 's'}.` : ''} Tap for details.`}
        aria-expanded={showBreakdown}
        aria-live="polite"
        aria-atomic="true"
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? timings.fast : timings.slow}
      >
        {/* Instant status — emoji + phrase, the first thing the eye catches */}
        <p
          className="text-center"
          style={{
            fontSize: pxToRem(22),
            fontWeight: 600,
            color,
            lineHeight: 1.3,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
          aria-label={isTrackerMode ? `Tracker: ${instantStatus.phrase}` : `Status: ${instantStatus.phrase}`}
        >
          <span
            aria-hidden="true"
            style={{ marginRight: 6, display: "inline-flex", verticalAlign: "middle" }}
          >
            <Icon name={instantStatus.iconName} size={22} />
          </span>
          {instantStatus.phrase}
        </p>

        {/* Hero label — in tracker mode or custom hero meaning, show a label below the badge */}
        {(heroLabel) && (
          <p
            style={{
              fontSize: pxToRem(12),
              color: "var(--sub)",
              opacity: 0.7,
              margin: 0,
              fontVariantNumeric: "tabular-nums",
            }}
            aria-hidden="true"
          >
            {heroLabel}
          </p>
        )}

        {/* Ring with depth shadow + shimmer particles */}
        <div className="relative" style={{ width: ringSize, height: ringSize }}>
          {/* Soft depth shadow beneath the ring, shifting with progress (Task 248.1: refined) */}
          <motion.div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              bottom: -6,
              width: ringSize * 0.5,
              height: 18,
              marginLeft: -(ringSize * 0.5) / 2,
              borderRadius: "50%",
              background: color,
              filter: "blur(18px)",
              pointerEvents: "none",
            }}
            animate={{ x: shadowShift, opacity: shadowOpacity }}
            transition={shadowTransition}
          />

          {/* Barely-visible shimmer around the ring when healthy */}
          {showShimmer && <ShimmerParticles size={ringSize} />}

          <AllowanceRing
            progress={progress}
            status={status}
            size={ringSize}
            strokeWidth={8}
          >
            <AnimatedAmount
              value={heroValue}
              status={status}
              prefersReducedMotion={prefersReducedMotion}
            />
          </AllowanceRing>
        </div>

        {/* Encouraging message */}
        <motion.p
          className="text-center text-sm"
          style={{
            color: "var(--sub)",
            maxWidth: 280,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={timings.normal}
        >
          {message}
        </motion.p>

        {/* Confidence band pill (Task 164.2) — subtle "usually $X–$Y/day" range
            for users with variable income. Only shown in guided/structured mode
            when the band is significant enough to warrant display. */}
        {confidenceBand && confidenceBand.isSignificant && !isTrackerMode && (
          <motion.div
            className="flex items-center gap-1.5"
            style={{
              padding: "6px 12px",
              background: fills[4],
              border: `1px solid ${fills[8]}`,
              borderRadius: "var(--radius-full)",
              marginTop: 4,
            }}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={timings.normal}
            aria-label={`Usually ${formatBandAmount(confidenceBand.low)} to ${formatBandAmount(confidenceBand.high)} per day`}
          >
            <span aria-hidden="true" style={{ fontSize: pxToRem(13), opacity: 0.7 }}>
              📊
            </span>
            <span style={{ fontSize: pxToRem(12), color: "var(--sub)", opacity: 0.85 }}>
              Usually {formatBandAmount(confidenceBand.low)}–{formatBandAmount(confidenceBand.high)}/day
            </span>
          </motion.div>
        )}

        {/* Combined "total reserved" pill (Task 90.2) — shows a unified total when
            BOTH recurring bills and scheduled items exist, giving users a single at-a-glance
            number. The individual breakdowns still appear below for transparency. */}
        {reservedForBills !== undefined && reservedForBills > 0 && reservedForScheduled !== undefined && reservedForScheduled > 0 && (
          <motion.div
            className="flex items-center gap-1.5"
            style={{
              padding: "6px 12px",
              background: fills[5],
              border: `1px solid ${fills[10]}`,
              borderRadius: "var(--radius-full)",
              marginTop: 4,
            }}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={timings.normal}
            aria-label={`${formatCurrency(reservedForBills + reservedForScheduled)} total reserved for upcoming bills and scheduled items`}
          >
            <span aria-hidden="true" style={{ fontSize: pxToRem(13), opacity: 0.8 }}>
              🔒
            </span>
            <span style={{ fontSize: pxToRem(12), color: "var(--sub)", opacity: 0.9 }}>
              {formatCurrency(reservedForBills + reservedForScheduled)} reserved total
            </span>
          </motion.div>
        )}

        {/* Reserved for bills notice — warm, informational pill */}
        {reservedForBills !== undefined && reservedForBills > 0 && upcomingBillCount !== undefined && upcomingBillCount > 0 && (
          <motion.div
            className="flex items-center gap-1.5"
            style={{
              padding: "6px 12px",
              background: fills[4],
              border: `1px solid ${fills[8]}`,
              borderRadius: "var(--radius-full)",
              marginTop: 4,
            }}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={timings.normal}
            aria-label={`${formatCurrency(reservedForBills)} set aside for ${upcomingBillCount} upcoming bill${upcomingBillCount === 1 ? '' : 's'}`}
          >
            <span aria-hidden="true" style={{ fontSize: pxToRem(13), opacity: 0.7 }}>
              🛡️
            </span>
            <span style={{ fontSize: pxToRem(12), color: "var(--sub)", opacity: 0.85 }}>
              {formatCurrency(reservedForBills)} set aside for {upcomingBillCount} upcoming bill{upcomingBillCount === 1 ? '' : 's'}
            </span>
          </motion.div>
        )}

        {/* Deferred spending indicator (Task 82) */}
        {deferredSpending !== undefined && deferredSpending > 0 && (
          <motion.div
            className="flex items-center gap-1.5"
            style={{
              padding: "6px 12px",
              background: fills[4],
              border: `1px solid ${fills[8]}`,
              borderRadius: "var(--radius-full)",
              marginTop: 4,
            }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={timings.normal}
            aria-label={`On credit: ${formatCurrency(deferredSpending)}`}
          >
            <span aria-hidden="true" style={{ fontSize: pxToRem(13), opacity: 0.7 }}>
              💳
            </span>
            <span style={{ fontSize: pxToRem(12), color: "var(--sub)", opacity: 0.85 }}>
              On credit: {formatCurrency(deferredSpending)}
            </span>
          </motion.div>
        )}

        {/* Scheduled expenses indicator (Task 90.1) */}
        {reservedForScheduled !== undefined && reservedForScheduled > 0 && scheduledCount !== undefined && scheduledCount > 0 && (
          <motion.div
            className="flex items-center gap-1.5"
            style={{
              padding: "6px 12px",
              background: fills[4],
              border: `1px solid ${fills[8]}`,
              borderRadius: "var(--radius-full)",
              marginTop: 4,
            }}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={timings.normal}
            aria-label={`${formatCurrency(reservedForScheduled)} scheduled for ${scheduledCount} upcoming item${scheduledCount === 1 ? '' : 's'}`}
          >
            <span aria-hidden="true" style={{ fontSize: pxToRem(13), opacity: 0.7 }}>
              📅
            </span>
            <span style={{ fontSize: pxToRem(12), color: "var(--sub)", opacity: 0.85 }}>
              {formatCurrency(reservedForScheduled)} scheduled
            </span>
          </motion.div>
        )}

        {/* Breakdown panel */}
        <AnimatePresence>
          {showBreakdown && (
            <motion.div
              className="w-full mt-3"
              style={{
                background: fills[4],
                borderRadius: "var(--radius-md)",
                padding: "12px 16px",
                overflow: "hidden",
              }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={prefersReducedMotion ? timings.fast : timings.normal}
              role="region"
              aria-label="Allowance breakdown"
            >
              <motion.div
                className="flex flex-col"
                variants={listContainer}
                initial="hidden"
                animate="visible"
              >
                {breakdownRows.map((row, index) => (
                  <motion.div
                    key={row.key}
                    variants={listItem}
                    className="flex justify-between items-center text-sm"
                    style={{
                      padding: "12px 0",
                      borderBottom:
                        index < breakdownRows.length - 1
                          ? `1px solid ${fills[6]}`
                          : "none",
                      color: "var(--sub)",
                    }}
                  >
                    <span className="flex items-center" style={{ gap: 10 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: 'var(--radius-sm)',
                          background: `${row.accentColor}15`,
                          color: row.accentColor,
                          flexShrink: 0,
                        }}
                      >
                        <Icon name={row.icon} size={16} />
                      </span>
                      <span style={{ fontFamily: 'var(--font-family, Inter, sans-serif)' }}>
                        {row.label}
                      </span>
                    </span>
                    <span style={{ color: row.valueColor, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{row.value}</span>
                  </motion.div>
                ))}
              </motion.div>

              {/* "How is this calculated?" explainer toggle */}
              <div className="flex justify-center mt-2 mb-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowExplainer((prev) => !prev)
                  }}
                  className="text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded px-2 py-1"
                  style={{
                    color: "var(--sub)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    opacity: 0.8,
                    textDecoration: "underline",
                    textDecorationStyle: "dotted",
                    textUnderlineOffset: "3px",
                  }}
                  aria-label="How is this calculated? Toggle formula explanation"
                  aria-expanded={showExplainer}
                >
                  {showExplainer ? "Hide formula" : "How is this calculated?"}
                </button>
              </div>

              {/* Explainer content */}
              <AnimatePresence>
                {showExplainer && (
                  <motion.div
                    className="mt-1"
                    style={{
                      background: fills[2],
                      borderRadius: "var(--radius-md)",
                      padding: "12px 14px",
                      border: "1px solid var(--border)",
                    }}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={prefersReducedMotion ? timings.fast : timings.normal}
                    role="region"
                    aria-label="Daily allowance formula explanation"
                  >
                    {isTrackerMode ? (
                      <ol
                        className="flex flex-col gap-2 text-xs"
                        style={{ color: "var(--sub)", margin: 0, paddingLeft: 16 }}
                      >
                        <li>
                          <strong style={{ color: "var(--text)" }}>Spent today</strong> = sum of all expenses you logged for today
                        </li>
                        <li>
                          <strong style={{ color: "var(--text)" }}>Typical day</strong> = your average daily spending based on your history (used as a reference, not a limit)
                        </li>
                        <li>
                          You&apos;re in tracking mode — there&apos;s no limit, just a clear picture of what you&apos;re spending.
                        </li>
                      </ol>
                    ) : (
                      <ol
                        className="flex flex-col gap-2 text-xs"
                        style={{ color: "var(--sub)", margin: 0, paddingLeft: 16 }}
                      >
                        <li>
                          <strong style={{ color: "var(--text)" }}>Daily budget</strong> = (monthly income − fixed bills) ÷ days in month
                        </li>
                        <li>
                          <strong style={{ color: "var(--text)" }}>Rollover</strong> = what you saved or spent extra from previous days (capped at ±2 days)
                        </li>
                        <li>
                          <strong style={{ color: "var(--text)" }}>Today&apos;s allowance</strong> = daily budget + rollover − spent today
                        </li>
                        <li>
                          The number is always $0 or more — if you overspend, tomorrow resets.
                        </li>
                      </ol>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </GlassCard>
  )
}
