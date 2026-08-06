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
 * Phase 6, Task 269.1 — Premium design system styling
 */

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { GlassCard } from "@/components/ui/GlassCard"
import { Icon } from "@/components/ui/Icon"
import {
  getSupporterSummary,
  type GuardianContributionSummary,
} from "@/lib/guardianContributions"
import {
  sharedPageContainer,
  headerBadge,
  headerBadgeRow,
  notFoundContainer,
  notFoundIconWrapper,
  notFoundTitle,
  notFoundDescription,
  loadingText,
  sectionLabel,
  detailRow,
  detailLabel,
  detailValue,
  footerText,
  footerAttribution,
  colorRamp,
  fills,
  typography,
  TABULAR_NUMS,
  FONT_FAMILY,
  spacing,
} from "../../sharedPageStyles"

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
      <div style={sharedPageContainer}>
        <p style={loadingText}>Loading…</p>
      </div>
    )
  }

  // Invalid or revoked link
  if (summary === null) {
    return (
      <div style={sharedPageContainer}>
        <div style={notFoundContainer}>
          <div style={notFoundIconWrapper}>
            <Icon name="shared:link-expired" size={28} />
          </div>
          <h1 style={notFoundTitle}>
            This link is no longer active
          </h1>
          <p style={notFoundDescription}>
            The person who shared this may have revoked access, or the link may have expired.
          </p>
        </div>
      </div>
    )
  }

  // Valid supporter summary
  const cadenceLabel = CADENCE_LABELS[summary.cadence] ?? "regularly"

  return (
    <div style={sharedPageContainer}>
      {/* Header badge */}
      <div style={headerBadgeRow}>
        <span style={headerBadge}>FAMILY SUPPORT</span>
      </div>

      {/* Warm hero */}
      <GlassCard elevation="high" style={{ padding: "24px 20px", marginBottom: spacing.md }}>
        <div style={{ textAlign: "center", marginBottom: spacing.md }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: colorRamp.accent[100],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              color: colorRamp.accent[500],
            }}
          >
            <Icon name="shared:support" size={28} />
          </div>
          <h1 style={{ ...typography.headline, color: "var(--text)", marginBottom: 8 }}>
            Your support helps {summary.recipientName} stay on track
          </h1>
          <p style={{ ...typography.body, color: "var(--sub)" }}>
            Thank you, {summary.supporterName}. Here&apos;s how your contribution makes a difference.
          </p>
        </div>
      </GlassCard>

      {/* Contribution details */}
      <GlassCard elevation="low" style={{ padding: "20px", marginBottom: spacing.md }}>
        <p style={sectionLabel}>Contribution details</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={detailRow}>
            <span style={detailLabel}>Amount</span>
            <span style={detailValue}>
              ${summary.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={detailRow}>
            <span style={detailLabel}>Frequency</span>
            <span style={{ ...detailValue, fontVariantNumeric: undefined }}>{cadenceLabel}</span>
          </div>
          {summary.lastContributionDate && (
            <div style={detailRow}>
              <span style={detailLabel}>Last received</span>
              <span style={{ ...detailValue, fontVariantNumeric: undefined }}>
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
            <span style={{ ...detailValue, fontVariantNumeric: undefined }}>
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
        <GlassCard elevation="low" style={{ padding: "20px", marginBottom: spacing.md }}>
          <p style={sectionLabel}>Recent months</p>
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
                      ? `1px solid ${fills[8]}`
                      : "none",
                }}
              >
                <span style={{ ...typography.body, color: "var(--text)" }}>
                  {monthLabel}
                </span>
                <span
                  style={{
                    ...typography.body,
                    fontWeight: 500,
                    color: "var(--sub)",
                    ...TABULAR_NUMS,
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
              borderTop: `1px solid ${fills[8]}`,
            }}
          >
            <span style={{ ...typography.body, fontWeight: 600, color: "var(--text)" }}>
              Total contributed
            </span>
            <span
              style={{
                ...typography.headline,
                fontSize: typography.body.fontSize,
                fontWeight: 700,
                color: "var(--text)",
                ...TABULAR_NUMS,
              }}
            >
              ${summary.totalContributed.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        </GlassCard>
      )}

      {/* Warm footer */}
      <p style={{ ...footerText, ...typography.body, fontSize: typography.caption.fontSize }}>
        {summary.recipientName} is building healthy money habits. Your support makes that possible. 💜
      </p>
      <p style={footerAttribution}>
        Shared via Folio · Read-only view
      </p>
    </div>
  )
}
