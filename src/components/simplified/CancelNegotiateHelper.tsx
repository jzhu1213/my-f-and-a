"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { springs, useReducedMotion } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import type { DetectedSubscription } from "@/lib/subscriptionDetector"
import { emojiForCategory } from "@/lib/subscriptionDetector"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeader,
  borderRadius,
  segmentedControl,
  segmentedButtonBase,
  segmentedButtonActive,
  segmentedButtonInactive,
} from "@/styles/shared"

// ============================================================================
// Types
// ============================================================================

export interface CancelNegotiateHelperProps {
  /**
   * The subscription the student wants help with. When `null`, the helper
   * shows generic guidance that works for any service (reachable from Tools).
   */
  subscription: DetectedSubscription | null
  /** Close the helper and return to the previous surface. */
  onClose: () => void
}

/** Which DIY path the student is exploring right now. */
type HelperMode = "negotiate" | "cancel"

// ============================================================================
// Copy builders (pure)
// ============================================================================

/** A friendly, human name to use in scripts and steps. */
function serviceName(subscription: DetectedSubscription | null): string {
  const label = subscription?.label?.trim()
  return label && label.length > 0 ? label : "this service"
}

/** Formats an amount like "$9.99", or empty string when unknown. */
function amountText(subscription: DetectedSubscription | null): string {
  if (!subscription || subscription.amount <= 0) return ""
  return `$${subscription.amount.toFixed(2)}`
}

/**
 * Builds a warm, ready-to-use negotiation script the student can read aloud on
 * a call or paste into a chat. Interpolates the service name and current price
 * when we know them; stays fully generic otherwise.
 */
function buildNegotiationScript(subscription: DetectedSubscription | null): string {
  const name = serviceName(subscription)
  const price = amountText(subscription)
  const priceClause = price ? ` I'm currently paying ${price} a month, and` : ""
  const studentLine = subscription?.isStudentEligible
    ? ` I'm a student, so if there's a student rate I'd love to switch to it.`
    : ` I'm a student on a tight budget, so a lower rate would really help.`

  return [
    `Hi! I've been happily using ${name} for a while and I'd like to keep it,`,
    `but I'm reviewing my monthly costs.${priceClause} I'm wondering if there's`,
    `any current promotion, loyalty discount, or lower plan you can offer.${studentLine}`,
    ``,
    `If there's nothing available right now, I completely understand — I may need`,
    `to pause or cancel for now. Is there anything you can do to help me stay?`,
  ].join(" ").replace(/\s+\n\s+/g, "\n\n").trim()
}

// ============================================================================
// Static guidance content
// ============================================================================

/** Generic, service-agnostic cancellation steps. */
const CANCELLATION_STEPS: readonly string[] = [
  "Open the service's app or website and sign in to the account you pay from.",
  "Head to Account, Settings, Membership, or Subscription — that's usually where the plan lives.",
  "Look for “Cancel”, “Manage plan”, or “Turn off auto-renew”. It's sometimes tucked a click or two deep.",
  "Follow the steps and take a screenshot of the confirmation so you have a record.",
  "If they offer a retention deal (a discount or free month), it's totally fine to take it or decline it — your call.",
  "Check your next statement to make sure the charge actually stops.",
]

/** Gentle, shame-free reasons to keep. */
const REASONS_TO_KEEP: readonly string[] = [
  "You use it often and it genuinely makes your week better.",
  "It supports school, work, or a goal you care about.",
  "There's a student rate that makes it easy to justify.",
]

/** Gentle, shame-free reasons to cancel. */
const REASONS_TO_CANCEL: readonly string[] = [
  "You haven't opened it in a while and wouldn't miss it.",
  "Another service you already pay for does the same thing.",
  "The money would feel better in your daily allowance right now.",
]

// ============================================================================
// Small presentational helpers
// ============================================================================

/** A numbered step row used in the cancellation checklist. */
function StepRow({ index, text }: { index: number; text: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: borderRadius.full,
          background: "rgba(129, 140, 248, 0.16)",
          color: "var(--text)",
          fontSize: 12,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {index}
      </span>
      <p style={{ fontSize: 13.5, color: "var(--sub)", lineHeight: 1.5, margin: 0 }}>{text}</p>
    </div>
  )
}

/** A bulleted reason row (keep / cancel prompts). */
function ReasonRow({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: 14, lineHeight: 1.5 }} aria-hidden="true">{emoji}</span>
      <p style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.5, margin: 0 }}>{text}</p>
    </div>
  )
}

// ============================================================================
// CancelNegotiateHelper Component
// ============================================================================

/**
 * CancelNegotiateHelper — a DIY, no-concierge helper that empowers the student
 * to cancel or negotiate a subscription themselves. Adapted from Rocket Money's
 * paid cancel/negotiate concierge, but reworked for Folio's free, no-linking,
 * shame-free positioning: we hand the student the steps and the words, they
 * stay in control.
 *
 * Reachable from the Subscription Audit screen (per-subscription) and from the
 * Tools tab (generic). Never surfaced on the home screen (progressive disclosure).
 *
 * Validates: Requirements new
 */
export function CancelNegotiateHelper({ subscription, onClose }: CancelNegotiateHelperProps) {
  const { prefersReducedMotion } = useReducedMotion()
  const [mode, setMode] = useState<HelperMode>("negotiate")
  const [copied, setCopied] = useState(false)

  const script = useMemo(() => buildNegotiationScript(subscription), [subscription])
  const name = serviceName(subscription)
  const price = amountText(subscription)

  async function handleCopyScript() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(script)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Clipboard can be unavailable (permissions, insecure context). The
      // script stays visible on screen, so the student can still copy manually.
      setCopied(false)
    }
  }

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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <motion.button
          onClick={onClose}
          whileTap={!prefersReducedMotion ? { scale: 0.92 } : undefined}
          transition={springs.snappy}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border)",
            borderRadius: borderRadius.full,
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 18,
            color: "var(--text)",
          }}
          aria-label="Go back"
        >
          ←
        </motion.button>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          Cancel or negotiate
        </h2>
      </div>

      {/* ── Warm intro ─────────────────────────────────────────────── */}
      <p style={{ fontSize: 14, color: "var(--sub)", marginBottom: 20, lineHeight: 1.5 }}>
        You&apos;ve got this. Here&apos;s everything you need to lower a bill or cancel it yourself —
        no phone calls we make for you, no account linking, just the steps and the words.
      </p>

      {/* ── Subscription context (when opened from a specific one) ──── */}
      {subscription && (
        <GlassCard elevation="low" style={{ padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }} aria-hidden="true">{emojiForCategory(subscription.category)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>{name}</p>
              {price && (
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {price}<span style={{ marginLeft: 2 }}>/mo</span>
                </p>
              )}
            </div>
          </div>
          {subscription.studentDiscountHint && (
            <p style={{ fontSize: 12.5, color: "var(--sub)", marginTop: 10, lineHeight: 1.5 }}>
              💡 {subscription.studentDiscountHint}
            </p>
          )}
        </GlassCard>
      )}

      {/* ── Reasons to keep vs. cancel (gentle, shame-free) ────────── */}
      <GlassCard elevation="low" style={{ padding: "16px 20px", marginBottom: 20 }}>
        <p style={sectionHeader}>No wrong answer</p>
        <p style={{ fontSize: 13, color: "var(--sub)", marginTop: -4, marginBottom: 14, lineHeight: 1.5 }}>
          A quick gut-check before you decide — whatever feels right is the right call.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>Reasons to keep it</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REASONS_TO_KEEP.map((r) => <ReasonRow key={r} emoji="💜" text={r} />)}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>Reasons to let it go</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REASONS_TO_CANCEL.map((r) => <ReasonRow key={r} emoji="🍃" text={r} />)}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ── Mode switch ────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Choose a path"
        style={{ ...segmentedControl, marginBottom: 20 }}
      >
        <button
          role="tab"
          aria-selected={mode === "negotiate"}
          onClick={() => setMode("negotiate")}
          style={{
            ...segmentedButtonBase,
            ...(mode === "negotiate" ? segmentedButtonActive : segmentedButtonInactive),
          }}
        >
          💬 Negotiate
        </button>
        <button
          role="tab"
          aria-selected={mode === "cancel"}
          onClick={() => setMode("cancel")}
          style={{
            ...segmentedButtonBase,
            ...(mode === "cancel" ? segmentedButtonActive : segmentedButtonInactive),
          }}
        >
          ✂️ Cancel
        </button>
      </div>

      {/* ── Negotiate path ─────────────────────────────────────────── */}
      {mode === "negotiate" && (
        <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
          <p style={sectionHeader}>A friendly script to use</p>
          <p style={{ fontSize: 13, color: "var(--sub)", marginTop: -4, marginBottom: 14, lineHeight: 1.5 }}>
            Read it on a call or paste it into their chat. Companies would rather keep you than lose you,
            so it&apos;s very normal to just ask.
          </p>

          <div
            style={{
              padding: "14px 16px",
              borderRadius: borderRadius.md,
              background: "rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--border)",
              fontSize: 13.5,
              color: "var(--text)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {script}
          </div>

          <motion.button
            onClick={handleCopyScript}
            whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
            transition={springs.snappy}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "12px 0",
              background: copied ? "rgba(6, 214, 160, 0.14)" : "rgba(129, 140, 248, 0.16)",
              border: `1px solid ${copied ? "var(--success)" : "var(--border)"}`,
              borderRadius: borderRadius.md,
              color: copied ? "var(--success)" : "var(--text)",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: FONT_FAMILY,
              cursor: "pointer",
            }}
            aria-label={copied ? "Script copied to clipboard" : "Copy negotiation script"}
          >
            {copied ? "✓ Copied" : "Copy script"}
          </motion.button>

          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14, lineHeight: 1.5 }}>
            Tip: ask for retention or loyalty offers by name, and mention any student rate. If the
            first person can&apos;t help, it&apos;s okay to politely ask for the retention team.
          </p>
        </GlassCard>
      )}

      {/* ── Cancel path ────────────────────────────────────────────── */}
      {mode === "cancel" && (
        <GlassCard elevation="low" style={{ padding: "18px 20px" }}>
          <p style={sectionHeader}>Step-by-step cancel</p>
          <p style={{ fontSize: 13, color: "var(--sub)", marginTop: -4, marginBottom: 16, lineHeight: 1.5 }}>
            These steps work for just about any service. Take your time — you can always resubscribe later.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {CANCELLATION_STEPS.map((step, i) => (
              <StepRow key={step} index={i + 1} text={step} />
            ))}
          </div>

          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 16, lineHeight: 1.5 }}>
            Heads up: if you&apos;re still in a free trial, cancelling before the renewal date usually
            means you won&apos;t be charged — but you often keep access until the trial ends.
          </p>
        </GlassCard>
      )}
    </div>
  )
}
