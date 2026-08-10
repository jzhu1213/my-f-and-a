"use client"

/**
 * Shared Support View Page
 *
 * A read-only page that shows a guardian/family supporter how their
 * recurring support helps the student. Warm, encouraging, and minimal.
 *
 * All visual values sourced from the Design_Token_System — zero page-local
 * overrides. Section heading + shared value + supporting labels render
 * immediately in the shell (badge visible before data loads).
 * Invalid/expired link renders explanatory state immediately (no partial content).
 *
 * For MVP, reads from localStorage keyed by token. In production this
 * would fetch from a Supabase endpoint so it works cross-device.
 *
 * Requirements: 15.8, 15.9, 15.10
 */

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card } from "@/components/ui/primitives/Card"
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
  typography,
  TABULAR_NUMS,
  spacingScale,
  textColors,
  radius,
  elevations,
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

  // Loading state — badge renders immediately
  if (summary === undefined) {
    return (
      <div style={sharedPageContainer}>
        <div style={headerBadgeRow}>
          <span style={headerBadge}>FAMILY SUPPORT</span>
        </div>
        <p style={loadingText}>Loading…</p>
      </div>
    )
  }

  // Invalid or revoked link — rendered immediately, no partial content
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
      <Card elevation="raised" style={{ padding: `${spacingScale["24"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
        <div style={{ textAlign: "center", marginBottom: spacingScale["16"] }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.full,
              background: colorRamp.accent[100],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: `0 auto ${spacingScale["12"]}`,
              color: colorRamp.accent[500],
            }}
          >
            <Icon name="shared:support" size={28} />
          </div>
          <h1 style={{ ...typography.headline, color: textColors.text, marginBottom: spacingScale["8"] }}>
            Your support helps {summary.recipientName} stay on track
          </h1>
          <p style={{ ...typography.body, color: textColors.sub }}>
            Thank you, {summary.supporterName}. Here&apos;s how your contribution makes a difference.
          </p>
        </div>
      </Card>

      {/* Contribution details */}
      <Card elevation="resting" style={{ padding: spacingScale["20"], marginBottom: spacingScale["16"] }}>
        <p style={sectionLabel}>Contribution details</p>

        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["12"] }}>
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
      </Card>

      {/* Monthly history */}
      {summary.monthlyHistory.length > 0 && (
        <Card elevation="resting" style={{ padding: spacingScale["20"], marginBottom: spacingScale["16"] }}>
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
                  padding: `${spacingScale["8"]} 0`,
                  borderBottom:
                    idx < summary.monthlyHistory.length - 1
                      ? elevations.resting.border
                      : "none",
                }}
              >
                <span style={{ ...typography.body, color: textColors.text }}>
                  {monthLabel}
                </span>
                <span
                  style={{
                    ...typography.body,
                    fontWeight: 500,
                    color: textColors.sub,
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
              padding: `${spacingScale["12"]} 0 0`,
              marginTop: spacingScale["8"],
              borderTop: elevations.resting.border,
            }}
          >
            <span style={{ ...typography.body, fontWeight: 600, color: textColors.text }}>
              Total contributed
            </span>
            <span
              style={{
                ...typography.body,
                fontWeight: 700,
                color: textColors.text,
                ...TABULAR_NUMS,
              }}
            >
              ${summary.totalContributed.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        </Card>
      )}

      {/* Warm footer */}
      <p style={{ ...footerText, ...typography.caption }}>
        {summary.recipientName} is building healthy money habits. Your support makes that possible. 💜
      </p>
      <p style={footerAttribution}>
        Shared via Folio · Read-only view
      </p>
    </div>
  )
}
