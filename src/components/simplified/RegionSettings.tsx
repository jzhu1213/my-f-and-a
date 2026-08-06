"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import { sectionHeadingStrong } from "@/styles/shared"
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
    <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
      <p style={{ ...sectionHeadingStrong, marginBottom: 4 }}>Region</p>
      <p
        style={{
          fontSize: 13,
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
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          cursor: "pointer",
          fontFamily: FONT_FAMILY,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">{current.flag}</span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              {current.name}
            </span>
            <span style={{ fontSize: 12, color: "var(--sub)" }}>
              {current.currency} ({getRegionCurrencySymbol(region)})
              {currencyMeta ? ` · ${currencyMeta.name}` : ""}
            </span>
          </span>
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={springs.snappy}
          style={{ color: "var(--sub)", fontSize: 14 }}
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
                      gap: 10,
                      width: "100%",
                      padding: "11px 12px",
                      background: isActive ? "rgba(167, 139, 250, 0.12)" : "transparent",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: FONT_FAMILY,
                    }}
                    aria-label={`Set region to ${r.name}`}
                  >
                    <span style={{ fontSize: 18 }} aria-hidden="true">{r.flag}</span>
                    <span style={{ flex: 1 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 14,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? "var(--text)" : "var(--sub)",
                        }}
                      >
                        {r.name}
                      </span>
                      <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
                        {r.currency} ({getRegionCurrencySymbol(r.code)})
                      </span>
                    </span>
                    {isActive && (
                      <span style={{ color: "rgba(167, 139, 250, 0.95)", fontSize: 15 }} aria-hidden="true">
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
