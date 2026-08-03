"use client"

/**
 * Shared Support View Page
 *
 * A read-only page that shows a guardian/family supporter how their
 * recurring support helps the student. Warm, encouraging, and minimal.
 *
 * For MVP, reads from localStorage keyed by token. In production, this
 * would fetch from a Supabase endpoint so it works cross-device.
 *
 * Task 171.1 — Track inbound support as a named income stream
 */

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  borderRadius,
} from "@/styles/shared"
import {
  getSupporterSummary,
  type GuardianContributionSummary,
} from "@/lib/guardianContributions"

// ============================================================================
// Cadence display labels
// ============================================================================

const CADENCE_LABELS: Record<string, string> = {
  weekly: "every week",
  biweekly: "every two weeks",
  semimonthly: "twice a month",
  monthly: "every month",
  irregular: "regularly",
}

// ============================================================================
// Component
// ============================================================================

export default function SharedSupportViewPage() {
  const params = useParams()
  const token = params?.token as string | undefined
  const [summary, setSummary] = useState<GuardianContributionSummary | null | undefined>(undefined)

  useEffect(() => {
    if (!token) {
      setSummary(null)
      return
    }
    const data = getSupporterSummary(token)
    setSummary(data)
  }, [token])

  // Loading state
  if (summary === undefined) {
    return (
      <div style={pageContainer}>
        <p style={{ color: "var(--sub)", fontSize: 14, textAlign: "center", marginTop: 80 }}>
          Loading…
        </p>
      </div>
    )
  }

  // Invalid or revoked link
  if (summary === null) {
    return (
      <div style={pageContainer}>
        <div style={{ textAlign: "center", marginTop: 80 }}>
          <p style={{ fontSize: 40, marginBottom: 16 }} aria-hidden="true">🔗</p>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 8,
              fontFamily: FONT_FAMILY,
            }}
          >
            This link is no longer active
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--sub)",
              lineHeight: 1.5,
              maxWidth: 300,
              margin: "0 auto",
              fontFamily: FONT_FAMILY,
            }}
          >
            The person who shared this may have revoked access, or the link may have expired.
          </p>
        </div>
      </div>
    )
  }

  // Valid supporter summary
  const cadenceLabel = CADENCE_LABELS[summary.cadence] ?? "regularly"

  return (
    <div style={pageContainer}>
      {/* Header badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 24,
        }}
      >
        <span
          style={{
            padding: "4px 10px",
            borderRadius: borderRadius.full,
            background: "rgba(129, 140, 248, 0.1)",
            border: "1px solid rgba(129, 140, 248, 0.2)",
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(129, 140, 248, 1)",
            letterSpacing: "0.04em",
            fontFamily: FONT_FAMILY,
          }}
        >
          FAMILY SUPPORT
        </span>
      </div>

      {/* Warm hero */}
      <GlassCard elevation="low" style={{ padding: "24px 20px", marginBottom: 16 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">
            {summary.supporterEmoji}
          </p>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 8,
              fontFamily: FONT_FAMILY,
            }}
          >
            Your support helps {summary.recipientName} stay on track
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--sub)",
              lineHeight: 1.5,
              fontFamily: FONT_FAMILY,
            }}
          >
            Thank you, {summary.supporterName}. Here&apos;s how your contribution makes a difference.
          </p>
        </div>
      </GlassCard>

      {/* Contribution details */}
      <GlassCard elevation="low" style={{ padding: "20px", marginBottom: 16 }}>
        <p style={{ ...labelStyle, marginBottom: 14 }}>Contribution details</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={detailRow}>
            <span style={detailLabel}>Amount</span>
            <span style={detailValue}>
              ${summary.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={detailRow}>
            <span style={detailLabel}>Frequency</span>
            <span style={detailValue}>{cadenceLabel}</span>
          </div>
          {summary.lastContributionDate && (
            <div style={detailRow}>
              <span style={detailLabel}>Last received</span>
              <span style={detailValue}>
                {new Date(summary.lastContributionDate + "T00:00:00Z").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </span>
            </div>
          )}
          <div style={detailRow}>
            <span style={detailLabel}>Next expected</span>
            <span style={detailValue}>
              {new Date(summary.nextExpectedDate + "T00:00:00Z").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Monthly history */}
      {summary.monthlyHistory.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "20px", marginBottom: 16 }}>
          <p style={{ ...labelStyle, marginBottom: 14 }}>Recent months</p>
          {summary.monthlyHistory.map((entry, idx) => {
            const date = new Date(entry.month + "-01T00:00:00Z")
            const monthLabel = date.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            })
            return (
              <div
                key={entry.month}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom:
                    idx < summary.monthlyHistory.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                }}
              >
                <span style={{ fontSize: 14, color: "var(--text)", fontFamily: FONT_FAMILY }}>
                  {monthLabel}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--sub)",
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  ${entry.total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
            )
          })}

          {/* Total */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0 0",
              marginTop: 8,
              borderTop: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", fontFamily: FONT_FAMILY }}>
              Total contributed
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text)",
                fontVariantNumeric: "tabular-nums",
                fontFamily: FONT_FAMILY,
              }}
            >
              ${summary.totalContributed.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        </GlassCard>
      )}

      {/* Warm footer */}
      <p
        style={{
          fontSize: 13,
          color: "var(--sub)",
          textAlign: "center",
          marginTop: 24,
          lineHeight: 1.5,
          fontFamily: FONT_FAMILY,
        }}
      >
        {summary.recipientName} is building healthy money habits. Your support makes that possible. 💜
      </p>

      <p
        style={{
          fontSize: 11,
          color: "var(--muted)",
          textAlign: "center",
          marginTop: 12,
          opacity: 0.6,
          fontFamily: FONT_FAMILY,
        }}
      >
        Shared via Folio · Read-only view
      </p>
    </div>
  )
}

// ============================================================================
// Styles
// ============================================================================

const pageContainer: React.CSSProperties = {
  maxWidth: CONTENT_MAX_WIDTH,
  margin: "0 auto",
  padding: `60px ${HORIZONTAL_PADDING}px 40px`,
  fontFamily: FONT_FAMILY,
  minHeight: "100vh",
  background: "var(--bg)",
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--muted)",
  letterSpacing: "0.02em",
  fontFamily: FONT_FAMILY,
}

const detailRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}

const detailLabel: React.CSSProperties = {
  fontSize: 14,
  color: "var(--sub)",
  fontFamily: FONT_FAMILY,
}

const detailValue: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: "var(--text)",
  fontFamily: FONT_FAMILY,
}
