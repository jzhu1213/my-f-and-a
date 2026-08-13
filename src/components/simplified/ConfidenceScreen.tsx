"use client"

/**
 * ConfidenceScreen — A warm, journal-like view of the user's money confidence.
 *
 * Shows:
 * - Current tier name with warm copy
 * - Score ring (radial progress, 0–100)
 * - Trend line (sparkline from history entries)
 * - Factor breakdown with strongest habit highlighted
 * - Enable/disable toggle (opt-in control)
 *
 * Requirements: 19.7
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion } from "framer-motion"
import { useReducedMotion } from "@/lib/animations"
import { SectionHeader, Card } from "@/components/ui"
import { Icon } from "@/components/ui/Icon"
import { contentColumn, spacingScale } from "@/styles/layout"
import { typography, FONT_FAMILY } from "@/styles/typography"
import { textColors, colorRamp } from "@/styles/colors"
import { radius } from "@/styles/surfaces"
import { safeAreaBottom } from "@/styles/layout"
import {
  isConfidenceEnabled,
  setConfidenceEnabled,
  getConfidenceHistory,
  getScoreTrend,
  getLastConfidenceScore,
  type ConfidenceScore,
  type ConfidenceTier,
  type ConfidenceFactors,
  type ConfidenceHistory,
} from "@/lib/confidenceScore"

// ============================================================================
// Props
// ============================================================================

export interface ConfidenceScreenProps {
  onBack?: () => void
}

// ============================================================================
// Constants
// ============================================================================

const TIER_COLORS: Record<ConfidenceTier, string> = {
  Building: colorRamp.accent[300],
  Growing: colorRamp.accent[400],
  Thriving: colorRamp.accent[500],
  Confident: colorRamp.accent[600],
}

const TIER_COPY: Record<ConfidenceTier, string> = {
  Building: "You're laying the foundation — every small step counts.",
  Growing: "Your habits are taking root. Keep going!",
  Thriving: "You're in a great rhythm. Your consistency shows.",
  Confident: "You've built real money confidence. That's something to be proud of.",
}

const FACTOR_LABELS: Record<keyof ConfidenceFactors, string> = {
  loggingConsistency: "Logging consistency",
  allowanceAdherence: "Daily allowance mindfulness",
  savingsProgress: "Savings progress",
  billPunctuality: "Bill punctuality",
  engagementStreak: "Engagement streak",
}

const FACTOR_ENCOURAGEMENT: Record<keyof ConfidenceFactors, string> = {
  loggingConsistency: "Logging consistency is your strongest habit",
  allowanceAdherence: "Budget mindfulness is your strongest habit",
  savingsProgress: "Saving steadily is your strongest habit",
  billPunctuality: "Paying bills on time is your strongest habit",
  engagementStreak: "Staying engaged is your strongest habit",
}

// ============================================================================
// Score Ring SVG
// ============================================================================

function ScoreRing({ score, tier }: { score: number; tier: ConfidenceTier }) {
  const size = 160
  const strokeWidth = 12
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const progress = Math.max(0, Math.min(100, score))
  const dashOffset = circumference * (1 - progress / 100)

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }} role="img" aria-label={`Confidence score: ${score} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface, #1a1a2e)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TIER_COLORS[tier]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      {/* Center text */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            ...typography.display,
            fontSize: "2rem",
            color: textColors.text,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {score}
        </span>
        <span style={{ ...typography.caption, color: textColors.sub, marginTop: 4 }}>
          out of 100
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Trend Sparkline
// ============================================================================

function TrendSparkline({ history }: { history: ConfidenceHistory }) {
  const entries = history.entries.slice(-12) // last 12 weeks
  if (entries.length < 2) {
    return (
      <p style={{ ...typography["body-sm"], color: textColors.muted, textAlign: "center" }}>
        Check back after a couple of weeks to see your trend.
      </p>
    )
  }

  const scores = entries.map((e) => e.score)
  const min = Math.max(0, Math.min(...scores) - 10)
  const max = Math.min(100, Math.max(...scores) + 10)
  const range = max - min || 1

  const width = 280
  const height = 60
  const padding = 8

  const points = scores.map((s, i) => {
    const x = padding + (i / (scores.length - 1)) * (width - padding * 2)
    const y = height - padding - ((s - min) / range) * (height - padding * 2)
    return `${x},${y}`
  })

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="Score trend over recent weeks">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={colorRamp.accent[500]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dot on last point */}
        {points.length > 0 && (
          <circle
            cx={parseFloat(points[points.length - 1].split(",")[0])}
            cy={parseFloat(points[points.length - 1].split(",")[1])}
            r={4}
            fill={colorRamp.accent[500]}
          />
        )}
      </svg>
    </div>
  )
}

// ============================================================================
// Factor Breakdown
// ============================================================================

function FactorBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: spacingScale["12"] }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ ...typography["body-sm"], color: textColors.sub }}>{label}</span>
        <span style={{ ...typography["body-sm"], color: textColors.text, fontVariantNumeric: "tabular-nums" }}>
          {value}
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: "var(--surface, #1a1a2e)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            height: "100%",
            borderRadius: 2,
            background: colorRamp.accent[500],
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ConfidenceScreen({ onBack }: ConfidenceScreenProps) {
  const [enabled, setEnabled] = useState(false)
  const [history, setHistory] = useState<ConfidenceHistory | null>(null)
  const { prefersReducedMotion } = useReducedMotion()

  useEffect(() => {
    setEnabled(isConfidenceEnabled())
    setHistory(getConfidenceHistory())
  }, [])

  const lastScore = history?.lastScore ?? null
  const trend = useMemo(() => (history ? getScoreTrend(history) : "stable"), [history])

  const strongestFactor = useMemo(() => {
    if (!lastScore) return null
    const entries = Object.entries(lastScore.factors) as [keyof ConfidenceFactors, number][]
    entries.sort((a, b) => b[1] - a[1])
    return entries[0]?.[0] ?? null
  }, [lastScore])

  const handleToggle = useCallback(() => {
    const next = !enabled
    setConfidenceEnabled(next)
    setEnabled(next)
    if (next) {
      // Refresh history after enabling
      setHistory(getConfidenceHistory())
    }
  }, [enabled])

  const trendLabel = trend === "up" ? "↑ Trending up" : trend === "down" ? "↓ Trending down" : "→ Stable"
  const trendColor = trend === "up" ? "var(--success, #34d399)" : trend === "down" ? "var(--warning, #f59e0b)" : textColors.sub

  return (
    <div
      style={{
        ...contentColumn,
        paddingTop: spacingScale["24"],
        paddingBottom: safeAreaBottom(100),
      }}
    >
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Go back"
          style={{
            background: "none",
            border: "none",
            color: textColors.sub,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: spacingScale["16"],
            padding: 0,
            fontFamily: FONT_FAMILY,
            fontSize: 14,
          }}
        >
          ← Back
        </button>
      )}

      {/* Header */}
      <SectionHeader>Money Confidence</SectionHeader>
      <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["24"] }}>
        A gentle journal of your financial habits — never a judgment.
      </p>

      {/* Enable/Disable Toggle */}
      <Card style={{ padding: `${spacingScale["16"]} ${spacingScale["16"]}`, marginBottom: spacingScale["24"] }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ ...typography.body, color: textColors.text, margin: 0 }}>
              {enabled ? "Confidence tracking is on" : "Confidence tracking is off"}
            </p>
            <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0, marginTop: 4 }}>
              {enabled ? "Tap to hide your score anytime." : "Enable to see your money confidence score."}
            </p>
          </div>
          <button
            onClick={handleToggle}
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? "Disable confidence tracking" : "Enable confidence tracking"}
            style={{
              width: 48,
              height: 28,
              borderRadius: 14,
              border: "none",
              cursor: "pointer",
              background: enabled ? colorRamp.accent[500] : "var(--surface, #1a1a2e)",
              position: "relative",
              transition: "background 0.2s ease",
              flexShrink: 0,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 3,
                left: enabled ? 23 : 3,
                width: 22,
                height: 22,
                borderRadius: 11,
                background: "var(--text, #fff)",
                transition: "left 0.2s ease",
              }}
            />
          </button>
        </div>
      </Card>

      {/* Score content — only shown when enabled */}
      {enabled && lastScore && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
        >
          {/* Tier name */}
          <div style={{ textAlign: "center", marginBottom: spacingScale["24"] }}>
            <p style={{ ...typography.subhead, color: TIER_COLORS[lastScore.tier], margin: 0 }}>
              {lastScore.tier}
            </p>
            <p style={{ ...typography["body-sm"], color: textColors.sub, marginTop: 8, maxWidth: 280, marginLeft: "auto", marginRight: "auto" }}>
              {TIER_COPY[lastScore.tier]}
            </p>
          </div>

          {/* Score Ring */}
          <div style={{ marginBottom: spacingScale["24"] }}>
            <ScoreRing score={lastScore.score} tier={lastScore.tier} />
          </div>

          {/* Trend */}
          <div style={{ textAlign: "center", marginBottom: spacingScale["32"] }}>
            <span style={{ ...typography.body, color: trendColor }}>{trendLabel}</span>
          </div>

          {/* Sparkline */}
          {history && history.entries.length >= 2 && (
            <Card style={{ padding: spacingScale["16"], marginBottom: spacingScale["24"] }}>
              <p style={{ ...typography.caption, color: textColors.muted, marginBottom: spacingScale["12"] }}>
                RECENT WEEKS
              </p>
              <TrendSparkline history={history} />
            </Card>
          )}

          {/* Factor Breakdown */}
          <Card style={{ padding: spacingScale["16"], marginBottom: spacingScale["24"] }}>
            <p style={{ ...typography.caption, color: textColors.muted, marginBottom: spacingScale["16"] }}>
              WHAT'S CONTRIBUTING
            </p>
            {(Object.keys(FACTOR_LABELS) as (keyof ConfidenceFactors)[]).map((key) => (
              <FactorBar key={key} label={FACTOR_LABELS[key]} value={lastScore.factors[key]} />
            ))}
          </Card>

          {/* Strongest habit callout */}
          {strongestFactor && (
            <Card style={{ padding: spacingScale["16"], marginBottom: spacingScale["24"] }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }} aria-hidden="true">✨</span>
                <p style={{ ...typography.body, color: textColors.text, margin: 0 }}>
                  {FACTOR_ENCOURAGEMENT[strongestFactor]}
                </p>
              </div>
            </Card>
          )}
        </motion.div>
      )}

      {/* Empty state when enabled but no score yet */}
      {enabled && !lastScore && (
        <Card style={{ padding: spacingScale["24"], textAlign: "center" }}>
          <p style={{ ...typography.body, color: textColors.sub, margin: 0 }}>
            Your confidence score will appear after your first week of activity.
          </p>
          <p style={{ ...typography["body-sm"], color: textColors.muted, marginTop: 8, margin: "8px 0 0" }}>
            Just keep logging and using the app — we'll do the rest.
          </p>
        </Card>
      )}

      {/* Disabled state info */}
      {!enabled && (
        <Card style={{ padding: spacingScale["24"], textAlign: "center" }}>
          <p style={{ ...typography.body, color: textColors.sub, margin: 0 }}>
            Your confidence score is private and optional.
          </p>
          <p style={{ ...typography["body-sm"], color: textColors.muted, marginTop: 8, margin: "8px 0 0" }}>
            Enable it above to see how your habits are building over time.
            It'll never appear in notifications unless you turn it on.
          </p>
        </Card>
      )}
    </div>
  )
}
