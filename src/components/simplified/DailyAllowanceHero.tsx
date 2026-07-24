"use client"

import { useEffect, useState } from "react"
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "framer-motion"
import type { AllowanceStatus } from "@/types/folio"
import { getStatus, generateEncouragingMessage } from "@/lib/dailyAllowanceUtils"
import { GlassCard, AmbientGlow } from "@/components/ui"
import { useReducedMotion, springs, timings } from "@/lib/animations"
import { typography } from "@/styles/typography"
import { AllowanceRing } from "./AllowanceRing"
import { STATUS_EMOJI, STATUS_LABELS } from "@/lib/vocabulary"

interface DailyAllowanceHeroProps {
  allowanceLeft: number
  dailyBudget: number
  spentToday: number
  rollover: number
  isOverBudget: boolean
  isLoading: boolean
  onTapForDetails: () => void
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
function getInstantStatus(status: AllowanceStatus): { emoji: string; phrase: string } {
  return { emoji: STATUS_EMOJI[status], phrase: STATUS_LABELS[status] }
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

/** Spring used by the animated counter — soft settle with a tiny overshoot. */
const HERO_COUNTER_SPRING = { stiffness: 90, damping: 18, restDelta: 0.5 }

/**
 * AnimatedAmount — the large dollar amount rendered with a spring-driven
 * counter and a slow-moving gradient text fill.
 *
 * The number ticks up/down toward the target `value` using framer-motion's
 * `useMotionValue` + `useSpring`. The visible text is derived from the spring
 * so it counts through the intermediate integers. Under reduced motion the
 * value is shown immediately with a static color (no gradient animation).
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

  // Start from 0 for a count-up on mount (skipped under reduced motion).
  const motionValue = useMotionValue(prefersReducedMotion ? value : 0)
  const spring = useSpring(motionValue, HERO_COUNTER_SPRING)
  const [display, setDisplay] = useState(prefersReducedMotion ? value : 0)

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

  return (
    <span
      className={prefersReducedMotion ? undefined : "hero-amount"}
      style={{
        ...typography.display,
        fontSize: 46,
        lineHeight: 1.05,
        display: "block",
        textAlign: "center",
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
  onTapForDetails,
}: DailyAllowanceHeroProps) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const { prefersReducedMotion, listContainer, listItem } = useReducedMotion()

  // Determine status and message
  const status: AllowanceStatus = isOverBudget
    ? "over"
    : getStatus(allowanceLeft, dailyBudget)
  const message = generateEncouragingMessage(status, allowanceLeft, spentToday)
  const color = getStatusColor(status)
  const instantStatus = getInstantStatus(status)

  if (isLoading) {
    return <HeroSkeleton />
  }

  const ringSize = 180
  const progress = dailyBudget > 0 ? spentToday / dailyBudget : 0
  const clampedProgress = Math.max(0, Math.min(1, progress))

  // Soft depth shadow beneath the ring shifts horizontally with progress.
  const shadowShift = (clampedProgress - 0.5) * ringSize * 0.28
  const shadowOpacity = 0.18 + clampedProgress * 0.22
  const shadowTransition = prefersReducedMotion ? { duration: 0 } : springs.gentle

  const showShimmer = status === "healthy" && !prefersReducedMotion

  // Breakdown rows — icon accent, label, formatted value and value color.
  const breakdownRows: {
    key: string
    icon: string
    label: string
    value: string
    valueColor: string
  }[] = [
    {
      key: "daily-budget",
      icon: "📅",
      label: "Daily budget",
      value: `${formatCurrency(dailyBudget)}/day`,
      valueColor: "var(--text)",
    },
    {
      key: "rollover",
      icon: "🔄",
      label: "Rollover",
      value: formatRollover(rollover),
      valueColor: rollover >= 0 ? "var(--success)" : "var(--sub)",
    },
    {
      key: "spent-today",
      icon: "💸",
      label: "Spent today",
      value: `${formatCurrency(spentToday)} spent today`,
      valueColor: "var(--text)",
    },
  ]

  function handleTap() {
    setShowBreakdown((prev) => !prev)
    triggerHaptic()
    onTapForDetails()
  }

  return (
    <GlassCard
      elevation="high"
      glow={getStatusGlow(status)}
      className="w-full relative"
      style={{ padding: "28px 20px", overflow: "visible" }}
    >
      {/* Breathing ambient light behind the number */}
      <div className={prefersReducedMotion ? undefined : "hero-breathe"}>
        <AmbientGlow status={status} size="lg" intensity="medium" position="center" />
      </div>

      <motion.button
        type="button"
        className="flex flex-col items-center gap-2 w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-lg"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
        onClick={handleTap}
        aria-label={`Daily allowance: ${formatCurrency(allowanceLeft)}. ${instantStatus.phrase}. ${message}. Tap for details.`}
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
            fontSize: 22,
            fontWeight: 600,
            color,
            lineHeight: 1.3,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
          aria-label={`Status: ${instantStatus.phrase}`}
        >
          <span aria-hidden="true" style={{ marginRight: 6 }}>
            {instantStatus.emoji}
          </span>
          {instantStatus.phrase}
        </p>

        {/* Ring with depth shadow + shimmer particles */}
        <div className="relative" style={{ width: ringSize, height: ringSize }}>
          {/* Soft depth shadow beneath the ring, shifting with progress */}
          <motion.div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              bottom: -4,
              width: ringSize * 0.55,
              height: 14,
              marginLeft: -(ringSize * 0.55) / 2,
              borderRadius: "50%",
              background: color,
              filter: "blur(14px)",
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
            strokeWidth={6}
          >
            <AnimatedAmount
              value={allowanceLeft}
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

        {/* Breakdown panel */}
        <AnimatePresence>
          {showBreakdown && (
            <motion.div
              className="w-full mt-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderRadius: "var(--radius-md)",
                padding: "6px 16px",
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
                      padding: "10px 0",
                      borderBottom:
                        index < breakdownRows.length - 1
                          ? "1px solid var(--border)"
                          : "none",
                      color: "var(--sub)",
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" style={{ fontSize: 14 }}>
                        {row.icon}
                      </span>
                      {row.label}
                    </span>
                    <span style={{ color: row.valueColor }}>{row.value}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </GlassCard>
  )
}
