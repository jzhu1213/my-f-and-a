"use client"

/**
 * useTimeOfDay
 *
 * Returns the current time-of-day period and atmosphere parameters that subtly
 * modulate the hero's ambient glow warmth and breathing rhythm across the day.
 *
 * Periods:
 *   morning (6am–11am)  → brighter, optimistic — cooler tint, faster breathe
 *   midday  (11am–4pm)  → neutral/default — standard glow, normal rhythm
 *   evening (4pm–8pm)   → warmer, calmer — amber shift, slower breathe
 *   night   (8pm–6am)   → sleepy/cozy — deep warm purple, slowest breathe
 *
 * This is purely atmospheric — it never changes the status color semantics
 * (healthy=green, caution=amber, etc). Think of it as a barely-perceptible
 * warmth shift underneath the status glow.
 *
 * Updates every 15 minutes so the transition between periods feels natural
 * without per-second overhead.
 *
 * Reduced-motion: returns static values (no animation duration changes needed
 * since `.hero-breathe` already has `animation: none` under reduced-motion).
 *
 * Validates: Task 249.1
 */

import { useState, useEffect } from "react"
import { useReducedMotion } from "@/lib/animations"

// ─── Types ──────────────────────────────────────────────────────────────────

export type TimePeriod = "morning" | "midday" | "evening" | "night"

export interface TimeAtmosphere {
  /** Current time-of-day period. */
  period: TimePeriod
  /** Breathing animation duration in seconds. */
  breatheDuration: number
  /** Minimum opacity during the breathe cycle. */
  breatheOpacityMin: number
  /** Maximum opacity during the breathe cycle. */
  breatheOpacityMax: number
  /** Scale at the peak of the breathe cycle. */
  breatheScale: number
  /** Subtle tint color applied as a barely-visible overlay underneath the status glow. */
  tintColor: string
  /** Whether reduced motion is active. */
  prefersReducedMotion: boolean
}

// ─── Atmosphere presets per period ──────────────────────────────────────────

const ATMOSPHERE: Record<TimePeriod, Omit<TimeAtmosphere, "period" | "prefersReducedMotion">> = {
  morning: {
    breatheDuration: 3.5,
    breatheOpacityMin: 0.72,
    breatheOpacityMax: 0.97,
    breatheScale: 1.06,
    // Cooler/fresher tint — hint of teal-blue
    tintColor: "rgba(120, 200, 220, 0.04)",
  },
  midday: {
    breatheDuration: 4.5,
    breatheOpacityMin: 0.7,
    breatheOpacityMax: 0.95,
    breatheScale: 1.05,
    // Neutral — no tint shift
    tintColor: "rgba(129, 140, 248, 0.02)",
  },
  evening: {
    breatheDuration: 5.5,
    breatheOpacityMin: 0.68,
    breatheOpacityMax: 0.92,
    breatheScale: 1.04,
    // Warmer — amber/warm-orange tint
    tintColor: "rgba(251, 191, 80, 0.05)",
  },
  night: {
    breatheDuration: 6.5,
    breatheOpacityMin: 0.65,
    breatheOpacityMax: 0.88,
    breatheScale: 1.03,
    // Deep warm purple — cozy
    tintColor: "rgba(160, 100, 200, 0.05)",
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Determine the time-of-day period from the current hour. */
function getPeriod(hour: number): TimePeriod {
  if (hour >= 6 && hour < 11) return "morning"
  if (hour >= 11 && hour < 16) return "midday"
  if (hour >= 16 && hour < 20) return "evening"
  return "night"
}

/** Update interval — 15 minutes in ms. */
const UPDATE_INTERVAL_MS = 15 * 60 * 1000

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Returns the current time-of-day atmosphere parameters.
 *
 * Cheap to call — only re-renders every 15 minutes (on period boundary checks).
 * Under reduced-motion, returns the midday defaults (static, no animation
 * changes) since the CSS already suppresses the animation itself.
 */
export function useTimeOfDay(): TimeAtmosphere {
  const { prefersReducedMotion } = useReducedMotion()

  const [period, setPeriod] = useState<TimePeriod>(() => getPeriod(new Date().getHours()))

  useEffect(() => {
    // Check immediately in case SSR/hydration had a stale value
    setPeriod(getPeriod(new Date().getHours()))

    const interval = setInterval(() => {
      setPeriod(getPeriod(new Date().getHours()))
    }, UPDATE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [])

  // Under reduced-motion, return static midday defaults — the animation
  // is already suppressed by CSS, so these values are informational only.
  if (prefersReducedMotion) {
    return {
      period,
      ...ATMOSPHERE.midday,
      prefersReducedMotion: true,
    }
  }

  const atmo = ATMOSPHERE[period]
  return {
    period,
    ...atmo,
    prefersReducedMotion: false,
  }
}
