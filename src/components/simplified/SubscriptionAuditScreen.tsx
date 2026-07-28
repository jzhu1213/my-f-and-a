"use client"

import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import type { DetectedSubscription } from "@/lib/subscriptionDetector"
import { emojiForCategory, getMonthlySubscriptionTotal } from "@/lib/subscriptionDetector"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeadingStrong,
} from "@/styles/shared"

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionAuditScreenProps {
  subscriptions: DetectedSubscription[]
  onDismiss: (id: string) => void
  onClose: () => void
}

// ============================================================================
// Helpers
// ============================================================================

function frequencyLabel(frequency: 'monthly' | 'weekly' | 'annual'): string {
  switch (frequency) {
    case 'weekly': return '/wk'
    case 'annual': return '/yr'
    case 'monthly':
    default: return '/mo'
  }
}

// ============================================================================
// SubscriptionAuditScreen Component
// ============================================================================

/**
 * SubscriptionAuditScreen — a friendly, non-judgmental view of detected
 * recurring subscriptions. Shows total monthly cost and lets users dismiss
 * (mark as expected) individual items.
 *
 * Validates: Requirements 5.2, new
 */
export function SubscriptionAuditScreen({
  subscriptions,
  onDismiss,
  onClose,
}: SubscriptionAuditScreenProps) {
  const monthlyTotal = getMonthlySubscriptionTotal(subscriptions)

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX_WIDTH,
        margin: "0 auto",
        padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM - 20}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text)",
          }}
        >
          Subscriptions
        </h2>
        <motion.button
          onClick={onClose}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: FONT_FAMILY,
            color: "var(--sub)",
            cursor: "pointer",
          }}
          aria-label="Close subscription audit"
        >
          Done
        </motion.button>
      </div>

      {/* ── Warm intro copy ────────────────────────────────────────── */}
      <p style={{ fontSize: 14, color: "var(--sub)", marginBottom: 20, lineHeight: 1.5 }}>
        Here&apos;s what&apos;s renewing automatically. No pressure — just a quick check so nothing surprises you.
      </p>

      {/* ── Monthly total card ─────────────────────────────────────── */}
      <GlassCard elevation="low" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ ...sectionHeadingStrong }}>Monthly total</p>
        <p
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ${monthlyTotal.toFixed(2)}
          <span style={{ fontSize: 14, fontWeight: 400, color: "var(--sub)", marginLeft: 4 }}>/mo</span>
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
          {subscriptions.length} subscription{subscriptions.length !== 1 ? "s" : ""} detected
        </p>
      </GlassCard>

      {/* ── Subscription list ──────────────────────────────────────── */}
      {subscriptions.length === 0 ? (
        <GlassCard elevation="low" style={{ padding: "24px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--sub)" }}>
            No subscriptions detected yet. Keep logging and we&apos;ll spot patterns over time.
          </p>
        </GlassCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {subscriptions.map((sub) => (
            <GlassCard key={sub.id} elevation="low" style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Emoji */}
                <span style={{ fontSize: 22 }} aria-hidden="true">
                  {emojiForCategory(sub.category)}
                </span>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sub.label}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {sub.isConfirmed ? "Confirmed" : "Detected"} · {sub.chargeCount} charges
                  </p>
                </div>

                {/* Amount + frequency */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--text)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ${sub.amount.toFixed(2)}
                    <span style={{ fontSize: 11, fontWeight: 400, color: "var(--sub)" }}>
                      {frequencyLabel(sub.frequency)}
                    </span>
                  </p>
                </div>

                {/* Dismiss button */}
                <motion.button
                  onClick={() => onDismiss(sub.id)}
                  whileTap={{ scale: 0.9 }}
                  transition={springs.snappy}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 6,
                    cursor: "pointer",
                    color: "var(--muted)",
                    fontSize: 16,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  aria-label={`Dismiss ${sub.label}`}
                  title="Mark as expected"
                >
                  ✓
                </motion.button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}
