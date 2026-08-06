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
import { getSharedSummary, type SharedSummary } from "@/lib/sharingUtils"
import type { AllowanceStatus } from "@/types/folio"

// ============================================================================
// Status styling helpers
// ============================================================================

const STATUS_CONFIG: Record<AllowanceStatus, { label: string; color: string; emoji: string; bg: string }> = {
  healthy: {
    label: "Doing well",
    color: "rgba(6, 214, 160, 1)",
    emoji: "✓",
    bg: "rgba(6, 214, 160, 0.08)",
  },
  caution: {
    label: "A bit tight",
    color: "rgba(245, 158, 11, 1)",
    emoji: "~",
    bg: "rgba(245, 158, 11, 0.08)",
  },
  warning: {
    label: "Getting tight",
    color: "rgba(245, 158, 11, 1)",
    emoji: "!",
    bg: "rgba(245, 158, 11, 0.1)",
  },
  over: {
    label: "A little over today",
    color: "rgba(248, 113, 113, 1)",
    emoji: "↑",
    bg: "rgba(248, 113, 113, 0.08)",
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
    // NOTE: In production, this would be a fetch() to a Supabase edge function.
    // For MVP, we read from localStorage (same-device testing only).
    const data = getSharedSummary(token)
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

  // Valid shared summary
  const statusConfig = STATUS_CONFIG[summary.status]
  // Respect the link's scope: only render sections the sharer chose to include.
  // Older summaries without a scope default to showing everything.
  const visibleSections = summary.scope?.sections ?? ["status", "weekSpending", "categories"]
  const showStatus = visibleSections.includes("status")
  const showWeek = visibleSections.includes("weekSpending")
  const showCategories = visibleSections.includes("categories")

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
          SHARED VIEW
        </span>
        <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: FONT_FAMILY }}>
          · {summary.label}
        </span>
      </div>

      {/* Budget health status */}
      {showStatus && (
      <GlassCard
        elevation="low"
        glow={summary.status === "healthy" ? "healthy" : summary.status === "over" ? "over" : "none"}
        style={{ padding: "20px", marginBottom: 16 }}
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
              fontSize: 16,
              fontWeight: 700,
              color: statusConfig.color,
              fontFamily: FONT_FAMILY,
            }}
          >
            {statusConfig.emoji}
          </span>
          <div>
            <p
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: statusConfig.color,
                fontFamily: FONT_FAMILY,
              }}
            >
              {statusConfig.label}
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--sub)",
                fontFamily: FONT_FAMILY,
              }}
            >
              Daily budget health
            </p>
          </div>
        </div>

        {/* Daily allowance summary */}
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "12px 0 0",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2, fontFamily: FONT_FAMILY }}>
              Safe to spend today
            </p>
            <p
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--text)",
                fontFamily: FONT_FAMILY,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ${summary.dailyAllowanceAmount.toFixed(0)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2, fontFamily: FONT_FAMILY }}>
              Daily budget
            </p>
            <p
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--sub)",
                fontFamily: FONT_FAMILY,
                fontVariantNumeric: "tabular-nums",
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
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <p style={{ ...labelStyle }}>This week&apos;s spending</p>
        <p
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: "var(--text)",
            fontFamily: FONT_FAMILY,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ${summary.weekSpendingTotal.toFixed(0)}
        </p>
      </GlassCard>
      )}

      {/* Category breakdown */}
      {showCategories && summary.categoryBreakdown.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 16 }}>
          <p style={{ ...labelStyle, marginBottom: 12 }}>Budget categories</p>
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
                <span style={{ fontSize: 13, color: "var(--text)", fontFamily: FONT_FAMILY }}>
                  {cat.emoji} {cat.label}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: cat.percentUsed >= 100 ? "var(--error)" : "var(--sub)",
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  {cat.percentUsed}%
                </span>
              </div>
              {/* Progress bar */}
              <div
                style={{
                  width: "100%",
                  height: 4,
                  borderRadius: 2,
                  background: "rgba(255, 255, 255, 0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(cat.percentUsed, 100)}%`,
                    height: "100%",
                    borderRadius: 2,
                    background:
                      cat.percentUsed >= 100
                        ? "rgba(248, 113, 113, 0.8)"
                        : cat.percentUsed >= 75
                        ? "rgba(245, 158, 11, 0.7)"
                        : "rgba(129, 140, 248, 0.6)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          ))}
        </GlassCard>
      )}

      {/* Footer */}
      <p
        style={{
          fontSize: 11,
          color: "var(--muted)",
          textAlign: "center",
          marginTop: 20,
          fontFamily: FONT_FAMILY,
        }}
      >
        Last updated {new Date(summary.generatedAt).toLocaleString()}
      </p>

      <p
        style={{
          fontSize: 11,
          color: "var(--muted)",
          textAlign: "center",
          marginTop: 8,
          opacity: 0.6,
          fontFamily: FONT_FAMILY,
        }}
      >
        Shared via Folio · Summary only, no transaction details
      </p>
    </div>
  )
}

// ============================================================================
// Shared styles
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
