"use client"

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs, useReducedMotion } from '@/lib/animations'
import { triggerHaptic } from '@/lib/haptics'
import { CURRENCIES, getCurrencySymbol, normalizeCode, formatCurrency } from '@/lib/currencyUtils'
import { getHomeCurrency } from '@/lib/currencyPreferences'
import { getRate } from '@/lib/exchangeRates'
import { getTravelCurrency } from '@/lib/travelMode'
import { FONT_FAMILY, pxToRem, fontWeights } from '@/styles/typography'
import { fills, colorRamp } from '@/styles/shared'
import { radius } from '@/styles/surfaces'

// ============================================================================
// Types
// ============================================================================

interface CurrencySelectorProps {
  /** Currently selected currency code (controlled). */
  selectedCurrency: string
  /** Called when user picks a different currency. */
  onCurrencyChange: (code: string) => void
  /** The entered amount (in the selected currency) — used for conversion preview. */
  amount: number
  /** Whether to show the conversion preview below (when amount > 0 and foreign). */
  showPreview?: boolean
}

// ============================================================================
// Component
// ============================================================================

/**
 * CurrencySelector — a compact chip that expands into a picker on tap.
 *
 * Shows the active currency symbol as a small pill. When tapped, expands to
 * show a grid of common currencies. When a foreign currency is selected and
 * an amount is entered, shows a "€25 ≈ $27.15" conversion preview.
 *
 * Invisible to single-currency users: if only the home currency is used and
 * travel mode is inactive, the chip shows just the home symbol and tapping
 * still allows switching (progressive disclosure).
 *
 * Task 422.1 — Requirements: 24.2
 */
export function CurrencySelector({
  selectedCurrency,
  onCurrencyChange,
  amount,
  showPreview = true,
}: CurrencySelectorProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [isExpanded, setIsExpanded] = useState(false)
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null)
  const [homeCurrency, setHomeCurrency] = useState<string>('USD')

  // Resolve home currency on mount
  useEffect(() => {
    setHomeCurrency(normalizeCode(getHomeCurrency()))
  }, [])

  const isForeign = normalizeCode(selectedCurrency) !== normalizeCode(homeCurrency)

  // Compute conversion preview when a foreign currency is selected
  useEffect(() => {
    if (!isForeign || amount <= 0 || !showPreview) {
      setConvertedAmount(null)
      return
    }

    let cancelled = false
    async function fetchConversion() {
      const rate = await getRate(selectedCurrency, homeCurrency)
      if (cancelled) return
      if (rate !== null) {
        setConvertedAmount(amount * rate)
      } else {
        setConvertedAmount(null)
      }
    }
    fetchConversion()
    return () => { cancelled = true }
  }, [selectedCurrency, homeCurrency, amount, isForeign, showPreview])

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev)
    triggerHaptic('light')
  }, [])

  const handleSelect = useCallback((code: string) => {
    onCurrencyChange(code)
    setIsExpanded(false)
    triggerHaptic('light')
  }, [onCurrencyChange])

  // Build the currency list: home first, then travel currency (if active), then the rest
  const travelCurrency = getTravelCurrency()
  const sortedCurrencies = (() => {
    const home = normalizeCode(homeCurrency)
    const travel = travelCurrency ? normalizeCode(travelCurrency) : null

    // Start with home currency, then travel, then the rest sorted
    const ordered = CURRENCIES.filter(
      (c) => c.code !== home && c.code !== travel
    )

    const result = []
    const homeCurr = CURRENCIES.find((c) => c.code === home)
    if (homeCurr) result.push(homeCurr)
    if (travel) {
      const travelCurr = CURRENCIES.find((c) => c.code === travel)
      if (travelCurr) result.push(travelCurr)
    }
    result.push(...ordered)
    return result
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* Currency chip button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Currency: ${selectedCurrency}. Tap to change.`}
        aria-expanded={isExpanded}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '5px 10px',
          background: isForeign ? colorRamp.accent[100] : fills[4],
          border: isForeign
            ? `1px solid ${colorRamp.accent[300]}`
            : `1px solid ${fills[10]}`,
          borderRadius: radius.full,
          cursor: 'pointer',
          fontSize: pxToRem(12),
          fontWeight: fontWeights.medium,
          fontFamily: FONT_FAMILY,
          color: isForeign ? 'var(--accent)' : 'var(--sub)',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <span style={{ fontSize: pxToRem(13) }}>{getCurrencySymbol(selectedCurrency)}</span>
        <span>{normalizeCode(selectedCurrency)}</span>
        <span
          style={{
            fontSize: pxToRem(9),
            opacity: 0.7,
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* Expanded currency picker */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="currency-picker"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scaleY: 0.95 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scaleY: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scaleY: 0.95 }}
            transition={springs.snappy}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              padding: 10,
              background: fills[4],
              border: `1px solid ${fills[10]}`,
              borderRadius: radius.control,
              maxWidth: 320,
              justifyContent: 'center',
              transformOrigin: 'top center',
            }}
            role="listbox"
            aria-label="Select currency"
          >
            {sortedCurrencies.map((currency) => {
              const isSelected = normalizeCode(selectedCurrency) === currency.code
              const isHome = currency.code === normalizeCode(homeCurrency)
              const isTravel = currency.code === travelCurrency
              return (
                <button
                  key={currency.code}
                  type="button"
                  onClick={() => handleSelect(currency.code)}
                  role="option"
                  aria-selected={isSelected}
                  aria-label={`${currency.name} (${currency.code})${isHome ? ' — home' : ''}${isTravel ? ' — travel' : ''}`}
                  style={{
                    padding: '6px 10px',
                    minHeight: 32,
                    background: isSelected
                      ? colorRamp.accent[200]
                      : 'transparent',
                    border: isSelected
                      ? `1px solid ${colorRamp.accent[400]}`
                      : '1px solid transparent',
                    borderRadius: radius.full,
                    cursor: 'pointer',
                    fontSize: pxToRem(12),
                    fontWeight: isSelected ? 600 : 400,
                    fontFamily: FONT_FAMILY,
                    color: isSelected ? 'var(--accent)' : 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: pxToRem(13) }}>{currency.symbol}</span>
                  <span>{currency.code}</span>
                  {isHome && (
                    <span style={{ fontSize: pxToRem(9), opacity: 0.6 }}>home</span>
                  )}
                  {isTravel && !isHome && (
                    <span style={{ fontSize: pxToRem(9), opacity: 0.6 }}>travel</span>
                  )}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversion preview — "€25 ≈ $27.15" */}
      <AnimatePresence>
        {isForeign && showPreview && convertedAmount !== null && amount > 0 && (
          <motion.p
            key="conversion-preview"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={springs.snappy}
            style={{
              fontSize: pxToRem(12),
              color: 'var(--sub)',
              fontFamily: FONT_FAMILY,
              fontVariantNumeric: 'tabular-nums',
              margin: 0,
              textAlign: 'center',
            }}
            aria-live="polite"
            aria-label={`${formatCurrency(amount, selectedCurrency)} is approximately ${formatCurrency(convertedAmount, homeCurrency)}`}
          >
            {formatCurrency(amount, selectedCurrency)} ≈ {formatCurrency(convertedAmount, homeCurrency)}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
