"use client"

/**
 * Shared View Page — Spending Summary
 *
 * A read-only page that displays a spending summary for a given share token.
 * Shows high-level budget health without individual transaction details.
 *
 * All visual values sourced from the Design_Token_System — zero page-local
 * overrides. Section heading + shared value + supporting labels render
 * immediately in the shell (badge, heading visible before data loads).
 * Invalid/expired link renders explanatory state immediately (no partial content).
 *
 * Fetches from Supabase via the `get_shared_summary()` RPC function so it
 * works cross-device for unauthenticated viewers. Falls back to localStorage
 * if the network is unavailable.
 *
 * Requirements: 15.8, 15.9, 15.10
 */

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card } from "@/components/ui/primitives/Card"
import { Icon } from "@/components/ui/Icon"
import { getSharedSummary, type SharedSummary } from "@/lib/sharingUtils"
import type { AllowanceStatus } from "@/types/folio"
import {
  sharedPageContainer,
  headerBadge,
  headerBadgeRow,
  headerSubtitle,
  notFoundContainer,
  notFoundIconWrapper,
  notFoundTitle,
  notFoundDescription,
  loadingText,
  sectionLabel,
  footerText,
  footerAttribution,
  progressTrack,
  colorRamp,
  typography,
  TABULAR_NUMS,
  spacingScale,
  textColors,
  radius,
  elevations,
} from "../sharedPageStyles"

// ============================================================================
// Status styling helpers
// ============================================================================

const STATUS_CONFIG: Record<AllowanceStatus, { label: string; iconName: "status:healthy" | "status:caution" | "status:warning" | "status:over"; color: string; bg: string }> = {
  healthy: {
    label: "Doing well",
    iconName: "status:healthy",
    color: colorRamp.success[500],
    bg: colorRamp.success[100],
  },
  caution: {
    label: "A bit tight",
    iconName: "status:caution",
    color: colorRamp.warning[500],
    bg: colorRamp.warning[100],
  },
  warning: {
    label: "Getting tight",
    iconName: "status:warning",
    color: colorRamp.warning[500],
    bg: colorRamp.warning[100],
  },
  over: {
    label: "A little over today",
    iconName: "status:over",
    color: colorRamp.error[500],
    bg: colorRamp.error[100],
  },
}

// ============================================================================
// Component
// ============================================================================

export default function SharedViewPage() {
  const params = useParams()
  const token = params?.token as string | undefined
  const [summary, setSummary] = useState<SharedSummary | null | undefined>(undefined)

  useEffect(() => {
    if (!token) {
      setSummary(null)
      return
    }

    let cancelled = false

    async function fetchSummary() {
      const data = await getSharedSummary(token!)
      if (!cancelled) {
        setSummary(data)
      }
    }

    fetchSummary()

    return () => {
      cancelled = true
    }
  }, [token])

  // Loading state — shell (badge, heading) renders immediately
  if (summary === undefined) {
    return (
      <div style={sharedPageContainer}>
        <div style={headerBadgeRow}>
          <span style={headerBadge}>SHARED VIEW</span>
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

  // Valid shared summary
  const statusConfig = STATUS_CONFIG[summary.status]
  const visibleSections = summary.scope?.sections ?? ["status", "weekSpending", "categories"]
  const showStatus = visibleSections.includes("status")
  const showWeek = visibleSections.includes("weekSpending")
  const showCategories = visibleSections.includes("categories")

  return (
    <div style={sharedPageContainer}>
      {/* Header badge */}
      <div style={headerBadgeRow}>
        <span style={headerBadge}>SHARED VIEW</span>
        <span style={headerSubtitle}>· {summary.label}</span>
      </div>

      {/* Budget health status */}
      {showStatus && (
        <Card elevation="raised" style={{ padding: spacingScale["20"], marginBottom: spacingScale["16"] }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacingScale["12"], marginBottom: spacingScale["12"] }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                background: statusConfig.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: statusConfig.color,
              }}
            >
              <Icon name={statusConfig.iconName} size={18} />
            </span>
            <div>
              <p
                style={{
                  ...typography.body,
                  fontWeight: 500,
                  color: statusConfig.color,
                }}
              >
                {statusConfig.label}
              </p>
              <p style={{ ...typography.caption, color: textColors.sub }}>
                Daily budget health
              </p>
            </div>
          </div>

          {/* Daily allowance summary */}
          <div
            style={{
              display: "flex",
              gap: spacingScale["16"],
              padding: `${spacingScale["12"]} 0 0`,
              borderTop: elevations.resting.border,
            }}
          >
            <div>
              <p style={{ ...typography.caption, color: textColors.muted, marginBottom: 2 }}>
                Safe to spend today
              </p>
              <p
                style={{
                  ...typography.headline,
                  color: textColors.text,
                  ...TABULAR_NUMS,
                }}
              >
                ${summary.dailyAllowanceAmount.toFixed(0)}
              </p>
            </div>
            <div>
              <p style={{ ...typography.caption, color: textColors.muted, marginBottom: 2 }}>
                Daily budget
              </p>
              <p
                style={{
                  ...typography.headline,
                  color: textColors.sub,
                  ...TABULAR_NUMS,
                }}
              >
                ${summary.dailyBudget.toFixed(0)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Week spending */}
      {showWeek && (
        <Card elevation="resting" style={{ padding: `${spacingScale["20"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
          <p style={sectionLabel}>This week&apos;s spending</p>
          <p
            style={{
              ...typography.title,
              color: textColors.text,
              ...TABULAR_NUMS,
            }}
          >
            ${summary.weekSpendingTotal.toFixed(0)}
          </p>
        </Card>
      )}

      {/* Category breakdown */}
      {showCategories && summary.categoryBreakdown.length > 0 && (
        <Card elevation="resting" style={{ padding: `${spacingScale["20"]} ${spacingScale["20"]}`, marginBottom: spacingScale["16"] }}>
          <p style={sectionLabel}>Budget categories</p>
          {summary.categoryBreakdown.map((cat, idx) => (
            <div
              key={cat.category}
              style={{
                marginBottom: idx < summary.categoryBreakdown.length - 1 ? spacingScale["12"] : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: spacingScale["4"],
                }}
              >
                <span style={{ ...typography.caption, color: textColors.text }}>
                  {cat.emoji} {cat.label}
                </span>
                <span
                  style={{
                    ...typography.caption,
                    color: cat.percentUsed >= 100 ? colorRamp.error[500] : textColors.sub,
                    ...TABULAR_NUMS,
                  }}
                >
                  {cat.percentUsed}%
                </span>
              </div>
              {/* Progress bar */}
              <div style={progressTrack}>
                <div
                  style={{
                    width: `${Math.min(cat.percentUsed, 100)}%`,
                    height: "100%",
                    borderRadius: radius.min,
                    background:
                      cat.percentUsed >= 100
                        ? colorRamp.error[500]
                        : cat.percentUsed >= 75
                        ? colorRamp.warning[500]
                        : colorRamp.accent[500],
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Footer */}
      <p style={footerText}>
        Last updated {new Date(summary.generatedAt).toLocaleString()}
      </p>
      <p style={footerAttribution}>
        Shared via Folio · Summary only, no transaction details
      </p>
    </div>
  )
}
