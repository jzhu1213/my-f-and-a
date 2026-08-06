"use client"

/**
 * Shared View Page
 *
 * A read-only page that displays a spending summary for a given share token.
 * Shows high-level budget health without individual transaction details.
 *
 * For MVP, reads from localStorage keyed by token. In production, this would
 * fetch from a Supabase endpoint so it works cross-device.
 *
 * Task 115.1 — Optional read-only sharing
 * Phase 6, Task 269.1 — Premium design system styling
 */

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { GlassCard } from "@/components/ui/GlassCard"
import { Icon } from "@/components/ui/Icon"
import { getSharedSummary, type SharedSummary } from "@/lib/sharingUtils"
import { progressTrack } from "@/styles/shared"
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
  colorRamp,
  fills,
  typography,
  TABULAR_NUMS,
  FONT_FAMILY,
  spacing,
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
    const data = getSharedSummary(token)
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
        <GlassCard
          elevation="medium"
          glow={summary.status === "healthy" ? "healthy" : summary.status === "over" ? "over" : "none"}
          style={{ padding: "20px", marginBottom: spacing.md }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
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
                  ...typography.headline,
                  fontSize: typography.body.fontSize,
                  color: statusConfig.color,
                }}
              >
                {statusConfig.label}
              </p>
              <p style={{ ...typography.caption, color: "var(--sub)" }}>
                Daily budget health
              </p>
            </div>
          </div>

          {/* Daily allowance summary */}
          <div
            style={{
              display: "flex",
              gap: spacing.md,
              padding: `${spacing.sm}px 0 0`,
              borderTop: `1px solid ${fills[8]}`,
            }}
          >
            <div>
              <p style={{ ...typography.caption, color: "var(--muted)", marginBottom: 2 }}>
                Safe to spend today
              </p>
              <p
                style={{
                  ...typography.headline,
                  color: "var(--text)",
                  ...TABULAR_NUMS,
                }}
              >
                ${summary.dailyAllowanceAmount.toFixed(0)}
              </p>
            </div>
            <div>
              <p style={{ ...typography.caption, color: "var(--muted)", marginBottom: 2 }}>
                Daily budget
              </p>
              <p
                style={{
                  ...typography.headline,
                  color: "var(--sub)",
                  ...TABULAR_NUMS,
                }}
              >
                ${summary.dailyBudget.toFixed(0)}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Week spending */}
      {showWeek && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: spacing.md }}>
          <p style={sectionLabel}>This week&apos;s spending</p>
          <p
            style={{
              ...typography.title,
              color: "var(--text)",
              ...TABULAR_NUMS,
            }}
          >
            ${summary.weekSpendingTotal.toFixed(0)}
          </p>
        </GlassCard>
      )}

      {/* Category breakdown */}
      {showCategories && summary.categoryBreakdown.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: spacing.md }}>
          <p style={sectionLabel}>Budget categories</p>
          {summary.categoryBreakdown.map((cat, idx) => (
            <div
              key={cat.category}
              style={{
                marginBottom: idx < summary.categoryBreakdown.length - 1 ? 12 : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <span style={{ ...typography.body, color: "var(--text)", fontSize: typography.caption.fontSize }}>
                  {cat.emoji} {cat.label}
                </span>
                <span
                  style={{
                    ...typography.caption,
                    color: cat.percentUsed >= 100 ? colorRamp.error[500] : "var(--sub)",
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
                    borderRadius: 2,
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
        </GlassCard>
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
