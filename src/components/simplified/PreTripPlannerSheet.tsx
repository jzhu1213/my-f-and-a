"use client"

/**
 * PreTripPlannerSheet — Plan your travel budget before you leave.
 *
 * A simple planning sheet: "How many days?" × "Daily budget?" = total trip budget.
 * Optional breakdown by category (food/transport/activities/accommodation).
 * Includes a "Start trip" button that activates travel mode with those settings.
 *
 * Task 425.2
 * Requirements: 24.4
 */

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { useReducedMotion } from "@/lib/animations"
import { spacingScale } from "@/styles/layout"
import { typography } from "@/styles/typography"
import { textColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { fills } from "@/styles/shared"
import { getHomeCurrency } from "@/lib/currencyPreferences"
import { getCurrencySymbol } from "@/lib/currencyUtils"

// ============================================================================
// Types
// ============================================================================

export interface PreTripPlannerSheetProps {
  open: boolean
  onClose: () => void
  /** Called when the user wants to start the trip with these settings */
  onStartTrip?: (settings: TripPlanSettings) => void
}

export interface TripPlanSettings {
  days: number
  dailyBudget: number
  categories?: CategoryBreakdown
}

interface CategoryBreakdown {
  food: number
  transport: number
  activities: number
  accommodation: number
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CATEGORIES: CategoryBreakdown = {
  food: 40,
  transport: 20,
  activities: 20,
  accommodation: 20,
}

const CATEGORY_LABELS: Record<keyof CategoryBreakdown, string> = {
  food: "🍽️ Food",
  transport: "🚌 Transport",
  activities: "🎯 Activities",
  accommodation: "🏨 Accommodation",
}

// ============================================================================
// Component
// ============================================================================

export function PreTripPlannerSheet({ open, onClose, onStartTrip }: PreTripPlannerSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [days, setDays] = useState<string>("")
  const [dailyBudget, setDailyBudget] = useState<string>("")
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [categories, setCategories] = useState<CategoryBreakdown>(DEFAULT_CATEGORIES)

  const homeCurrency = typeof window !== "undefined" ? getHomeCurrency() : "USD"
  const currencySymbol = getCurrencySymbol(homeCurrency)

  const daysNum = Number(days) || 0
  const dailyNum = Number(dailyBudget) || 0
  const totalBudget = daysNum * dailyNum

  const categoryAmounts = useMemo(() => {
    if (!showBreakdown || dailyNum <= 0) return null
    const totalPercent = categories.food + categories.transport + categories.activities + categories.accommodation
    if (totalPercent === 0) return null
    return {
      food: (categories.food / totalPercent) * dailyNum,
      transport: (categories.transport / totalPercent) * dailyNum,
      activities: (categories.activities / totalPercent) * dailyNum,
      accommodation: (categories.accommodation / totalPercent) * dailyNum,
    }
  }, [showBreakdown, dailyNum, categories])

  function handleStartTrip() {
    if (daysNum <= 0 || dailyNum <= 0) return
    onStartTrip?.({
      days: daysNum,
      dailyBudget: dailyNum,
      categories: showBreakdown ? categories : undefined,
    })
    onClose()
  }

  function updateCategory(key: keyof CategoryBreakdown, value: string) {
    const num = Math.max(0, Math.min(100, Number(value) || 0))
    setCategories((prev) => ({ ...prev, [key]: num }))
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <motion.div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 999,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Pre-trip budget planner"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: elevations.raised.fill,
          borderTop: `1px solid ${elevations.raised.border}`,
          borderRadius: "20px 20px 0 0",
          padding: `${spacingScale["24"]} ${spacingScale["20"]} ${spacingScale["40"]}`,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        initial={prefersReducedMotion ? { opacity: 0 } : { y: "100%" }}
        animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { y: "100%" }}
        transition={springs.gentle}
      >
        {/* Handle */}
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: fills[10],
            margin: "0 auto 16px",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["20"] }}>
          {/* Header */}
          <div>
            <h2 style={{ ...typography.headline, color: textColors.text, margin: 0 }}>
              🗺️ Plan your trip
            </h2>
            <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0, marginTop: 4 }}>
              Figure out how much you need before you go.
            </p>
          </div>

          {/* Days input */}
          <div>
            <label
              htmlFor="trip-days"
              style={{ ...typography["body-sm"], color: textColors.muted, display: "block", marginBottom: spacingScale["8"] }}
            >
              How many days?
            </label>
            <input
              id="trip-days"
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="e.g. 7"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              style={{
                width: "100%",
                padding: `${spacingScale["12"]} ${spacingScale["12"]}`,
                background: fills[4],
                border: `1px solid ${fills[8]}`,
                borderRadius: radius.control,
                color: textColors.text,
                ...typography.body,
                outline: "none",
              }}
            />
          </div>

          {/* Daily budget input */}
          <div>
            <label
              htmlFor="trip-daily-budget"
              style={{ ...typography["body-sm"], color: textColors.muted, display: "block", marginBottom: spacingScale["8"] }}
            >
              Daily budget ({currencySymbol})
            </label>
            <input
              id="trip-daily-budget"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="e.g. 80"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              style={{
                width: "100%",
                padding: `${spacingScale["12"]} ${spacingScale["12"]}`,
                background: fills[4],
                border: `1px solid ${fills[8]}`,
                borderRadius: radius.control,
                color: textColors.text,
                ...typography.body,
                outline: "none",
              }}
            />
          </div>

          {/* Total display */}
          {daysNum > 0 && dailyNum > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springs.snappy}
              style={{
                padding: spacingScale["16"],
                background: colorRamp.accent[50],
                border: `1px solid ${colorRamp.accent[200]}`,
                borderRadius: radius.card,
                textAlign: "center",
              }}
            >
              <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0, marginBottom: 4 }}>
                Total trip budget
              </p>
              <p style={{ ...typography.headline, color: textColors.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                {currencySymbol}{totalBudget.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p style={{ ...typography["body-sm"], color: textColors.muted, margin: 0, marginTop: 4 }}>
                {daysNum} {daysNum === 1 ? "day" : "days"} × {currencySymbol}{dailyNum}/day
              </p>
            </motion.div>
          )}

          {/* Category breakdown toggle */}
          <button
            type="button"
            onClick={() => setShowBreakdown(!showBreakdown)}
            style={{
              background: "transparent",
              border: "none",
              padding: `${spacingScale["8"]} 0`,
              cursor: "pointer",
              ...typography["body-sm"],
              color: colorRamp.accent[500],
              textAlign: "left",
            }}
          >
            {showBreakdown ? "▾ Hide category breakdown" : "▸ Add category breakdown"}
          </button>

          {/* Category breakdown */}
          {showBreakdown && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              style={{ display: "flex", flexDirection: "column", gap: spacingScale["12"] }}
            >
              {(Object.keys(CATEGORY_LABELS) as Array<keyof CategoryBreakdown>).map((key) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: spacingScale["12"] }}>
                  <span style={{ ...typography["body-sm"], color: textColors.sub, minWidth: 120 }}>
                    {CATEGORY_LABELS[key]}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    value={categories[key]}
                    onChange={(e) => updateCategory(key, e.target.value)}
                    aria-label={`${key} percentage`}
                    style={{
                      width: 60,
                      padding: `${spacingScale["8"]} ${spacingScale["8"]}`,
                      background: fills[4],
                      border: `1px solid ${fills[8]}`,
                      borderRadius: radius.control,
                      color: textColors.text,
                      ...typography["body-sm"],
                      textAlign: "center",
                      outline: "none",
                    }}
                  />
                  <span style={{ ...typography["body-sm"], color: textColors.muted }}>%</span>
                  {categoryAmounts && (
                    <span style={{ ...typography["body-sm"], color: textColors.sub, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                      {currencySymbol}{categoryAmounts[key].toFixed(0)}/day
                    </span>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          {/* Start trip button */}
          <button
            type="button"
            onClick={handleStartTrip}
            disabled={daysNum <= 0 || dailyNum <= 0}
            style={{
              width: "100%",
              padding: `${spacingScale["12"]} ${spacingScale["20"]}`,
              background: daysNum > 0 && dailyNum > 0 ? colorRamp.accent[500] : fills[6],
              color: daysNum > 0 && dailyNum > 0 ? "#fff" : textColors.muted,
              border: "none",
              borderRadius: radius.control,
              cursor: daysNum > 0 && dailyNum > 0 ? "pointer" : "not-allowed",
              ...typography.body,
              fontWeight: 500,
              opacity: daysNum > 0 && dailyNum > 0 ? 1 : 0.6,
            }}
          >
            Use this as my travel budget
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              padding: `${spacingScale["12"]} ${spacingScale["20"]}`,
              background: "transparent",
              color: textColors.sub,
              border: `1px solid ${elevations.resting.border}`,
              borderRadius: radius.control,
              cursor: "pointer",
              ...typography["body-sm"],
            }}
          >
            Close
          </button>
        </div>
      </motion.div>
    </>
  )
}
