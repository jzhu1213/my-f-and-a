"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { sectionHeader } from "@/styles/shared"
import { radius } from '@/styles/surfaces'
import {
  REGION_LIST,
  getRegion,
  setRegion,
  getRegionDefaults,
  getRegionCurrencySymbol,
  type RegionCode,
} from "@/lib/regionDefaults"
import { getCurrency } from "@/lib/currencyUtils"

// ============================================================================
// RegionSettings — pick your region; it sets sensible local defaults
// ============================================================================
//
// Task 198.1 — Region-aware defaults (Group 28: Internationalization).
//
// A warm, self-contained control (mirrors MinBalanceBufferSetting / AppLockSetting).
// New users get sensible defaults detected from their device; anyone can change
// their region here at any time. Choosing a region updates the DEFAULT currency
// and display locale — it never rewrites money you've already logged.

export function RegionSettings() {
  const [region, setRegionState] = useState<RegionCode>("US")
  const [expanded, setExpanded] = useState(false)

  // Hydrate from storage/detection on mount (SSR-safe).
  useEffect(() => {
    setRegionState(getRegion())
  }, [])

  const current = getRegionDefaults(region)
  const currencyMeta = getCurrency(current.currency)

  function choose(next: RegionCode) {
    setRegionState(next)
    setRegion(next)
    setExpanded(false)
  }

  return (
    <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: spacing.md }}>
      <p style={{ ...sectionHeader, marginBottom: 4 }}>Region</p>
      <p
        style={{
          fontSize: typography['body-sm'].fontSize,
          color: "var(--sub)",
          lineHeight: 1.5,
          marginBottom: 14,
        }}
      >
        Sets your starting currency, formatting, and handy amount shortcuts. You
        can change this anytime — it won&rsquo;t touch anything you&rsquo;ve already logged.
      </p>

      {/* Current selection — tap to expand the picker */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label="Change region"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "12px 14px",
          background: "var(--fill-04)",
          border: "1px solid var(--border)",
          borderRadius: radius.control,
          cursor: "pointer",
          fontFamily: FONT_FAMILY,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <span style={{ fontSize: typography.subhead.fontSize }} aria-hidden="true">{current.flag}</span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: "var(--text)" }}>
              {current.name}
            </span>
            <span style={{ fontSize: typography['body-sm'].fontSize, color: "var(--sub)" }}>
              {current.currency} ({getRegionCurrencySymbol(region)})
              {currencyMeta ? ` · ${currencyMeta.name}` : ""}
            </span>
          </span>
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={springs.snappy}
          style={{ color: "var(--sub)", fontSize: typography.body.fontSize }}
          aria-hidden="true"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="region-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.gentle}
            style={{ overflow: "hidden" }}
          >
            <div
              role="listbox"
              aria-label="Choose a region"
              style={{ display: "flex", flexDirection: "column", paddingTop: 10 }}
            >
              {REGION_LIST.map((r) => {
                const isActive = r.code === region
                return (
                  <motion.button
                    key={r.code}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => choose(r.code)}
                    whileTap={{ scale: 0.98 }}
                    transition={springs.snappy}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: spacing.sm,
                      width: "100%",
                      padding: "11px 12px",
                      background: isActive ? "var(--accent-200)" : "transparent",
                      border: "none",
                      borderRadius: radius.control,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: FONT_FAMILY,
                    }}
                    aria-label={`Set region to ${r.name}`}
                  >
                    <span style={{ fontSize: typography.subhead.fontSize }} aria-hidden="true">{r.flag}</span>
                    <span style={{ flex: 1 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: typography.body.fontSize,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? "var(--text)" : "var(--sub)",
                        }}
                      >
                        {r.name}
                      </span>
                      <span style={{ display: "block", fontSize: typography['body-sm'].fontSize, color: "var(--muted)" }}>
                        {r.currency} ({getRegionCurrencySymbol(r.code)})
                      </span>
                    </span>
                    {isActive && (
                      <span style={{ color: "var(--accent-500)", fontSize: typography.body.fontSize }} aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  )
}
