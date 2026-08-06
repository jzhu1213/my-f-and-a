"use client"

import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import type { DetectedSubscription, SubscriptionAlert, ConfidenceBadge } from "@/lib/subscriptionDetector"
import { emojiForCategory, getMonthlySubscriptionTotal, getStudentSavingsOpportunities, getSubscriptionAlerts, confidenceBadge } from "@/lib/subscriptionDetector"
import { getTodayLocal } from "@/lib/dateUtils"
import { TIP_EMOJI } from "@/lib/vocabulary"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
} from "@/styles/shared"

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionAuditScreenProps {
  subscriptions: DetectedSubscription[]
  onDismiss: (id: string) => void
  onClose: () => void
  /**
   * Open the DIY cancel/negotiate helper for a specific subscription. When
   * omitted, the per-item helper action is hidden.
   */
  onOpenCancelNegotiate?: (subscription: DetectedSubscription) => void
  /**
   * One-tap confirm: promote a detected (unconfirmed) subscription into a
   * tracked recurring bill. When omitted, the confirm action is hidden. Only
   * shown for detections that aren't already confirmed.
   */
  onConfirm?: (subscription: DetectedSubscription) => void
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

/**
 * Color tokens for a confidence badge. Tuned for AA contrast on the dark
 * surface: a light foreground over a low-opacity tinted background.
 */
function confidenceBadgeStyle(level: ConfidenceBadge['level']): { bg: string; fg: string; border: string } {
  switch (level) {
    case 'high':
      return { bg: "rgba(74, 222, 128, 0.16)", fg: "#86efac", border: "rgba(74, 222, 128, 0.32)" }
    case 'medium':
      return { bg: "rgba(129, 140, 248, 0.16)", fg: "#c7d2fe", border: "rgba(129, 140, 248, 0.32)" }
    case 'low':
    default:
      return { bg: "rgba(255, 255, 255, 0.08)", fg: "var(--sub)", border: "var(--border)" }
  }
}

/** Warm, shame-free copy for an imminent renewal / trial-ending alert. */
function alertCopy(alert: SubscriptionAlert): { emoji: string; text: string } {
  const { subscription, kind, daysUntil } = alert
  const when = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`
  const amountStr = `$${subscription.amount.toFixed(2)}`

  if (kind === 'trial_ending') {
    return {
      emoji: TIP_EMOJI.trial_ending,
      text: `Your ${subscription.label} trial converts ${when} (${amountStr}). Keep it if you love it — or cancel before it charges.`,
    }
  }
  return {
    emoji: TIP_EMOJI.renewal_soon,
    text: `${subscription.label} renews ${when} (${amountStr}). All good if you're keeping it!`,
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
  onOpenCancelNegotiate,
  onConfirm,
}: SubscriptionAuditScreenProps) {
  const monthlyTotal = getMonthlySubscriptionTotal(subscriptions)
  const savingsOpportunities = getStudentSavingsOpportunities(subscriptions)
  const alerts = getSubscriptionAlerts(subscriptions, getTodayLocal())

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
        <p style={{ ...sectionHeader }}>Monthly total</p>
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

      {/* ── Renewing soon / trial ending heads-up ──────────────────── */}
      {alerts.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "16px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeader }}>Coming up soon</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {alerts.map((alert) => {
              const { emoji, text } = alertCopy(alert)
              return (
                <div key={`${alert.subscription.id}-${alert.nextRenewalDate}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16, lineHeight: 1.4 }} aria-hidden="true">{emoji}</span>
                  <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5, margin: 0 }}>{text}</p>
                </div>
              )
            })}
          </div>
        </GlassCard>
      )}

      {/* ── Student savings opportunities ──────────────────────────── */}
      {savingsOpportunities.length > 0 && (
        <GlassCard elevation="low" style={{ padding: "16px 20px", marginBottom: 20 }}>
          <p style={{ ...sectionHeader }}>Student perks worth a peek</p>
          <p style={{ fontSize: 13, color: "var(--sub)", marginTop: 6, lineHeight: 1.5 }}>
            {savingsOpportunities.length === 1
              ? "One of these offers a student rate — a quick switch could free up a little room."
              : `${savingsOpportunities.length} of these offer student rates — a few quick switches could free up some room.`}
          </p>
        </GlassCard>
      )}

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
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                    {(() => {
                      const badge = confidenceBadge(sub)
                      const style = confidenceBadgeStyle(badge.level)
                      return (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 8,
                            background: style.bg,
                            border: `1px solid ${style.border}`,
                            color: style.fg,
                            fontSize: 11,
                            fontWeight: 600,
                            lineHeight: 1.3,
                            whiteSpace: "nowrap",
                          }}
                          title={`${badge.percent}% confidence this is recurring`}
                          aria-label={`Confidence: ${badge.label}, about ${badge.percent} percent`}
                        >
                          {badge.label}
                          <span style={{ fontWeight: 400, fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                            {badge.percent}%
                          </span>
                        </span>
                      )
                    })()}
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {sub.isConfirmed ? "Confirmed" : "Detected"} · {sub.chargeCount} charges
                      {sub.isLikelyTrialConversion ? " · started as a trial" : ""}
                    </span>
                  </div>
                  {sub.isLikelyDuplicate && (
                    <p style={{ fontSize: 11.5, color: "var(--sub)", marginTop: 4, lineHeight: 1.45 }}>
                      You have another {sub.serviceKind === "music" ? "music" : "streaming"} service too — keep both if you love them.
                    </p>
                  )}
                  {sub.studentDiscountHint && (
                    <p style={{ fontSize: 11.5, color: "var(--sub)", marginTop: 4, lineHeight: 1.45 }}>
                      💡 {sub.studentDiscountHint}
                    </p>
                  )}
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

              {/* Action row: one-tap confirm (unconfirmed only) + cancel/negotiate */}
              {(onOpenCancelNegotiate || (onConfirm && !sub.isConfirmed)) && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {onConfirm && !sub.isConfirmed && (
                    <motion.button
                      onClick={() => onConfirm(sub)}
                      whileTap={{ scale: 0.98 }}
                      transition={springs.snappy}
                      style={{
                        flex: 1,
                        padding: "10px 0",
                        background: "rgba(74, 222, 128, 0.14)",
                        border: "1px solid rgba(74, 222, 128, 0.32)",
                        borderRadius: 10,
                        color: "#86efac",
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: FONT_FAMILY,
                        cursor: "pointer",
                      }}
                      aria-label={`Confirm ${sub.label} as a recurring bill`}
                    >
                      ✓ Yes, it&apos;s recurring
                    </motion.button>
                  )}
                  {onOpenCancelNegotiate && (
                    <motion.button
                      onClick={() => onOpenCancelNegotiate(sub)}
                      whileTap={{ scale: 0.98 }}
                      transition={springs.snappy}
                      style={{
                        flex: 1,
                        padding: "10px 0",
                        background: "rgba(129, 140, 248, 0.12)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        color: "var(--text)",
                        fontSize: 13,
                        fontWeight: 500,
                        fontFamily: FONT_FAMILY,
                        cursor: "pointer",
                      }}
                      aria-label={`Get help cancelling or negotiating ${sub.label}`}
                    >
                      💬 Cancel or negotiate
                    </motion.button>
                  )}
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}
