"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { AllowanceStatus } from "@/types/folio"
import { getStatus, generateEncouragingMessage } from "@/lib/dailyAllowanceUtils"
import { AllowanceRing } from "./AllowanceRing"

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

/**
 * Loading skeleton placeholder for the hero section.
 */
function HeroSkeleton() {
  return (
    <div
      className="flex flex-col items-center gap-3"
      aria-label="Loading daily allowance"
      role="status"
    >
      {/* Amount skeleton */}
      <div
        className="rounded-lg animate-pulse"
        style={{
          width: 160,
          height: 64,
          background: "var(--raised)",
        }}
      />
      {/* Message skeleton */}
      <div
        className="rounded animate-pulse"
        style={{
          width: 220,
          height: 20,
          background: "var(--raised)",
        }}
      />
    </div>
  )
}

/**
 * Formats the rollover amount into a human-friendly string.
 * e.g., "+$5 from yesterday" or "-$3 from yesterday"
 */
function formatRollover(rollover: number): string {
  const rounded = Math.round(Math.abs(rollover))
  if (rollover >= 0) {
    return `+$${rounded} from yesterday`
  }
  return `-$${rounded} from yesterday`
}

/**
 * DailyAllowanceHero — the centerpiece of the simplified home screen.
 *
 * Displays the user's remaining daily allowance in large readable typography
 * with an encouraging status message below.
 *
 * Tapping reveals a detailed calculation breakdown (daily budget, rollover, spent today).
 *
 * Validates: Requirements 2.1, 2.3, 2.4, 2.5, 2.6, 2.7
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

  // Determine status and message
  const status: AllowanceStatus = isOverBudget
    ? "over"
    : getStatus(allowanceLeft, dailyBudget)
  const message = generateEncouragingMessage(status, allowanceLeft, spentToday)
  const color = getStatusColor(status)

  if (isLoading) {
    return <HeroSkeleton />
  }

  function handleTap() {
    setShowBreakdown((prev) => !prev)
    triggerHaptic()
    onTapForDetails()
  }

  return (
    <motion.button
      type="button"
      className="flex flex-col items-center gap-2 w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-lg"
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
      }}
      onClick={handleTap}
      aria-label={`Daily allowance: ${formatCurrency(allowanceLeft)}. ${message}. Tap for details.`}
      aria-expanded={showBreakdown}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Progress ring wrapping the allowance amount */}
      <AllowanceRing
        progress={dailyBudget > 0 ? spentToday / dailyBudget : 0}
        status={status}
        size={180}
        strokeWidth={6}
      >
        {/* Large allowance amount */}
        <AnimatePresence mode="wait">
          <motion.span
            key={allowanceLeft}
            className="block text-center"
            style={{
              fontSize: 48,
              fontWeight: 300,
              fontFamily: "'Inter', sans-serif",
              lineHeight: 1.1,
              color,
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            aria-hidden="true"
          >
            {formatCurrency(allowanceLeft)}
          </motion.span>
        </AnimatePresence>
      </AllowanceRing>

      {/* Encouraging message */}
      <motion.p
        className="text-center text-sm"
        style={{ color: "var(--sub)", maxWidth: 280 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        {message}
      </motion.p>

      {/* Breakdown panel */}
      <AnimatePresence>
        {showBreakdown && (
          <motion.div
            className="w-full mt-3"
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              overflow: "hidden",
            }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            role="region"
            aria-label="Allowance breakdown"
          >
            <div className="flex flex-col gap-2">
              {/* Daily budget */}
              <div
                className="flex justify-between items-center text-sm"
                style={{ color: "var(--sub)" }}
              >
                <span>Daily budget</span>
                <span style={{ color: "var(--text)" }}>
                  {formatCurrency(dailyBudget)}/day
                </span>
              </div>

              {/* Rollover */}
              <div
                className="flex justify-between items-center text-sm"
                style={{ color: "var(--sub)" }}
              >
                <span>Rollover</span>
                <span
                  style={{
                    color: rollover >= 0 ? "var(--success)" : "var(--error)",
                  }}
                >
                  {formatRollover(rollover)}
                </span>
              </div>

              {/* Spent today */}
              <div
                className="flex justify-between items-center text-sm"
                style={{ color: "var(--sub)" }}
              >
                <span>Spent today</span>
                <span style={{ color: "var(--text)" }}>
                  {formatCurrency(spentToday)} spent today
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
