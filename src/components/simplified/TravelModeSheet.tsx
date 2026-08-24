"use client"

/**
 * TravelModeSheet — Quick travel mode activation bottom sheet.
 *
 * "Going somewhere?" One-tap activation: pick a currency → set optional
 * daily budget → optional destination label → done. When travel mode is
 * already active, shows status and "End trip" button. On ending, shows a
 * TripSpendingSummary before confirming deactivation.
 *
 * Task 424.2, Task 425.3
 * Requirements: 24.4
 */

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs, timings, useReducedMotion } from "@/lib/animations"
import { spacingScale } from "@/styles/layout"
import { typography, pxToRem, fontWeights } from '@/styles/typography'
import { textColors, colorRamp } from "@/styles/colors"
import { elevations, radius } from "@/styles/surfaces"
import { fills } from "@/styles/shared"
import {
  isTravelModeActive,
  getTravelModeConfig,
  setTravelModeConfig,
  clearTravelMode,
} from "@/lib/travelMode"
import type { TravelModeConfig } from "@/lib/travelMode"
import { CURRENCIES } from "@/lib/currencyUtils"
import { getHomeCurrency } from "@/lib/currencyPreferences"
import { TripSpendingSummary } from "./TripSpendingSummary"
import type { Transaction } from "@/types"

// ============================================================================
// Types
// ============================================================================

export interface TravelModeSheetProps {
  open: boolean
  onClose: () => void
  /** All transactions — needed for the trip summary on deactivation */
  transactions?: Transaction[]
}

// ============================================================================
// Popular travel currencies (sorted by common study-abroad destinations)
// ============================================================================

const POPULAR_CODES = ["EUR", "GBP", "JPY", "CAD", "AUD", "KRW", "THB", "MXN", "CNY", "CHF"]

// ============================================================================
// Component
// ============================================================================

export function TravelModeSheet({ open, onClose, transactions = [] }: TravelModeSheetProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [isActive, setIsActive] = useState(false)
  const [config, setConfig] = useState<TravelModeConfig | null>(null)
  const [showingSummary, setShowingSummary] = useState(false)

  // Form state
  const [selectedCurrency, setSelectedCurrency] = useState<string>("")
  const [dailyBudget, setDailyBudget] = useState<string>("")
  const [destinationLabel, setDestinationLabel] = useState<string>("")

  // Load current state on open
  useEffect(() => {
    if (open) {
      const active = isTravelModeActive()
      setIsActive(active)
      setShowingSummary(false)
      if (active) {
        const existing = getTravelModeConfig()
        setConfig(existing)
      } else {
        setConfig(null)
        setSelectedCurrency("")
        setDailyBudget("")
        setDestinationLabel("")
      }
    }
  }, [open])

  const homeCurrency = typeof window !== "undefined" ? getHomeCurrency() : "USD"
  const availableCurrencies = CURRENCIES.filter((c) => c.code !== homeCurrency)
  const popularCurrencies = availableCurrencies.filter((c) => POPULAR_CODES.includes(c.code))

  function handleActivate() {
    if (!selectedCurrency) return
    const newConfig: TravelModeConfig = {
      currency: selectedCurrency,
      ...(dailyBudget && Number(dailyBudget) > 0 ? { dailyBudgetOverride: Number(dailyBudget) } : {}),
      ...(destinationLabel.trim() ? { destinationLabel: destinationLabel.trim() } : {}),
      startDate: new Date().toISOString().split("T")[0],
    }
    setTravelModeConfig(newConfig)
    setIsActive(true)
    setConfig(newConfig)
    onClose()
  }

  function handleEndTrip() {
    // Task 425.3: Show trip summary before clearing
    setShowingSummary(true)
  }

  function handleConfirmEndTrip() {
    clearTravelMode()
    setIsActive(false)
    setConfig(null)
    setShowingSummary(false)
    onClose()
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
          background: "var(--color-canvas)",
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
        aria-label={isActive ? "Travel mode active" : "Activate travel mode"}
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

        {isActive && config ? (
          /* ── Active state ──────────────────────────────────────── */
          <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["16"] }}>
            <h2 style={{ ...typography.headline, color: textColors.text, margin: 0 }}>
              {showingSummary ? "🏠 Welcome back!" : "✈️ Travel mode active"}
            </h2>

            {showingSummary ? (
              /* ── Trip summary before deactivation (Task 425.3) ──── */
              <>
                <TripSpendingSummary
                  transactions={transactions}
                  tripCurrency={config.currency}
                  label={config.destinationLabel ? `${config.destinationLabel} Trip` : undefined}
                />

                <button
                  type="button"
                  onClick={handleConfirmEndTrip}
                  style={{
                    width: "100%",
                    padding: `${spacingScale["12"]} ${spacingScale["20"]}`,
                    background: colorRamp.accent[500],
                    color: "var(--text)",
                    border: "none",
                    borderRadius: radius.control,
                    cursor: "pointer",
                    ...typography.body,
                    fontWeight: fontWeights.medium,
                  }}
                >
                  Back home
                </button>

                <button
                  type="button"
                  onClick={() => setShowingSummary(false)}
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
                  Keep traveling
                </button>
              </>
            ) : (
              /* ── Normal active state ─────────────────────────────── */
              <>
                <div
                  style={{
                    padding: spacingScale["16"],
                    background: colorRamp.accent[50],
                    border: `1px solid ${colorRamp.accent[200]}`,
                    borderRadius: radius.card,
                  }}
                >
                  <p style={{ ...typography.body, color: textColors.text, margin: 0 }}>
                    {config.destinationLabel
                      ? `${config.destinationLabel} (${config.currency})`
                      : config.currency}
                  </p>
                  {config.dailyBudgetOverride && (
                    <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0, marginTop: 4 }}>
                      Daily budget: ${config.dailyBudgetOverride}
                    </p>
                  )}
                  {config.startDate && (
                    <p style={{ ...typography["body-sm"], color: textColors.muted, margin: 0, marginTop: 4 }}>
                      Since {config.startDate}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleEndTrip}
                  style={{
                    width: "100%",
                    padding: `${spacingScale["12"]} ${spacingScale["20"]}`,
                    background: colorRamp.error[500],
                    color: "var(--text)",
                    border: "none",
                    borderRadius: radius.control,
                    cursor: "pointer",
                    ...typography.body,
                    fontWeight: fontWeights.medium,
                  }}
                >
                  End trip
                </button>

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
              </>
            )}
          </div>
        ) : (
          /* ── Activation form ──────────────────────────────────── */
          <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["20"] }}>
            <div>
              <h2 style={{ ...typography.headline, color: textColors.text, margin: 0 }}>
                ✈️ Going somewhere?
              </h2>
              <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0, marginTop: 4 }}>
                Set your travel currency and Folio will log in it by default.
              </p>
            </div>

            {/* Currency selection */}
            <div>
              <label
                style={{ ...typography["body-sm"], color: textColors.muted, display: "block", marginBottom: spacingScale["8"] }}
              >
                Destination currency
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: spacingScale["8"] }}>
                {popularCurrencies.map((currency) => (
                  <button
                    key={currency.code}
                    type="button"
                    onClick={() => setSelectedCurrency(currency.code)}
                    aria-pressed={selectedCurrency === currency.code}
                    style={{
                      padding: `${spacingScale["8"]} ${spacingScale["12"]}`,
                      background: selectedCurrency === currency.code ? colorRamp.accent[100] : fills[4],
                      border: `1px solid ${selectedCurrency === currency.code ? colorRamp.accent[400] : fills[8]}`,
                      borderRadius: radius.control,
                      cursor: "pointer",
                      ...typography["body-sm"],
                      color: selectedCurrency === currency.code ? textColors.text : textColors.sub,
                      fontWeight: selectedCurrency === currency.code ? 500 : 400,
                    }}
                  >
                    {currency.symbol} {currency.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional daily budget */}
            <div>
              <label
                htmlFor="travel-daily-budget"
                style={{ ...typography["body-sm"], color: textColors.muted, display: "block", marginBottom: spacingScale["8"] }}
              >
                Daily budget override (optional, in {homeCurrency})
              </label>
              <input
                id="travel-daily-budget"
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

            {/* Optional destination label */}
            <div>
              <label
                htmlFor="travel-destination"
                style={{ ...typography["body-sm"], color: textColors.muted, display: "block", marginBottom: spacingScale["8"] }}
              >
                Destination (optional)
              </label>
              <input
                id="travel-destination"
                type="text"
                placeholder="e.g. London, Tokyo"
                value={destinationLabel}
                onChange={(e) => setDestinationLabel(e.target.value)}
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

            {/* Activate button */}
            <button
              type="button"
              onClick={handleActivate}
              disabled={!selectedCurrency}
              aria-label={selectedCurrency ? `Start travel mode with ${selectedCurrency}` : "Select a currency first"}
              style={{
                width: "100%",
                padding: `${spacingScale["12"]} ${spacingScale["20"]}`,
                background: selectedCurrency ? colorRamp.accent[500] : fills[6],
                color: selectedCurrency ? "var(--text)" : textColors.muted,
                border: "none",
                borderRadius: radius.control,
                cursor: selectedCurrency ? "pointer" : "not-allowed",
                ...typography.body,
                fontWeight: fontWeights.medium,
                opacity: selectedCurrency ? 1 : 0.6,
              }}
            >
              {selectedCurrency ? `Start travel mode → ${selectedCurrency}` : "Pick a currency to start"}
            </button>
          </div>
        )}
      </motion.div>
    </>
  )
}
