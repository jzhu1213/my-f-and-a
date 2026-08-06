"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { getMinBalanceBuffer, setMinBalanceBuffer } from "@/lib/minBalanceBuffer"
import { DEFAULT_MIN_BALANCE_BUFFER } from "@/lib/paySchedule"
import { FONT_FAMILY } from "@/styles/typography"
import { sectionHeader } from "@/styles/shared"

// ============================================================================
// Constants
// ============================================================================

const STEP = 10
const MIN = 0
const MAX = 2000

// ============================================================================
// MinBalanceBufferSetting Component
// ============================================================================

/**
 * MinBalanceBufferSetting — a warm control for the low-balance cushion.
 *
 * Sets the minimum-balance buffer used by the payday-aware overdraft heads-up.
 * When Folio projects your balance would dip below this amount before your next
 * paycheck, it shows a gentle, non-judgmental tip so you can plan ahead.
 *
 * Purely additive and reversible — changing it just adjusts when the heads-up
 * appears. Persisted client-side with a sensible default when unset.
 */
export function MinBalanceBufferSetting() {
  const [buffer, setBuffer] = useState<number>(DEFAULT_MIN_BALANCE_BUFFER)

  // Hydrate from storage on mount (SSR-safe).
  useEffect(() => {
    setBuffer(getMinBalanceBuffer())
  }, [])

  function commit(next: number) {
    const clamped = Math.min(MAX, Math.max(MIN, Math.round(next)))
    setBuffer(clamped)
    setMinBalanceBuffer(clamped)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = Number(e.target.value)
    // Update the visible value freely while typing; clamp on commit.
    setBuffer(Number.isFinite(raw) ? raw : 0)
  }

  return (
    <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
      <p style={{ ...sectionHeader }}>Low-balance buffer</p>

      {/* Description */}
      <p
        style={{
          fontSize: 13,
          color: "var(--sub)",
          lineHeight: 1.5,
          marginBottom: 16,
        }}
      >
        We&rsquo;ll give you a gentle heads-up if your balance looks like it might dip
        below this cushion before your next payday.
      </p>

      {/* Stepper + value */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <motion.button
          onClick={() => commit(buffer - STEP)}
          whileTap={{ scale: 0.96 }}
          transition={springs.bouncy}
          disabled={buffer <= MIN}
          style={{
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: buffer > MIN ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            cursor: buffer > MIN ? "pointer" : "not-allowed",
            color: buffer > MIN ? "var(--text)" : "var(--muted)",
            fontSize: 20,
            fontWeight: 600,
          }}
          aria-label={`Decrease buffer by $${STEP}`}
        >
          −
        </motion.button>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 700, color: "var(--sub)" }}>$</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN}
            max={MAX}
            step={STEP}
            value={buffer}
            onChange={handleInputChange}
            onBlur={() => commit(buffer)}
            aria-label="Low-balance buffer amount in dollars"
            style={{
              width: 90,
              textAlign: "center",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text)",
              fontFamily: FONT_FAMILY,
              fontVariantNumeric: "tabular-nums",
              background: "transparent",
              border: "none",
              outline: "none",
              padding: 0,
              // Hide native number spinners for a cleaner, warmer look.
              MozAppearance: "textfield",
            }}
          />
        </div>

        <motion.button
          onClick={() => commit(buffer + STEP)}
          whileTap={{ scale: 0.96 }}
          transition={springs.bouncy}
          disabled={buffer >= MAX}
          style={{
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: buffer < MAX ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            cursor: buffer < MAX ? "pointer" : "not-allowed",
            color: buffer < MAX ? "var(--text)" : "var(--muted)",
            fontSize: 20,
            fontWeight: 600,
          }}
          aria-label={`Increase buffer by $${STEP}`}
        >
          +
        </motion.button>
      </div>

      {/* Hide WebKit number spinners */}
      <style jsx>{`
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </GlassCard>
  )
}
